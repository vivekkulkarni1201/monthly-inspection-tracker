
let productChart,monthlyChart,issueChart;

const PRODUCT_COLORS=["#20a5ff","#22db8c","#ffb735","#b66cff","#ff607a","#38d7d4","#8fa6ff","#7dd35c"];
const ISSUE_COLORS=["#ff5069","#ff9f43","#ffc93c","#43b8ff","#ad68ff","#3bd5a2","#91a5b7","#ef6df0"];

async function bootDashboard(){
  navLink("dashboard");
  buildMonthPicker();
  buildPrettyMonthPicker();
  $("monthPicker").onchange=()=>{
    syncPrettyMonth();
    renderDashboard();
  };
  try{
    await initCloud();
    subscribe("inspections",renderDashboard);
    subscribe("monthly_production",renderDashboard);
    renderDashboard();
    $("modeNote").textContent="LIVE ONLINE • Supabase realtime connected on every device.";
  }catch(e){
    console.error(e);
    updateLiveBadge();
    $("modeNote").textContent="Cloud connection failed: "+e.message;
  }
}
function buildPrettyMonthPicker(){
  const menu=$("monthMenu");
  menu.innerHTML=MONTHS.map((m,i)=>{
    const val=`2026-${String(i+1).padStart(2,"0")}`;
    return `<button type="button" class="month-option" data-value="${val}">${m} 2026</button>`;
  }).join("");
  $("monthButton").onclick=(e)=>{
    e.stopPropagation();
    $("monthControl").classList.toggle("open");
  };
  menu.querySelectorAll(".month-option").forEach(b=>{
    b.onclick=()=>{
      $("monthPicker").value=b.dataset.value;
      $("monthControl").classList.remove("open");
      syncPrettyMonth();
      renderDashboard();
    }
  });
  document.addEventListener("click",(e)=>{
    if(!$("monthControl").contains(e.target))$("monthControl").classList.remove("open");
  });
  syncPrettyMonth();
}
function syncPrettyMonth(){
  const label=$("monthPicker").selectedOptions[0]?.textContent || "Select month";
  $("monthButton").querySelector("span").textContent=label;
  document.querySelectorAll(".month-option").forEach(b=>b.classList.toggle("active",b.dataset.value===$("monthPicker").value));
}

function renderDashboard(){
  const rows=currentRows(),m=currentMonthKey(),manufactured=+production[m]||0,offered=qtySum(rows);
  $("kpiManufactured").textContent=manufactured;
  $("kpiOffered").textContent=offered;
  $("kpiCompleted").textContent=statusQty(rows,"Completed");
  $("kpiDelayed").textContent=statusQty(rows,"Delayed");
  $("kpiCancelled").textContent=statusQty(rows,"Cancelled");
  $("kpiWaiver").textContent=statusQty(rows,"Waiver");
  drawProduct(rows);
  drawMonthly();
  drawIssues(rows);
  renderDashboardTable(rows);
}

function renderLegend(el,entries,total,colors){
  if(!entries.length){el.innerHTML="";return}
  el.innerHTML=entries.map(([name,val],i)=>{
    const pct=total?Math.round(val/total*100):0;
    return `<div class="legend-row">
      <span class="legend-dot" style="--dot:${colors[i%colors.length]}"></span>
      <span class="legend-name">${name}</span>
      <b>${val}</b>
      <em>${pct}%</em>
    </div>`;
  }).join("");
}

function drawProduct(rows){
  const map={};
  rows.forEach(r=>map[r.ups_type||"Unknown"]=(map[r.ups_type||"Unknown"]||0)+(+r.qty||0));
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("productTotal").textContent=total+" offered";
  $("productCenter").textContent=total;
  renderLegend($("productLegend"),arr,total,PRODUCT_COLORS);
  productChart?.destroy();
  productChart=new Chart($("productChart"),{
    type:"doughnut",
    data:{labels:arr.map(x=>x[0]),datasets:[{
      data:arr.map(x=>x[1]),
      backgroundColor:arr.map((_,i)=>PRODUCT_COLORS[i%PRODUCT_COLORS.length]),
      borderColor:"#081a2b",borderWidth:3,hoverOffset:7
    }]},
    options:{cutout:"74%",rotation:-90,circumference:360,plugins:{legend:{display:false},tooltip:{callbacks:{
      label:(ctx)=>{const pct=total?Math.round(ctx.raw/total*100):0;return ` ${ctx.label}: ${ctx.raw} (${pct}%)`}
    }}}}
  })
}

