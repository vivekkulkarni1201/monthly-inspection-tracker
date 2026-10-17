
const $=id=>document.getElementById(id);
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS=[2024,2025,2026];

let db=null,online=false;
let inspections=[],upsTypes=[],issueTypes=[],engineers=[],production={};
let historySummaries=[],historyProducts=[],historyIssues=[],inspectionIssues=[],inspectionRevisions=[];
let deferredInstallPrompt=null;

function toast(msg,bad=false){
  const t=$("toast"); if(!t)return;
  t.textContent=msg;t.className=bad?"show bad":"show";setTimeout(()=>t.className="",2600)
}
function cleanUrl(v){return String(v||"").trim().replace(/^SUPABASE_URL\s*=\s*/i,"").replace(/^["']|["']$/g,"").replace(/\/+$/,"")}
function cleanKey(v){return String(v||"").trim().replace(/^SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*=\s*/i,"").replace(/^["']|["']$/g,"")}
function monthKey(v){return v?String(v).slice(0,7):""}
function fmtDate(v){if(!v)return"-";const [y,m,d]=String(v).slice(0,10).split("-");return `${d}-${MONTHS[+m-1].slice(0,3)}-${y}`}
function fmtMonthKey(v){if(!v)return"-";const [y,m]=String(v).split("-").map(Number);return `${MONTHS[m-1]} ${y}`}
function daysBetween(a,b){if(!a||!b)return 0;return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000))}
function currentMonthKey(){
  const sel=$("monthPicker");if(sel?.value)return sel.value;
  return `2026-${String(new Date().getMonth()+1).padStart(2,"0")}`
}
function buildMonthPicker(){
  const el=$("monthPicker");if(!el)return;
  el.innerHTML=YEARS.flatMap(y=>MONTHS.map((m,i)=>`<option value="${y}-${String(i+1).padStart(2,"0")}">${m} ${y}</option>`)).join("");
  const now=new Date();
  el.value=(now.getFullYear()>=2024&&now.getFullYear()<=2026)?`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`:"2026-10";
}
function initPrettyMonthPicker(onChange){
  const control=$("monthControl"),button=$("monthButton"),menu=$("monthMenu"),select=$("monthPicker");
  if(!control||!button||!menu||!select)return;
  menu.innerHTML=YEARS.slice().reverse().map(y=>`<div class="month-year-group"><div class="month-year-title">${y}</div>${MONTHS.map((m,i)=>{const value=`${y}-${String(i+1).padStart(2,"0")}`;return `<button type="button" class="month-option" data-value="${value}">${m}</button>`}).join("")}</div>`).join("");
  const sync=()=>{
    button.querySelector("span").textContent=select.selectedOptions[0]?.textContent||"Select month";
    menu.querySelectorAll(".month-option").forEach(x=>x.classList.toggle("active",x.dataset.value===select.value));
  };
  button.onclick=(e)=>{e.stopPropagation();control.classList.toggle("open")};
  menu.querySelectorAll(".month-option").forEach(x=>x.onclick=()=>{select.value=x.dataset.value;control.classList.remove("open");sync();onChange?.()});
  document.addEventListener("click",(e)=>{if(!control.contains(e.target))control.classList.remove("open")});
  sync();
}
async function optionalTable(table,orderColumn){
  try{
    let q=db.from(table).select("*");if(orderColumn)q=q.order(orderColumn,{ascending:true});
    const r=await q;if(r.error)return [];return r.data||[];
  }catch{return []}
}
async function initCloud(){
  const url=cleanUrl(window.APP_CONFIG?.SUPABASE_URL||""),key=cleanKey(window.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY||"");
  if(!url||!key||!window.supabase)throw new Error("Supabase config missing");
  db=window.supabase.createClient(url,key);await loadAll();online=true;updateLiveBadge()
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
  inspections=a.data||[];upsTypes=(b.data||[]).map(x=>x.name);issueTypes=(c.data||[]).map(x=>x.name);engineers=(d.data||[]).map(x=>x.name);
  production=Object.fromEntries((e.data||[]).map(x=>[x.month,+x.manufactured_qty||0]));
  [historySummaries,historyProducts,historyIssues,inspectionIssues,inspectionRevisions]=await Promise.all([
    optionalTable("monthly_history","month"),optionalTable("monthly_history_products","month"),optionalTable("monthly_history_issues","month"),
    optionalTable("inspection_issues","id"),optionalTable("inspection_revisions","id")
  ]);
}
function updateLiveBadge(){
  const t=$("liveText"),s=$("liveSub"),d=$("liveDot");
  if(t)t.textContent=online?"Live Online":"Offline";if(s)s.textContent=online?"Supabase realtime":"Connection problem";if(d)d.style.background=online?"#2bd47f":"#ffae17"
}
function subscribe(table,callback){
  if(!online)return;
  db.channel(`ch_${table}_${Math.random()}`).on("postgres_changes",{event:"*",schema:"public",table},async()=>{await loadAll();callback?.()}).subscribe()
}
function navLink(active){document.querySelectorAll(".nav").forEach(a=>a.classList.remove("active"));document.querySelector(`[data-page="${active}"]`)?.classList.add("active")}
function fillMasterSelect(id,arr,allLabel){const el=$(id);if(!el)return;el.innerHTML=(allLabel?`<option value="">${allLabel}</option>`:`<option value="">-</option>`)+arr.map(x=>`<option>${x}</option>`).join("")}

function eventKeyFor(r){return r.event_key||`ROW-${r.id}`}
function rowsForMonth(m){return inspections.filter(r=>(r.schedule_month||monthKey(r.planned_date||r.actual_date))===m)}
function currentRows(){return rowsForMonth(currentMonthKey())}
function groupEvents(rows){
  const map=new Map();rows.forEach(r=>{const k=eventKeyFor(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)});return [...map.entries()]
}
function groupOutcome(rows){
  const sts=new Set(rows.map(r=>r.status||"Planned"));
  if(sts.has("Cancelled"))return"Cancelled";
  if(sts.has("Waiver"))return"Waiver";
  if([...sts].every(x=>x==="Completed"))return"Completed";
  return"Planned";
}
function revisionsForEvent(eventKey){return inspectionRevisions.filter(x=>x.event_key===eventKey)}
function issuesForEvent(eventKey){return inspectionIssues.filter(x=>x.event_key===eventKey)}
function latestRevision(eventKey){
  const arr=revisionsForEvent(eventKey).filter(x=>x.revised_date).sort((a,b)=>String(a.revised_date).localeCompare(String(b.revised_date)));return arr.at(-1)||null
}
function eventIsDelayed(eventKey,rows){
  return revisionsForEvent(eventKey).length>0 || rows.some(r=>r.legacy_delayed===true || r.status==="Delayed")
}
function eventDelayDays(eventKey,rows){
  const planned=rows.map(r=>r.planned_date).filter(Boolean).sort()[0];
  const latest=latestRevision(eventKey)?.revised_date || rows.map(r=>r.actual_date).filter(Boolean).sort().at(-1);
  return daysBetween(planned,latest)
}
function qtySum(rows){return rows.reduce((s,r)=>s+(+r.qty||0),0)}
function historyForMonth(m){return historySummaries.find(x=>x.month===m)||null}
function monthSnapshot(m){
  const rows=rowsForMonth(m),groups=groupEvents(rows),hist=historyForMonth(m);
  if(rows.length){
    let completed=0,cancelled=0,waiver=0,delayed=0,revisions=0;
    groups.forEach(([k,rs])=>{
      const outcome=groupOutcome(rs);if(outcome==="Completed")completed++;if(outcome==="Cancelled")cancelled++;if(outcome==="Waiver")waiver++;
      if(eventIsDelayed(k,rs))delayed++;revisions+=revisionsForEvent(k).length;
    });
    return{source:"live",month:m,manufactured:+production[m]||+(hist?.manufactured_qty||0),offered:qtySum(rows),planned_inspections:groups.length,completed,delayed,cancelled,waiver,revisions}
  }
  if(hist)return{source:"history",month:m,manufactured:+hist.manufactured_qty||0,offered:+hist.ups_offered||0,planned_inspections:+hist.planned_inspections||0,completed:+hist.completed_inspections||0,delayed:+hist.delayed_qty||0,cancelled:+hist.cancelled_qty||0,waiver:+hist.waiver_qty||0,revisions:+hist.revision_count||0};
  return{source:"empty",month:m,manufactured:+production[m]||0,offered:0,planned_inspections:0,completed:0,delayed:0,cancelled:0,waiver:0,revisions:0}
}
function productBreakdown(m){
  const rows=rowsForMonth(m);if(rows.length){const map={};rows.forEach(r=>map[r.ups_type||"Unknown"]=(map[r.ups_type||"Unknown"]||0)+(+r.qty||0));return map}
  const map={};historyProducts.filter(x=>x.month===m).forEach(x=>map[x.ups_type]=(map[x.ups_type]||0)+(+x.qty||0));return map
}
function issueBreakdown(m){
  const rows=rowsForMonth(m);
  if(rows.length){
    const keys=new Set(groupEvents(rows).map(([k])=>k)),map={};
    inspectionIssues.filter(x=>keys.has(x.event_key)&&x.issue_type).forEach(x=>{map[x.issue_type]=(map[x.issue_type]||0)+Math.max(1,+x.occurrence_count||1)});
    return map
  }
  const map={};historyIssues.filter(x=>x.month===m&&x.issue_type).forEach(x=>map[x.issue_type]=(map[x.issue_type]||0)+(+x.qty||0));return map
}
function yearlySnapshots(year){return MONTHS.map((_,i)=>monthSnapshot(`${year}-${String(i+1).padStart(2,"0")}`))}
function yearlyIssueTotal(year){return MONTHS.reduce((s,_,i)=>s+Object.values(issueBreakdown(`${year}-${String(i+1).padStart(2,"0")}`)).reduce((a,b)=>a+b,0),0)}

function setupPWA(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;document.querySelectorAll(".pwa-install").forEach(b=>b.hidden=false)});
  document.querySelectorAll(".pwa-install").forEach(btn=>btn.onclick=async()=>{if(!deferredInstallPrompt)return toast("App install is available from your browser menu if already installed or the prompt is hidden.");deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;btn.hidden=true})
}
setupPWA();
