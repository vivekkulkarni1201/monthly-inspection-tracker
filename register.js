
let issueDraft=[],revisionDraft=[];

async function bootRegister(){
  navLink("register");buildMonthPicker();initPrettyMonthPicker(renderTable);
  try{
    await initCloud();
    ["inspections","inspection_issues","inspection_revisions"].forEach(t=>subscribe(t,async()=>{await loadAll();fillMasters();renderTable()}));
    fillMasters();wire();renderTable();$("modeNote").textContent="LIVE ONLINE • Register updates are stored in Supabase."
  }catch(e){console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message}
  const p=new URLSearchParams(location.search);if(p.get("action")==="add")setTimeout(()=>openEntry(),150);if(p.get("edit"))setTimeout(()=>{const r=inspections.find(x=>String(x.id)===String(p.get("edit")));if(r)openEntry(r)},180)
}
function wire(){
  $("monthPicker").onchange=renderTable;$("filterType").onchange=renderTable;$("filterStatus").onchange=renderTable;$("filterIssue").onchange=renderTable;$("searchBox").oninput=renderTable;
  $("btnReset").onclick=()=>{$("filterType").value="";$("filterStatus").value="";$("filterIssue").value="";$("searchBox").value="";renderTable()};
  $("btnAdd").onclick=()=>openEntry();$("btnAdd2").onclick=()=>openEntry();$("btnSave").onclick=saveEntry;$("btnExport").onclick=exportExcel;
  $("btnAddIssue").onclick=()=>{issueDraft.push({issue_type:issueTypes[0]||"",occurrence_count:1,description:"",remarks:""});renderIssueRows()};
  $("btnAddRevision").onclick=()=>{revisionDraft.push({revised_date:"",reason:""});renderRevisionRows()}
}
function fillMasters(){fillMasterSelect("filterType",upsTypes,"All UPS Types");fillMasterSelect("filterIssue",issueTypes,"All Issue Types");fillMasterSelect("upsType",upsTypes);fillMasterSelect("engineer",engineers)}
function filtered(){
  let rows=currentRows(),t=$("filterType").value,s=$("filterStatus").value,i=$("filterIssue").value,q=$("searchBox").value.trim().toLowerCase();
  if(t)rows=rows.filter(r=>r.ups_type===t);
  if(s==="__DELAYED__")rows=rows.filter(r=>eventIsDelayed(eventKeyFor(r),[r]));else if(s)rows=rows.filter(r=>r.status===s);
  if(i)rows=rows.filter(r=>issuesForEvent(eventKeyFor(r)).some(x=>x.issue_type===i));
  if(q)rows=rows.filter(r=>{const k=eventKeyFor(r),ix=issuesForEvent(k).map(x=>`${x.issue_type} ${x.description||""} ${x.remarks||""}`).join(" "),rv=revisionsForEvent(k).map(x=>`${x.revised_date||""} ${x.reason||""}`).join(" ");return(JSON.stringify(r)+" "+ix+" "+rv).toLowerCase().includes(q)});
  return rows
}
function renderTable(){
  const rows=filtered();$("inspectionBody").innerHTML=rows.length?rows.map((r,i)=>{const k=eventKeyFor(r),rev=revisionsForEvent(k),latest=latestRevision(k),issues=issuesForEvent(k),reasons=rev.map(x=>x.reason).filter(Boolean).join(" | ")||"-",isu=issues.length?issues.map(x=>`${x.issue_type} ×${Math.max(1,+x.occurrence_count||1)}`).join(", "):"-",details=issues.map(x=>[x.description,x.remarks].filter(Boolean).join(" — ")).filter(Boolean).join(" | ")||"-";return `<tr><td>${i+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td><td>${r.engineer||""}</td><td>${fmtDate(r.planned_date)}</td><td>${fmtDate(latest?.revised_date)}</td><td>${rev.length}</td><td>${reasons}</td><td>${fmtDate(r.actual_date)}</td><td>${eventDelayDays(k,[r])}</td><td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td><td>${isu}</td><td>${details}</td><td>${r.remarks||"-"}</td><td class="actions"><button onclick="editEntry('${r.id}')">✎</button><button onclick="deleteEntry('${r.id}')">🗑</button></td></tr>`}).join(""):`<tr><td colspan="17" style="text-align:center;padding:30px">No records for this month.</td></tr>`
}
function openEntry(r=null){
  $("entryTitle").textContent=r?"Edit Inspection Entry":"Add Inspection Entry";$("entryId").value=r?.id||"";$("eventKey").value=r?eventKeyFor(r):"";
  const map={customer:"customer_project",soNo:"so_no",qty:"qty",kva:"kva_rating",upsType:"ups_type",engineer:"engineer",plannedDate:"planned_date",actualDate:"actual_date",status:"status",remarks:"remarks"};
  for(const[id,k]of Object.entries(map))$(id).value=r?.[k]??(id==="qty"?1:id==="status"?"Planned":"");
  issueDraft=r?issuesForEvent(eventKeyFor(r)).map(x=>({issue_type:x.issue_type,occurrence_count:Math.max(1,+x.occurrence_count||1),description:x.description||"",remarks:x.remarks||""})):[];
  revisionDraft=r?revisionsForEvent(eventKeyFor(r)).map(x=>({revised_date:x.revised_date||"",reason:x.reason||""})):[];
  renderIssueRows();renderRevisionRows();$("entryDialog").showModal()
}
function renderRevisionRows(){
  const el=$("revisionRows");if(!revisionDraft.length){el.innerHTML='<div class="multi-issue-empty">No revised date. This inspection is on the original planned schedule.</div>';return}
  el.innerHTML=revisionDraft.map((x,i)=>`<div class="revision-row"><label>Revised Date<input data-rdate="${i}" type="date" value="${x.revised_date||""}"></label><label>Reason / Customer Remark<input data-rreason="${i}" value="${String(x.reason||"").replaceAll('"','&quot;')}" placeholder="Why was the date revised?"></label><button type="button" class="issue-remove" onclick="removeRevision(${i})">×</button></div>`).join("");
  revisionDraft.forEach((_,i)=>{document.querySelector(`[data-rdate="${i}"]`).onchange=e=>revisionDraft[i].revised_date=e.target.value;document.querySelector(`[data-rreason="${i}"]`).oninput=e=>revisionDraft[i].reason=e.target.value})
}
window.removeRevision=i=>{revisionDraft.splice(i,1);renderRevisionRows()};
function renderIssueRows(){
  const el=$("inspectionIssueRows");if(!issueDraft.length){el.innerHTML='<div class="multi-issue-empty">No issue recorded. Click <b>＋ Add Issue</b> only if an issue occurred.</div>';return}
  el.innerHTML=issueDraft.map((x,i)=>`<div class="inspection-issue-row"><label>Issue Type<select data-it="${i}">${issueTypes.map(t=>`<option ${t===x.issue_type?"selected":""}>${t}</option>`).join("")}</select></label><label>Occurrence<input data-ic="${i}" type="number" min="1" value="${x.occurrence_count||1}"></label><label class="issue-desc">Description<input data-id="${i}" value="${String(x.description||"").replaceAll('"','&quot;')}"></label><label class="issue-remarks">Issue Remarks<input data-ir="${i}" value="${String(x.remarks||"").replaceAll('"','&quot;')}"></label><button type="button" class="issue-remove" onclick="removeIssue(${i})">×</button></div>`).join("");
  issueDraft.forEach((_,i)=>{document.querySelector(`[data-it="${i}"]`).onchange=e=>issueDraft[i].issue_type=e.target.value;document.querySelector(`[data-ic="${i}"]`).oninput=e=>issueDraft[i].occurrence_count=Math.max(1,+e.target.value||1);document.querySelector(`[data-id="${i}"]`).oninput=e=>issueDraft[i].description=e.target.value;document.querySelector(`[data-ir="${i}"]`).oninput=e=>issueDraft[i].remarks=e.target.value})
}
window.removeIssue=i=>{issueDraft.splice(i,1);renderIssueRows()};
window.editEntry=id=>openEntry(inspections.find(r=>String(r.id)===String(id)));
window.deleteEntry=async id=>{if(!confirm("Delete this inspection line?"))return;const r=inspections.find(x=>String(x.id)===String(id)),k=eventKeyFor(r);const peers=inspections.filter(x=>eventKeyFor(x)===k);if(peers.length===1){await db.from("inspection_issues").delete().eq("event_key",k);await db.from("inspection_revisions").delete().eq("event_key",k)}const q=await db.from("inspections").delete().eq("id",id);if(q.error)return toast(q.error.message,true);await loadAll();renderTable();toast("Entry deleted.")};
async function saveEntry(){
  const existingId=$("entryId").value,eventKey=$("eventKey").value||`MANUAL-${crypto.randomUUID()}`;
  const plannedValue=$("plannedDate").value||null;const shared={customer_project:$("customer").value.trim(),so_no:$("soNo").value.trim()||null,engineer:$("engineer").value||null,planned_date:plannedValue,schedule_month:plannedValue?plannedValue.slice(0,7):currentMonthKey(),actual_date:$("actualDate").value||null,status:$("status").value,remarks:$("remarks").value.trim()||null,event_key:eventKey,legacy_delayed:false,updated_at:new Date().toISOString()};
  const line={...shared,qty:+$("qty").value||1,kva_rating:+$("kva").value||null,ups_type:$("upsType").value||null};
  if(!shared.customer_project)return toast("Customer / Project required.",true);
  let inspectionId=existingId;
  if(existingId){
    const q=await db.from("inspections").update(line).eq("id",existingId);if(q.error)return toast(q.error.message,true);
    const peerShared={customer_project:shared.customer_project,so_no:shared.so_no,engineer:shared.engineer,planned_date:shared.planned_date,schedule_month:shared.schedule_month,actual_date:shared.actual_date,status:shared.status,remarks:shared.remarks,updated_at:shared.updated_at};
    await db.from("inspections").update(peerShared).eq("event_key",eventKey).neq("id",existingId)
  }else{
    const q=await db.from("inspections").insert(line).select("id").single();if(q.error)return toast(q.error.message,true);inspectionId=q.data.id
  }
  await db.from("inspection_issues").delete().eq("event_key",eventKey);
  if(issueDraft.length){const rows=issueDraft.filter(x=>x.issue_type).map(x=>({inspection_id:+inspectionId,event_key:eventKey,issue_type:x.issue_type,occurrence_count:Math.max(1,+x.occurrence_count||1),description:x.description.trim()||null,remarks:x.remarks.trim()||null}));if(rows.length){const q=await db.from("inspection_issues").insert(rows);if(q.error)return toast(q.error.message,true)}}
  await db.from("inspection_revisions").delete().eq("event_key",eventKey);
  const revs=revisionDraft.filter(x=>x.revised_date||x.reason.trim()).map(x=>({event_key:eventKey,revised_date:x.revised_date||null,reason:x.reason.trim()||null}));
  if(revs.length){const q=await db.from("inspection_revisions").insert(revs);if(q.error)return toast(q.error.message,true)}
  await loadAll();$("entryDialog").close();renderTable();toast(revs.length?"Saved — inspection is counted as Delayed/Revised.":"Inspection entry saved.")
}
function exportExcel(){
  const rows=filtered().map((r,i)=>{const k=eventKeyFor(r),rev=revisionsForEvent(k),issues=issuesForEvent(k);return{"Sr No":i+1,"Customer / Project":r.customer_project,"SO No":r.so_no,"Qty":r.qty,"kVA Rating":r.kva_rating,"UPS Type":r.ups_type,"Inspection Given By":r.engineer,"Planned Date":r.planned_date,"Latest Revised Date":latestRevision(k)?.revised_date||"","Revision Count":rev.length,"Revision Reasons":rev.map(x=>x.reason).filter(Boolean).join(" | "),"Actual Inspection Date":r.actual_date,"Days / Delay":eventDelayDays(k,[r]),"Status":r.status,"Issues":issues.map(x=>`${x.issue_type} ×${x.occurrence_count||1}`).join(", "),"Issue Details":issues.map(x=>[x.description,x.remarks].filter(Boolean).join(" — ")).join(" | "),"Remarks":r.remarks}});
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inspection");XLSX.writeFile(wb,`Inspection_${currentMonthKey()}.xlsx`)
}
bootRegister();
