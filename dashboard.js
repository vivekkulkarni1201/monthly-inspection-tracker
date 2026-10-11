
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
    options:{cutout:"72%",plugins:{legend:{display:false},tooltip:{callbacks:{
      label:(ctx)=>{const pct=total?Math.round(ctx.raw/total*100):0;return ` ${ctx.label}: ${ctx.raw} (${pct}%)`}
    }}}}
  })
}

function drawMonthly(){
  const keys=MONTHS.map((_,i)=>`2026-${String(i+1).padStart(2,"0")}`);
  const manufactured=keys.map(k=>+production[k]||0);
  const offered=keys.map(k=>qtySum(inspections.filter(r=>monthKey(r.planned_date||r.actual_date)===k)));
  monthlyChart?.destroy();
  monthlyChart=new Chart($("monthlyChart"),{
    type:"bar",
    data:{labels:MONTHS.map(m=>m.slice(0,3)),datasets:[
      {
        label:"Total UPS Manufactured",
        data:manufactured,
        backgroundColor:"rgba(139,166,191,.48)",
        borderColor:"rgba(198,219,237,.72)",
        borderWidth:1,borderRadius:7,barPercentage:.86,categoryPercentage:.72,order:2
      },
      {
        label:"Offered for Inspection",
        data:offered,
        backgroundColor:"rgba(26,162,255,.98)",
        borderColor:"#6ec4ff",
        borderWidth:1,borderRadius:7,barPercentage:.52,categoryPercentage:.72,order:1
      }
    ]},
    options:{
      maintainAspectRatio:false,
      plugins:{legend:{labels:{color:"#dceaf6",usePointStyle:true,boxWidth:10,padding:16}}},
      scales:{
        x:{grid:{display:false},ticks:{color:"#d6e5f2",autoSkip:false,maxRotation:0,minRotation:0,font:{size:10}}},
        y:{beginAtZero:true,grid:{color:"rgba(89,130,163,.22)"},ticks:{color:"#c8d9e7",precision:0}}
      }
    }
  })
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
    options:{cutout:"72%",plugins:{legend:{display:false},tooltip:{callbacks:{
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
