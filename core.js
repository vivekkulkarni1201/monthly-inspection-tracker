
const $=id=>document.getElementById(id);
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS=[2024,2025,2026];

let db=null,online=false;
let inspections=[],upsTypes=[],issueTypes=[],engineers=[],production={};
let historySummaries=[],historyProducts=[],historyIssues=[];

function toast(msg,bad=false){
  const t=$("toast"); if(!t)return;
  t.textContent=msg;t.className=bad?"show bad":"show";
  setTimeout(()=>t.className="",2500)
}
function cleanUrl(v){return String(v||"").trim().replace(/^SUPABASE_URL\s*=\s*/i,"").replace(/^["']|["']$/g,"").replace(/\/+$/,"")}
function cleanKey(v){return String(v||"").trim().replace(/^SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*=\s*/i,"").replace(/^["']|["']$/g,"")}
function monthKey(v){return v?String(v).slice(0,7):""}
function fmtDate(v){if(!v)return"-";const [y,m,d]=String(v).slice(0,10).split("-");return `${d}-${MONTHS[+m-1].slice(0,3)}-${y}`}
function fmtMonthKey(v){
  if(!v)return"-";
  const [y,m]=String(v).split("-").map(Number);
  return `${MONTHS[m-1]} ${y}`;
}
function daysDelay(r){
  if(!r.planned_date)return 0;
  const end=r.actual_date||[r.revised_date_5,r.revised_date_4,r.revised_date_3,r.revised_date_2,r.revised_date_1].find(Boolean);
  if(!end)return 0;
  return Math.max(0,Math.round((new Date(end)-new Date(r.planned_date))/86400000))
}
function currentMonthKey(){
  const sel=$("monthPicker"); if(sel?.value)return sel.value;
  return `2026-${String(new Date().getMonth()+1).padStart(2,"0")}`
}
function buildMonthPicker(){
  const el=$("monthPicker"); if(!el)return;
  el.innerHTML=YEARS.flatMap(y=>MONTHS.map((m,i)=>`<option value="${y}-${String(i+1).padStart(2,"0")}">${m} ${y}</option>`)).join("");
  const now=new Date();
  const desired=(now.getFullYear()>=2024&&now.getFullYear()<=2026)?`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`:"2026-10";
  el.value=desired;
}
function initPrettyMonthPicker(onChange){
  const control=$("monthControl"),button=$("monthButton"),menu=$("monthMenu"),select=$("monthPicker");
  if(!control||!button||!menu||!select)return;
  menu.innerHTML=YEARS.slice().reverse().map(y=>`
    <div class="month-year-group">
      <div class="month-year-title">${y}</div>
      ${MONTHS.map((m,i)=>{
        const value=`${y}-${String(i+1).padStart(2,"0")}`;
        return `<button type="button" class="month-option" data-value="${value}">${m}</button>`;
      }).join("")}
    </div>`).join("");
  const sync=()=>{
    const text=select.selectedOptions[0]?.textContent||"Select month";
    button.querySelector("span").textContent=text;
    menu.querySelectorAll(".month-option").forEach(x=>x.classList.toggle("active",x.dataset.value===select.value));
  };
  button.onclick=(e)=>{e.stopPropagation();control.classList.toggle("open")};
  menu.querySelectorAll(".month-option").forEach(x=>{
    x.onclick=()=>{
      select.value=x.dataset.value;
      control.classList.remove("open");
      sync();
      onChange?.();
    };
  });
  document.addEventListener("click",(e)=>{if(!control.contains(e.target))control.classList.remove("open")});
  sync();
}
async function initCloud(){
  const url=cleanUrl(window.APP_CONFIG?.SUPABASE_URL||"");
  const key=cleanKey(window.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY||"");
  if(!url||!key||!window.supabase)throw new Error("Supabase config missing");
  db=window.supabase.createClient(url,key);
  await loadAll();
  online=true;
  updateLiveBadge();
}
async function optionalTable(table,orderColumn){
  try{
    let q=db.from(table).select("*");
    if(orderColumn)q=q.order(orderColumn,{ascending:true});
    const r=await q;
    if(r.error)return [];
    return r.data||[];
  }catch{return []}
}
async function loadAll(){
  const [a,b,c,d,e]=await Promise.all([
    db.from("inspections").select("*").order("planned_date",{ascending:true}),
    db.from("ups_types").select("*").order("name"),
    db.from("issue_types").select("*").order("name"),
    db.from("engineers").select("*").order("name"),
    db.from("monthly_production").select("*")
  ]);
  for(const r of [a,b,c,d,e])if(r.error)throw r.error;
  inspections=a.data||[];
  upsTypes=(b.data||[]).map(x=>x.name);
  issueTypes=(c.data||[]).map(x=>x.name);
  engineers=(d.data||[]).map(x=>x.name);
  production=Object.fromEntries((e.data||[]).map(x=>[x.month,+x.manufactured_qty||0]));

  [historySummaries,historyProducts,historyIssues]=await Promise.all([
    optionalTable("monthly_history","month"),
    optionalTable("monthly_history_products","month"),
    optionalTable("monthly_history_issues","month")
  ]);
}
function updateLiveBadge(){
  const t=$("liveText"),s=$("liveSub"),d=$("liveDot");
  if(t)t.textContent=online?"Live Online":"Offline";
  if(s)s.textContent=online?"Supabase realtime":"Connection problem";
  if(d)d.style.background=online?"#2bd47f":"#ffae17";
}
function subscribe(table,callback){
  if(!online)return;
  db.channel(`ch_${table}_${Math.random()}`)
    .on("postgres_changes",{event:"*",schema:"public",table},async()=>{await loadAll();callback?.()})
    .subscribe();
}
function rowsForMonth(m){return inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m)}
function currentRows(){return rowsForMonth(currentMonthKey())}
function qtySum(rows){return rows.reduce((s,r)=>s+(+r.qty||0),0)}
function statusQty(rows,status){return rows.filter(r=>r.status===status).reduce((s,r)=>s+(+r.qty||0),0)}
function historyForMonth(m){return historySummaries.find(x=>x.month===m)||null}
function monthSnapshot(m){
  const rows=rowsForMonth(m),hist=historyForMonth(m);
  if(rows.length){
    return {
      source:"live",
      month:m,
      planned_inspections:rows.length,
      completed_inspections:rows.filter(r=>["Completed","Delayed"].includes(r.status)).length,
      manufactured:+production[m]||+(hist?.manufactured_qty||0),
      offered:qtySum(rows),
      completed:statusQty(rows,"Completed"),
      delayed:statusQty(rows,"Delayed"),
      cancelled:statusQty(rows,"Cancelled"),
      waiver:statusQty(rows,"Waiver")
    };
  }
  if(hist){
    return {
      source:"history",
      month:m,
      planned_inspections:+hist.planned_inspections||0,
      completed_inspections:+hist.completed_inspections||0,
      manufactured:+hist.manufactured_qty||0,
      offered:+hist.ups_offered||0,
      completed:+hist.ups_completed||0,
      delayed:+hist.delayed_qty||0,
      cancelled:+hist.cancelled_qty||0,
      waiver:+hist.waiver_qty||0
    };
  }
  return {source:"empty",month:m,planned_inspections:0,completed_inspections:0,manufactured:+production[m]||0,offered:0,completed:0,delayed:0,cancelled:0,waiver:0};
}
function productBreakdown(m){
  const rows=rowsForMonth(m);
  if(rows.length){
    const map={};rows.forEach(r=>map[r.ups_type||"Unknown"]=(map[r.ups_type||"Unknown"]||0)+(+r.qty||0));return map;
  }
  const map={};historyProducts.filter(x=>x.month===m).forEach(x=>map[x.ups_type]=(map[x.ups_type]||0)+(+x.qty||0));return map;
}
function issueBreakdown(m){
  const rows=rowsForMonth(m);
  if(rows.length){
    const map={};rows.filter(r=>r.issue_type).forEach(r=>map[r.issue_type]=(map[r.issue_type]||0)+(+r.qty||0));return map;
  }
  const map={};historyIssues.filter(x=>x.month===m).forEach(x=>map[x.issue_type]=(map[x.issue_type]||0)+(+x.qty||0));return map;
}
function fillMasterSelect(id,arr,allLabel){
  const el=$(id);if(!el)return;
  el.innerHTML=(allLabel?`<option value="">${allLabel}</option>`:`<option value="">-</option>`)+arr.map(x=>`<option>${x}</option>`).join("")
}
function navLink(active){
  document.querySelectorAll(".nav").forEach(a=>a.classList.remove("active"));
  const el=document.querySelector(`[data-page="${active}"]`); if(el)el.classList.add("active")
}
