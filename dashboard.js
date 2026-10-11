
let productChart,monthlyChart,issueChart;
async function bootDashboard(){
  navLink("dashboard");buildMonthPicker();
  $("monthPicker").onchange=renderDashboard;
  try{
    await initCloud();
    subscribe("inspections",renderDashboard);subscribe("monthly_production",renderDashboard);
    renderDashboard();
    $("modeNote").textContent="LIVE ONLINE • Supabase realtime connected on every device.";
  }catch(e){
    console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message;
  }
}
function renderDashboard(){
  const rows=currentRows(),m=currentMonthKey(),manufactured=+production[m]||0,offered=qtySum(rows);
  $("kpiManufactured").textContent=manufactured;$("kpiOffered").textContent=offered;
  $("kpiCompleted").textContent=statusQty(rows,"Completed");$("kpiDelayed").textContent=statusQty(rows,"Delayed");
  $("kpiCancelled").textContent=statusQty(rows,"Cancelled");$("kpiWaiver").textContent=statusQty(rows,"Waiver");
  $("sumPending").textContent=Math.max(0,manufactured-offered);$("sumCoverage").textContent=manufactured?Math.round(offered/manufactured*100)+"%":"0%";
  $("sumIssues").textContent=rows.filter(r=>r.issue_type).length;$("sumMonth").textContent=$("monthPicker").selectedOptions[0]?.textContent||"";
  drawProduct(rows);drawMonthly();drawIssues(rows);
}
function drawProduct(rows){
  const map={};rows.forEach(r=>map[r.ups_type||"Unknown"]=(map[r.ups_type||"Unknown"]||0)+(+r.qty||0));
  $("productTotal").textContent=qtySum(rows)+" offered";
  productChart?.destroy();
  productChart=new Chart($("productChart"),{
    type:"doughnut",data:{labels:Object.keys(map),datasets:[{data:Object.values(map),borderWidth:0,hoverOffset:6}]},
    options:{cutout:"70%",plugins:{legend:{position:"right",labels:{color:"#dceaf5",boxWidth:10,usePointStyle:true,padding:14}}}}
  })
}
function drawMonthly(){
  const keys=MONTHS.map((_,i)=>`2026-${String(i+1).padStart(2,"0")}`);
  const manufactured=keys.map(k=>+production[k]||0);
  const offered=keys.map(k=>qtySum(inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===k)));
  monthlyChart?.destroy();
  monthlyChart=new Chart($("monthlyChart"),{
    type:"bar",
    data:{labels:MONTHS,datasets:[
      {label:"Total UPS Manufactured",data:manufactured,backgroundColor:"rgba(179,196,214,.55)",borderRadius:7,barPercentage:.86,categoryPercentage:.68,order:2},
      {label:"Offered for Inspection",data:offered,backgroundColor:"rgba(30,157,255,.96)",borderRadius:7,barPercentage:.5,categoryPercentage:.68,order:1}
    ]},
    options:{plugins:{legend:{labels:{color:"#dceaf6",usePointStyle:true,boxWidth:10}}},
      scales:{x:{grid:{display:false},ticks:{color:"#c8d9e7",maxRotation:0}},y:{beginAtZero:true,grid:{color:"#244158"},ticks:{color:"#c8d9e7",precision:0}}}}
  })
}
function drawIssues(rows){
  const map={};rows.filter(r=>r.issue_type).forEach(r=>map[r.issue_type]=(map[r.issue_type]||0)+(+r.qty||0));
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,7),total=arr.reduce((a,x)=>a+x[1],0);
  $("issueTotal").textContent=total+" issues";
  if(!arr.length){
    $("issueEmpty").style.display="grid";$("issueCanvasWrap").style.display="none";issueChart?.destroy();return
  }
  $("issueEmpty").style.display="none";$("issueCanvasWrap").style.display="block";
  issueChart?.destroy();
  issueChart=new Chart($("issueChart"),{
    type:"bar",data:{labels:arr.map(x=>x[0]),datasets:[{data:arr.map(x=>x[1]),backgroundColor:["#ff5069","#ff9f43","#ffc93c","#43b8ff","#ad68ff","#3bd5a2","#91a5b7"],borderRadius:7,barThickness:14}]},
    options:{indexAxis:"y",maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{beginAtZero:true,grid:{color:"#244158"},ticks:{color:"#c9d9e7",precision:0}},y:{grid:{display:false},ticks:{color:"#dce9f4",font:{size:10}}}}}
  })
}
bootDashboard();
