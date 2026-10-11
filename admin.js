
async function bootAdmin(){
  navLink("admin");
  try{await initCloud();wire();renderAdmin();$("cloudStatus").textContent="✓ Live Supabase connection active. This config is shared by GitHub Pages on all devices.";$("modeNote").textContent="LIVE ONLINE • Admin changes are stored centrally."}
  catch(e){console.error(e);updateLiveBadge();$("cloudStatus").textContent="Connection failed: "+e.message}
}
function wire(){
  $("saveProduction").onclick=saveProduction;$("addEngineer").onclick=()=>addMaster("engineer");$("addUpsType").onclick=()=>addMaster("type");$("addIssueType").onclick=()=>addMaster("issue");
}
function renderAdmin(){
  $("productionRows").innerHTML=MONTHS.map((m,i)=>{const k=`2026-${String(i+1).padStart(2,"0")}`;return `<div class="prod-row"><span>${m}</span><input data-month="${k}" type="number" min="0" value="${production[k]||0}"></div>`}).join("");
  $("engineerList").innerHTML=masterHtml(engineers,"engineer");$("upsTypeList").innerHTML=masterHtml(upsTypes,"type");$("issueTypeList").innerHTML=masterHtml(issueTypes,"issue")
}
function masterHtml(a,k){return a.map(x=>`<div class="master-item"><span>${x}</span><button onclick="removeMaster('${k}','${x.replaceAll("'","\\'")}')">Delete</button></div>`).join("")}
async function addMaster(k){
  const inp=k==="engineer"?$("newEngineer"):k==="type"?$("newUpsType"):$("newIssueType"),name=inp.value.trim();if(!name)return;
  const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";
  const {error}=await db.from(table).insert({name});if(error&&error.code!=="23505")return toast(error.message,true);
  await loadAll();inp.value="";renderAdmin();toast("Master updated.")
}
window.removeMaster=async(k,name)=>{const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";const {error}=await db.from(table).delete().eq("name",name);if(error)return toast(error.message,true);await loadAll();renderAdmin();toast("Master removed.")};
async function saveProduction(){const rows=[...document.querySelectorAll("[data-month]")].map(x=>({month:x.dataset.month,manufactured_qty:+x.value||0}));const {error}=await db.from("monthly_production").upsert(rows);if(error)return toast(error.message,true);await loadAll();renderAdmin();toast("Monthly production saved.")}
bootAdmin();
