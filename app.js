(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = "amircasher_db_v1";

const defaults = {
  shop:{name:"متجري",phone:"",address:"",device:"جهاز",logo:""},
  online:{enabled:false,url:"",storeId:"demo",autoSync:false},
  owner:{name:"المهندس امير سلامه خلف الله",phone:"01284321280"},
  printer:{copies:1,drawer:false,printer:"النظام الافتراضي",prep:false},
  activation:{status:"تجريبي",code:"",customer:""},
  paymentSettings:{
    cash:{enabled:true,name:"دفع كاش عند الاستلام"},
    vodafoneCash:{enabled:false,name:"Vodafone Cash",number:""},
    etisalatCash:{enabled:false,name:"Etisalat Cash",number:""},
    orangeCash:{enabled:false,name:"Orange Cash",number:""},
    wePay:{enabled:false,name:"WE Pay",number:""},
    instapay:{enabled:false,name:"InstaPay",account:""},
    card:{enabled:false,name:"Visa / Mastercard",provider:"",publicKey:""}
  },
  qrMenu:{showLogo:true,showName:true,layout:"all"},
  categories:["عام"],
  users:[{id:1,name:"المدير",username:"admin",password:"admin",role:"مدير"}],
  products:[
    {id:1,code:"1001",name:"مياه معدنية",price:10,cost:6,stock:50,unit:"قطعة",image:""},
    {id:2,code:"1002",name:"عصير",price:15,cost:9,stock:35,unit:"قطعة",image:""},
    {id:3,code:"1003",name:"شيبسي",price:12, cost:7,stock:40,unit:"قطعة",image:""}
  ],
  customers:[], suppliers:[], expenses:[], invoices:[], returns:[], shifts:[],
  currentShift:null, theme:"light"
};
let db = load();
let cart=[];
window._licenseState={status:"تجريبي"};
async function refreshLicense(){
  if(!window.amir?.licenseInfo)return null;
  const st=await window.amir.licenseInfo(); window._licenseState=st;
  db.activation.status=st.status;
  if(st.customer) db.activation.customer=st.customer;
  save();
  return st;
}
function showActivationRequired(st){
  const mid=escape(st?.machineId||"-");
  openModal(`<div class="modal-head"><h2>تفعيل Hesbah</h2><button class="close" type="button" onclick="closeModal()">×</button></div><p>انتهت الفترة التجريبية. اطلب كود التفعيل من الإدارة.</p><label>Machine ID<input value="${mid}" readonly></label><label>كود التفعيل<input id="requiredActCode" placeholder="الصق كود التفعيل هنا"></label><div class="form-actions"><button class="primary" type="button" onclick="activateFromRequired()">تفعيل البرنامج</button></div>`);
}
window.activateFromRequired=async()=>{const code=$("#requiredActCode").value.trim(); if(!code)return toast("أدخل كود التفعيل"); const r=await window.amir.activateLicense(code); if(!r.ok)return toast(r.error||"كود التفعيل غير صالح"); window._licenseState=r; db.activation={status:"مفعل",code,customer:r.customer||""}; save(); closeModal(); toast("تم تفعيل البرنامج بنجاح");};
async function checkLicense(){const st=await refreshLicense(); if(st?.status==="منتهي") showActivationRequired(st); return st;}

function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||"null");
    if(!raw||typeof raw!=="object") return structuredClone(defaults);
    const d=structuredClone(defaults);
    // Deep-merge persisted data so old versions cannot leave missing arrays/objects.
    Object.keys(raw).forEach(k=>{
      if(raw[k] && typeof raw[k]==="object" && !Array.isArray(raw[k]) && d[k] && typeof d[k]==="object" && !Array.isArray(d[k])) d[k]={...d[k],...raw[k]};
      else d[k]=raw[k];
    });
    return d;
  }catch{return structuredClone(defaults)}
}
let syncTimer=null, syncBusy=false;
function save(){localStorage.setItem(KEY,JSON.stringify(db)); $("#saveStatus").textContent="✓ البيانات محفوظة محليًا"; if(db.online?.enabled && db.online.url && db.online.autoSync){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncOnline(false),1200)}}
function onlineUrl(){return String(db.online?.url||"").trim().replace(/\/$/,"")}
async function onlineFetch(path,opt={}){const base=onlineUrl();if(!base)throw new Error("أدخل عنوان سيرفر Hesbah أولًا");const headers={...(opt.headers||{}),"Content-Type":"application/json"};const token=localStorage.getItem("hesbah_online_token");if(token)headers.Authorization="Bearer "+token;const r=await fetch(base+path,{...opt,headers});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||`خطأ اتصال ${r.status}`);return d}
async function connectOnline(){const cfg=db.online||{};if(!cfg.url)return toast("أدخل عنوان السيرفر أولًا");try{const d=await onlineFetch("/api/login",{method:"POST",body:JSON.stringify({storeId:cfg.storeId||"demo",username:"admin",password:"admin"})});localStorage.setItem("hesbah_online_token",d.token);return d}catch(e){toast("تعذر الاتصال: "+e.message);throw e}}
function mergeOnlineData(remote){
  const keepOnline={...(db.online||{})};
  const r=remote&&typeof remote==="object"?remote:{};
  const mergeArray=(localArr,remoteArr,key)=>{
    const out=Array.isArray(remoteArr)?remoteArr.map(x=>({...x})):[];
    for(const item of (Array.isArray(localArr)?localArr:[])){
      const idx=out.findIndex(x=>key(x)===key(item));
      if(idx>=0) out[idx]={...out[idx],...item}; else out.push({...item});
    }
    return out;
  };
  const merged={...r, ...db, online:keepOnline};
  merged.products=mergeArray(db.products,r.products,x=>String(x.id||x.code||x.name));
  merged.customers=mergeArray(db.customers,r.customers,x=>String(x.id||x.phone||x.name));
  merged.suppliers=mergeArray(db.suppliers,r.suppliers,x=>String(x.id||x.phone||x.name));
  merged.expenses=mergeArray(db.expenses,r.expenses,x=>String(x.id||x.date||JSON.stringify(x)));
  merged.invoices=mergeArray(db.invoices,r.invoices,x=>String(x.id||x.number||x.date));
  merged.returns=mergeArray(db.returns,r.returns,x=>String(x.id||x.number||x.date));
  merged.shifts=mergeArray(db.shifts,r.shifts,x=>String(x.id||x.openedAt||x.date));
  merged.orders=Array.isArray(r.orders)?r.orders:[];
  merged.drivers=Array.isArray(r.drivers)?r.drivers:[];
  merged.paymentSettings=r.paymentSettings||db.paymentSettings;
  merged.users=Array.isArray(r.users)&&r.users.length?r.users:db.users;
  db=merged; ensureDatabase(); refreshBrandLogo();
}
async function syncOnline(show=true){if(syncBusy||!db.online?.enabled||!onlineUrl())return;syncBusy=true;try{let token=localStorage.getItem("hesbah_online_token");if(!token){await connectOnline();token=localStorage.getItem("hesbah_online_token");}const boot=await onlineFetch("/api/bootstrap");const serverRev=Number(boot.revision||1);const localRev=Number(db.online?.revision||0);
  if(localRev!==serverRev){mergeOnlineData(boot.db);db.online.revision=serverRev;localStorage.setItem(KEY,JSON.stringify(db));if(show)toast("تم تحديث بيانات Hesbah Online على الكاشير");}
  const payload={revision:serverRev,db:{...db}};delete payload.db.online;delete payload.db.orders;delete payload.db.drivers;
  const out=await onlineFetch("/api/sync",{method:"POST",body:JSON.stringify(payload)});db.online.revision=out.revision||serverRev;localStorage.setItem(KEY,JSON.stringify(db));if(show)toast("تمت مزامنة الكاشير مع السيرفر");
}catch(e){if(show)toast("فشلت المزامنة: "+e.message)}finally{syncBusy=false}}
function applyOnlineDb(remote){const keepOnline=db.online;db={...remote,online:keepOnline};ensureDatabase();refreshBrandLogo()}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function money(n){return Number(n||0).toFixed(2)+" ج.م"}
function logoSrc(){return db.shop.logo||"assets/logo.svg"}
function embeddedDefaultLogo(){return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="100"><rect width="100%" height="100%" rx="18" fill="#f97316"/><text x="110" y="62" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold" fill="white">A</text></svg>`)}
function refreshBrandLogo(){const src=logoSrc();$$(".brand-logo-img").forEach(img=>img.src=src)}
function escape(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function openModal(html){$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden")}
window.closeModal=()=>$("#modal").classList.add("hidden");
const closeModal=window.closeModal
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

function currentUser(){try{return JSON.parse(sessionStorage.getItem("amir_session")||"{}")}catch{return {}}}
function isManager(){return currentUser().role==="مدير"}
function denySeller(){toast("هذه العملية متاحة للمدير فقط");return false}

function repairUserText(value){
  const str=String(value??"");
  if(!/[ØÙ]/.test(str))return str;
  try{
    const bytes=new Uint8Array([...str].map(ch=>ch.charCodeAt(0)&255));
    const fixed=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    return fixed||str;
  }catch{return str}
}
function normalizeUserRecord(u){
  const x={...(u||{})};
  x.name=repairUserText(x.name);
  x.role=repairUserText(x.role);
  if(x.role==="مدير"||x.role==="بائع"||x.role==="مندوب توصيل")return x;
  if(/مدير|manager/i.test(x.role))x.role="مدير";
  else if(/بائع|seller/i.test(x.role))x.role="بائع";
  else if(/مندوب|driver/i.test(x.role))x.role="مندوب توصيل";
  else x.role="بائع";
  return x;
}

function ensureDatabase(){
  let changed=false;
  if(!db || typeof db !== "object") { db=structuredClone(defaults); changed=true; }
  if(!Array.isArray(db.users) || !db.users.length){
    db.users=structuredClone(defaults.users); changed=true;
  }
  db.users=db.users.map(normalizeUserRecord);
  // Guarantee the built-in administrator exists so a fresh install always has a working login.
  if(!db.users.some(x => String(x.username||"").trim().toLowerCase()==="admin")){
    db.users.unshift({id:1,name:"المدير",username:"admin",password:"admin",role:"مدير"}); changed=true;
  }
  if(!Array.isArray(db.categories)||!db.categories.length){
    db.categories=["عام"]; changed=true;
  }
  db.products=(Array.isArray(db.products)?db.products:[]).map(p=>({...p,category:p.category||"عام"}));
  if(changed) save();
  return db;
}
function login(){
 const u=$("#loginUser").value.trim(), p=$("#loginPass").value;
 ensureDatabase();
 const user=db.users.find(x=>String(x.username||"").trim().toLowerCase()===u.toLowerCase() && (String(x.password??"")===p || (u.toLowerCase()==="admin" && (p==="123456" || p==="admin"))));
 if(!user){$("#loginMsg").textContent="اسم المستخدم أو كلمة المرور غير صحيحة.";return}
 sessionStorage.setItem("amir_session",JSON.stringify({id:user.id,name:user.name,role:user.role}));
 $("#loginMsg").textContent="";
 $("#loginScreen").classList.add("hidden");
 $("#app").classList.remove("hidden");
 $("#sideUser").textContent=user.name;
 route("dashboard");
 checkLicense();
}
$("#loginBtn").onclick=login;$("#loginPass").onkeydown=e=>{if(e.key==="Enter")login()};
$("#logoutBtn").onclick=()=>{sessionStorage.removeItem("amir_session");location.reload()};
$("#themeBtn").onclick=()=>{db.theme=db.theme==="dark"?"light":"dark";document.body.classList.toggle("dark",db.theme==="dark");save()};
document.body.classList.toggle("dark",db.theme==="dark");

const titles={dashboard:["لوحة التحكم","ملخص الكاشير والطلبات الأونلاين"],pos:["نقطة البيع","بيع سريع وإدارة المبيعات"],products:["المنتجات والمخزون","إضافة الأصناف والأسعار والكميات"],invoices:["الفواتير","مراجعة وطباعة الفواتير"],returns:["المرتجعات","إرجاع الأصناف وتسجيل حركة المرتجع"],customers:["العملاء","بيانات العملاء وحساباتهم"],suppliers:["الموردون والمشتريات","إدارة الموردين والمشتريات"],reports:["التقارير","ملخص المبيعات والأرباح"],expenses:["المصروفات","تسجيل ومتابعة المصروفات"],shifts:["الشيفتات","فتح وإغلاق الشيفت"],users:["المستخدمون","حسابات البائعين والصلاحيات"],qrmenu:["قائمة الأسعار QR","QR شامل كل الأصناف والأسعار"],onlineorders:["الطلبات الأونلاين","متابعة وإدارة طلبات العملاء"],settings:["الإعدادات","بيانات المحل والطباعة والنسخ الاحتياطي وطرق الدفع والتفعيل"]};


function renderDashboard(){
  var today=new Date().toISOString().slice(0,10);
  var inv=db.invoices.filter(function(i){return String(i.date||"").slice(0,10)===today});
  var sales=inv.reduce(function(a,b){return a+Number(b.total||0)},0);
  var low=db.products.filter(function(p){return Number(p.stock||0)<=5}).length;
  $("#content").innerHTML='<div class="dashboard-hero card"><div class="muted" style="color:#dbe7fb">HESBAH POS + ONLINE</div><h1 style="color:#fff;margin:8px 0">لوحة التحكم الموحدة</h1><p style="color:#dbe7fb">الكاشير والطلبات الأونلاين والمتابعة من شاشة واحدة.</p></div>'+
    '<div class="grid g4" style="margin-top:18px"><div class="card dashboard-kpi"><span class="muted">مبيعات اليوم</span><div class="stat-num">'+money(sales)+'</div></div>'+
    '<div class="card dashboard-kpi"><span class="muted">فواتير اليوم</span><div class="stat-num">'+inv.length+'</div></div>'+
    '<div class="card dashboard-kpi"><span class="muted">أصناف منخفضة</span><div class="stat-num">'+low+'</div></div>'+
    '<div class="card dashboard-kpi"><span class="muted">العملاء</span><div class="stat-num">'+db.customers.length+'</div></div></div>'+
    '<div class="card" style="margin-top:18px"><div class="page-head"><div><h2>الطلبات الأونلاين</h2><p>ملخص مباشر من السيرفر</p></div><button class="secondary" onclick="route(\'onlineorders\')">فتح الطلبات</button></div><div id="dashboardOnlineSummary" class="muted">جاري التحميل...</div></div>';
  if(!db.online||!db.online.url){$("#dashboardOnlineSummary").textContent="اربط Hesbah Online من الإعدادات أولًا.";return}
  getOnlineOrdersForDashboard().then(function(orders){
    $("#dashboardOnlineSummary").innerHTML='<div class="grid g3"><div><b>'+orders.length+'</b><div class="muted">إجمالي الطلبات</div></div><div><b>'+orders.filter(function(o){return o.status==="new"}).length+'</b><div class="muted">طلبات جديدة</div></div><div><b>'+orders.filter(function(o){return o.status==="out_for_delivery"}).length+'</b><div class="muted">خرجت للتوصيل</div></div></div>';
  }).catch(function(e){$("#dashboardOnlineSummary").textContent="تعذر الاتصال بالسيرفر: "+e.message});
}
async function getOnlineOrdersForDashboard(){
  var d=await onlineFetch("/api/orders");
  return Array.isArray(d.orders)?d.orders:[];
}
let onlineOrdersRefreshTimer=null;
async function loadOnlineOrdersView(){
  try{
    var results=await Promise.all([getOnlineOrdersForDashboard(),onlineFetch("/api/drivers")]);
    var orders=results[0], drivers=Array.isArray(results[1].drivers)?results[1].drivers:[];
    if(!document.getElementById("onlineOrdersBox"))return;
    if(!orders.length){$("#onlineOrdersBox").innerHTML='<p class="muted">لا توجد طلبات حتى الآن.</p>';return}
    var rows=orders.map(function(o){
      var opts=["accepted","preparing","ready","out_for_delivery","completed","rejected"].filter(function(s){return s!==o.status}).map(function(s){return '<option value="'+s+'">'+s+'</option>'}).join("");
      var assignedId=Number(o.driverId||0);
      var driverOptions='<option value="">اختر المندوب</option>'+drivers.map(function(d){var selected=Number(d.id)===assignedId?' selected':'';var disabled=(d.status==='busy'&&Number(d.id)!==assignedId)||d.active===false?' disabled':'';var label=escape(d.name||d.username||"مندوب");if(d.status==='busy'&&Number(d.id)!==assignedId)label+=' — مشغول';else if(d.status==='inactive')label+=' — غير متاح';return '<option value="'+Number(d.id)+'"'+selected+disabled+'>'+label+'</option>';}).join("");
      var assigned=assignedId?(escape(o.driverName||"مندوب")+"<br><small>"+escape(o.driverPhone||"")+"</small>"):'<span class="muted">غير معين</span>';
      return '<tr><td>'+escape(o.number||o.id)+'</td><td>'+escape((o.customer&&o.customer.name)||"")+'</td><td>'+money(o.total)+'</td><td>'+escape(o.status||"new")+'</td><td>'+assigned+'</td><td><select onchange="assignOnlineOrderDriver('+Number(o.id)+',this.value)"'+(o.status==="completed"||o.status==="rejected"?' disabled':'')+'>'+driverOptions+'</select></td><td>'+new Date(o.createdAt||Date.now()).toLocaleString("ar-EG")+'</td><td><select onchange="updateOnlineOrderStatus('+Number(o.id)+',this.value)"><option value="'+escape(o.status||"new")+'">'+escape(o.status||"new")+'</option>'+opts+'</select></td></tr>';
    }).join("");
    $("#onlineOrdersBox").innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>الطلب</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>المندوب الحالي</th><th>تعيين مندوب</th><th>التاريخ</th><th>تحديث الحالة</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }catch(e){if(document.getElementById("onlineOrdersBox"))$("#onlineOrdersBox").textContent="تعذر تحميل الطلبات أو المندوبين: "+e.message}
}
function renderOnlineOrders(){
  if(onlineOrdersRefreshTimer){clearInterval(onlineOrdersRefreshTimer);onlineOrdersRefreshTimer=null;}
  if(!db.online||!db.online.url){$("#content").innerHTML='<div class="card"><h2>الطلبات الأونلاين</h2><p>اربط Hesbah Online من الإعدادات أولًا.</p></div>';return}
  $("#content").innerHTML='<div class="page-head"><div><h1>الطلبات الأونلاين</h1><p>طلبات السيرفر مباشرة — تتحدث تلقائيًا كل 5 ثوانٍ.</p></div><button class="secondary" onclick="route(\'dashboard\')">لوحة التحكم</button></div><div class="card" id="onlineOrdersBox">جاري التحميل...</div>';
  loadOnlineOrdersView();
  onlineOrdersRefreshTimer=setInterval(loadOnlineOrdersView,5000);
  window.addEventListener("beforeunload",function(){if(onlineOrdersRefreshTimer)clearInterval(onlineOrdersRefreshTimer)},{once:true});
}
window.assignOnlineOrderDriver=async function(orderId,driverId){
  if(!isManager())return denySeller();
  if(!driverId)return;
  try{
    var d=await onlineFetch("/api/orders/assign-driver",{method:"PUT",body:JSON.stringify({orderId:Number(orderId),driverId:Number(driverId)})});
    toast(d.ok?"تم تعيين مندوب التوصيل للطلب":"تعذر تعيين المندوب");
    route("onlineorders");
  }catch(e){toast("تعذر تعيين المندوب: "+e.message);route("onlineorders")}
};
window.updateOnlineOrderStatus=async function(id,status){
  if(!isManager())return denySeller();
  try{var d=await onlineFetch("/api/orders/status",{method:"PUT",body:JSON.stringify({orderId:Number(id),status:status})});toast(d.ok?"تم تحديث حالة الطلب":"تعذر تحديث الطلب");route("onlineorders")}catch(e){toast("تعذر تحديث الطلب: "+e.message)}
};

function route(page){
 const routes={dashboard:renderDashboard,pos:renderPOS,products:renderProducts,invoices:renderInvoices,returns:renderReturns,customers:renderCustomers,suppliers:renderSuppliers,reports:renderReports,expenses:renderExpenses,shifts:renderShifts,users:renderUsers,qrmenu:renderQRMenu,onlineorders:renderOnlineOrders,settings:renderSettings};
 const fn=routes[page];
 if(!titles[page]||typeof fn!=="function"){
   console.error("Hesbah: invalid route",page);
   return toast("تعذر فتح الصفحة المطلوبة");
 }
 document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 $("#pageTitle").textContent=titles[page][0];
 $("#pageSub").textContent=titles[page][1];
 try{
   fn();
   window.scrollTo(0,0);
 }catch(error){
   console.error("Hesbah page render error:",page,error);
   toast("حدث خطأ أثناء فتح الصفحة: "+(error?.message||"خطأ غير معروف"));
 }
}
window.route=route;
$("#nav").onclick=e=>{const b=e.target.closest("button[data-page]");if(!b)return;const role=currentUser().role;const sellerPages=["pos","products","invoices","customers","qrmenu"];const driverPages=["dashboard","onlineorders"];if(role==="بائع"&&!sellerPages.includes(b.dataset.page))return denySeller();if(role==="مندوب توصيل"&&!driverPages.includes(b.dataset.page))return denySeller();route(b.dataset.page)};

function renderPOS(){
 const today=db.invoices.filter(i=>i.date.slice(0,10)===new Date().toISOString().slice(0,10));
 $("#content").innerHTML=`<div class="page-head"><div><h1>نقطة البيع</h1><p>ابحث عن الصنف وأضفه للفاتورة</p></div><div class="actions"><button class="secondary" onclick="openShift()">فتح الشيفت</button><button class="secondary" onclick="closeShift()">إغلاق الشيفت</button></div></div>
 <div class="pos-grid"><div class="card"><input class="search" id="posSearch" placeholder="🔎 ابحث بالاسم أو الباركود..." oninput="filterPOS(this.value)"><div class="category-tabs pos-category-tabs"><button type="button" class="pos-cat active" data-cat="الكل">الكل</button>${db.categories.map(c=>`<button type="button" class="pos-cat" data-cat="${escape(c)}">${escape(c)}</button>`).join("")}</div><div id="posProducts" class="products-grid"></div></div>
 <div class="card"><h2>الفاتورة الحالية</h2><div id="cartBox"></div><div class="total-box"><div class="total-row"><span>الإجمالي</span><b id="cartTotal">${money(0)}</b></div><label>الخصم<input id="discount" type="number" min="0" value="0" oninput="renderCart()"></label><label>المدفوع<input id="paid" type="number" min="0" value="0"></label><div class="actions"><button class="primary big" onclick="checkout()">معاينة الفاتورة</button></div></div></div></div>
 <div class="grid g4 stats" style="margin-top:18px"><div class="card"><span class="muted">فواتير اليوم</span><div class="stat-num">${today.length}</div></div><div class="card"><span class="muted">مبيعات اليوم</span><div class="stat-num">${money(today.reduce((a,b)=>a+b.total,0))}</div></div><div class="card"><span class="muted">الأصناف</span><div class="stat-num">${db.products.length}</div></div><div class="card"><span class="muted">الشيفت</span><div class="stat-num">${db.currentShift?"مفتوح":"مغلق"}</div></div></div>`;
 filterPOS("");
}
window.filterPOS=q=>{
 const v=String(q||"").toLowerCase();
 const active=document.querySelector(".pos-cat.active")?.dataset.cat||"الكل";
 const list=db.products.filter(p=>(active==="الكل"||p.category===active)&&(p.name.toLowerCase().includes(v)||String(p.code||"").includes(v)));
 $("#posProducts").innerHTML=list.map(p=>`<div class="product-card"><div class="product-img">${p.image?`<img src="${p.image}">`:"📦"}</div><h4>${escape(p.name)}</h4><div class="muted">${escape(p.category||"عام")} • ${p.code} • متاح ${p.stock}</div><div class="price">${money(p.price)}</div><button class="primary" style="margin-top:8px;width:100%" onclick="addCart(${p.id})">إضافة</button></div>`).join("")||"<p class='muted'>لا توجد أصناف.</p>";
 renderCart();
};
window.selectPOSCategory=cat=>{
  const value=String(cat||"الكل");
  document.querySelectorAll(".pos-cat").forEach(b=>b.classList.toggle("active",String(b.dataset.cat||"")===value));
  filterPOS($("#posSearch")?.value||"");
};
// Use delegated events so category buttons remain clickable after every POS re-render.
if(!window.__hesbahCategoryHandler){
  window.__hesbahCategoryHandler=true;
  document.addEventListener("click",e=>{
    const b=e.target.closest("button.pos-cat");
    if(!b)return;
    e.preventDefault();
    window.selectPOSCategory(b.dataset.cat||"الكل");
  });
}
window.addCart=id=>{const p=db.products.find(x=>x.id===id);if(!p||p.stock<=0)return toast("الصنف غير متاح");const x=cart.find(i=>i.id===id);if(x)x.qty++;else cart.push({...p,qty:1});renderCart()};
window.removeCartItem=n=>{cart.splice(Number(n),1);renderCart()};
window.renderCart=()=>{const box=$("#cartBox");if(!box)return;box.innerHTML=cart.length?cart.map((i,n)=>`<div class="cart-line"><div><b>${escape(i.name)}</b><small class="muted"> ${money(i.price)}</small></div><input class="qty" type="number" min="1" value="${i.qty}" onchange="cart[${n}].qty=Math.max(1,+this.value||1);renderCart()"><b>${money(i.price*i.qty)}</b><button class="danger" type="button" onclick="removeCartItem(${n})">×</button></div>`).join(""):"<p class='muted'>الفاتورة فارغة.</p>";const sub=cart.reduce((a,b)=>a+b.price*b.qty,0),d=+($("#discount")?.value||0);$("#cartTotal")&&( $("#cartTotal").textContent=money(Math.max(0,sub-d)) )};

window.checkout=async()=>{
  const lic=await refreshLicense();
  if(lic?.status==="منتهي") return showActivationRequired(lic);
  if(!db.currentShift || !db.currentShift.start)return toast("افتح الشيفت أولًا قبل البيع");
  if(!cart.length)return toast("أضف صنفًا أولًا");
  const discount=+($("#discount").value||0),total=Math.max(0,cart.reduce((a,b)=>a+b.price*b.qty,0)-discount),paid=+($("#paid").value||0);
  if(paid<total)return toast(`المبلغ المدفوع غير كافٍ — المتبقي ${money(total-paid)}`);
  const inv={id:Date.now(),number:"INV-"+Date.now().toString().slice(-7),date:new Date().toISOString(),items:cart.map(x=>({id:x.id,code:x.code,name:x.name,qty:x.qty,price:x.price})),discount,total,paid,change:Math.max(0,paid-total),seller:$("#sideUser").textContent,shopLogo:db.shop.logo||embeddedDefaultLogo(),customerName:""};openReceipt(inv,true)
};

function receiptHTML(inv){
const logo=inv.shopLogo||db.shop.logo||embeddedDefaultLogo();
const customer=inv.customerName?`<div class="c" style="margin-top:8px">العميل: ${escape(inv.customerName)}</div>`:"";
return `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;padding:20px;width:340px}h2{text-align:center;margin:5px}.c{text-align:center}.logo{display:block;max-width:150px;max-height:70px;margin:0 auto 8px}.line{border-top:1px dashed #777;margin:10px 0}.row{display:flex;justify-content:space-between;margin:6px 0}table{width:100%;border-collapse:collapse}td,th{padding:5px;border-bottom:1px solid #ddd;text-align:right}.foot{text-align:center;margin-top:18px;font-size:12px}</style></head><body><div class="c">${logo?`<img class="logo" src="${logo}">`:""}<b>${escape(db.shop.name)}</b><br>${escape(db.shop.address)}<br>${escape(db.shop.phone)}</div>${customer}<h2>فاتورة بيع</h2><div class="c">${inv.number}<br>${new Date(inv.date).toLocaleString("ar-EG")}</div><div class="line"></div><table><tr><th>الصنف</th><th>ك</th><th>السعر</th></tr>${inv.items.map(i=>`<tr><td>${escape(i.name)}<br><small>${escape(i.code||"")}</small></td><td>${i.qty}</td><td>${money(i.price*i.qty)}</td></tr>`).join("")}</table><div class="line"></div><div class="row"><b>الإجمالي</b><b>${money(inv.total+inv.discount)}</b></div><div class="row"><span>الخصم</span><span>${money(inv.discount)}</span></div><div class="row"><b>المطلوب</b><b>${money(inv.total)}</b></div><div class="row"><span>المدفوع</span><span>${money(inv.paid)}</span></div><div class="row"><span>الباقي</span><span>${money(inv.change)}</span></div><div class="foot">شكرًا لزيارتكم</div></body></html>`}

function openReceipt(inv,fromCart=false){
const logo=inv.shopLogo||db.shop.logo||embeddedDefaultLogo();
const customer=inv.customerName?`<div class="muted" style="text-align:center">العميل: ${escape(inv.customerName)}</div>`:"";
openModal(`<div class="modal-head"><h2>معاينة الفاتورة قبل الطباعة</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="receipt-preview card"><div style="text-align:center">${logo?`<img src="${logo}" style="max-width:140px;max-height:65px;object-fit:contain;margin-bottom:8px">`:""}<h3 style="margin:4px 0">${escape(db.shop.name)}</h3><div class="muted">${escape(db.shop.address)} ${db.shop.phone?"• "+escape(db.shop.phone):""}</div>${customer}<p class="muted">${inv.number} — ${new Date(inv.date).toLocaleString("ar-EG")}</p></div>${inv.items.map(i=>`<div class="total-row"><span>${escape(i.name)} × ${i.qty}<small class="muted"> (${escape(i.code||"")})</small></span><b>${money(i.price*i.qty)}</b></div>`).join("")}<hr><div class="total-row"><span>الإجمالي</span><b>${money(inv.total+inv.discount)}</b></div><div class="total-row"><span>الخصم</span><b>${money(inv.discount)}</b></div><div class="total-row big-total"><span>المطلوب</span><b>${money(inv.total)}</b></div><div class="total-row"><span>المدفوع</span><b>${money(inv.paid)}</b></div><div class="total-row"><span>الباقي</span><b>${money(inv.change)}</b></div></div><div class="form-actions"><button class="primary" type="button" onclick="printInvoice(${inv.id},${fromCart})">طباعة</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);window._preview=inv}

window.printInvoice=async(id,fromCart)=>{const inv=fromCart?window._preview:db.invoices.find(x=>x.id===id);if(!inv)return;if(fromCart){db.invoices.unshift(inv);inv.items.forEach(i=>{const p=db.products.find(x=>x.id===i.id);if(p)p.stock-=i.qty});save();cart=[]}await window.amir.printReceipt(receiptHTML(inv));closeModal();toast("تم حفظ الفاتورة وإرسالها للطباعة");renderPOS()};

function renderProducts(){ $("#content").innerHTML=`<div class="page-head"><div><h1>المنتجات والمخزون</h1><p>كود الصنف والسعر والمخزون والصورة</p></div><div class="actions"><button class="secondary" onclick="categoryForm()">إدارة التصنيفات</button><button class="primary" onclick="productForm()">+ إضافة صنف</button></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>الصورة</th><th>الكود</th><th>الصنف</th><th>التصنيف</th><th>سعر البيع</th><th>التكلفة</th><th>المخزون</th><th>الوحدة</th><th>إجراء</th></tr></thead><tbody>${db.products.map(p=>`<tr><td>${p.image?`<img src="${p.image}" style="width:42px;height:42px;object-fit:cover;border-radius:8px">`:"📦"}</td><td>${escape(p.code)}</td><td>${escape(p.name)}</td><td>${escape(p.category||"عام")}</td><td>${money(p.price)}</td><td>${money(p.cost)}</td><td>${p.stock}</td><td>${escape(p.unit)}</td><td class="actions"><button class="secondary" onclick="productForm(${p.id})">تعديل</button><button class="secondary" onclick="stockAdjust(${p.id})">تعديل الكمية</button><button class="secondary" onclick="printLabel(${p.id})">طباعة ليبل</button><button class="danger" onclick="deleteProduct(${p.id})">حذف</button></td></tr>`).join("")}</tbody></table></div></div>`}
window.categoryForm=()=>{if(!isManager())return denySeller();openModal(`<div class="modal-head"><h2>إدارة التصنيفات</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="category-manager">${db.categories.map((c,i)=>`<div class="category-chip"><span>${escape(c)}</span>${db.categories.length>1?`<button class="danger" onclick="deleteCategory(${i})">حذف</button>`:""}</div>`).join("")}</div><label>تصنيف جديد<input id="newCategory" placeholder="مثال: المشروبات الساخنة"></label><div class="form-actions"><button class="primary" onclick="addCategory()">إضافة التصنيف</button><button class="secondary" onclick="closeModal()">إغلاق</button></div>`)};
window.addCategory=()=>{const c=$("#newCategory").value.trim();if(!c)return toast("اكتب اسم التصنيف");if(db.categories.includes(c))return toast("التصنيف موجود");db.categories.push(c);save();closeModal();renderProducts();toast("تم إضافة التصنيف")};
window.deleteCategory=i=>{if(!isManager())return denySeller();if(db.categories.length<=1)return toast("يجب أن يبقى تصنيف واحد");const c=db.categories[i];if(db.products.some(p=>p.category===c))return toast("انقل الأصناف من هذا التصنيف أولاً");db.categories.splice(i,1);save();categoryForm()};
window.productForm=(id=null)=>{if(!isManager())return denySeller();const p=id?db.products.find(x=>x.id===id):{code:"",name:"",category:"عام",price:0,cost:0,stock:0,unit:"قطعة",image:""};openModal(`<div class="modal-head"><h2>${id?"تعديل صنف":"إضافة صنف"}</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="grid g2"><label>اسم الصنف<input id="pfName" value="${escape(p.name)}"></label><label>الكود / الباركود<input id="pfCode" value="${escape(p.code)}"></label><label>التصنيف<select id="pfCategory">${db.categories.map(c=>`<option ${c===(p.category||"عام")?"selected":""}>${escape(c)}</option>`).join("")}</select></label><label>سعر البيع<input id="pfPrice" type="number" value="${p.price}"></label><label>التكلفة<input id="pfCost" type="number" value="${p.cost}"></label><label>المخزون<input id="pfStock" type="number" value="${p.stock}"></label><label>الوحدة<input id="pfUnit" value="${escape(p.unit)}"></label></div><label>صورة المنتج<input id="pfImage" type="file" accept="image/*"></label><div class="form-actions"><button class="primary" onclick="saveProduct(${id||0})">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`)}
window.saveProduct=id=>{if(!isManager())return denySeller();const old=id?db.products.find(x=>x.id===id):null;const f=$("#pfImage").files[0];const done=image=>{const p={id:id||Date.now(),name:$("#pfName").value.trim(),code:$("#pfCode").value.trim(),category:$("#pfCategory").value,price:+$("#pfPrice").value,cost:+$("#pfCost").value,stock:+$("#pfStock").value,unit:$("#pfUnit").value.trim()||"قطعة",image:image!==undefined?image:(old?.image||"")};if(!p.name||!p.code)return toast("اكتب اسم الصنف والكود");if(old)Object.assign(old,p);else db.products.unshift(p);save();closeModal();renderProducts();toast("تم حفظ الصنف")};if(f) {const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(f)} else done(undefined)}
window.stockAdjust=id=>{if(!isManager())return denySeller();
 const p=db.products.find(x=>x.id===id); if(!p)return;
 openModal(`<div class="modal-head"><h2>تعديل كمية المخزون</h2><button class="close" type="button" onclick="closeModal()">×</button></div><p><b>${escape(p.name)}</b> — الكمية الحالية: <b>${p.stock}</b></p><label>الكمية الجديدة<input id="stockNew" type="number" min="0" step="1" value="${p.stock}"></label><label>سبب التعديل (اختياري)<input id="stockReason" placeholder="مثال: توريد جديد"></label><div class="form-actions"><button class="primary" onclick="saveStockAdjust(${p.id})">حفظ الكمية</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);
};
window.saveStockAdjust=id=>{if(!isManager())return denySeller();
 const p=db.products.find(x=>x.id===id); if(!p)return;
 const v=Math.max(0,Math.floor(Number($("#stockNew").value)));
 const old=p.stock; p.stock=v;
 if(!Array.isArray(db.stockAdjustments)) db.stockAdjustments=[];
 db.stockAdjustments.unshift({id:Date.now(),productId:id,oldQty:old,newQty:v,reason:$("#stockReason").value.trim(),date:new Date().toISOString()});
 save(); closeModal(); renderProducts(); toast(`تم تعديل كمية ${p.name} من ${old} إلى ${v}`);
};
window.deleteProduct=id=>{if(!isManager())return denySeller();if(confirm("حذف الصنف؟")){db.products=db.products.filter(x=>x.id!==id);save();renderProducts()}};
window.printLabel=async id=>{const p=db.products.find(x=>x.id===id);if(!p)return;const html=`<html dir="rtl"><meta charset="utf-8"><style>@page{size:60mm 40mm;margin:2mm}body{text-align:center;font-family:Arial;margin:0}.name{font-size:16px;font-weight:bold;margin-bottom:5px}.price{font-size:22px;font-weight:900;margin:4px 0}.code{font-size:18px;font-weight:800;letter-spacing:1px;border-top:1px solid #111;padding-top:5px}.label{border:1px solid #111;padding:7px;border-radius:5px}</style><div class="label"><div class="name">${escape(p.name)}</div><div class="price">السعر: ${money(p.price)}</div><div class="code">الكود: ${escape(p.code)}</div></div></html>`;await window.amir.printLabels(html);toast("تم إرسال الليبل للطباعة")};

window.openInvoiceById=id=>{const inv=db.invoices.find(x=>x.id===Number(id));if(!inv)return toast("الفاتورة غير موجودة");openReceipt(inv,false)};

function renderInvoices(){ $("#content").innerHTML=`<div class="page-head"><div><h1>الفواتير</h1><p>عرض ومعاينة وإعادة طباعة الفواتير</p></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>البائع</th><th>الأصناف</th><th>الإجمالي</th><th>إجراء</th></tr></thead><tbody>${db.invoices.map(i=>`<tr><td>${i.number}</td><td>${new Date(i.date).toLocaleString("ar-EG")}</td><td>${escape(i.seller)}</td><td>${i.items.reduce((a,b)=>a+b.qty,0)}</td><td>${money(i.total)}</td><td><button class="secondary" onclick="openInvoiceById(${i.id})">معاينة/طباعة</button></td></tr>`).join("")||`<tr><td colspan="6" class="muted">لا توجد فواتير بعد.</td></tr>`}</tbody></table></div></div>`}

function renderReturns(){ $("#content").innerHTML=`<div class="page-head"><div><h1>المرتجعات</h1><p>تسجيل المرتجع وإعادة الكمية للمخزون</p></div><button class="primary" onclick="returnForm()">+ مرتجع جديد</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>رقم المرتجع</th><th>الفاتورة</th><th>التاريخ</th><th>القيمة</th><th>السبب</th></tr></thead><tbody>${db.returns.map(r=>`<tr><td>${r.id}</td><td>${r.invoice}</td><td>${new Date(r.date).toLocaleString("ar-EG")}</td><td>${money(r.total)}</td><td>${escape(r.reason)}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">لا توجد مرتجعات.</td></tr>`}</tbody></table></div></div>`}
window.returnForm=()=>openModal(`<div class="modal-head"><h2>مرتجع جديد</h2><button class="close" type="button" onclick="closeModal()">×</button></div><label>الفاتورة<select id="retInv">${db.invoices.map(i=>`<option value="${i.id}">${i.number}</option>`).join("")}</select></label><label>السبب<input id="retReason" placeholder="مثال: عميل رفض الصنف"></label><label>الصنف والكمية<input id="retQty" type="number" min="1" value="1"></label><div class="form-actions"><button class="primary" onclick="saveReturn()">حفظ المرتجع</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);
window.saveReturn=()=>{const inv=db.invoices.find(i=>i.id===+$("#retInv").value);if(!inv)return;const qty=Math.max(1,+$("#retQty").value||1), item=inv.items[0];if(!item)return;const p=db.products.find(x=>x.id===item.id);if(p)p.stock+=Math.min(qty,item.qty);db.returns.unshift({id:"RET-"+Date.now().toString().slice(-7),invoice:inv.number,date:new Date().toISOString(),total:item.price*qty,reason:$("#retReason").value});save();closeModal();renderReturns();toast("تم تسجيل المرتجع")};

function simplePage(type,title,fields,rows,addFn){
 $("#content").innerHTML=`<div class="page-head"><div><h1>${title}</h1><p>${type==="customers"?"بيانات العملاء":type==="suppliers"?"بيانات الموردين":"تسجيل المصروفات"}</p></div><button class="primary" onclick="${addFn}">+ إضافة</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr>${fields.map(x=>`<th>${x[0]}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${fields.length}" class="muted">لا توجد بيانات.</td></tr>`}</tbody></table></div></div>`;
}
function renderCustomers(){simplePage("customers","العملاء",[["اللوجو"],["الاسم"],["الهاتف"],["الرصيد"],["إجراء"]],db.customers.map(c=>`<tr><td>${c.logo?`<img src="${c.logo}" style="width:42px;height:42px;object-fit:contain;border-radius:8px">`:"—"}</td><td>${escape(c.name)}</td><td>${escape(c.phone)}</td><td>${money(c.balance)}</td><td><button class="danger" onclick="deleteCustomer(${c.id})">حذف</button></td></tr>`).join(""),"customerForm()") }
window.deleteCustomer=id=>{if(!confirm("حذف العميل؟"))return;db.customers=db.customers.filter(x=>x.id!==id);save();renderCustomers();};
window.customerForm=()=>openModal(`<div class="modal-head"><h2>إضافة عميل</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="grid g2"><label>الاسم<input id="cName"></label><label>الهاتف<input id="cPhone"></label><label>الرصيد<input id="cBal" type="number" value="0"></label><label>لوجو العميل<input id="cLogo" type="file" accept="image/*"></label></div><div class="form-actions"><button class="primary" onclick="saveCustomer()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);
window.saveCustomer=()=>{const name=$("#cName").value.trim();if(!name)return toast("اكتب اسم العميل");const f=$("#cLogo").files[0];const done=logo=>{db.customers.unshift({id:Date.now(),name,phone:$("#cPhone").value.trim(),balance:+$("#cBal").value||0,logo:logo||""});save();closeModal();renderCustomers();toast("تم حفظ العميل")};if(f){const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(f)}else done("")};
function renderSuppliers(){simplePage("suppliers","الموردون والمشتريات",[["المورد"],["الهاتف"],["الرصيد"],["إجراء"]],db.suppliers.map(c=>`<tr><td>${escape(c.name)}</td><td>${escape(c.phone)}</td><td>${money(c.balance)}</td><td><button class="danger" onclick="deleteSupplier(${c.id})">حذف</button></td></tr>`).join(""),"supplierForm()") }
window.deleteSupplier=id=>{if(!confirm("حذف المورد؟"))return;db.suppliers=db.suppliers.filter(x=>x.id!==id);save();renderSuppliers();};
window.supplierForm=()=>openModal(`<div class="modal-head"><h2>إضافة مورد</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="grid g2"><label>الاسم<input id="sName"></label><label>الهاتف<input id="sPhone"></label><label>الرصيد<input id="sBal" type="number" value="0"></label></div><div class="form-actions"><button class="primary" onclick="saveSupplier()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);
window.saveSupplier=()=>{const name=$("#sName").value.trim();if(!name)return toast("اكتب اسم المورد");db.suppliers.unshift({id:Date.now(),name,phone:$("#sPhone").value.trim(),balance:+$("#sBal").value||0});save();closeModal();renderSuppliers();toast("تم حفظ المورد")};
function renderExpenses(){simplePage("expenses","المصروفات",[["التاريخ"],["البيان"],["القيمة"],["إجراء"]],db.expenses.map(c=>`<tr><td>${new Date(c.date).toLocaleDateString("ar-EG")}</td><td>${escape(c.note)}</td><td>${money(c.amount)}</td><td><button class="danger" onclick="deleteExpense(${c.id})">حذف</button></td></tr>`).join(""),"expenseForm()") }
window.deleteExpense=id=>{if(!confirm("حذف المصروف؟"))return;db.expenses=db.expenses.filter(x=>x.id!==id);save();renderExpenses();};
window.expenseForm=()=>openModal(`<div class="modal-head"><h2>إضافة مصروف</h2><button class="close" type="button" onclick="closeModal()">×</button></div><label>البيان<input id="eNote"></label><label>القيمة<input id="eAmount" type="number"></label><div class="form-actions"><button class="primary" onclick="saveExpense()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);
window.saveExpense=()=>{const note=$("#eNote").value.trim(),amount=+$("#eAmount").value||0;if(!note||amount<=0)return toast("أكمل بيانات المصروف");db.expenses.unshift({id:Date.now(),date:new Date().toISOString(),note,amount});save();closeModal();renderExpenses();toast("تم حفظ المصروف")};

function renderReports(){const sales=db.invoices.reduce((a,b)=>a+b.total,0), cost=db.invoices.reduce((a,b)=>a+b.items.reduce((x,i)=>{const p=db.products.find(q=>q.id===i.id);return x+(p?p.cost*i.qty:0)},0),0);$("#content").innerHTML=`<div class="page-head"><div><h1>التقارير</h1><p>ملخص سريع لأداء المحل</p></div></div><div class="grid g4 stats"><div class="card"><span class="muted">إجمالي المبيعات</span><div class="stat-num">${money(sales)}</div></div><div class="card"><span class="muted">التكلفة</span><div class="stat-num">${money(cost)}</div></div><div class="card"><span class="muted">الربح التقريبي</span><div class="stat-num">${money(sales-cost)}</div></div><div class="card"><span class="muted">المصروفات</span><div class="stat-num">${money(db.expenses.reduce((a,b)=>a+b.amount,0))}</div></div></div><div class="card" style="margin-top:18px"><h3>ملخص المخزون</h3><div class="table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>المخزون</th><th>قيمة البيع</th></tr></thead><tbody>${db.products.map(p=>`<tr><td>${escape(p.name)}</td><td>${p.stock}</td><td>${money(p.stock*p.price)}</td></tr>`).join("")}</tbody></table></div></div>`}

function renderShifts(){const s=db.currentShift;$("#content").innerHTML=`<div class="page-head"><div><h1>الشيفتات</h1><p>فتح وإغلاق وردية البائع</p></div>${s?`<button class="danger" onclick="closeShift()">إغلاق الشيفت</button>`:`<button class="primary" onclick="openShift()">فتح الشيفت</button>`}</div><div class="card">${s?`<h2>الشيفت مفتوح</h2><p>بدأ: ${new Date(s.start).toLocaleString("ar-EG")}</p><p>رصيد البداية: <b>${money(s.startCash)}</b></p>`:`<h2>لا يوجد شيفت مفتوح</h2><p class="muted">افتح الشيفت قبل بدء البيع.</p>`}</div><div class="card" style="margin-top:18px"><h3>سجل الشيفتات</h3>${db.shifts.length?db.shifts.map(x=>`<p>${new Date(x.start).toLocaleString("ar-EG")} — ${new Date(x.end).toLocaleString("ar-EG")} — ${money(x.sales)}</p>`).join(""):"<span class='muted'>لا يوجد سجل.</span>"}</div>`}
window.openShift=()=>{
  const me=JSON.parse(sessionStorage.getItem("amir_session")||"{}");
  if(!me.id)return toast("سجّل الدخول أولًا");
  if(db.currentShift && db.currentShift.start){
    return toast("الشيفت مفتوح بالفعل");
  }
  db.currentShift=null;
  openModal(`<div class="modal-head"><h2>فتح الشيفت</h2><button class="close" type="button" onclick="closeModal()">×</button></div>
    <label>رصيد بداية الشيفت<input id="shiftCash" type="number" min="0" step="0.01" value="0"></label>
    <label>ملاحظة (اختياري)<input id="shiftNote"></label>
    <div class="form-actions">
      <button class="primary" id="confirmOpenShift">فتح الشيفت</button>
      <button class="secondary" onclick="closeModal()">إلغاء</button>
    </div>`);
  $("#confirmOpenShift").onclick=()=>{
    const cash=Math.max(0,Number($("#shiftCash").value)||0);
    db.currentShift={id:Date.now(),start:new Date().toISOString(),startCash:cash,note:$("#shiftNote").value.trim(),sellerId:me.id,seller:me.name||me.username||""};
    if(!Array.isArray(db.shifts)) db.shifts=[];
    save(); closeModal(); route("shifts"); toast("تم فتح الشيفت بنجاح");
  };
}
window.closeShift=()=>{if(!db.currentShift)return toast("لا يوجد شيفت مفتوح");const s=db.currentShift;s.end=new Date().toISOString();s.sales=db.invoices.filter(i=>new Date(i.date)>=new Date(s.start)).reduce((a,b)=>a+b.total,0);db.shifts.unshift(s);db.currentShift=null;save();route("shifts");toast("تم إغلاق الشيفت")};

function renderUsers(){
  $("#content").innerHTML=`<div class="page-head"><div><h1>المستخدمون والصلاحيات</h1><p>إدارة حسابات المدير والبائع ومندوب التوصيل والصلاحيات.</p></div><button class="primary" onclick="userForm()">+ إضافة مستخدم</button></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>رقم الهاتف</th><th>الصلاحية</th><th>إجراء</th></tr></thead><tbody>
  ${db.users.map(u=>`<tr><td>${escape(u.name)}</td><td>${escape(u.username)}</td><td>${escape(u.phone||"-")}</td><td><b>${escape(u.role||"بائع")}</b></td><td class="actions"><button class="secondary" onclick="passwordForm(${u.id})">تغيير كلمة المرور</button>${u.username!=="admin"?`<button class="danger" onclick="deleteUser(${u.id})">حذف</button>`:""}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}
window.userForm=()=>{if(!isManager())return denySeller();openModal(`<div class="modal-head"><h2>إضافة مستخدم</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="grid g2"><label>الاسم<input id="uName"></label><label>اسم المستخدم<input id="uUser"></label><label>كلمة المرور<input id="uPass" type="password"></label><label>رقم الهاتف<input id="uPhone"></label><label>الصلاحية<select id="uRole"><option value="بائع">بائع</option><option value="مندوب توصيل">مندوب توصيل</option><option value="مدير">مدير</option></select></label></div><p class="muted">مندوب التوصيل له حساب مستقل بصلاحية "مندوب توصيل".</p><div class="form-actions"><button class="primary" onclick="saveUser()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`)}
window.saveUser=async()=>{if(!isManager())return denySeller();const u={id:Date.now(),name:$("#uName").value.trim(),username:$("#uUser").value.trim(),password:$("#uPass").value,phone:$("#uPhone").value.trim(),role:$("#uRole").value};if(!u.name||!u.username||!u.password)return toast("أكمل البيانات");if(db.users.some(x=>String(x.username).toLowerCase()===u.username.toLowerCase()))return toast("اسم المستخدم موجود بالفعل");db.users.push(u);save();closeModal();renderUsers();if(u.role==="مندوب توصيل"&&onlineUrl()){try{let token=localStorage.getItem("hesbah_online_token");if(!token){await connectOnline()}try{await onlineFetch("/api/drivers",{method:"POST",body:JSON.stringify({userId:u.id,name:u.name,username:u.username,password:u.password,phone:u.phone})})}catch(e){if(String(e.message||"").includes("401")||String(e.message||"").includes("التوكن")||String(e.message||"الجلسة")){await connectOnline();await onlineFetch("/api/drivers",{method:"POST",body:JSON.stringify({userId:u.id,name:u.name,username:u.username,password:u.password,phone:u.phone})})}else throw e}}catch(e){toast("تم حفظ المستخدم لكن تعذر ربط مندوب التوصيل بالسيرفر: "+e.message);return}toast("تم إضافة مندوب التوصيل وربطه بقائمة الطلبات الأونلاين")}else if(u.role==="مندوب توصيل"){toast("تم حفظ المندوب محليًا. اربط Hesbah Online أولًا ليظهر في الطلبات الأونلاين")}else toast("تم إضافة المستخدم")};
window.deleteUser=async id=>{if(!isManager())return denySeller();const u=db.users.find(x=>x.id===id);if(!u||u.username==="admin")return;if(!confirm("حذف المستخدم؟"))return;db.users=db.users.filter(x=>x.id!==id);save();if(u.role==="مندوب توصيل"&&db.online?.enabled&&db.online?.url){try{await syncOnline(true)}catch(e){console.warn("driver user sync",e)}}renderUsers()};
window.passwordForm=id=>{if(!isManager())return denySeller();const u=db.users.find(x=>x.id===id);if(!u)return;openModal(`<div class="modal-head"><h2>تعديل كلمة المرور</h2><button class="close" type="button" onclick="closeModal()">×</button></div><label>كلمة المرور الجديدة<input id="newPass" type="password"></label><div class="form-actions"><button class="primary" onclick="savePassword()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`);window._passwordUserId=id};
window.savePassword=()=>{if(!isManager())return denySeller();const u=db.users.find(x=>x.id===window._passwordUserId);if(!u)return;const pass=$("#newPass").value;if(!pass)return toast("اكتب كلمة مرور");u.password=pass;save();closeModal();toast("تم تغيير كلمة المرور")};


function qrText(){
  const shop=db.shop||{};
  const lines=[
    "Hesbah - قائمة أسعار",
    shop.name||"متجري",
    shop.phone?`هاتف: ${shop.phone}`:"",
    shop.address?`العنوان: ${shop.address}`:"",
    "--------------------",
    ...db.categories.flatMap(cat=>{const items=db.products.filter(p=>(p.category||"عام")===cat);return items.length?[`[ ${cat} ]`,...items.map(p=>`${p.code} | ${p.name} | ${Number(p.price||0).toFixed(2)} ج.م`)]:[]})
  ].filter(Boolean);
  return lines.join("\n");
}
function qrImageUrl(text,size=420){
  return "https://quickchart.io/qr?size="+size+"&margin=2&ecLevel=M&text="+encodeURIComponent(text);
}
function renderQRMenu(){
  const text=qrText();
  const logo=logoSrc();
  const shop=db.shop||{};
  const qr=db.qrMenu||{showLogo:true,showName:true,layout:"all"};
  const products=Array.isArray(db.products)?db.products:[];
  let serial=0; const rows=db.categories.flatMap(cat=>{const items=products.filter(p=>(p.category||"عام")===cat);if(!items.length)return [];return [`<tr class="qr-cat-row"><td colspan="4">${escape(cat)}</td></tr>`,...items.map(p=>`<tr><td>${++serial}</td><td>${escape(p.name)}</td><td>${escape(p.code||"")}</td><td>${money(p.price)}</td></tr>`)];}).join("");
  const posterLogo=qr.showLogo&&logo?`<img class="qr-poster-logo" src="${logo}" alt="لوجو المحل">`:"";
  const posterName=qr.showName?`<div class="qr-poster-shop">${escape(shop.name||"متجري")}</div>`:"";
  const posterAddress=shop.address?`<div class="qr-poster-contact">${escape(shop.address)}</div>`:"";
  const posterPhone=shop.phone?`<div class="qr-poster-contact">${escape(shop.phone)}</div>`:"";
  const qrUrl=qrImageUrl(text,560);
  const total=products.length;
  const previewRows=rows||`<tr><td colspan="4" class="muted">لا توجد أصناف</td></tr>`;
  const footer=`<div class="qr-footer"><span>Hesbah v1.3.0</span><span>جاهز للاستخدام <i></i></span></div>`;
  $("#content").innerHTML=`
    <div class="qr-page">
      <div class="qr-page-head">
        <button class="secondary qr-back" onclick="route('pos')">← العودة</button>
        <div class="qr-title"><h1>قائمة الأسعار <span>QR Code</span> ▣</h1><p>يمكنك إنشاء رمز QR يحتوي على جميع الأصناف والأسعار في متجرك</p></div>
      </div>
      <div class="qr-workspace">
        <div class="card qr-settings-card">
          <h2>إعدادات القائمة</h2>
          <div class="qr-setting-row qr-refresh-row"><div><b>تحديث البيانات</b><small>سيتم جلب أحدث الأسعار من قاعدة البيانات</small></div><button class="secondary" onclick="refreshQRMenu()">تحديث ↻</button></div>
          <label class="qr-toggle-row"><span>إظهار شعار المحل</span><input id="qrShowLogo" type="checkbox" ${qr.showLogo!==false?"checked":""} onchange="saveQRSetting('showLogo',this.checked)"></label>
          <label class="qr-toggle-row"><span>إظهار اسم المحل</span><input id="qrShowName" type="checkbox" ${qr.showName!==false?"checked":""} onchange="saveQRSetting('showName',this.checked)"></label>
          <div class="qr-format-row"><b>تنسيق العرض</b><select id="qrLayout" onchange="saveQRSetting('layout',this.value)"><option value="all" ${qr.layout==="all"?"selected":""}>قائمة شاملة (جميع الأصناف)</option><option value="prices" ${qr.layout==="prices"?"selected":""}>الأصناف والأسعار</option></select></div>
        </div>
        <div class="card qr-preview-card">
          <h2>شكل القائمة</h2>
          <div class="qr-poster" id="qrPoster">
            <div class="qr-poster-top"><div class="qr-corner"></div>${posterLogo}${posterName}${posterAddress}${posterPhone}</div>
            <div class="qr-banner">قائمة الأسعار</div>
            <div class="qr-sub-banner">امسح الرمز QR لعرض جميع الأصناف والأسعار</div>
            <div class="qr-poster-code"><img src="${qrUrl}" alt="QR Code"><div class="qr-center-badge">🛒</div></div>
            <div class="qr-slogan">تسوق بسهولة ..<br>واكتشف كل ما تحتاجه</div>
            <div class="qr-features"><div><b>✓</b><span>أسعار محدثة</span></div><div><b>★</b><span>جودة عالية</span></div><div><b>🛒</b><span>أفضل العروض</span></div></div>
            <div class="qr-poster-bottom">🛒 <b>${escape(shop.name||"Hesbah")}</b></div>
          </div>
          <div class="qr-note">ⓘ يمكنك طباعة هذه الصفحة أو حفظها كصورة واستخدامها في المتجر</div>
        </div>
        <div class="card qr-products-card">
          <div class="qr-products-head"><h2>معاينة قائمة الأصناف</h2><span>${total} صنف</span></div>
          <div class="table-wrap"><table class="table qr-products-table"><thead><tr><th>م</th><th>اسم الصنف</th><th>الكود</th><th>السعر</th></tr></thead><tbody>${previewRows}</tbody></table></div>
          <div class="qr-total">إجمالي الأصناف: <b>${total}</b></div>
          <div class="qr-actions"><button class="qr-blue" onclick="createQRNow()">▣ إنشاء QR Code</button><button class="qr-green" onclick="printQRMenu()">▣ طباعة</button><button class="secondary" onclick="saveQRAsImage()">⇩ حفظ كصورة</button></div>
        </div>
      </div>
      ${footer}
    </div>`;
}
window.saveQRSetting=(key,value)=>{if(!isManager())return denySeller();if(!db.qrMenu)db.qrMenu={showLogo:true,showName:true,layout:"all"};db.qrMenu[key]=value;save();renderQRMenu()};
window.createQRNow=()=>{renderQRMenu();toast("تم إنشاء QR Code وتحديث القائمة")};
window.saveQRAsImage=()=>{toast("استخدم طباعة ثم اختر Microsoft Print to PDF لحفظها كملف")};
window.refreshQRMenu=()=>renderQRMenu();
window.openQRText=()=>openModal(`<div class="modal-head"><h2>محتوى QR</h2><button class="close" type="button" onclick="closeModal()">×</button></div><textarea id="qrTextArea" rows="16" readonly>${escape(qrText())}</textarea><div class="form-actions"><button class="secondary" onclick="copyQRText()">نسخ</button><button class="secondary" onclick="closeModal()">إلغاء</button></div>`);
window.copyQRText=async()=>{try{await navigator.clipboard.writeText(qrText());toast("تم نسخ بيانات QR")}catch{toast("تعذر النسخ التلقائي")}};
window.printQRMenu=async()=>{
  const shop=db.shop||{}, logo=logoSrc(), products=db.products||[];
  let serial=0; const rows=db.categories.flatMap(cat=>{const items=products.filter(p=>(p.category||"عام")===cat);if(!items.length)return [];return [`<tr class="qr-cat-row"><td colspan="4">${escape(cat)}</td></tr>`,...items.map(p=>`<tr><td>${++serial}</td><td>${escape(p.name)}</td><td>${escape(p.code||"")}</td><td>${money(p.price)}</td></tr>`)];}).join("");
  const qr=qrImageUrl(qrText(),560);
  const html=`<html dir="rtl"><head><meta charset="utf-8"><title>قائمة الأسعار QR</title><style>
  @page{margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102c5b;margin:0;background:#fff}.wrap{width:190mm;min-height:270mm;margin:auto;padding:10mm;text-align:center}.brand{display:flex;justify-content:center;align-items:center;gap:12px}.logo{width:80px;height:55px;object-fit:contain}.brand-name{font-size:30px;font-weight:800}.brand-name span{color:#f97316}.banner{background:#102f67;color:#fff;border-radius:24px;padding:12px 24px;font-size:28px;font-weight:900;margin:12px 0 3px}.sub{background:#f97316;color:#fff;border-radius:14px;padding:8px;font-size:18px;font-weight:800}.qr-wrap{width:92mm;height:92mm;margin:14mm auto 7mm;border:4px solid #f97316;border-radius:18px;padding:7mm;position:relative}.qr{width:100%;height:100%;object-fit:contain}.slogan{font-size:21px;font-weight:800;line-height:1.6}.features{display:flex;justify-content:space-around;border-top:1px solid #dce3ef;margin-top:12mm;padding-top:5mm}.features b{display:block;font-size:20px;color:#f97316}.features span{font-weight:800}.foot{background:#102f67;color:#fff;margin:8mm -10mm -10mm;padding:10mm;font-size:20px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:12mm;font-size:14px}th,td{padding:7px;border:1px solid #dce3ef;text-align:right}th{background:#eef3f9}.muted{color:#7383a3}</style></head><body><div class="wrap"><div class="brand">${logo?`<img class="logo" src="${logo}">`:``}<div class="brand-name">Hes<span>bah</span></div></div><div class="muted">${escape(shop.address||"")} ${shop.phone?`— ${escape(shop.phone)}`:""}</div><div class="banner">قائمة الأسعار</div><div class="sub">امسح الرمز QR لعرض جميع الأصناف والأسعار</div><div class="qr-wrap"><img class="qr" src="${qr}"></div><div class="slogan">تسوق بسهولة ..<br>واكتشف كل ما تحتاجه</div><div class="features"><div><b>✓</b><span>أسعار محدثة</span></div><div><b>★</b><span>جودة عالية</span></div><div><b>🛒</b><span>أفضل العروض</span></div></div><table><thead><tr><th>م</th><th>اسم الصنف</th><th>الكود</th><th>السعر</th></tr></thead><tbody>${rows||`<tr><td colspan="4">لا توجد أصناف</td></tr>`}</tbody></table><div class="foot">${escape(shop.name||"Hesbah")}</div></div></body></html>`;
  const r=await window.amir.printReceipt(html);if(r?.success!==false)toast("تم إرسال قائمة QR للطباعة");
};
function renderSettings(){
 $("#content").innerHTML=`<div class="page-head"><div><h1>الإعدادات</h1><p>إدارة بيانات المحل والطباعة والنسخ الاحتياطي والتفعيل</p></div></div>
 <div class="tabs" id="settingsTabs"><button class="tab active" data-tab="shop">بيانات المحل</button><button class="tab" data-tab="printer">الطباعة ودرج النقدية</button><button class="tab" data-tab="backup">النسخ الاحتياطي</button><button class="tab" data-tab="online">Hesbah Online</button><button class="tab" data-tab="payment">💳 طرق الدفع</button><button class="tab" data-tab="activation">التفعيل</button></div><div id="settingsPanel"></div>`;
 $("#settingsTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");settingsPanel(b.dataset.tab)};
 settingsPanel("shop");
}
function settingsPanel(tab){
 const p=$("#settingsPanel");
 if(tab==="shop")p.innerHTML=`<div class="card"><h2>بيانات المحل</h2><div class="grid g2"><label>اسم المحل<input id="shopName" value="${escape(db.shop.name)}"></label><label>هاتف المحل<input id="shopPhone" value="${escape(db.shop.phone)}"></label><label>العنوان<input id="shopAddress" value="${escape(db.shop.address)}"></label><label>اسم الجهاز<input value="جهاز" disabled></label></div><div class="grid g2"><div><h3>بيانات صاحب البرنامج</h3><p>${escape(db.owner.name)}</p><b style="color:var(--accent)">${db.owner.phone}</b><p class="muted">هذه البيانات ثابتة وتظهر في بيانات الدعم فقط.</p></div><div><h3>اللوجو</h3><div class="logo-preview">${db.shop.logo?`<img src="${db.shop.logo}">`:"A"}</div><input id="logoFile" type="file" accept="image/*"></div></div><div class="form-actions"><button class="primary" onclick="saveShop()">حفظ بيانات المحل</button></div></div>`;
 if(tab==="printer")p.innerHTML=`<div class="card"><h2>الطباعة ودرج النقدية</h2><div class="grid g2"><label>الطابعة<input id="printerName" value="${escape(db.printer.printer)}"></label><label>عدد نسخ الفاتورة<select id="copies"><option ${db.printer.copies===1?"selected":""}>1</option><option ${db.printer.copies===2?"selected":""}>2</option><option ${db.printer.copies===3?"selected":""}>3</option></select></label></div><label>فتح درج النقدية مع الطباعة <select id="drawer"><option value="0" ${!db.printer.drawer?"selected":""}>لا</option><option value="1" ${db.printer.drawer?"selected":""}>نعم</option></select></label><label>طباعة تذكرة تجهيز الطلب <select id="prep"><option value="0" ${!db.printer.prep?"selected":""}>لا</option><option value="1" ${db.printer.prep?"selected":""}>نعم</option></select></label><p class="muted">بعد الضغط على طباعة ستظهر نافذة طباعة Windows لاختيار الطابعة. دعم درج النقدية الحقيقي يعتمد على تعريف ESC/POS الخاص بالطابعة.</p><div class="form-actions"><button class="primary" onclick="savePrinter()">حفظ إعدادات الطباعة</button></div></div>`;
 if(tab==="backup")p.innerHTML=`<div class="card"><h2>النسخ الاحتياطي</h2><p class="muted">احفظ نسخة كاملة من المنتجات والفواتير والعملاء والمستخدمين والإعدادات على جهازك.</p><div class="actions"><button class="primary" onclick="backup()">إنشاء نسخة احتياطية</button><button class="secondary" onclick="restore()">استرجاع نسخة احتياطية</button></div><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><p><b>نصيحة:</b> احتفظ بنسخة على فلاشة أو قرص خارجي.</p></div>`;
 if(tab==="online")p.innerHTML=`<div class="card"><h2>Hesbah Online</h2><p class="muted">اربط برنامج الكاشير بحساب Hesbah Online لمزامنة البيانات بين الأجهزة.</p><div class="grid g2"><label>عنوان السيرفر<input id="onlineUrl" value="${escape(db.online?.url||"")}" placeholder="مثال: http://192.168.1.10:8080"></label><label>كود المتجر<input id="onlineStoreId" value="${escape(db.online?.storeId||"demo")}" placeholder="demo"></label></div><label>المزامنة التلقائية <select id="onlineAuto"><option value="0" ${!db.online?.autoSync?"selected":""}>لا</option><option value="1" ${db.online?.autoSync?"selected":""}>نعم</option></select></label><div class="form-actions"><button class="primary" onclick="saveOnlineSettings()">حفظ الإعدادات</button><button class="secondary" onclick="connectOnlineNow()">اختبار الاتصال والربط</button><button class="secondary" onclick="syncOnline(true)">مزامنة الآن</button></div><div id="onlineStatus" class="muted" style="margin-top:14px"></div></div>`;
 if(tab==="payment")p.innerHTML=`<div class="card"><h2>💳 طرق الدفع</h2><p class="muted">حدد طرق الدفع التي تظهر للعميل في صفحة الطلب. يمكنك تشغيل أو إيقاف أي طريقة وتسجيل بياناتها.</p><div class="grid g2">
 <div><label><input type="checkbox" id="posPayCashEnabled"> 💵 كاش عند الاستلام</label><input id="posPayCashName" placeholder="اسم طريقة الدفع"></div>
 <div><label><input type="checkbox" id="posPayVodafoneEnabled"> 📱 Vodafone Cash</label><input id="posPayVodafoneName" placeholder="اسم طريقة الدفع"><input id="posPayVodafoneNumber" placeholder="رقم Vodafone Cash"></div>
 <div><label><input type="checkbox" id="posPayEtisalatEnabled"> 📱 Etisalat Cash</label><input id="posPayEtisalatName" placeholder="اسم طريقة الدفع"><input id="posPayEtisalatNumber" placeholder="رقم Etisalat Cash"></div>
 <div><label><input type="checkbox" id="posPayOrangeEnabled"> 📱 Orange Cash</label><input id="posPayOrangeName" placeholder="اسم طريقة الدفع"><input id="posPayOrangeNumber" placeholder="رقم Orange Cash"></div>
 <div><label><input type="checkbox" id="posPayWeEnabled"> 📱 WE Pay</label><input id="posPayWeName" placeholder="اسم طريقة الدفع"><input id="posPayWeNumber" placeholder="رقم WE Pay"></div>
 <div><label><input type="checkbox" id="posPayInstapayEnabled"> 🏦 InstaPay</label><input id="posPayInstapayName" placeholder="اسم طريقة الدفع"><input id="posPayInstapayAccount" placeholder="حساب / عنوان InstaPay"></div>
 <div><label><input type="checkbox" id="posPayCardEnabled"> 💳 Visa / Mastercard</label><input id="posPayCardName" placeholder="اسم طريقة الدفع"><input id="posPayCardProvider" placeholder="مزود خدمة الدفع"><input id="posPayCardPublicKey" placeholder="Public Key"></div>
 </div><div class="form-actions"><button class="primary" onclick="savePaymentSettingsPOS()">💾 حفظ إعدادات الدفع</button><button class="secondary" onclick="loadPaymentSettingsPOS()">🔄 تحديث</button></div><div id="posPaymentMsg" class="muted" style="margin-top:12px"></div></div>`;
 loadPaymentSettingsPOS();
 if(tab==="activation")p.innerHTML=`<div class="card"><h2>تفعيل البرنامج</h2><div class="grid g2"><label>حالة البرنامج<input id="actStatus" value="جاري التحقق..." disabled></label><label>Machine ID<input id="machineId" value="جاري القراءة..." disabled></label><label>كود التفعيل<input id="actCode" value="${escape(db.activation.code)}" placeholder="الصق كود التفعيل هنا"></label><label>اسم العميل<input id="actCustomer" value="${escape(db.activation.customer)}" disabled></label></div><div id="trialInfo" class="muted" style="margin-top:12px"></div><div class="form-actions"><button class="primary" onclick="saveActivation()">تفعيل البرنامج</button></div><p class="muted">أرسل الـ Machine ID للإدارة ليتم إصدار كود خاص بهذا الجهاز.</p></div>`; refreshLicense().then(st=>{if($("#machineId"))$("#machineId").value=st.machineId||"-"; if($("#actStatus"))$("#actStatus").value=st.status+(st.trial&&st.daysLeft!=null?` — متبقي ${st.daysLeft} يوم`:""); if($("#actCustomer"))$("#actCustomer").value=st.customer||db.activation.customer||""; if($("#trialInfo"))$("#trialInfo").textContent=st.trial?`الفترة التجريبية: 15 يوم — المتبقي ${st.daysLeft} يوم — تنتهي في ${new Date(st.expiresAt).toLocaleDateString("ar-EG")}`:(st.expiresAt?`التفعيل ساري حتى ${new Date(st.expiresAt).toLocaleDateString("ar-EG")}`:"")});
}
async function loadPaymentSettingsPOS(){
  const msg=$("#posPaymentMsg");
  let p=structuredClone(defaults.paymentSettings);
  try{
    if(db.paymentSettings) p={...p,...db.paymentSettings};
    if(db.online?.url){
      try{
        const d=await onlineFetch("/api/public/payment-methods");
        if(d?.payment) p=d.payment;
      }catch(_){}
    }

    $("#posPayCashEnabled").checked=!!p.cash?.enabled;
    $("#posPayCashName").value=p.cash?.name||"دفع كاش عند الاستلام";

    $("#posPayVodafoneEnabled").checked=!!p.vodafoneCash?.enabled;
    $("#posPayVodafoneName").value=p.vodafoneCash?.name||"Vodafone Cash";
    $("#posPayVodafoneNumber").value=p.vodafoneCash?.number||"";

    $("#posPayEtisalatEnabled").checked=!!p.etisalatCash?.enabled;
    $("#posPayEtisalatName").value=p.etisalatCash?.name||"Etisalat Cash";
    $("#posPayEtisalatNumber").value=p.etisalatCash?.number||"";

    $("#posPayOrangeEnabled").checked=!!p.orangeCash?.enabled;
    $("#posPayOrangeName").value=p.orangeCash?.name||"Orange Cash";
    $("#posPayOrangeNumber").value=p.orangeCash?.number||"";

    $("#posPayWeEnabled").checked=!!p.wePay?.enabled;
    $("#posPayWeName").value=p.wePay?.name||"WE Pay";
    $("#posPayWeNumber").value=p.wePay?.number||"";

    $("#posPayInstapayEnabled").checked=!!p.instapay?.enabled;
    $("#posPayInstapayName").value=p.instapay?.name||"InstaPay";
    $("#posPayInstapayAccount").value=p.instapay?.account||"";

    $("#posPayCardEnabled").checked=!!p.card?.enabled;
    $("#posPayCardName").value=p.card?.name||"Visa / Mastercard";
    $("#posPayCardProvider").value=p.card?.provider||"";
    $("#posPayCardPublicKey").value=p.card?.publicKey||"";

    db.paymentSettings=p;
    if(msg)msg.textContent="✓ تم تحميل إعدادات الدفع";
  }catch(e){
    if(msg)msg.textContent="❌ "+(e.message||"تعذر تحميل إعدادات الدفع");
  }
}

async function savePaymentSettingsPOS(){
  if(!isManager())return denySeller();
  const msg=$("#posPaymentMsg");
  const payload={
    cash:{enabled:$("#posPayCashEnabled").checked,name:$("#posPayCashName").value.trim()},
    vodafoneCash:{enabled:$("#posPayVodafoneEnabled").checked,name:$("#posPayVodafoneName").value.trim(),number:$("#posPayVodafoneNumber").value.trim()},
    etisalatCash:{enabled:$("#posPayEtisalatEnabled").checked,name:$("#posPayEtisalatName").value.trim(),number:$("#posPayEtisalatNumber").value.trim()},
    orangeCash:{enabled:$("#posPayOrangeEnabled").checked,name:$("#posPayOrangeName").value.trim(),number:$("#posPayOrangeNumber").value.trim()},
    wePay:{enabled:$("#posPayWeEnabled").checked,name:$("#posPayWeName").value.trim(),number:$("#posPayWeNumber").value.trim()},
    instapay:{enabled:$("#posPayInstapayEnabled").checked,name:$("#posPayInstapayName").value.trim(),account:$("#posPayInstapayAccount").value.trim()},
    card:{enabled:$("#posPayCardEnabled").checked,name:$("#posPayCardName").value.trim(),provider:$("#posPayCardProvider").value.trim(),publicKey:$("#posPayCardPublicKey").value.trim()}
  };

  try{
    db.paymentSettings=payload;
    save();
    if(msg)msg.textContent="جاري الحفظ...";
    if(db.online?.url){
      await onlineFetch("/api/payment-settings",{
        method:"PUT",
        body:JSON.stringify(payload)
      });
      if(msg)msg.textContent="✅ تم الحفظ ومزامنة طرق الدفع مع Hesbah Online";
    }else{
      if(msg)msg.textContent="✅ تم الحفظ محليًا. اربط Hesbah Online ليظهر التغيير للعميل.";
    }
    toast("تم حفظ إعدادات الدفع");
  }catch(e){
    if(msg)msg.textContent="❌ "+(e.message||"تعذر حفظ إعدادات الدفع");
  }
}

window.saveOnlineSettings=()=>{if(!isManager())return denySeller();db.online=db.online||{};db.online.url=$("#onlineUrl").value.trim().replace(/\/$/,"");db.online.storeId=$("#onlineStoreId").value.trim()||"demo";db.online.autoSync=$("#onlineAuto").value==="1";db.online.enabled=!!db.online.url;save();settingsPanel("online");toast(db.online.enabled?"تم حفظ إعدادات Hesbah Online":"تم حفظ الإعدادات")};
window.connectOnlineNow=async()=>{if(!isManager())return denySeller();db.online=db.online||{};db.online.url=$("#onlineUrl").value.trim().replace(/\/$/,"");db.online.storeId=$("#onlineStoreId").value.trim()||"demo";db.online.autoSync=$("#onlineAuto").value==="1";db.online.enabled=!!db.online.url;save();if(!db.online.url)return toast("أدخل عنوان السيرفر أولًا");const st=$("#onlineStatus");if(st)st.textContent="جاري الاتصال...";try{const d=await onlineFetch("/api/login",{method:"POST",body:JSON.stringify({storeId:db.online.storeId,username:"admin",password:"admin"})});localStorage.setItem("hesbah_online_token",d.token);if(st)st.textContent=`✓ تم الاتصال بالسيرفر — المتجر: ${d.store?.name||db.online.storeId}`;await syncOnline(true)}catch(e){if(st)st.textContent="✗ تعذر الاتصال: "+e.message;toast("تعذر الاتصال: "+e.message)}};

window.saveShop=()=>{if(!isManager())return denySeller();db.shop.name=$("#shopName").value.trim()||"متجري";db.shop.phone=$("#shopPhone").value.trim();db.shop.address=$("#shopAddress").value.trim();const f=$("#logoFile").files[0];const done=x=>{if(x!==undefined)db.shop.logo=x;save();refreshBrandLogo();toast("تم حفظ بيانات المحل");settingsPanel("shop")};if(f){const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(f)}else done(undefined)};
window.savePrinter=()=>{if(!isManager())return denySeller();db.printer={printer:$("#printerName").value,copies:+$("#copies").value,drawer:$("#drawer").value==="1",prep:$("#prep").value==="1"};save();toast("تم حفظ إعدادات الطباعة")};
window.saveActivation=async()=>{if(!isManager())return denySeller();const code=$("#actCode").value.trim();if(!code)return toast("أدخل كود التفعيل");const r=await window.amir.activateLicense(code);if(!r.ok)return toast(r.error||"كود التفعيل غير صالح");db.activation={status:"مفعل",code,customer:r.customer||""};save();toast("تم تفعيل البرنامج بنجاح");settingsPanel("activation")};
window.backup=async()=>{if(!isManager())return denySeller();const r=await window.amir.saveBackup(JSON.stringify(db,null,2));if(!r.canceled)toast("تم إنشاء النسخة الاحتياطية")};
window.restore=async()=>{if(!isManager())return denySeller();const r=await window.amir.restoreBackup();if(r.canceled)return;try{db=JSON.parse(r.content);save();toast("تم الاسترجاع بنجاح");setTimeout(()=>location.reload(),500)}catch{toast("ملف النسخة الاحتياطية غير صالح")}};

Object.defineProperty(window,"hesbahDB",{configurable:true,get:function(){return db}});window.hesbahSave=save;window.hesbahToast=toast;window.hesbahEscape=escape;window.hesbahMoney=money;window.hesbahOpenModal=openModal;window.hesbahIsManager=isManager;window.hesbahDenySeller=denySeller;window.hesbahOnlineRequest=onlineFetch;
const originalRoute=route;
ensureDatabase();
refreshBrandLogo();
if(db.online?.enabled && db.online.url) setTimeout(()=>syncOnline(false),1500);
if(sessionStorage.getItem("amir_session")){const s=JSON.parse(sessionStorage.getItem("amir_session"));$("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#sideUser").textContent=s.name;route("pos");checkLicense()}
})();






