
async function bootRegister(){
  navLink("register");buildMonthPicker();
  try{await initCloud();subscribe("inspections",()=>{renderTable()});fillMasters();wire();renderTable();$("modeNote").textContent="LIVE ONLINE • Register updates are stored in Supabase."}
  catch(e){console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message}
  const params=new URLSearchParams(location.search);
  if(params.get("action")==="add")setTimeout(()=>openEntry(),200);
  if(params.get("edit"))setTimeout(()=>{
    const r=inspections.find(x=>String(x.id)===String(params.get("edit")));
    if(r)openEntry(r);
  },220)
}
function wire(){
  $("monthPicker").onchange=renderTable;$("filterType").onchange=renderTable;$("filterStatus").onchange=renderTable;$("filterIssue").onchange=renderTable;$("searchBox").oninput=renderTable;
  $("btnReset").onclick=()=>{$("filterType").value="";$("filterStatus").value="";$("filterIssue").value="";$("searchBox").value="";renderTable()};
  $("btnAdd").onclick=()=>openEntry();$("btnAdd2").onclick=()=>openEntry();$("btnSave").onclick=saveEntry;$("btnExport").onclick=exportExcel;
}
function fillMasters(){
  fillMasterSelect("filterType",upsTypes,"All UPS Types");fillMasterSelect("filterIssue",issueTypes,"All Issue Types");
  fillMasterSelect("upsType",upsTypes);fillMasterSelect("issueType",issueTypes);fillMasterSelect("engineer",engineers);
}
function filtered(){
  let rows=currentRows(),t=$("filterType").value,s=$("filterStatus").value,i=$("filterIssue").value,q=$("searchBox").value.trim().toLowerCase();
  if(t)rows=rows.filter(r=>r.ups_type===t);if(s)rows=rows.filter(r=>r.status===s);if(i)rows=rows.filter(r=>r.issue_type===i);
  if(q)rows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));return rows;
}
function renderTable(){
  const rows=filtered();$("inspectionBody").innerHTML=rows.length?rows.map((r,i)=>`<tr>
<td>${i+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td><td>${r.engineer||""}</td>
<td>${fmtDate(r.planned_date)}</td><td>${fmtDate(r.revised_date_1)}</td><td>${fmtDate(r.revised_date_2)}</td><td>${fmtDate(r.revised_date_3)}</td><td>${fmtDate(r.revised_date_4)}</td><td>${fmtDate(r.revised_date_5)}</td>
<td>${fmtDate(r.actual_date)}</td><td>${daysDelay(r)}</td><td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td>
<td>${r.issue_type||"-"}</td><td>${r.issue_at_time||"-"}</td><td>${r.remarks||"-"}</td>
<td class="actions"><button onclick="editEntry('${r.id}')">✎</button><button onclick="deleteEntry('${r.id}')">🗑</button></td></tr>`).join(""):`<tr><td colspan="19" style="text-align:center;padding:30px">No records for this month.</td></tr>`
}
function openEntry(r=null){
  $("entryTitle").textContent=r?"Edit Inspection Entry":"Add Inspection Entry";$("entryId").value=r?.id||"";
  const map={customer:"customer_project",qty:"qty",kva:"kva_rating",upsType:"ups_type",engineer:"engineer",plannedDate:"planned_date",rev1:"revised_date_1",rev2:"revised_date_2",rev3:"revised_date_3",rev4:"revised_date_4",rev5:"revised_date_5",actualDate:"actual_date",status:"status",issueType:"issue_type",issueAtTime:"issue_at_time",remarks:"remarks"};
  for(const [id,k] of Object.entries(map))$(id).value=r?.[k]??(id==="qty"?1:id==="status"?"Planned":"");
  $("entryDialog").showModal()
}
window.editEntry=id=>openEntry(inspections.find(r=>String(r.id)===String(id)));
window.deleteEntry=async id=>{if(!confirm("Delete this inspection entry?"))return;const {error}=await db.from("inspections").delete().eq("id",id);if(error)return toast(error.message,true);await loadAll();renderTable();toast("Entry deleted.")};
async function saveEntry(){
  const obj={customer_project:$("customer").value.trim(),qty:+$("qty").value||1,kva_rating:+$("kva").value||null,ups_type:$("upsType").value||null,engineer:$("engineer").value||null,
  planned_date:$("plannedDate").value||null,revised_date_1:$("rev1").value||null,revised_date_2:$("rev2").value||null,revised_date_3:$("rev3").value||null,revised_date_4:$("rev4").value||null,revised_date_5:$("rev5").value||null,
  actual_date:$("actualDate").value||null,status:$("status").value,issue_type:$("issueType").value||null,issue_at_time:$("issueAtTime").value.trim()||null,remarks:$("remarks").value.trim()||null,updated_at:new Date().toISOString()};
  if(!obj.customer_project)return toast("Customer / Project required.",true);
  const id=$("entryId").value;const q=id?db.from("inspections").update(obj).eq("id",id):db.from("inspections").insert(obj);const {error}=await q;if(error)return toast(error.message,true);
  await loadAll();$("entryDialog").close();renderTable();toast("Inspection entry saved.")
}
function exportExcel(){
  const rows=filtered().map((r,i)=>({"Sr No":i+1,"Customer / Project":r.customer_project,"Qty":r.qty,"kVA Rating":r.kva_rating,"UPS Type":r.ups_type,"Inspection Given By":r.engineer,
  "Planned Date":r.planned_date,"Revised Date 1":r.revised_date_1,"Revised Date 2":r.revised_date_2,"Revised Date 3":r.revised_date_3,"Revised Date 4":r.revised_date_4,"Revised Date 5":r.revised_date_5,
  "Actual Inspection Date":r.actual_date,"Days / Delay":daysDelay(r),"Status":r.status,"Issue Type":r.issue_type,"Issue at the Time":r.issue_at_time,"Remarks":r.remarks}));
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inspection");XLSX.writeFile(wb,`Inspection_${currentMonthKey()}.xlsx`)
}
bootRegister();
