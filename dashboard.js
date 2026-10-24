
let productChart,monthlyChart,issueChart;
const PRODUCT_COLORS=["#20a5ff","#22db8c","#ffb735","#b66cff","#ff607a","#38d7d4","#8fa6ff","#7dd35c"];
const barValuePlugin={id:"barValuePlugin",afterDatasetsDraw(chart){const{ctx}=chart;ctx.save();ctx.textAlign="center";ctx.font="700 10px Segoe UI";chart.data.datasets.forEach((ds,di)=>{const meta=chart.getDatasetMeta(di);meta.data.forEach((bar,i)=>{const v=+ds.data[i]||0;if(!v)return;ctx.fillStyle=di===0?"#dfeaf4":"#62dcff";ctx.fillText(String(v),bar.x,Math.max(12,bar.y-5))})});ctx.restore()}};
const ISSUE_COLORS=["#ff5069","#ff9f43","#ffc93c","#43b8ff","#ad68ff","#3bd5a2","#91a5b7","#ef6df0"];

async function bootDashboard(){
  navLink("dashboard");
  buildMonthPicker();
  if(typeof initPrettyMonthPicker==="function")initPrettyMonthPicker(renderDashboard);
  else if(typeof buildPrettyMonthPicker==="function")buildPrettyMonthPicker();

  const hadCache=typeof loadPortalCache==="function" && loadPortalCache();

  if(hadCache){
    renderDashboard();
    if($("modeNote"))$("modeNote").textContent="SYNCING LIVE DATA • Showing last saved values.";
  }else{
    setDashboardLoadingState(true);
  }

  try{
    await initCloud();
    setDashboardLoadingState(false);

    subscribe("inspections",renderDashboard);
    subscribe("monthly_production",renderDashboard);
    try{subscribe("monthly_history",renderDashboard)}catch(e){}
    try{subscribe("monthly_history_products",renderDashboard)}catch(e){}
    try{subscribe("monthly_history_issues",renderDashboard)}catch(e){}
    try{subscribe("inspection_issues",renderDashboard)}catch(e){}

    renderDashboard();
    if($("modeNote"))$("modeNote").textContent="LIVE ONLINE • Supabase realtime connected.";
  }catch(e){
    console.error(e);
    setDashboardLoadingState(false);
    updateLiveBadge();
    if($("modeNote"))$("modeNote").textContent=hadCache
      ?"OFFLINE / SYNC FAILED • Showing last saved data."
      :"Cloud connection failed: "+e.message;
  }
}

