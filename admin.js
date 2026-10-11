
let historyIssueDraft=[];

async function bootAdmin(){
  navLink("admin");
  try{
    await initCloud();
    wire();
    renderAdmin();
    $("cloudStatus").textContent="✓ Live Supabase connection active. This config is shared by GitHub Pages on all devices.";
    $("modeNote").textContent="LIVE ONLINE • Admin changes are stored centrally.";
  }catch(e){
    console.error(e);updateLiveBadge();$("cloudStatus").textContent="Connection failed: "+e.message
  }
}
function wire(){
  $("saveProduction").onclick=saveProduction;
  $("addEngineer").onclick=()=>addMaster("engineer");
  $("addUpsType").onclick=()=>addMaster("type");
  $("addIssueType").onclick=()=>addMaster("issue");
  $("addHistoryIssue").onclick=()=>{historyIssueDraft.push({issue_type:issueTypes[0]||"",qty:0,remarks:""});renderHistoryIssueRows()};
  $("loadHistory").onclick=()=>loadHistoryMonth($("historyMonth").value);
  $("saveHistory").onclick=saveHistoryMonth;
  $("historyMonth").onchange=()=>loadHistoryMonth($("historyMonth").value);
}
function renderAdmin(){
  $("productionRows").innerHTML=MONTHS.map((m,i)=>{const k=`2026-${String(i+1).padStart(2,"0")}`;return `<div class="prod-row"><span>${m}</span><input data-month="${k}" type="number" min="0" value="${production[k]||0}"></div>`}).join("");
  $("engineerList").innerHTML=masterHtml(engineers,"engineer");
  $("upsTypeList").innerHTML=masterHtml(upsTypes,"type");
  $("issueTypeList").innerHTML=masterHtml(issueTypes,"issue");
  loadHistoryMonth($("historyMonth").value);
  renderHistoryList();
}
function masterHtml(a,k){return a.map(x=>`<div class="master-item"><span>${x}</span><button onclick="removeMaster('${k}','${x.replaceAll("'","\\'")}')">Delete</button></div>`).join("")}
async function addMaster(k){
  const inp=k==="engineer"?$("newEngineer"):k==="type"?$("newUpsType"):$("newIssueType"),name=inp.value.trim();if(!name)return;
  const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";
  const {error}=await db.from(table).insert({name});if(error&&error.code!=="23505")return toast(error.message,true);
  await loadAll();inp.value="";renderAdmin();toast("Master updated.")
}
window.removeMaster=async(k,name)=>{
  const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";
  const {error}=await db.from(table).delete().eq("name",name);if(error)return toast(error.message,true);
  await loadAll();renderAdmin();toast("Master removed.")
};
async function saveProduction(){
  const rows=[...document.querySelectorAll("[data-month]")].map(x=>({month:x.dataset.month,manufactured_qty:+x.value||0}));
  const {error}=await db.from("monthly_production").upsert(rows);if(error)return toast(error.message,true);
  await loadAll();renderAdmin();toast("Monthly production saved.")
}
function renderHistoryProductRows(month){
  const existing=historyProducts.filter(x=>x.month===month);
  const values=Object.fromEntries(existing.map(x=>[x.ups_type,+x.qty||0]));
  $("historyProductRows").innerHTML=upsTypes.map(t=>`<label class="history-product-item"><span>${t}</span><input type="number" min="0" value="${values[t]||0}" data-history-product="${t}"></label>`).join("");
}
function renderHistoryIssueRows(){
  const el=$("historyIssueRows");
  if(!historyIssueDraft.length){el.innerHTML='<div class="history-empty">No issues added for this month.</div>';return}
  el.innerHTML=historyIssueDraft.map((x,i)=>`<div class="history-issue-row">
    <select data-hi-type="${i}">${issueTypes.map(t=>`<option ${t===x.issue_type?"selected":""}>${t}</option>`).join("")}</select>
    <input data-hi-qty="${i}" type="number" min="0" value="${+x.qty||0}" placeholder="Qty">
    <input data-hi-remarks="${i}" value="${String(x.remarks||"").replaceAll('"','&quot;')}" placeholder="Issue / remarks">
    <button type="button" class="history-remove" onclick="removeHistoryIssue(${i})">×</button>
  </div>`).join("");
  historyIssueDraft.forEach((_,i)=>{
    document.querySelector(`[data-hi-type="${i}"]`).onchange=e=>historyIssueDraft[i].issue_type=e.target.value;
    document.querySelector(`[data-hi-qty="${i}"]`).oninput=e=>historyIssueDraft[i].qty=+e.target.value||0;
    document.querySelector(`[data-hi-remarks="${i}"]`).oninput=e=>historyIssueDraft[i].remarks=e.target.value;
  });
}
window.removeHistoryIssue=i=>{historyIssueDraft.splice(i,1);renderHistoryIssueRows()};
function clearHistoryFields(){
  ["histPlanned","histCompletedInspections","histUpsOffered","histUpsCompleted","histManufactured","histDelayed","histCancelled","histWaiver"].forEach(id=>$(id).value=0);
  $("histRemarks").value="";
}
function loadHistoryMonth(month){
  if(!month)return;
  clearHistoryFields();
  const h=historyForMonth(month);
  if(h){
    $("histPlanned").value=+h.planned_inspections||0;
    $("histCompletedInspections").value=+h.completed_inspections||0;
    $("histUpsOffered").value=+h.ups_offered||0;
    $("histUpsCompleted").value=+h.ups_completed||0;
    $("histManufactured").value=+h.manufactured_qty||0;
    $("histDelayed").value=+h.delayed_qty||0;
    $("histCancelled").value=+h.cancelled_qty||0;
    $("histWaiver").value=+h.waiver_qty||0;
    $("histRemarks").value=h.remarks||"";
  }
  renderHistoryProductRows(month);
  historyIssueDraft=historyIssues.filter(x=>x.month===month).map(x=>({issue_type:x.issue_type,qty:+x.qty||0,remarks:x.remarks||""}));
  renderHistoryIssueRows();
  $("historyStatus").textContent=h?`Loaded ${fmtMonthKey(month)} history.`:`No saved history for ${fmtMonthKey(month)} yet.`;
}
async function saveHistoryMonth(){
  const month=$("historyMonth").value;if(!month)return toast("Select a month.",true);
  const summary={
    month,
    planned_inspections:+$("histPlanned").value||0,
    completed_inspections:+$("histCompletedInspections").value||0,
    ups_offered:+$("histUpsOffered").value||0,
    ups_completed:+$("histUpsCompleted").value||0,
    manufactured_qty:+$("histManufactured").value||0,
    delayed_qty:+$("histDelayed").value||0,
    cancelled_qty:+$("histCancelled").value||0,
    waiver_qty:+$("histWaiver").value||0,
    remarks:$("histRemarks").value.trim()||null,
    updated_at:new Date().toISOString()
  };
  const s=await db.from("monthly_history").upsert(summary,{onConflict:"month"});
  if(s.error)return toast("Run the historical SQL patch first: "+s.error.message,true);

  await db.from("monthly_history_products").delete().eq("month",month);
  const products=[...document.querySelectorAll("[data-history-product]")].map(x=>({month,ups_type:x.dataset.historyProduct,qty:+x.value||0})).filter(x=>x.qty>0);
  if(products.length){
    const p=await db.from("monthly_history_products").insert(products);if(p.error)return toast(p.error.message,true);
  }

  await db.from("monthly_history_issues").delete().eq("month",month);
  const issues=historyIssueDraft.filter(x=>+x.qty>0||String(x.remarks||"").trim()).map(x=>({month,issue_type:x.issue_type,qty:+x.qty||0,remarks:String(x.remarks||"").trim()||null}));
  if(issues.length){
    const q=await db.from("monthly_history_issues").insert(issues);if(q.error)return toast(q.error.message,true);
  }

  await loadAll();renderAdmin();$("historyMonth").value=month;loadHistoryMonth(month);toast(`${fmtMonthKey(month)} history saved.`);
}
function renderHistoryList(){
  const rows=[...historySummaries].sort((a,b)=>b.month.localeCompare(a.month));
  $("historyListBody").innerHTML=rows.length?rows.map(h=>`<tr>
    <td>${fmtMonthKey(h.month)}</td><td>${h.planned_inspections||0}</td><td>${h.completed_inspections||0}</td><td>${h.ups_offered||0}</td><td>${h.ups_completed||0}</td><td>${h.manufactured_qty||0}</td>
    <td><button class="mini-action-btn" onclick="editHistory('${h.month}')">Edit</button><button class="mini-delete-btn" onclick="deleteHistory('${h.month}')">Delete</button></td>
  </tr>`).join(""):`<tr><td colspan="7" style="text-align:center;padding:18px">No historical months saved yet.</td></tr>`;
}
window.editHistory=month=>{$("historyMonth").value=month;loadHistoryMonth(month);$("historyMonth").scrollIntoView({behavior:"smooth",block:"center"})};
window.deleteHistory=async month=>{
  if(!confirm(`Delete historical summary for ${fmtMonthKey(month)}?`))return;
  await db.from("monthly_history_products").delete().eq("month",month);
  await db.from("monthly_history_issues").delete().eq("month",month);
  const r=await db.from("monthly_history").delete().eq("month",month);if(r.error)return toast(r.error.message,true);
  await loadAll();renderAdmin();toast("Historical month deleted.");
};
bootAdmin();
