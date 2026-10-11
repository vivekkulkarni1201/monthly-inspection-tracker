
const $=id=>document.getElementById(id);
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
let db=null,online=false;
let inspections=[],upsTypes=[],issueTypes=[],engineers=[],production={};

function toast(msg,bad=false){
  const t=$("toast"); if(!t)return;
  t.textContent=msg;t.className=bad?"show bad":"show";
  setTimeout(()=>t.className="",2500)
}
function cleanUrl(v){return String(v||"").trim().replace(/^SUPABASE_URL\s*=\s*/i,"").replace(/^["']|["']$/g,"").replace(/\/+$/,"")}
function cleanKey(v){return String(v||"").trim().replace(/^SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*=\s*/i,"").replace(/^["']|["']$/g,"")}
function monthKey(v){return v?String(v).slice(0,7):""}
function fmtDate(v){if(!v)return"-";const [y,m,d]=String(v).slice(0,10).split("-");return `${d}-${MONTHS[+m-1].slice(0,3)}-${y}`}
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
  el.innerHTML=MONTHS.map((m,i)=>`<option value="2026-${String(i+1).padStart(2,"0")}">${m} 2026</option>`).join("");
  el.value=`2026-${String(new Date().getMonth()+1).padStart(2,"0")}`;
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
function currentRows(){
  const m=currentMonthKey();
  return inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m)
}
function qtySum(rows){return rows.reduce((s,r)=>s+(+r.qty||0),0)}
function statusQty(rows,status){return rows.filter(r=>r.status===status).reduce((s,r)=>s+(+r.qty||0),0)}
function fillMasterSelect(id,arr,allLabel){
  const el=$(id);if(!el)return;
  el.innerHTML=(allLabel?`<option value="">${allLabel}</option>`:`<option value="">-</option>`)+arr.map(x=>`<option>${x}</option>`).join("")
}
function navLink(active){
  document.querySelectorAll(".nav").forEach(a=>a.classList.remove("active"));
  const el=document.querySelector(`[data-page="${active}"]`); if(el)el.classList.add("active")
}