function drawMonthly(){
  const keys=MONTHS.map((_,i)=>`2026-${String(i+1).padStart(2,"0")}`);
  const manufactured=keys.map(k=>+production[k]||0);
  const offered=keys.map(k=>qtySum(inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===k)));
  monthlyChart?.destroy();

  const ctx=$("monthlyChart").getContext("2d");
  const offeredGradient=ctx.createLinearGradient(0,0,0,240);
  offeredGradient.addColorStop(0,"rgba(30,187,255,1)");
  offeredGradient.addColorStop(.6,"rgba(18,128,255,.88)");
  offeredGradient.addColorStop(1,"rgba(18,92,225,.58)");

  const madeGradient=ctx.createLinearGradient(0,0,0,240);
  madeGradient.addColorStop(0,"rgba(206,224,239,.62)");
  madeGradient.addColorStop(1,"rgba(116,145,172,.20)");

  monthlyChart=new Chart($("monthlyChart"),{
    type:"bar",
    data:{labels:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],datasets:[
      {label:"Total UPS Manufactured",data:manufactured,backgroundColor:madeGradient,borderColor:"rgba(207,229,247,.75)",borderWidth:1,borderRadius:8,borderSkipped:false,barPercentage:.82,categoryPercentage:.76,order:2},
      {label:"Offered for Inspection",data:offered,backgroundColor:offeredGradient,borderColor:"rgba(116,214,255,.96)",borderWidth:1,borderRadius:8,borderSkipped:false,barPercentage:.46,categoryPercentage:.76,order:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,layout:{padding:{left:4,right:8,top:4,bottom:0}},interaction:{mode:"index",intersect:false},
      plugins:{legend:{position:"top",align:"end",labels:{color:"#dceaf6",usePointStyle:true,pointStyle:"rectRounded",boxWidth:10,boxHeight:10,padding:16,font:{size:10,weight:"600"}}},
        tooltip:{backgroundColor:"rgba(5,18,31,.96)",titleColor:"#fff",bodyColor:"#dceaf6",borderColor:"#2d6f9c",borderWidth:1,padding:10}},
      scales:{x:{offset:true,grid:{display:false},ticks:{color:"#cfe0ed",autoSkip:false,maxRotation:0,minRotation:0,padding:6,font:{size:10,weight:"600"}},border:{color:"rgba(85,129,161,.32)"}},
        y:{beginAtZero:true,grace:"10%",grid:{color:"rgba(86,129,161,.16)",drawTicks:false},ticks:{color:"#91abc0",precision:0,padding:8,font:{size:10}},border:{display:false}}}}
  });
}

function drawIssues(rows){
  const map={};
  rows.filter(r=>r.issue_type).forEach(r=>map[r.issue_type]=(map[r.issue_type]||0)+(+r.qty||0));
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]),total=arr.reduce((a,x)=>a+x[1],0);
  $("issueTotal").textContent=total+" issues";
  $("issueCenter").textContent=total;
  if(!arr.length){
    $("issueEmpty").style.display="grid";
    $("issueDonutLayout").style.display="none";
    issueChart?.destroy();issueChart=null;
    return;
  }
  $("issueEmpty").style.display="none";
  $("issueDonutLayout").style.display="grid";
  renderLegend($("issueLegend"),arr,total,ISSUE_COLORS);
  issueChart?.destroy();
  issueChart=new Chart($("issueChart"),{
    type:"doughnut",
    data:{labels:arr.map(x=>x[0]),datasets:[{
      data:arr.map(x=>x[1]),
      backgroundColor:arr.map((_,i)=>ISSUE_COLORS[i%ISSUE_COLORS.length]),
      borderColor:"#081a2b",borderWidth:3,hoverOffset:7
    }]},
    options:{cutout:"74%",rotation:-90,circumference:360,plugins:{legend:{display:false},tooltip:{callbacks:{
      label:(ctx)=>{const pct=total?Math.round(ctx.raw/total*100):0;return ` ${ctx.label}: ${ctx.raw} (${pct}%)`}
    }}}}
  })
}

function renderDashboardTable(rows){
  $("dashboardBody").innerHTML=rows.length?rows.slice(0,14).map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${r.customer_project||""}</td>
    <td>${r.qty||1}</td>
    <td>${r.kva_rating||""}</td>
    <td>${r.ups_type||""}</td>
    <td>${r.engineer||""}</td>
    <td>${fmtDate(r.planned_date)}</td>
    <td>${fmtDate(r.actual_date)}</td>
    <td>${daysDelay(r)}</td>
    <td><span class="status st-${r.status||"Planned"}">${r.status||"Planned"}</span></td>
    <td>${r.issue_type||"-"}</td>
    <td>${r.issue_at_time||"-"}</td>
    <td>${r.remarks||"-"}</td>
    <td class="actions"><a class="mini-action" href="register.html?edit=${r.id}">✎</a></td>
  </tr>`).join(""):`<tr><td colspan="14" style="text-align:center;padding:28px">No records for this month.</td></tr>`;
}
bootDashboard();
