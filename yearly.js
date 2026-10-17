let yearTrendChart,yearStatusChart;
const yearlyValuePlugin={id:"yearlyValuePlugin",afterDatasetsDraw(chart){const{ctx}=chart;ctx.save();ctx.textAlign="center";ctx.font="700 10px Segoe UI";chart.data.datasets.forEach((ds,di)=>{chart.getDatasetMeta(di).data.forEach((bar,i)=>{const v=+ds.data[i]||0;if(!v)return;ctx.fillStyle=di===0?"#dfeaf4":"#6ce2ff";ctx.fillText(String(v),bar.x,Math.max(12,bar.y-5))})});ctx.restore()}};
async function bootYearly(){
  navLink("yearly");
  try{await initCloud();$("yearPicker").onchange=renderYearly;["inspections","monthly_production","monthly_history","monthly_history_products","monthly_history_issues","inspection_issues","inspection_revisions"].forEach(t=>subscribe(t,renderYearly));renderYearly();$("modeNote").textContent="LIVE ONLINE • Yearly summary uses the same Supabase data."}
  catch(e){console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message}
}
function renderYearly(){
  const year=+$("yearPicker").value,s=yearlySnapshots(year),tot=k=>s.reduce((a,x)=>a+(+x[k]||0),0);
  $("yearManufactured").textContent=tot("manufactured");$("yearOffered").textContent=tot("offered");$("yearPlanned").textContent=tot("planned_inspections");$("yearCompleted").textContent=tot("completed");$("yearDelayed").textContent=tot("delayed");$("yearRevisions").textContent=tot("revisions");$("yearCancelled").textContent=tot("cancelled");$("yearWaiver").textContent=tot("waiver");$("yearIssueInspections").textContent=tot("inspections_with_issues");$("yearIssues").textContent=tot("issue_incidents");$("yearPill").textContent=year;
  $("yearSummaryBody").innerHTML=s.map((x,i)=>`<tr><td>${MONTHS[i]}</td><td>${x.manufactured}</td><td>${x.offered}</td><td>${x.planned_inspections}</td><td>${x.completed}</td><td>${x.delayed}</td><td>${x.revisions}</td><td>${x.cancelled}</td><td>${x.waiver}</td><td>${x.inspections_with_issues}</td><td>${x.issue_incidents}</td></tr>`).join("");
  drawYearTrend(s);drawYearStatus(s)
}
function drawYearTrend(s){
  yearTrendChart?.destroy();const ctx=$("yearTrendChart").getContext("2d"),silver=ctx.createLinearGradient(0,0,0,300),blue=ctx.createLinearGradient(0,0,0,300);silver.addColorStop(0,"rgba(235,244,255,.84)");silver.addColorStop(1,"rgba(119,143,165,.30)");blue.addColorStop(0,"rgba(46,205,255,1)");blue.addColorStop(1,"rgba(18,123,237,.82)");
  yearTrendChart=new Chart($("yearTrendChart"),{type:"bar",plugins:[yearlyValuePlugin],data:{labels:MONTHS.map(x=>x.slice(0,3)),datasets:[{label:"Manufactured",data:s.map(x=>x.manufactured),grouped:false,backgroundColor:silver,borderColor:"#dcebf7",borderWidth:1,borderRadius:10,barPercentage:.68,order:1},{label:"Offered",data:s.map(x=>x.offered),grouped:false,backgroundColor:blue,borderColor:"#64dbff",borderWidth:1,borderRadius:9,barPercentage:.40,order:2}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:14}},plugins:{legend:{labels:{color:"#dceaf6",usePointStyle:true}}},scales:{x:{grid:{color:"rgba(53,107,148,.12)"},ticks:{color:"#d7e7f3",autoSkip:false}},y:{beginAtZero:true,grace:"12%",grid:{color:"rgba(53,107,148,.2)"},ticks:{color:"#9cb8cd",precision:0}}}}})
}
function drawYearStatus(s){
  yearStatusChart?.destroy();yearStatusChart=new Chart($("yearStatusChart"),{type:"bar",data:{labels:MONTHS.map(x=>x.slice(0,3)),datasets:[{label:"Completed",data:s.map(x=>x.completed),backgroundColor:"#2bd47f",borderRadius:5},{label:"Delayed / Revised",data:s.map(x=>x.delayed),backgroundColor:"#ffb31d",borderRadius:5},{label:"Cancelled",data:s.map(x=>x.cancelled),backgroundColor:"#ff405b",borderRadius:5},{label:"Waiver",data:s.map(x=>x.waiver),backgroundColor:"#b45eff",borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#dceaf6",usePointStyle:true}}},scales:{x:{stacked:false,grid:{display:false},ticks:{color:"#d7e7f3",autoSkip:false}},y:{stacked:false,beginAtZero:true,grid:{color:"rgba(53,107,148,.2)"},ticks:{color:"#9cb8cd",precision:0}}}}})
}
bootYearly();