function setDashboardLoadingState(loading){
  const ids=["kpiManufactured","kpiOffered","kpiPlanned","kpiCompleted","kpiDelayed","kpiCancelled","kpiWaiver","kpiInspectionsWithIssues"];
  ids.forEach(id=>{
    const el=$(id); if(!el)return;
    if(loading){
      el.textContent="—";
      el.classList.add("loading-value");
    }else{
      el.classList.remove("loading-value");
    }
  });
  document.querySelectorAll(".dashboard-grid .card").forEach(c=>c.classList.toggle("loading-card",loading));
}
function renderDashboard(){
  const m=currentMonthKey(),rows=rowsForMonth(m),snap=monthSnapshot(m);
  $("kpiManufactured").textContent=snap.manufactured;$("kpiOffered").textContent=snap.offered;$("kpiPlanned").textContent=snap.planned_inspections;
  $("kpiCompleted").textContent=snap.completed;$("kpiDelayed").textContent=snap.delayed;$("kpiCancelled").textContent=snap.cancelled;$("kpiWaiver").textContent=snap.waiver;
  renderHistoryBanner(snap);drawProduct(m);drawMonthly(m);drawIssues(m);renderDashboardTable(rows,snap)
}
function renderHistoryBanner(s){
  const el=$("historyBanner");if(!el)return;if(s.source!=="history"){el.classList.add("hidden");el.innerHTML="";return}
  el.classList.remove("hidden");el.innerHTML=`<div class="history-banner-title"><b>${fmtMonthKey(s.month)} Historical Summary</b><span>Aggregate back-entry</span></div><div class="history-banner-metrics"><div><small>Planned Customers</small><strong>${s.planned_inspections}</strong></div><div><small>Completed</small><strong>${s.completed}</strong></div><div><small>Delayed</small><strong>${s.delayed}</strong></div><div><small>UPS Offered</small><strong>${s.offered}</strong></div></div>`
}
function renderLegend(el,entries,total,colors){
  el.innerHTML=entries.map(([name,val],i)=>`<div class="legend-chip"><span class="legend-dot" style="--dot:${colors[i%colors.length]}"></span><span class="legend-name">${name}</span><span class="legend-meta"><b>${val}</b> <em>${total?Math.round(val/total*100):0}%</em></span></div>`).join("")
}
function drawProduct(m){
  const arr=Object.entries(productBreakdown(m)).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("productTotal").textContent=total+" offered";$("productCenter").textContent=total;renderLegend($("productLegend"),arr,total,PRODUCT_COLORS);
  productChart?.destroy();productChart=new Chart($("productChart"),{type:"doughnut",data:{labels:arr.map(x=>x[0]),datasets:[{data:arr.map(x=>x[1]),backgroundColor:arr.map((_,i)=>PRODUCT_COLORS[i%PRODUCT_COLORS.length]),borderColor:"#081a2b",borderWidth:3}]},options:{cutout:"74%",plugins:{legend:{display:false}}}})
}
function drawMonthly(selectedMonth){
  const year=+selectedMonth.slice(0,4),snaps=yearlySnapshots(year);
  monthlyChart?.destroy();const ctx=$("monthlyChart").getContext("2d");
  const silver=ctx.createLinearGradient(0,0,0,270);silver.addColorStop(0,"rgba(235,244,255,.84)");silver.addColorStop(.35,"rgba(181,200,220,.66)");silver.addColorStop(1,"rgba(119,143,165,.30)");
  const blue=ctx.createLinearGradient(0,0,0,270);blue.addColorStop(0,"rgba(46,205,255,1)");blue.addColorStop(.45,"rgba(31,170,255,.94)");blue.addColorStop(1,"rgba(18,123,237,.82)");
  monthlyChart=new Chart($("monthlyChart"),{type:"bar",plugins:[barValuePlugin],data:{labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],datasets:[
    {label:"Total UPS Manufactured",data:snaps.map(x=>x.manufactured),grouped:false,backgroundColor:silver,borderColor:"rgba(235,244,255,.85)",borderWidth:1.3,borderRadius:10,barPercentage:.68,categoryPercentage:.82,order:1},
    {label:"Offered for Inspection",data:snaps.map(x=>x.offered),grouped:false,backgroundColor:blue,borderColor:"rgba(108,229,255,.98)",borderWidth:1,borderRadius:9,barPercentage:.40,categoryPercentage:.82,order:2}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",align:"end",labels:{color:"#dceaf6",usePointStyle:true,pointStyle:"circle",padding:16,font:{size:10,weight:"700"}}}},scales:{x:{offset:true,grid:{color:"rgba(53,107,148,.12)"},ticks:{color:"#d7e7f3",autoSkip:false,maxRotation:0,minRotation:0,font:{size:10,weight:"700"}}},y:{beginAtZero:true,grid:{color:"rgba(53,107,148,.20)"},ticks:{color:"#9cb8cd",precision:0}}}}});
  document.querySelector(".trend-card .pill").textContent=`Jan–Dec ${year}`
}
function drawIssues(m){
  const arr=Object.entries(issueBreakdown(m)).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("issueTotal").textContent=total+" issue"+(total===1?"":"s");$("issueCenter").textContent=total;
  if(!arr.length){$("issueEmpty").style.display="grid";$("issueDonutLayout").style.display="none";issueChart?.destroy();return}
  $("issueEmpty").style.display="none";$("issueDonutLayout").style.display="grid";renderLegend($("issueLegend"),arr,total,ISSUE_COLORS);
  issueChart?.destroy();issueChart=new Chart($("issueChart"),{type:"doughnut",data:{labels:arr.map(x=>x[0]),datasets:[{data:arr.map(x=>x[1]),backgroundColor:arr.map((_,i)=>ISSUE_COLORS[i%ISSUE_COLORS.length]),borderColor:"#081a2b",borderWidth:3}]},options:{cutout:"74%",plugins:{legend:{display:false}}}})
}
function issueSummary(eventKey){
  const a=issuesForEvent(eventKey);return{types:a.length?a.map(x=>`${x.issue_type} ×${Math.max(1,+x.occurrence_count||1)}`).join(", "):"-",details:a.map(x=>[x.description,x.remarks].filter(Boolean).join(" — ")).filter(Boolean).join(" | ")||"-"}
}
function renderDashboardTable(rows,snap){
  if(!rows.length&&snap.source==="history"){$("dashboardBody").innerHTML=`<tr><td colspan="16" style="text-align:center;padding:28px"><b>${fmtMonthKey(snap.month)}</b> is stored as consolidated historical data.</td></tr>`;return}
  $("dashboardBody").innerHTML=rows.length?rows.slice(0,16).map((r,i)=>{
    const k=eventKeyFor(r),rev=revisionsForEvent(k),latest=latestRevision(k),isu=issueSummary(k);
    return `<tr><td>${i+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td><td>${engineerDisplay(r)}</td><td>${fmtDate(r.planned_date)}</td><td>${fmtDate(latest?.revised_date)}</td><td>${rev.length}</td><td>${fmtDate(r.actual_date)}</td><td>${eventDelayDays(k,[r])}</td><td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td><td>${isu.types}</td><td>${isu.details}</td><td>${r.remarks||"-"}</td><td><a class="mini-action" href="register.html?edit=${r.id}">✎</a></td></tr>`
  }).join(""):`<tr><td colspan="16" style="text-align:center;padding:28px">No records for this month.</td></tr>`
}
bootDashboard();
