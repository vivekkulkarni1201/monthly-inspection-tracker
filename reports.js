let reportEvents=[];
async function bootReports(){
  navLink("reports");
  try{await initCloud();fillReportFilters();wireReports();renderReports();["inspections","inspection_issues","inspection_revisions","monthly_production","monthly_history"].forEach(t=>subscribe(t,renderReports));$("modeNote").textContent="LIVE ONLINE • Reports use the same Supabase data."}
  catch(e){console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message}
}
function fillReportFilters(){
  $("reportMonth").innerHTML='<option value="">All Months</option>'+MONTHS.map((m,i)=>`<option value="${String(i+1).padStart(2,"0")}">${m}</option>`).join("");
  fillMasterSelect("reportType",upsTypes,"All UPS Types");fillMasterSelect("reportEngineer",engineers,"All Engineers");fillMasterSelect("reportIssue",issueTypes,"All Issue Types");
  const ratings=[...new Set(inspections.map(r=>+r.kva_rating).filter(Boolean))].sort((a,b)=>a-b);$("reportKva").innerHTML='<option value="">All Ratings</option>'+ratings.map(x=>`<option value="${x}">${x}</option>`).join("");
  const customers=[...new Set(inspections.map(r=>r.customer_project).filter(Boolean))].sort((a,b)=>a.localeCompare(b));$("reportCustomer").innerHTML='<option value="">All Customers</option>'+customers.map(x=>`<option>${x}</option>`).join("")
}
function wireReports(){["reportYear","reportMonth","reportType","reportKva","reportCustomer","reportStatus","reportEngineer","reportIssue"].forEach(id=>$(id).onchange=renderReports);$("btnReportReset").onclick=()=>{["reportMonth","reportType","reportKva","reportCustomer","reportStatus","reportEngineer","reportIssue"].forEach(id=>$(id).value="");$("reportYear").value="2026";renderReports()};$("btnReportExport").onclick=exportReportExcel}
function eventRecords(){
  const y=$("reportYear").value,m=$("reportMonth").value,type=$("reportType").value,kva=$("reportKva").value,cust=$("reportCustomer").value,status=$("reportStatus").value,eng=$("reportEngineer").value,issue=$("reportIssue").value;
  let rows=inspections.filter(r=>String(r.schedule_month||monthKey(r.planned_date)).startsWith(y));if(m)rows=rows.filter(r=>(r.schedule_month||monthKey(r.planned_date))===`${y}-${m}`);
  const allGroups=groupEvents(rows);const result=[];
  for(const[k,rs0]of allGroups){
    let rs=rs0;
    if(type)rs=rs.filter(r=>r.ups_type===type);if(kva)rs=rs.filter(r=>String(r.kva_rating)===String(kva));if(cust)rs=rs.filter(r=>r.customer_project===cust);if(!rs.length)continue;
    const lead=rs0[0],outcome=groupOutcome(rs0),ix=issuesForEvent(k),rv=revisionsForEvent(k);
    if(status==="__DELAYED__"&&!eventIsDelayed(k,rs0))continue;if(status&&status!=="__DELAYED__"&&outcome!==status)continue;
    if(eng&&!rs0.some(r=>r.engineer===eng||r.engineer_2===eng))continue;if(issue&&!ix.some(x=>x.issue_type===issue))continue;
    result.push({key:k,rows:rs,allRows:rs0,lead,outcome,issues:ix,revisions:rv})
  }
  return result
}
function renderReports(){
  reportEvents=eventRecords();const y=+$("reportYear").value,m=$("reportMonth").value;
  const months=m?[`${y}-${m}`]:MONTHS.map((_,i)=>`${y}-${String(i+1).padStart(2,"0")}`);
  const manufactured=months.reduce((s,k)=>s+(+monthSnapshot(k).manufactured||0),0);
  const offered=reportEvents.reduce((s,e)=>s+qtySum(e.rows),0),planned=reportEvents.length,completed=reportEvents.filter(e=>e.outcome==="Completed").length,delayed=reportEvents.filter(e=>eventIsDelayed(e.key,e.allRows)).length,revisions=reportEvents.reduce((s,e)=>s+e.revisions.length,0),cancelled=reportEvents.filter(e=>e.outcome==="Cancelled").length,waiver=reportEvents.filter(e=>e.outcome==="Waiver").length,issueInspections=reportEvents.filter(e=>e.issues.length).length,issueIncidents=reportEvents.reduce((s,e)=>s+e.issues.reduce((a,x)=>a+Math.max(1,+x.occurrence_count||1),0),0);
  [["rManufactured",manufactured],["rOffered",offered],["rPlanned",planned],["rCompleted",completed],["rDelayed",delayed],["rRevisions",revisions],["rCancelled",cancelled],["rWaiver",waiver],["rIssueInspections",issueInspections],["rIssueIncidents",issueIncidents]].forEach(([id,v])=>$(id).textContent=v);
  $("reportResultText").textContent=`${planned} matching inspection event${planned===1?"":"s"}`;
  $("reportBody").innerHTML=reportEvents.length?reportEvents.map(e=>{const r=e.lead,latest=latestRevision(e.key),issueText=e.issues.map(x=>x.issue_type).join(", ")||"-",incident=e.issues.reduce((s,x)=>s+Math.max(1,+x.occurrence_count||1),0),lines=e.rows.map(x=>`${x.ups_type||"-"} / ${x.kva_rating||"-"}kVA ×${x.qty||0}`).join(" | ");return `<tr><td>${fmtMonthKey(r.schedule_month||monthKey(r.planned_date))}</td><td>${r.customer_project||"-"}</td><td>${r.so_no||"-"}</td><td>${lines}</td><td>${qtySum(e.rows)}</td><td>${engineerDisplay(r)}</td><td>${fmtDate(r.planned_date)}</td><td>${fmtDate(latest?.revised_date)}</td><td>${e.revisions.length}</td><td>${fmtDate(r.actual_date)}</td><td>${e.outcome}</td><td>${eventIsDelayed(e.key,e.allRows)?"Yes":"No"}</td><td>${issueText}</td><td>${incident}</td><td>${r.remarks||"-"}</td></tr>`}).join(""):`<tr><td colspan="15" style="text-align:center;padding:24px">No matching records.</td></tr>`
}
function exportReportExcel(){
  const filters={Year:$("reportYear").value,Month:$("reportMonth").selectedOptions[0]?.textContent||"All Months","UPS Type":$("reportType").value||"All","kVA Rating":$("reportKva").value||"All","Customer":$("reportCustomer").value||"All","Status":$("reportStatus").value||"All","Engineer":$("reportEngineer").value||"All","Issue Type":$("reportIssue").value||"All"};
  const summary=[...Object.entries(filters).map(([Metric,Value])=>({Metric,Value})),{Metric:"Manufactured UPS (period total; not segmented by detail filters)",Value:+$("rManufactured").textContent},{Metric:"Offered UPS",Value:+$("rOffered").textContent},{Metric:"Planned Inspections",Value:+$("rPlanned").textContent},{Metric:"Completed",Value:+$("rCompleted").textContent},{Metric:"Delayed / Revised",Value:+$("rDelayed").textContent},{Metric:"Date Revisions",Value:+$("rRevisions").textContent},{Metric:"Inspections with Issues",Value:+$("rIssueInspections").textContent},{Metric:"Issue Incidents",Value:+$("rIssueIncidents").textContent},{Metric:"Cancelled",Value:+$("rCancelled").textContent},{Metric:"Waiver",Value:+$("rWaiver").textContent}];
  const details=reportEvents.map((e,i)=>{const r=e.lead;return{"Sr No":i+1,"Month":r.schedule_month||monthKey(r.planned_date),"Customer / Project":r.customer_project,"SO No":r.so_no,"UPS Lines":e.rows.map(x=>`${x.ups_type||"-"} ${x.kva_rating||"-"}kVA x${x.qty||0}`).join(" | "),"Offered Qty":qtySum(e.rows),"Engineers":engineerDisplay(r),"Planned Date":r.planned_date,"Latest Revised Date":latestRevision(e.key)?.revised_date||"","Revision Count":e.revisions.length,"Revision Reasons":e.revisions.map(x=>x.reason).filter(Boolean).join(" | "),"Actual Date":r.actual_date,"Outcome":e.outcome,"Delayed / Revised":eventIsDelayed(e.key,e.allRows)?"Yes":"No","Issue Types":e.issues.map(x=>x.issue_type).join(", "),"Issue Incidents":e.issues.reduce((s,x)=>s+Math.max(1,+x.occurrence_count||1),0),"Issue Details":e.issues.map(x=>[x.description,x.remarks].filter(Boolean).join(" — ")).join(" | "),"Remarks":r.remarks,"Source":r.source_channel||""}});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),"Summary");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(details),"Detailed Records");XLSX.writeFile(wb,`Inspection_Report_${$("reportYear").value}_${$("reportMonth").value||"ALL"}.xlsx`)
}
bootReports();