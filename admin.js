
let historyIssueDraft=[],excelImportRows=[],excelImportRevisions=[];

async function bootAdmin(){
  navLink("admin");
  try{await initCloud();wire();renderAdmin();$("cloudStatus").textContent="✓ Live Supabase connection active. PWA, history and yearly summary use the same shared cloud database.";$("modeNote").textContent="LIVE ONLINE • Admin changes are stored centrally."}
  catch(e){console.error(e);updateLiveBadge();$("cloudStatus").textContent="Connection failed: "+e.message}
}
function wire(){
  $("saveProduction").onclick=saveProduction;$("addEngineer").onclick=()=>addMaster("engineer");$("addUpsType").onclick=()=>addMaster("type");$("addIssueType").onclick=()=>addMaster("issue");
  $("addHistoryIssue").onclick=()=>{historyIssueDraft.push({issue_type:issueTypes[0]||"",qty:0,remarks:""});renderHistoryIssueRows()};
  $("loadHistory").onclick=()=>loadHistoryMonth($("historyMonth").value);$("saveHistory").onclick=saveHistoryMonth;$("historyMonth").onchange=()=>loadHistoryMonth($("historyMonth").value);
  $("previewScheduleImport").onclick=previewScheduleWorkbook;$("confirmScheduleImport").onclick=confirmScheduleImport
}
function renderAdmin(){
  $("productionRows").innerHTML=MONTHS.map((m,i)=>{const k=`2026-${String(i+1).padStart(2,"0")}`;return `<div class="prod-row"><span>${m}</span><input data-month="${k}" type="number" min="0" value="${production[k]||0}"></div>`}).join("");
  $("engineerList").innerHTML=masterHtml(engineers,"engineer");$("upsTypeList").innerHTML=masterHtml(upsTypes,"type");$("issueTypeList").innerHTML=masterHtml(issueTypes,"issue");loadHistoryMonth($("historyMonth").value);renderHistoryList()
}
function masterHtml(a,k){return a.map(x=>`<div class="master-item"><span>${x}</span><button onclick="removeMaster('${k}','${x.replaceAll("'","\\'")}')">Delete</button></div>`).join("")}
async function addMaster(k){const inp=k==="engineer"?$("newEngineer"):k==="type"?$("newUpsType"):$("newIssueType"),name=inp.value.trim();if(!name)return;const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";const{error}=await db.from(table).insert({name});if(error&&error.code!=="23505")return toast(error.message,true);await loadAll();inp.value="";renderAdmin();toast("Master updated.")}
window.removeMaster=async(k,name)=>{const table=k==="engineer"?"engineers":k==="type"?"ups_types":"issue_types";const{error}=await db.from(table).delete().eq("name",name);if(error)return toast(error.message,true);await loadAll();renderAdmin();toast("Master removed.")};
async function saveProduction(){const rows=[...document.querySelectorAll("[data-month]")].map(x=>({month:x.dataset.month,manufactured_qty:+x.value||0}));const{error}=await db.from("monthly_production").upsert(rows);if(error)return toast(error.message,true);await loadAll();renderAdmin();toast("Monthly production saved.")}

function renderHistoryProductRows(month){const existing=historyProducts.filter(x=>x.month===month),values=Object.fromEntries(existing.map(x=>[x.ups_type,+x.qty||0]));$("historyProductRows").innerHTML=upsTypes.map(t=>`<label class="history-product-item"><span>${t}</span><input type="number" min="0" value="${values[t]||0}" data-history-product="${t}"></label>`).join("")}
function renderHistoryIssueRows(){
  const el=$("historyIssueRows");if(!historyIssueDraft.length){el.innerHTML='<div class="history-empty">No issues added for this month.</div>';return}
  el.innerHTML=historyIssueDraft.map((x,i)=>`<div class="history-issue-row"><select data-hi-type="${i}">${issueTypes.map(t=>`<option ${t===x.issue_type?"selected":""}>${t}</option>`).join("")}</select><input data-hi-qty="${i}" type="number" min="0" value="${+x.qty||0}" placeholder="Qty"><input data-hi-remarks="${i}" value="${String(x.remarks||"").replaceAll('"','&quot;')}" placeholder="Issue / remarks"><button type="button" class="history-remove" onclick="removeHistoryIssue(${i})">×</button></div>`).join("");
  historyIssueDraft.forEach((_,i)=>{document.querySelector(`[data-hi-type="${i}"]`).onchange=e=>historyIssueDraft[i].issue_type=e.target.value;document.querySelector(`[data-hi-qty="${i}"]`).oninput=e=>historyIssueDraft[i].qty=+e.target.value||0;document.querySelector(`[data-hi-remarks="${i}"]`).oninput=e=>historyIssueDraft[i].remarks=e.target.value})
}
window.removeHistoryIssue=i=>{historyIssueDraft.splice(i,1);renderHistoryIssueRows()};
function loadHistoryMonth(month){
  if(!month)return;const h=historyForMonth(month);
  ["histPlanned","histCompletedInspections","histUpsOffered","histManufactured","histDelayed","histCancelled","histWaiver","histRevisionCount","histInspectionsWithIssues"].forEach(id=>$(id).value=0);$("histRemarks").value="";
  if(h){$("histPlanned").value=+h.planned_inspections||0;$("histCompletedInspections").value=+h.completed_inspections||0;$("histUpsOffered").value=+h.ups_offered||0;$("histManufactured").value=+h.manufactured_qty||0;$("histDelayed").value=+h.delayed_qty||0;$("histCancelled").value=+h.cancelled_qty||0;$("histWaiver").value=+h.waiver_qty||0;$("histRevisionCount").value=+h.revision_count||0;$("histInspectionsWithIssues").value=+h.inspections_with_issues||0;$("histRemarks").value=h.remarks||""}
  renderHistoryProductRows(month);historyIssueDraft=historyIssues.filter(x=>x.month===month).map(x=>({issue_type:x.issue_type,qty:+x.qty||0,remarks:x.remarks||""}));renderHistoryIssueRows();$("historyStatus").textContent=h?`Loaded ${fmtMonthKey(month)} history.`:`No saved history for ${fmtMonthKey(month)} yet.`
}
async function saveHistoryMonth(){
  const month=$("historyMonth").value;if(!month)return toast("Select a month.",true);
  const summary={month,planned_inspections:+$("histPlanned").value||0,completed_inspections:+$("histCompletedInspections").value||0,ups_offered:+$("histUpsOffered").value||0,ups_completed:+$("histCompletedInspections").value||0,manufactured_qty:+$("histManufactured").value||0,delayed_qty:+$("histDelayed").value||0,cancelled_qty:+$("histCancelled").value||0,waiver_qty:+$("histWaiver").value||0,revision_count:+$("histRevisionCount").value||0,inspections_with_issues:+$("histInspectionsWithIssues").value||0,remarks:$("histRemarks").value.trim()||null,updated_at:new Date().toISOString()};
  let q=await db.from("monthly_history").upsert(summary,{onConflict:"month"});if(q.error)return toast(q.error.message,true);
  await db.from("monthly_history_products").delete().eq("month",month);const products=[...document.querySelectorAll("[data-history-product]")].map(x=>({month,ups_type:x.dataset.historyProduct,qty:+x.value||0})).filter(x=>x.qty>0);if(products.length){q=await db.from("monthly_history_products").insert(products);if(q.error)return toast(q.error.message,true)}
  await db.from("monthly_history_issues").delete().eq("month",month);const issues=historyIssueDraft.filter(x=>+x.qty>0||x.remarks.trim()).map(x=>({month,issue_type:x.issue_type,qty:+x.qty||0,remarks:x.remarks.trim()||null}));if(issues.length){q=await db.from("monthly_history_issues").insert(issues);if(q.error)return toast(q.error.message,true)}
  await loadAll();renderAdmin();$("historyMonth").value=month;loadHistoryMonth(month);toast(`${fmtMonthKey(month)} history saved.`)
}
function renderHistoryList(){const rows=[...historySummaries].sort((a,b)=>b.month.localeCompare(a.month));$("historyListBody").innerHTML=rows.length?rows.map(h=>`<tr><td>${fmtMonthKey(h.month)}</td><td>${h.planned_inspections||0}</td><td>${h.completed_inspections||0}</td><td>${h.ups_offered||0}</td><td>${h.manufactured_qty||0}</td><td><button class="mini-action-btn" onclick="editHistory('${h.month}')">Edit</button><button class="mini-delete-btn" onclick="deleteHistory('${h.month}')">Delete</button></td></tr>`).join(""):`<tr><td colspan="6" style="text-align:center;padding:18px">No historical months saved yet.</td></tr>`}
window.editHistory=month=>{$("historyMonth").value=month;loadHistoryMonth(month);$("historyMonth").scrollIntoView({behavior:"smooth",block:"center"})};
window.deleteHistory=async month=>{if(!confirm(`Delete historical summary for ${fmtMonthKey(month)}?`))return;await db.from("monthly_history_products").delete().eq("month",month);await db.from("monthly_history_issues").delete().eq("month",month);const r=await db.from("monthly_history").delete().eq("month",month);if(r.error)return toast(r.error.message,true);await loadAll();renderAdmin();toast("Historical month deleted.")};

function xlsxDate(v){if(v==null||v==="")return null;if(typeof v==="number"&&v>1000){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:null}return null}
function monthNo(name){return({JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12})[name.slice(0,3).toUpperCase()]||1}
function parseLegacyDate(v,sheet){
  const serial=xlsxDate(v);if(serial)return serial;const s=String(v??"").trim();if(!s||s==="-")return null;const dm=s.match(/(\d{1,2})/);if(!dm)return null;let mon=monthNo(sheet);const names=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];names.forEach((n,i)=>{if(s.toUpperCase().includes(n))mon=i+1});return `2026-${String(mon).padStart(2,"0")}-${String(+dm[1]).padStart(2,"0")}`
}
function normKey(v){return String(v??"").toUpperCase().replace(/[^A-Z0-9]+/g,"")}
async function previewScheduleWorkbook(){
  const f=$("scheduleWorkbook").files[0];if(!f)return toast("Choose the Excel workbook first.",true);
  const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});excelImportRows=[];excelImportRevisions=[];
  const summary={};
  wb.SheetNames.filter(n=>/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-26$/i.test(n)).forEach(sheet=>{
    const data=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null,raw:true});let rows=0,qty=0,events=new Set();
    for(let ri=5;ri<data.length;ri++){const r=data[ri],cust=String(r?.[1]??"").trim(),q=+r?.[3];if(!cust||!Number.isFinite(q))continue;const so=String(r?.[2]??"").trim(),planned=parseLegacyDate(r?.[9],sheet),legacyDate=String(r?.[9]??"").trim(),rawStatus=String(r?.[11]??"").trim().toUpperCase(),eventKey=`LEGACY-${sheet}|${normKey(cust)}|${normKey(so)}|${planned||normKey(legacyDate)}`,status=rawStatus==="COMPLETED"?"Completed":rawStatus==="CANCELLED"?"Cancelled":rawStatus==="WAIVER"?"Waiver":"Planned",remarks=(rawStatus&& !["COMPLETED","CANCELLED","WAIVER","POSTPONED"].includes(rawStatus))?`Legacy status: ${rawStatus}`:null;
      excelImportRows.push({customer_project:cust,so_no:so||null,qty:q,kva_rating:+r?.[4]||null,ups_type:String(r?.[6]??"").trim()||null,planned_date:planned,schedule_month:`2026-${String(monthNo(sheet)).padStart(2,"0")}`,status,remarks,event_key:eventKey,source_sheet:sheet,source_row:ri+1,legacy_date_text:legacyDate||null,import_batch:"EXCEL_SCHEDULE_IMPORT",legacy_delayed:rawStatus==="POSTPONED"});
      if(rawStatus==="POSTPONED"&&!excelImportRevisions.some(x=>x.event_key===eventKey))excelImportRevisions.push({event_key:eventKey,revised_date:null,reason:"Postponed in legacy inspection schedule"});
      rows++;qty+=q;events.add(eventKey)
    }
    summary[sheet]={rows,qty,events:events.size}
  });
  $("excelImportPreview").innerHTML=`<table class="import-preview-table"><thead><tr><th>Sheet</th><th>Rows</th><th>UPS Qty</th><th>Customer Inspections</th></tr></thead><tbody>${Object.entries(summary).map(([k,v])=>`<tr><td>${k}</td><td>${v.rows}</td><td>${v.qty}</td><td>${v.events}</td></tr>`).join("")}</tbody></table>`;
  $("excelImportStatus").textContent=`Preview ready: ${excelImportRows.length} line rows. No data has been written yet.`;$("confirmScheduleImport").disabled=!excelImportRows.length
}
async function confirmScheduleImport(){
  if(!excelImportRows.length)return; if(!confirm(`Import ${excelImportRows.length} Excel rows to Supabase? Existing rows from the same sheet/source-row will be replaced.`))return;
  $("excelImportStatus").textContent="Importing...";
  const sheets=[...new Set(excelImportRows.map(x=>x.source_sheet))];for(const s of sheets)await db.from("inspections").delete().eq("source_sheet",s).eq("import_batch","EXCEL_SCHEDULE_IMPORT");
  for(let i=0;i<excelImportRows.length;i+=100){const q=await db.from("inspections").insert(excelImportRows.slice(i,i+100));if(q.error)return toast(q.error.message,true)}
  const keys=[...new Set(excelImportRevisions.map(x=>x.event_key))];for(const k of keys)await db.from("inspection_revisions").delete().eq("event_key",k);
  if(excelImportRevisions.length){const q=await db.from("inspection_revisions").insert(excelImportRevisions);if(q.error)return toast(q.error.message,true)}
  await loadAll();$("excelImportStatus").textContent="✓ Excel schedule imported successfully.";toast("Excel history imported.")
}
bootAdmin();
