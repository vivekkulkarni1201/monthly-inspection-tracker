const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const $ = id => document.getElementById(id);
let db = null;
let online = false;
let inspections = [];
let upsTypes = [];
let issueTypes = [];
let engineers = [];
let production = {};
let productChart, monthlyChart, issueChart;

const STORE = {
  inspections: "inspection_portal_inspections",
  types: "inspection_portal_types",
  issues: "inspection_portal_issues",
  engineers: "inspection_portal_engineers",
  production: "inspection_portal_production"
};

const defaults = {
  types:["EXL","Trinergy","POWERUPS","STS","HU","APM2","P9S","EXM2","APM+","SX+"],
  issues:["WT Meter Issue","DL950 Timestamp Mismatch","Waveform Sync Issue","Documentation Pending","Material Not Ready","Customer Reschedule","Modbus Alarm","Instrument Issue","Others"],
  engineers:["Darshan","Akshay","Khemraj","Hemant","Harshad"]
};

function localGet(k, fallback){try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback}}
function localSet(k,v){localStorage.setItem(k,JSON.stringify(v))}
function monthKey(d){ if(!d) return ""; return String(d).slice(0,7) }
function selectedMonth(){ return $("monthPicker").value }
function isoMonthLabel(k){ const [y,m]=k.split("-").map(Number); return `${MONTHS[m-1]} ${y}` }
function fmtDate(v){ if(!v) return "-"; const [y,m,d]=String(v).slice(0,10).split("-"); return `${d}-${MONTHS[+m-1].slice(0,3)}-${y}` }
function daysDelay(r){
  if(!r.planned_date) return 0;
  const end = r.actual_date || [r.revised_date_5,r.revised_date_4,r.revised_date_3,r.revised_date_2,r.revised_date_1].find(Boolean);
  if(!end) return 0;
  return Math.max(0,Math.round((new Date(end)-new Date(r.planned_date))/86400000));
}
function statusClass(s){ return "status st-"+(s||"Planned").replace(/\s+/g,"") }

async function init(){
  buildMonthPicker();
  const cfg = window.APP_CONFIG || {};
  online = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  if(online){
    db = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    await loadCloud();
    subscribeRealtime();
  } else {
    upsTypes = localGet(STORE.types, defaults.types);
    issueTypes = localGet(STORE.issues, defaults.issues);
    engineers = localGet(STORE.engineers, defaults.engineers);
    production = localGet(STORE.production,{});
    inspections = localGet(STORE.inspections,[]);
  }
  refreshMasters();
  render();
  bind();
  $("modeNote").textContent = online ? "LIVE ONLINE MODE • Supabase realtime connected" : "LOCAL DEMO MODE • Add Supabase details in Admin to make it multi-user and always online";
}

