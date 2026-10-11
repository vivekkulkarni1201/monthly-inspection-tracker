const $=id=>document.getElementById(id);
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const STORE={inspections:"it_inspections",types:"it_types",issues:"it_issues",engineers:"it_engineers",production:"it_production"};
const defaults={types:["EXL","Trinergy","POWERUPS","STS"],issues:["WT Meter Issue","DL950 Timestamp Mismatch","Waveform Sync Issue","Documentation Pending","Material Not Ready","Customer Reschedule","Modbus Alarm","Instrument Issue","Others"],engineers:["Darshan","Akshay","Khemraj","Hemant","Harshad"]};
let online=false,db=null,inspections=[],upsTypes=[],issueTypes=[],engineers=[],production={};
let productChart,monthlyChart,issueChart;

const getLocal=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const setLocal=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const monthKey=v=>v?String(v).slice(0,7):"";
const selectedMonth=()=>$("monthPicker").value;
const toast=(m,bad=false)=>{const t=$("toast");t.textContent=m;t.className=bad?"show badtoast":"show";setTimeout(()=>t.className="",2600)};
function sanitizeEnv(v,name){
  v=String(v||"").trim();
  const rx=new RegExp("^"+name+"\\s*=\\s*","i");v=v.replace(rx,"").trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  return v.trim();
}
function cleanUrl(v){return sanitizeEnv(v,"SUPABASE_URL").replace(/\/+$/,"")}
function cleanKey(v){
  v=sanitizeEnv(v,"SUPABASE_PUBLISHABLE_KEY");
  v=sanitizeEnv(v,"SUPABASE_ANON_KEY");
  return v;
}
function validUrl(v){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(v)}
function validKey(v){return /^sb_publishable_[A-Za-z0-9_-]+$/.test(v)||/^eyJ[A-Za-z0-9_-]+\./.test(v)}

function showConnectionProblem(msg){
  $("connectionBanner").classList.remove("hidden");$("connectionMsg").textContent=msg;
  $("liveText").textContent="Connection Error";$("liveSub").textContent="Using local data";$("liveDot").style.background="#ffae17";
}
function clearConnectionProblem(){$("connectionBanner").classList.add("hidden")}

