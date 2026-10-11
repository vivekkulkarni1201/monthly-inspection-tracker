
let productChart,monthlyChart,issueChart;
const PRODUCT_COLORS=["#20a5ff","#22db8c","#ffb735","#b66cff","#ff607a","#38d7d4","#8fa6ff","#7dd35c"];
const ISSUE_COLORS=["#ff5069","#ff9f43","#ffc93c","#43b8ff","#ad68ff","#3bd5a2","#91a5b7","#ef6df0"];

async function bootDashboard(){
  navLink("dashboard");
  buildMonthPicker();
  initPrettyMonthPicker(renderDashboard);
  try{
    await initCloud();
    subscribe("inspections",renderDashboard);
    subscribe("monthly_production",renderDashboard);
    subscribe("monthly_history",renderDashboard);
    subscribe("monthly_history_products",renderDashboard);
    subscribe("monthly_history_issues",renderDashboard);
    renderDashboard();
    $("modeNote").textContent="LIVE ONLINE • Supabase realtime connected on every device.";
  }catch(e){
    console.error(e);updateLiveBadge();$("modeNote").textContent="Cloud connection failed: "+e.message;
  }
}
function renderDashboard(){
  const m=currentMonthKey(),rows=rowsForMonth(m),snap=monthSnapshot(m);
  $("kpiManufactured").textContent=snap.manufactured;
  $("kpiOffered").textContent=snap.offered;
  $("kpiCompleted").textContent=snap.completed;
  $("kpiDelayed").textContent=snap.delayed;
  $("kpiCancelled").textContent=snap.cancelled;
  $("kpiWaiver").textContent=snap.waiver;
  renderHistoryBanner(snap);
  drawProduct(m);
  drawMonthly(m);
  drawIssues(m);
  renderDashboardTable(rows,snap);
}
function renderHistoryBanner(snap){
  const el=$("historyBanner");if(!el)return;
  if(snap.source!=="history"){el.classList.add("hidden");el.innerHTML="";return}
  el.classList.remove("hidden");
  el.innerHTML=`<div class="history-banner-title"><b>${fmtMonthKey(snap.month)} Historical Summary</b><span>Aggregate back-entry</span></div>
    <div class="history-banner-metrics">
      <div><small>Planned Customers</small><strong>${snap.planned_inspections}</strong></div>
      <div><small>Completed Customers</small><strong>${snap.completed}</strong></div>
      <div><small>UPS Offered</small><strong>${snap.offered}</strong></div>
      <div><small>Total Manufactured</small><strong>${snap.manufactured}</strong></div>
    </div>`;
}
function renderLegend(el,entries,total,colors){
  if(!entries.length){el.innerHTML="";return}
  el.innerHTML=entries.map(([name,val],i)=>{
    const pct=total?Math.round(val/total*100):0;
    return `<div class="legend-chip"><span class="legend-dot" style="--dot:${colors[i%colors.length]}"></span><span class="legend-name" title="${name}">${name}</span><span class="legend-meta"><b>${val}</b> <em>${pct}%</em></span></div>`;
  }).join("");
}
function drawProduct(m){
  const map=productBreakdown(m),arr=Object.entries(map).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("productTotal").textContent=total+" offered";$("productCenter").textContent=total;renderLegend($("productLegend"),arr,total,PRODUCT_COLORS);
  productChart?.destroy();
  productChart=new Chart($("productChart"),{type:"doughnut",data:{labels:arr.map(x=>x[0]),datasets:[{data:arr.map(x=>x[1]),backgroundColor:arr.map((_,i)=>PRODUCT_COLORS[i%PRODUCT_COLORS.length]),borderColor:"#081a2b",borderWidth:3,hoverOffset:7}]},options:{cutout:"74%",plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>{const pct=total?Math.round(ctx.raw/total*100):0;return ` ${ctx.label}: ${ctx.raw} (${pct}%)`}}}}}});
}
function drawMonthly(selectedMonth){
  const year=Number(selectedMonth.slice(0,4));
  const keys=MONTHS.map((_,i)=>`${year}-${String(i+1).padStart(2,"0")}`);
  const manufactured=keys.map(k=>monthSnapshot(k).manufactured);
  const offered=keys.map(k=>monthSnapshot(k).offered);
  monthlyChart?.destroy();
  const ctx=$("monthlyChart").getContext("2d");

  const madeGradient=ctx.createLinearGradient(0,0,0,260);
  madeGradient.addColorStop(0,"rgba(235,244,255,.82)");
  madeGradient.addColorStop(.35,"rgba(181,200,220,.64)");
  madeGradient.addColorStop(1,"rgba(119,143,165,.30)");

  const offeredGradient=ctx.createLinearGradient(0,0,0,260);
  offeredGradient.addColorStop(0,"rgba(46,205,255,1)");
  offeredGradient.addColorStop(.42,"rgba(31,170,255,.94)");
  offeredGradient.addColorStop(1,"rgba(18,123,237,.82)");

  monthlyChart=new Chart($("monthlyChart"),{
    type:"bar",
    data:{
      labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      datasets:[
        {
          label:"Total UPS Manufactured",
          data:manufactured,
          grouped:false,
          backgroundColor:madeGradient,
          borderColor:"rgba(235,244,255,.85)",
          borderWidth:1.4,
          borderRadius:12,
          borderSkipped:false,
          barPercentage:.68,
          categoryPercentage:.82,
          order:1
        },
        {
          label:"Offered for Inspection",
          data:offered,
          grouped:false,
          backgroundColor:offeredGradient,
          borderColor:"rgba(108,229,255,.98)",
          borderWidth:1,
          borderRadius:10,
          borderSkipped:false,
          barPercentage:.40,
          categoryPercentage:.82,
          order:2
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{left:6,right:10,top:2,bottom:2}},
      plugins:{
        legend:{
          position:"top",
          align:"end",
          labels:{
            color:"#dceaf6",
            usePointStyle:true,
            pointStyle:"circle",
            boxWidth:10,
            boxHeight:10,
            padding:18,
            font:{size:10,weight:"700"}
          }
        },
        tooltip:{
          backgroundColor:"rgba(6,20,33,.96)",
          titleColor:"#fff",
          bodyColor:"#dceaf6",
          borderColor:"rgba(61,129,176,.8)",
          borderWidth:1,
          padding:10
        }
      },
      scales:{
        x:{
          offset:true,
          grid:{display:true,color:"rgba(53,107,148,.14)",drawTicks:false},
          ticks:{
            color:"#d7e7f3",
            autoSkip:false,
            maxRotation:0,
            minRotation:0,
            padding:8,
            font:{size:11,weight:"700"}
          },
          border:{color:"rgba(98,145,179,.35)"}
        },
        y:{
          beginAtZero:true,
          grace:"10%",
          grid:{color:"rgba(53,107,148,.22)",drawTicks:false},
          ticks:{
            color:"#9cb8cd",
            padding:10,
            precision:0,
            font:{size:10,weight:"600"}
          },
          border:{color:"rgba(98,145,179,.35)"}
        }
      }
    }
  });
  const pill=document.querySelector(".trend-card .pill");if(pill)pill.textContent=`Jan–Dec ${year}`;
}
function drawIssues(m){
  const map=issueBreakdown(m),arr=Object.entries(map).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("issueTotal").textContent=total+" issue"+(total===1?"":"s");$("issueCenter").textContent=total;
  if(!arr.length){$("issueEmpty").style.display="grid";$("issueDonutLayout").style.display="none";issueChart?.destroy();return}
  $("issueEmpty").style.display="none";$("issueDonutLayout").style.display="grid";renderLegend($("issueLegend"),arr,total,ISSUE_COLORS);
  issueChart?.destroy();
  issueChart=new Chart($("issueChart"),{type:"doughnut",data:{labels:arr.map(x=>x[0]),datasets:[{data:arr.map(x=>x[1]),backgroundColor:arr.map((_,i)=>ISSUE_COLORS[i%ISSUE_COLORS.length]),borderColor:"#081a2b",borderWidth:3,hoverOffset:7}]},options:{cutout:"74%",plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>{const pct=total?Math.round(ctx.raw/total*100):0;return ` ${ctx.label}: ${ctx.raw} (${pct}%)`}}}}}});
}
function renderDashboardTable(rows,snap){
  if(!rows.length&&snap.source==="history"){
    $("dashboardBody").innerHTML=`<tr><td colspan="14" style="text-align:center;padding:28px"><b>${fmtMonthKey(snap.month)}</b> is stored as consolidated historical data. Individual inspection rows were not back-entered.</td></tr>`;return;
  }
  $("dashboardBody").innerHTML=rows.length?rows.slice(0,14).map((r,i)=>`<tr><td>${i+1}</td><td>${r.customer_project||""}</td><td>${r.qty||1}</td><td>${r.kva_rating||""}</td><td>${r.ups_type||""}</td><td>${r.engineer||""}</td><td>${fmtDate(r.planned_date)}</td><td>${fmtDate(r.actual_date)}</td><td>${daysDelay(r)}</td><td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td><td>${r.issue_type||"-"}</td><td>${r.issue_at_time||"-"}</td><td>${r.remarks||"-"}</td><td class="actions"><a class="mini-action" href="register.html?edit=${r.id}">✎</a></td></tr>`).join(""):`<tr><td colspan="14" style="text-align:center;padding:28px">No records for this month.</td></tr>`;
}
bootDashboard();