function buildMonthPicker(){
  const now = new Date();
  const year = 2026;
  $("monthPicker").innerHTML = MONTHS.map((m,i)=>`<option value="${year}-${String(i+1).padStart(2,"0")}">${m} ${year}</option>`).join("");
  $("monthPicker").value = `${year}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

async function loadCloud(){
  const [a,b,c,d,e] = await Promise.all([
    db.from("inspections").select("*").order("planned_date",{ascending:true}),
    db.from("ups_types").select("*").order("name"),
    db.from("issue_types").select("*").order("name"),
    db.from("engineers").select("*").order("name"),
    db.from("monthly_production").select("*")
  ]);
  if(a.error) throw a.error;
  inspections=a.data||[]; upsTypes=(b.data||[]).map(x=>x.name); issueTypes=(c.data||[]).map(x=>x.name); engineers=(d.data||[]).map(x=>x.name);
  production=Object.fromEntries((e.data||[]).map(x=>[x.month,x.manufactured_qty]));
}

function subscribeRealtime(){
  db.channel("inspection-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"inspections"},async()=>{await loadCloud();refreshMasters();render()})
    .on("postgres_changes",{event:"*",schema:"public",table:"monthly_production"},async()=>{await loadCloud();render()})
    .subscribe();
}

function bind(){
  $("monthPicker").onchange=render;
  $("filterType").onchange=renderTable; $("filterStatus").onchange=renderTable; $("filterIssue").onchange=renderTable; $("searchBox").oninput=renderTable;
  $("btnReset").onclick=()=>{$("filterType").value="";$("filterStatus").value="";$("filterIssue").value="";$("searchBox").value="";renderTable()};
  $("btnAdd").onclick=()=>openEntry();
  $("btnSaveEntry").onclick=saveEntry;
  $("btnAdmin").onclick=()=>{$("adminDialog").showModal();renderAdmin()};
  $("closeAdmin").onclick=()=>$("adminDialog").close();
  $("btnExport").onclick=exportExcel;
  $("addEngineer").onclick=()=>addMaster("engineer");
  $("addUpsType").onclick=()=>addMaster("type");
  $("addIssueType").onclick=()=>addMaster("issue");
  $("saveProduction").onclick=saveProduction;
  $("importHistory").onclick=importHistory;
  $("saveCloudConfig").onclick=()=>{localStorage.setItem("inspection_supabase_url",$("supabaseUrl").value.trim());localStorage.setItem("inspection_supabase_key",$("supabaseKey").value.trim());location.reload()};
}

function currentRows(){
  const m=selectedMonth();
  return inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m);
}
function offeredQty(rows){ return rows.reduce((s,r)=>s+(+r.qty||0),0) }
function sumStatus(rows,status){return rows.filter(r=>r.status===status).reduce((s,r)=>s+(+r.qty||0),0)}

function render(){
  const rows=currentRows();
  $("kpiManufactured").textContent=production[selectedMonth()]||0;
  $("kpiOffered").textContent=offeredQty(rows);
  $("kpiCompleted").textContent=sumStatus(rows,"Completed");
  $("kpiDelayed").textContent=sumStatus(rows,"Delayed");
  $("kpiCancelled").textContent=sumStatus(rows,"Cancelled");
  $("kpiWaiver").textContent=sumStatus(rows,"Waiver");
  renderTable(); renderCharts();
}

function filteredRows(){
  let rows=currentRows();
  const t=$("filterType").value, s=$("filterStatus").value, i=$("filterIssue").value, q=$("searchBox").value.trim().toLowerCase();
  if(t) rows=rows.filter(r=>r.ups_type===t); if(s) rows=rows.filter(r=>r.status===s); if(i) rows=rows.filter(r=>r.issue_type===i);
  if(q) rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  return rows;
}

function renderTable(){
  const rows=filteredRows();
  $("inspectionBody").innerHTML = rows.length ? rows.map((r,idx)=>`
    <tr>
      <td>${idx+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td>
      <td>${r.engineer||""}</td><td>${fmtDate(r.planned_date)}</td>
      <td>${fmtDate(r.revised_date_1)}</td><td>${fmtDate(r.revised_date_2)}</td><td>${fmtDate(r.revised_date_3)}</td><td>${fmtDate(r.revised_date_4)}</td><td>${fmtDate(r.revised_date_5)}</td>
      <td>${fmtDate(r.actual_date)}</td><td>${daysDelay(r)}</td><td><span class="${statusClass(r.status)}">${r.status||"Planned"}</span></td>
      <td>${r.issue_type||"-"}</td><td>${r.issue_at_time||"-"}</td><td>${r.remarks||"-"}</td>
      <td class="actions"><button onclick="editEntry('${r.id}')">✎</button><button onclick="deleteEntry('${r.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="19" style="text-align:center;padding:30px">No inspection entries for this month.</td></tr>`;
}

function refreshMasters(){
  const options=a=>`<option value="">-</option>`+a.map(x=>`<option>${x}</option>`).join("");
  $("filterType").innerHTML=`<option value="">All UPS Types</option>`+upsTypes.map(x=>`<option>${x}</option>`).join("");
  $("filterIssue").innerHTML=`<option value="">All Issue Types</option>`+issueTypes.map(x=>`<option>${x}</option>`).join("");
  $("upsType").innerHTML=options(upsTypes); $("issueType").innerHTML=options(issueTypes); $("engineer").innerHTML=options(engineers);
}

function openEntry(r=null){
  $("entryTitle").textContent=r?"Edit Inspection Entry":"Add Inspection Entry";
  $("entryId").value=r?.id||"";
  const map={customer:"customer_project",qty:"qty",kva:"kva_rating",upsType:"ups_type",engineer:"engineer",plannedDate:"planned_date",rev1:"revised_date_1",rev2:"revised_date_2",rev3:"revised_date_3",rev4:"revised_date_4",rev5:"revised_date_5",actualDate:"actual_date",status:"status",issueType:"issue_type",issueAtTime:"issue_at_time",remarks:"remarks"};
  for(const [id,key] of Object.entries(map)) $(id).value=r?.[key]??(id==="qty"?1:id==="status"?"Planned":"");
  $("entryDialog").showModal();
}
window.editEntry=id=>openEntry(inspections.find(r=>String(r.id)===String(id)));
window.deleteEntry=async id=>{
  if(!confirm("Delete this inspection entry?"))return;
  if(online){const {error}=await db.from("inspections").delete().eq("id",id);if(error)return alert(error.message)}
  else {inspections=inspections.filter(r=>String(r.id)!==String(id));localSet(STORE.inspections,inspections);render()}
};

async function saveEntry(){
  const obj={
    customer_project:$("customer").value.trim(),qty:+$("qty").value||1,kva_rating:+$("kva").value||null,ups_type:$("upsType").value||null,engineer:$("engineer").value||null,
    planned_date:$("plannedDate").value||null,revised_date_1:$("rev1").value||null,revised_date_2:$("rev2").value||null,revised_date_3:$("rev3").value||null,revised_date_4:$("rev4").value||null,revised_date_5:$("rev5").value||null,
    actual_date:$("actualDate").value||null,status:$("status").value,issue_type:$("issueType").value||null,issue_at_time:$("issueAtTime").value.trim()||null,remarks:$("remarks").value.trim()||null,
    updated_at:new Date().toISOString()
  };
  if(!obj.customer_project) return alert("Customer / Project is required.");
  const id=$("entryId").value;
  if(online){
    const q=id?db.from("inspections").update(obj).eq("id",id):db.from("inspections").insert(obj);
    const {error}=await q;if(error)return alert(error.message);await loadCloud();
  } else {
    if(id){const ix=inspections.findIndex(r=>String(r.id)===String(id));inspections[ix]={...inspections[ix],...obj}}
    else inspections.push({...obj,id:crypto.randomUUID(),created_at:new Date().toISOString()});
    localSet(STORE.inspections,inspections);
  }
  $("entryDialog").close();render();
}

function renderCharts(){
  const rows=currentRows();
  const prodMap={}; rows.forEach(r=>prodMap[r.ups_type||"Unknown"]=(prodMap[r.ups_type||"Unknown"]||0)+(+r.qty||0));
  const issueMap={}; rows.filter(r=>r.issue_type).forEach(r=>issueMap[r.issue_type]=(issueMap[r.issue_type]||0)+(+r.qty||0));
  const months=MONTHS.map((m,i)=>`2026-${String(i+1).padStart(2,"0")}`);
  const manufactured=months.map(m=>+production[m]||0);
  const offered=months.map(m=>offeredQty(inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m)));

  productChart?.destroy(); monthlyChart?.destroy(); issueChart?.destroy();
  productChart=new Chart($("productChart"),{type:"doughnut",data:{labels:Object.keys(prodMap),datasets:[{data:Object.values(prodMap)}]},options:{plugins:{legend:{labels:{color:"#dfeeff"}}}}});
  issueChart=new Chart($("issueChart"),{type:"bar",data:{labels:Object.keys(issueMap),datasets:[{label:"Qty",data:Object.values(issueMap)}]},options:{indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#cbd8e5"}},y:{ticks:{color:"#cbd8e5"}}}}});
  monthlyChart=new Chart($("monthlyChart"),{
    type:"bar",
    data:{labels:MONTHS,datasets:[
      {label:"Total UPS Manufactured",data:manufactured,backgroundColor:"rgba(170,190,210,.55)",barPercentage:.9,categoryPercentage:.82,order:2},
      {label:"Offered for Inspection",data:offered,backgroundColor:"rgba(18,152,255,.9)",barPercentage:.52,categoryPercentage:.82,order:1}
    ]},
    options:{responsive:true,plugins:{legend:{labels:{color:"#dfeeff"}}},scales:{x:{stacked:false,ticks:{color:"#cbd8e5"}},y:{beginAtZero:true,ticks:{color:"#cbd8e5"}}}}
  });
}

function renderAdmin(){
  $("supabaseUrl").value=localStorage.getItem("inspection_supabase_url")||"";
  $("supabaseKey").value=localStorage.getItem("inspection_supabase_key")||"";
  $("engineerList").innerHTML=masterHtml(engineers,"engineer");
  $("upsTypeList").innerHTML=masterHtml(upsTypes,"type");
  $("issueTypeList").innerHTML=masterHtml(issueTypes,"issue");
  $("productionRows").innerHTML=MONTHS.map((m,i)=>{const k=`2026-${String(i+1).padStart(2,"0")}`;return `<div class="prod-row"><span>${m}</span><input type="number" min="0" data-month="${k}" value="${production[k]||0}"></div>`}).join("");
}
function masterHtml(arr,kind){return arr.map(x=>`<div class="master-item"><span>${x}</span><button onclick="removeMaster('${kind}','${String(x).replaceAll("'","\\'")}')">Delete</button></div>`).join("")}
window.removeMaster=async(kind,name)=>{
  const table=kind==="engineer"?"engineers":kind==="type"?"ups_types":"issue_types";
  if(online){await db.from(table).delete().eq("name",name);await loadCloud()}
  else {
    if(kind==="engineer"){engineers=engineers.filter(x=>x!==name);localSet(STORE.engineers,engineers)}
    if(kind==="type"){upsTypes=upsTypes.filter(x=>x!==name);localSet(STORE.types,upsTypes)}
    if(kind==="issue"){issueTypes=issueTypes.filter(x=>x!==name);localSet(STORE.issues,issueTypes)}
  }
  refreshMasters();renderAdmin();render();
};

async function addMaster(kind){
  const input=kind==="engineer"?$("newEngineer"):kind==="type"?$("newUpsType"):$("newIssueType");
  const name=input.value.trim(); if(!name)return;
  const table=kind==="engineer"?"engineers":kind==="type"?"ups_types":"issue_types";
  if(online){const {error}=await db.from(table).insert({name});if(error&&error.code!=="23505")return alert(error.message);await loadCloud()}
  else {
    if(kind==="engineer"&&!engineers.includes(name)){engineers.push(name);localSet(STORE.engineers,engineers)}
    if(kind==="type"&&!upsTypes.includes(name)){upsTypes.push(name);localSet(STORE.types,upsTypes)}
    if(kind==="issue"&&!issueTypes.includes(name)){issueTypes.push(name);localSet(STORE.issues,issueTypes)}
  }
  input.value="";refreshMasters();renderAdmin();
}

async function saveProduction(){
  const rows=[...$("productionRows").querySelectorAll("input[data-month]")].map(x=>({month:x.dataset.month,manufactured_qty:+x.value||0}));
  if(online){
    const {error}=await db.from("monthly_production").upsert(rows);if(error)return alert(error.message);await loadCloud()
  } else {production=Object.fromEntries(rows.map(x=>[x.month,x.manufactured_qty]));localSet(STORE.production,production)}
  render();alert("Monthly production saved.");
}

function parseExcelDate(v){
  if(!v)return null;
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:null}
  const s=String(v).trim();
  const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10);
}
async function importHistory(){
  const f=$("historyFile").files[0];if(!f)return alert("Choose an Excel file.");
  $("importStatus").textContent="Reading workbook...";
  const wb=XLSX.read(await f.arrayBuffer(),{type:"array",cellDates:true});
  let imported=[];
  for(const sn of wb.SheetNames.filter(n=>/Inspection Schedule -/i.test(n))){
    const ws=wb.Sheets[sn]; const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    let header=-1;
    for(let r=0;r<Math.min(15,data.length);r++){if(String(data[r]?.[0]||"").includes("Sr. No")){header=r;break}}
    if(header<0)continue;
    for(let r=header+2;r<data.length;r++){
      const row=data[r]; if(!row||!row[1])continue;
      const customer=String(row[1]||"").trim(); if(!customer)continue;
      const qty=+row[2]||1,kva=+row[3]||null,type=row[4]?String(row[4]).trim():null;
      const engineer=row[5]?String(row[5]).trim():(row[6]?String(row[6]).trim():null);
      const planned=parseExcelDate(row[11]??row[12]);
      const revised=[12,13,14,15,16].map(ix=>parseExcelDate(row[ix]));
      const actual=parseExcelDate(row[17]??row[18]);
      const remarks=row[8]?String(row[8]):null;
      const waiver=String(row[6]??row[7]??"").toLowerCase()==="yes";
      const cancelled=String(row[19]??row[20]??"").toLowerCase()==="yes";
      let status="Planned";
      if(cancelled)status="Cancelled"; else if(waiver)status="Waiver"; else if(actual) status=(planned&&actual>planned)?"Delayed":"Completed";
      imported.push({customer_project:customer,qty,kva_rating:kva,ups_type:type,engineer,planned_date:planned,
        revised_date_1:revised[0],revised_date_2:revised[1],revised_date_3:revised[2],revised_date_4:revised[3],revised_date_5:revised[4],
        actual_date:actual,status,remarks});
    }
  }
  if(!imported.length){$("importStatus").textContent="No historical rows found.";return}
  if(online){
    const batch=100;for(let i=0;i<imported.length;i+=batch){const {error}=await db.from("inspections").insert(imported.slice(i,i+batch));if(error){$("importStatus").textContent=error.message;return}}
    await loadCloud();
  } else {inspections.push(...imported.map(x=>({...x,id:crypto.randomUUID()})));localSet(STORE.inspections,inspections)}
  $("importStatus").textContent=`Imported ${imported.length} inspection rows.`;render();
}

function exportExcel(){
  const rows=filteredRows().map((r,i)=>({
    "Sr No":i+1,"Customer / Project":r.customer_project,"Qty":r.qty,"kVA Rating":r.kva_rating,"UPS Type":r.ups_type,
    "Inspection Given By":r.engineer,"Planned Date":r.planned_date,"Revised Date 1":r.revised_date_1,"Revised Date 2":r.revised_date_2,
    "Revised Date 3":r.revised_date_3,"Revised Date 4":r.revised_date_4,"Revised Date 5":r.revised_date_5,
    "Actual Inspection Date":r.actual_date,"No. of Days / Delay":daysDelay(r),"Status":r.status,"Issue Type":r.issue_type,
    "Issue at the Time":r.issue_at_time,"Remarks":r.remarks
  }));
  const ws=XLSX.utils.json_to_sheet(rows), wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inspection");XLSX.writeFile(wb,`Inspection_${selectedMonth()}.xlsx`);
}

init().catch(e=>{console.error(e);alert("Portal start error: "+e.message)});