async function init(){
  buildMonthPicker();
  const cfg=window.APP_CONFIG||{};
  let url=cleanUrl(cfg.SUPABASE_URL||""), key=cleanKey(cfg.SUPABASE_PUBLISHABLE_KEY||"");
  if(url||key){
    if(!validUrl(url)||!validKey(key)){
      showConnectionProblem("Saved Supabase URL/key format is invalid. Open Admin and paste only Project URL + Publishable key.");
      loadLocal();
    }else{
      try{
        db=window.supabase.createClient(url,key);
        await loadCloud();
        online=true;clearConnectionProblem();subscribeRealtime();
      }catch(e){
        console.error(e);showConnectionProblem(e.message||"Unable to connect to Supabase.");loadLocal();
      }
    }
  } else loadLocal();

  refreshMasters();bind();render();
  updateMode();
}
function loadLocal(){online=false;upsTypes=getLocal(STORE.types,defaults.types);issueTypes=getLocal(STORE.issues,defaults.issues);engineers=getLocal(STORE.engineers,defaults.engineers);production=getLocal(STORE.production,{});inspections=getLocal(STORE.inspections,[])}
function updateMode(){
  if(online){$("liveText").textContent="Live Online";$("liveSub").textContent="Supabase realtime";$("liveDot").style.background="#29d17d";$("modeNote").textContent="LIVE ONLINE MODE • Changes are stored in Supabase and shared with the team."}
  else{$("modeNote").textContent="LOCAL MODE • Open Admin to connect Supabase for team-wide realtime updates."}
}
function buildMonthPicker(){
  const y=2026;$("monthPicker").innerHTML=MONTHS.map((m,i)=>`<option value="${y}-${String(i+1).padStart(2,"0")}">${m} ${y}</option>`).join("");
  $("monthPicker").value=`${y}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
}
async function loadCloud(){
  const [a,b,c,d,e]=await Promise.all([
    db.from("inspections").select("*").order("planned_date",{ascending:true}),
    db.from("ups_types").select("*").order("name"),
    db.from("issue_types").select("*").order("name"),
    db.from("engineers").select("*").order("name"),
    db.from("monthly_production").select("*")
  ]);
  for(const r of [a,b,c,d,e])if(r.error)throw r.error;
  inspections=a.data||[];upsTypes=(b.data||[]).map(x=>x.name);issueTypes=(c.data||[]).map(x=>x.name);engineers=(d.data||[]).map(x=>x.name);production=Object.fromEntries((e.data||[]).map(x=>[x.month,x.manufactured_qty]));
}
function subscribeRealtime(){
  db.channel("inspection-live")
   .on("postgres_changes",{event:"*",schema:"public",table:"inspections"},async()=>{await loadCloud();refreshMasters();render()})
   .on("postgres_changes",{event:"*",schema:"public",table:"monthly_production"},async()=>{await loadCloud();render()})
   .subscribe();
}
function bind(){
  $("monthPicker").onchange=render;$("filterType").onchange=renderTable;$("filterStatus").onchange=renderTable;$("filterIssue").onchange=renderTable;$("searchBox").oninput=renderTable;
  $("btnReset").onclick=()=>{$("filterType").value="";$("filterStatus").value="";$("filterIssue").value="";$("searchBox").value="";renderTable()};
  $("btnAdd").onclick=()=>openEntry();$("btnAdd2").onclick=()=>openEntry();
  $("btnAdmin").onclick=openAdmin;$("sideAdmin").onclick=openAdmin;$("fixConnection").onclick=openAdmin;
  $("closeAdmin").onclick=()=>$("adminDialog").close();$("btnSaveEntry").onclick=saveEntry;$("btnExport").onclick=exportExcel;
  $("addEngineer").onclick=()=>addMaster("engineer");$("addUpsType").onclick=()=>addMaster("type");$("addIssueType").onclick=()=>addMaster("issue");
  $("saveProduction").onclick=saveProduction;$("importHistory").onclick=()=>toast("History import will be enabled after your Excel column mapping is finalized.");
  $("testCloudConfig").onclick=testCloud;$("saveCloudConfig").onclick=saveCloud;$("clearCloudConfig").onclick=clearCloud;
}
function openAdmin(){$("adminDialog").showModal();renderAdmin()}
function currentRows(){const m=selectedMonth();return inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m)}
function offered(rows){return rows.reduce((s,r)=>s+(+r.qty||0),0)}
function statusQty(rows,s){return rows.filter(r=>r.status===s).reduce((a,r)=>a+(+r.qty||0),0)}
function render(){
  const rows=currentRows();$("kpiManufactured").textContent=production[selectedMonth()]||0;$("kpiOffered").textContent=offered(rows);
  $("kpiCompleted").textContent=statusQty(rows,"Completed");$("kpiDelayed").textContent=statusQty(rows,"Delayed");$("kpiCancelled").textContent=statusQty(rows,"Cancelled");$("kpiWaiver").textContent=statusQty(rows,"Waiver");
  renderTable();renderCharts();
}
function filteredRows(){
  let rows=currentRows(),t=$("filterType").value,s=$("filterStatus").value,i=$("filterIssue").value,q=$("searchBox").value.trim().toLowerCase();
  if(t)rows=rows.filter(r=>r.ups_type===t);if(s)rows=rows.filter(r=>r.status===s);if(i)rows=rows.filter(r=>r.issue_type===i);if(q)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));return rows;
}
function fmtDate(v){if(!v)return"-";const [y,m,d]=String(v).slice(0,10).split("-");return `${d}-${MONTHS[+m-1].slice(0,3)}-${y}`}
function daysDelay(r){if(!r.planned_date)return 0;const end=r.actual_date||[r.revised_date_5,r.revised_date_4,r.revised_date_3,r.revised_date_2,r.revised_date_1].find(Boolean);if(!end)return 0;return Math.max(0,Math.round((new Date(end)-new Date(r.planned_date))/86400000))}
function renderTable(){
  const rows=filteredRows();$("inspectionBody").innerHTML=rows.length?rows.map((r,i)=>`<tr>
  <td>${i+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td><td>${r.engineer||""}</td>
  <td>${fmtDate(r.planned_date)}</td><td>${fmtDate(r.revised_date_1)}</td><td>${fmtDate(r.revised_date_2)}</td><td>${fmtDate(r.revised_date_3)}</td><td>${fmtDate(r.revised_date_4)}</td><td>${fmtDate(r.revised_date_5)}</td>
  <td>${fmtDate(r.actual_date)}</td><td>${daysDelay(r)}</td><td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td><td>${r.issue_type||"-"}</td><td>${r.issue_at_time||"-"}</td><td>${r.remarks||"-"}</td>
  <td class="actions"><button onclick="editEntry('${r.id}')">✎</button><button onclick="deleteEntry('${r.id}')">🗑</button></td></tr>`).join(""):`<tr><td colspan="19" style="text-align:center;padding:28px">No inspection entries for this month.</td></tr>`;
}
function refreshMasters(){
  const opts=a=>`<option value="">-</option>`+a.map(x=>`<option>${x}</option>`).join("");
  $("filterType").innerHTML=`<option value="">All UPS Types</option>`+upsTypes.map(x=>`<option>${x}</option>`).join("");
  $("filterIssue").innerHTML=`<option value="">All Issue Types</option>`+issueTypes.map(x=>`<option>${x}</option>`).join("");
  $("upsType").innerHTML=opts(upsTypes);$("issueType").innerHTML=opts(issueTypes);$("engineer").innerHTML=opts(engineers);
}
function openEntry(r=null){
  $("entryTitle").textContent=r?"Edit Inspection Entry":"Add Inspection Entry";$("entryId").value=r?.id||"";
  const map={customer:"customer_project",qty:"qty",kva:"kva_rating",upsType:"ups_type",engineer:"engineer",plannedDate:"planned_date",rev1:"revised_date_1",rev2:"revised_date_2",rev3:"revised_date_3",rev4:"revised_date_4",rev5:"revised_date_5",actualDate:"actual_date",status:"status",issueType:"issue_type",issueAtTime:"issue_at_time",remarks:"remarks"};
  for(const [id,k] of Object.entries(map))$(id).value=r?.[k]??(id==="qty"?1:id==="status"?"Planned":"");$("entryDialog").showModal();
}
window.editEntry=id=>openEntry(inspections.find(r=>String(r.id)===String(id)));
window.deleteEntry=async id=>{if(!confirm("Delete this inspection entry?"))return;if(online){const {error}=await db.from("inspections").delete().eq("id",id);if(error)return toast(error.message,true);await loadCloud()}else{inspections=inspections.filter(r=>String(r.id)!==String(id));setLocal(STORE.inspections,inspections)}render()};
async function saveEntry(){
  const o={customer_project:$("customer").value.trim(),qty:+$("qty").value||1,kva_rating:+$("kva").value||null,ups_type:$("upsType").value||null,engineer:$("engineer").value||null,
  planned_date:$("plannedDate").value||null,revised_date_1:$("rev1").value||null,revised_date_2:$("rev2").value||null,revised_date_3:$("rev3").value||null,revised_date_4:$("rev4").value||null,revised_date_5:$("rev5").value||null,
  actual_date:$("actualDate").value||null,status:$("status").value,issue_type:$("issueType").value||null,issue_at_time:$("issueAtTime").value.trim()||null,remarks:$("remarks").value.trim()||null,updated_at:new Date().toISOString()};
  if(!o.customer_project)return toast("Customer / Project is required.",true);const id=$("entryId").value;
  if(online){let q=id?db.from("inspections").update(o).eq("id",id):db.from("inspections").insert(o);const {error}=await q;if(error)return toast(error.message,true);await loadCloud()}
  else{if(id){let ix=inspections.findIndex(r=>String(r.id)===String(id));inspections[ix]={...inspections[ix],...o}}else inspections.push({...o,id:crypto.randomUUID()});setLocal(STORE.inspections,inspections)}
  $("entryDialog").close();render();toast("Inspection entry saved.");
}
function renderCharts(){
  const rows=currentRows(),prod={},issues={};rows.forEach(r=>prod[r.ups_type||"Unknown"]=(prod[r.ups_type||"Unknown"]||0)+(+r.qty||0));rows.filter(r=>r.issue_type).forEach(r=>issues[r.issue_type]=(issues[r.issue_type]||0)+(+r.qty||0));
  const sortedIssues=Object.entries(issues).sort((a,b)=>b[1]-a[1]).slice(0,7);$("issueCountBadge").textContent=`${sortedIssues.reduce((a,x)=>a+x[1],0)} issues`;
  const months=MONTHS.map((_,i)=>`2026-${String(i+1).padStart(2,"0")}`),man=months.map(m=>+production[m]||0),off=months.map(m=>offered(inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===m)));
  productChart?.destroy();monthlyChart?.destroy();issueChart?.destroy();
  productChart=new Chart($("productChart"),{type:"doughnut",data:{labels:Object.keys(prod),datasets:[{data:Object.values(prod),borderWidth:0,hoverOffset:5}]},options:{cutout:"68%",plugins:{legend:{position:"right",labels:{color:"#d9e8f5",boxWidth:10,usePointStyle:true}}}}});
  monthlyChart=new Chart($("monthlyChart"),{type:"bar",data:{labels:MONTHS,datasets:[
    {label:"Total UPS Manufactured",data:man,backgroundColor:"rgba(180,197,214,.55)",borderRadius:5,barPercentage:.86,categoryPercentage:.72},
    {label:"Offered for Inspection",data:off,backgroundColor:"rgba(26,153,255,.92)",borderRadius:5,barPercentage:.52,categoryPercentage:.72}
  ]},options:{plugins:{legend:{labels:{color:"#dbe9f5"}}},scales:{x:{grid:{display:false},ticks:{color:"#c7d8e6"}},y:{beginAtZero:true,grid:{color:"#244158"},ticks:{color:"#c7d8e6"}}}}});
  issueChart=new Chart($("issueChart"),{type:"bar",data:{labels:sortedIssues.map(x=>x[0]),datasets:[{data:sortedIssues.map(x=>x[1]),backgroundColor:["#ff516a","#ff9f43","#ffc93c","#41b6ff","#ad68ff","#38d39f","#8aa0b8"],borderRadius:7,barThickness:13}]},options:{indexAxis:"y",maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:"#244158"},ticks:{color:"#c7d8e6",precision:0}},y:{grid:{display:false},ticks:{color:"#dce9f4",font:{size:10}}}}}});
}
function renderAdmin(){
  $("supabaseUrl").value=localStorage.getItem("inspection_supabase_url")||"";$("supabaseKey").value=localStorage.getItem("inspection_supabase_key")||"";
  $("engineerList").innerHTML=masterHtml(engineers,"engineer");$("upsTypeList").innerHTML=masterHtml(upsTypes,"type");$("issueTypeList").innerHTML=masterHtml(issueTypes,"issue");
  $("productionRows").innerHTML=MONTHS.map((m,i)=>{let k=`2026-${String(i+1).padStart(2,"0")}`;return `<div class="prod-row"><span>${m}</span><input data-month="${k}" type="number" min="0" value="${production[k]||0}"></div>`}).join("");
}
function masterHtml(a,k){return a.map(x=>`<div class="master-item"><span>${x}</span><button onclick="removeMaster('${k}','${x.replaceAll("'","\\'")}')">Delete</button></div>`).join("")}
window.removeMaster=async(k,n)=>{const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";if(online){await db.from(table).delete().eq("name",n);await loadCloud()}else{if(k==="engineer"){engineers=engineers.filter(x=>x!==n);setLocal(STORE.engineers,engineers)}if(k==="type"){upsTypes=upsTypes.filter(x=>x!==n);setLocal(STORE.types,upsTypes)}if(k==="issue"){issueTypes=issueTypes.filter(x=>x!==n);setLocal(STORE.issues,issueTypes)}}refreshMasters();renderAdmin()};
async function addMaster(k){const inp=k==="engineer"?$("newEngineer"):k==="type"?$("newUpsType"):$("newIssueType"),n=inp.value.trim();if(!n)return;const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";if(online){const {error}=await db.from(table).insert({name:n});if(error&&error.code!=="23505")return toast(error.message,true);await loadCloud()}else{if(k==="engineer"&&!engineers.includes(n)){engineers.push(n);setLocal(STORE.engineers,engineers)}if(k==="type"&&!upsTypes.includes(n)){upsTypes.push(n);setLocal(STORE.types,upsTypes)}if(k==="issue"&&!issueTypes.includes(n)){issueTypes.push(n);setLocal(STORE.issues,issueTypes)}}inp.value="";refreshMasters();renderAdmin()}
async function saveProduction(){const rows=[...$("productionRows").querySelectorAll("[data-month]")].map(x=>({month:x.dataset.month,manufactured_qty:+x.value||0}));if(online){const {error}=await db.from("monthly_production").upsert(rows);if(error)return toast(error.message,true);await loadCloud()}else{production=Object.fromEntries(rows.map(x=>[x.month,x.manufactured_qty]));setLocal(STORE.production,production)}render();toast("Monthly production saved.")}
async function testCloud(){
  const url=cleanUrl($("supabaseUrl").value),key=cleanKey($("supabaseKey").value);$("cloudTestResult").textContent="Testing...";
  if(!validUrl(url))return $("cloudTestResult").textContent="Invalid Project URL. It should look like https://xxxx.supabase.co";
  if(!validKey(key))return $("cloudTestResult").textContent="Invalid Publishable key. Paste sb_publishable_... only (not secret key).";
  try{const c=window.supabase.createClient(url,key),r=await c.from("ups_types").select("name").limit(1);if(r.error)throw r.error;$("cloudTestResult").textContent="✓ Connection successful. You can Save & Reload Online."}catch(e){$("cloudTestResult").textContent="Connection failed: "+e.message}
}
function saveCloud(){
  const url=cleanUrl($("supabaseUrl").value),key=cleanKey($("supabaseKey").value);
  if(!validUrl(url))return toast("Invalid Supabase Project URL.",true);if(!validKey(key))return toast("Invalid Publishable key.",true);
  localStorage.setItem("inspection_supabase_url",url);localStorage.setItem("inspection_supabase_key",key);location.reload();
}
function clearCloud(){localStorage.removeItem("inspection_supabase_url");localStorage.removeItem("inspection_supabase_key");toast("Saved Supabase connection cleared.");setTimeout(()=>location.reload(),700)}
function exportExcel(){const rows=filteredRows().map((r,i)=>({"Sr No":i+1,"Customer / Project":r.customer_project,"Qty":r.qty,"kVA Rating":r.kva_rating,"UPS Type":r.ups_type,"Inspection Given By":r.engineer,"Planned Date":r.planned_date,"Revised Date 1":r.revised_date_1,"Revised Date 2":r.revised_date_2,"Revised Date 3":r.revised_date_3,"Revised Date 4":r.revised_date_4,"Revised Date 5":r.revised_date_5,"Actual Inspection Date":r.actual_date,"Days / Delay":daysDelay(r),"Status":r.status,"Issue Type":r.issue_type,"Issue at the Time":r.issue_at_time,"Remarks":r.remarks}));const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inspection");XLSX.writeFile(wb,`Inspection_${selectedMonth()}.xlsx`)}

init().catch(e=>{console.error(e);showConnectionProblem(e.message||"Portal startup problem");loadLocal();refreshMasters();bind();render();updateMode()});
