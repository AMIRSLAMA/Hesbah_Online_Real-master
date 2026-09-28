let token = localStorage.getItem('hesbah_token') || '';
let state = null;

const $ = id => document.getElementById(id);

const money = n =>
  Number(n || 0).toFixed(2) + ' ج.م';

async function api(path, opt = {}) {
  opt.headers = {
    ...(opt.headers || {}),
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {})
  };

  const r = await fetch(path, opt);
  const d = await r.json();

  if (r.status === 401) {
    logout();
    return;
  }

  if (!r.ok) {
    throw Error(d.message || 'حدث خطأ');
  }

  return d;
}

async function doLogin() {
  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        storeId: $('store').value,
        username: $('user').value,
        password: $('pass').value
      })
    });

    token = d.token;
    localStorage.setItem('hesbah_token', token);

    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');

    await load();

  } catch (e) {
    $('msg').textContent =
      e.message || 'حدث خطأ أثناء تسجيل الدخول';
  }
}

async function load() {
  const d = await api('/api/bootstrap');

  state = d.db;

  $('shop').textContent =
    state.shop?.name || '';

  render();
  await loadOrders();
}

function render() {
  const today =
    new Date().toISOString().slice(0, 10);

  const inv = state.invoices || [];

  const todayInv = inv.filter(x =>
    String(x.date).slice(0, 10) === today
  );

  $('sales').textContent = money(
    todayInv.reduce(
      (a, b) => a + Number(b.total || 0),
      0
    )
  );

  $('count').textContent = inv.length;

  $('productsCount').textContent =
    (state.products || []).length;

  $('stockValue').textContent = money(
    (state.products || []).reduce(
      (a, p) =>
        a +
        Number(p.stock || 0) *
        Number(p.price || 0),
      0
    )
  );

  $('products').innerHTML =
    (state.products || [])
      .map(p => `
        <tr>
          <td>${esc(p.code)}</td>
          <td>${esc(p.name)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock}</td>
          <td>
            <button
              class="edit"
              onclick="editProduct(${p.id})">
              تعديل
            </button>
          </td>
        </tr>
      `)
      .join('');

  $('invoices').innerHTML =
    inv.slice(0, 20)
      .map(i => `
        <tr>
          <td>${esc(i.number)}</td>
          <td>
            ${new Date(i.date)
              .toLocaleString('ar-EG')}
          </td>
          <td>${esc(i.seller)}</td>
          <td>${money(i.total)}</td>
        </tr>
      `)
      .join('')
      ||
      '<tr><td colspan="4">لا توجد فواتير بعد</td></tr>';
}

let previousOrderSnapshot = '';
let knownOrderIds = new Set();
let soundEnabled = false;
let orderAudioContext = null;
let adminMap = null;
let adminMarkers = {};
let activityLog = [];

async function loadOrders() {
  try {
    const d = await api('/api/orders');
    const orders = d.orders || [];
    const currentNew = orders.filter(o => o.status === 'new');
    const signature = orders.map(o => String(o.id)+':'+o.status+':'+(o.driverId||0)).join('|');
    const firstLoad = previousOrderSnapshot === '';
    const newlyArrived = firstLoad ? [] : currentNew.filter(o => !knownOrderIds.has(String(o.id)));

    state.ordersCache = orders;
    orders.forEach(o => knownOrderIds.add(String(o.id)));
    previousOrderSnapshot = signature;
    renderOrders(orders);
    updateDashboard(orders);
    updateAdminMap(orders);

    if (newlyArrived.length) {
      newlyArrived.forEach(o => {
        activityLog.unshift({icon:'🔔', text:'طلب جديد '+(o.number||('#'+o.id)), time:new Date()});
      });
      activityLog = activityLog.slice(0,8);
      showNewOrderAlert(newlyArrived);
    }
    updateActivity();
    setLiveConnection('متصل الآن');
  } catch (e) {
    console.error('Orders error:', e);
    setLiveConnection('غير متصل');
  }
}

function renderOrders(orders) {
  const box = $('orders');
  if (!orders.length) {
    box.innerHTML = '<div class="empty-orders">لا توجد طلبات</div>';
    return;
  }
  const statusClass = s => 'status-'+String(s).replace(/_/g,'-');
  box.innerHTML = orders.slice().sort((a,b)=>Number(b.id)-Number(a.id)).map(order => {
    const type = order.type === 'table' ? 'ترابيزة '+esc(order.location?.table||'') :
      order.type === 'room' ? 'غرفة '+esc(order.location?.room||'') : 'طلب توصيل';
    const payment = order.paymentMethod === 'cash' ? 'نقدي عند الاستلام' : 'دفع إلكتروني';
    const items=(order.items||[]).map(item=>'<div class="order-item"><span>'+esc(item.name)+'</span><b>× '+item.qty+'</b><span>'+money(Number(item.price)*Number(item.qty))+'</span></div>').join('');
    const driver = order.driverName ? '<div class="driver-assigned">🛵 المندوب: <b>'+esc(order.driverName)+'</b>'+(order.driverPhone?' — '+esc(order.driverPhone):'')+'</div>' : '';
    return '<div class="order-card '+(order.status==='new'?'new-order-card ':'')+statusClass(order.status)+'">'+
      '<div class="order-head"><div><strong>'+(order.status==='new'?'🔔 ':'')+esc(order.number)+'</strong><small>'+new Date(order.createdAt).toLocaleString('ar-EG')+'</small></div>'+
      '<span class="order-status">'+(STATUS_LABELS[order.status]||esc(order.status))+'</span></div>'+
      '<div class="order-info"><div>👤 <b>العميل:</b> '+esc(order.customer?.name||'')+'</div><div>📞 <b>الهاتف:</b> '+esc(order.customer?.phone||'')+'</div><div>📍 <b>النوع:</b> '+type+'</div>'+
      (order.type==='delivery'?'<div>🏠 <b>العنوان:</b> '+esc(order.customer?.address||'')+(order.customer?.building?' - عمارة '+esc(order.customer.building):'')+(order.customer?.floor?' - الدور '+esc(order.customer.floor):'')+(order.customer?.apartment?' - شقة '+esc(order.customer.apartment):'')+'</div>':'')+
      '</div>'+driver+'<div class="order-items">'+items+'</div>'+
      '<div class="order-footer"><div><b>الإجمالي: '+money(order.total)+'</b><small>'+payment+'</small></div><div class="order-actions">'+driverSelect(order)+
      (NEXT_STATUS[order.status]||[]).map(s=>'<button onclick="changeOrderStatus(\''+order.id+'\',\''+s+'\')">'+STATUS_LABELS[s]+'</button>').join('')+
      (order.status==='out_for_delivery'?'<button onclick="createDriverLink(\''+order.id+'\')">📍 رابط الدليفري</button>':'')+'</div></div></div>';
  }).join('');
}

const STATUS_LABELS = {
  new: 'جديد',
  accepted: 'تم القبول',
  preparing: 'جاري التجهيز',
  ready: 'جاهز',
  out_for_delivery: 'خرج للتوصيل',
  completed: 'تم التسليم',
  rejected: 'مرفوض'
};

const NEXT_STATUS = {
  new: ['accepted','rejected'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['out_for_delivery','completed'],
  out_for_delivery: ['completed']
};


async function loadDrivers(){
  try{
    const d=await api('/api/drivers');
    state.drivers=d.drivers||[];
    const box=$('drivers');
    if(!box)return;
    if(!state.drivers.length){
      box.innerHTML='<div class="empty-orders">لا يوجد مندوبون. أضف أول مندوب.</div>';
      return;
    }
    box.innerHTML=state.drivers.map(d=>'<div class="order-card" style="margin-top:8px;padding:12px"><b>🛵 '+esc(d.name)+'</b><div>👤 '+esc(d.username)+' — 📞 '+esc(d.phone||'-')+'</div></div>').join('');
    renderOrders(state.ordersCache||[]);
  }catch(e){console.error('Drivers error:',e)}
}

async function createDriver(){
  try{
    const d=await api('/api/drivers',{
      method:'POST',
      body:JSON.stringify({
        name:$('driverName').value.trim(),
        username:$('driverUsername').value.trim(),
        password:$('driverPassword').value,
        phone:$('driverPhone').value.trim()
      })
    });
    $('driverName').value='';
    $('driverUsername').value='';
    $('driverPassword').value='';
    $('driverPhone').value='';
    await loadDrivers();
    alert('تم إضافة المندوب: '+d.driver.name);
  }catch(e){alert(e.message)}
}

async function assignDriver(orderId,driverId){
  try{
    await api('/api/orders/assign-driver',{
      method:'PUT',
      body:JSON.stringify({orderId:Number(orderId),driverId:Number(driverId)})
    });
    await loadOrders();
  }catch(e){alert(e.message)}
}

function driverSelect(order){
  if(order.type!=='delivery'||!Array.isArray(state.drivers)) return '';
  return `<select onchange="assignDriver(${Number(order.id)},this.value)" style="padding:9px;border-radius:10px;border:1px solid #ddd">
    <option value="0">بدون مندوب</option>
    ${state.drivers.map(d=>`<option value="${d.id}" ${Number(order.driverId)===Number(d.id)?'selected':''}>${esc(d.name)}</option>`).join('')}
  </select>`;
}

async function changeOrderStatus(id, status) {
  try {
    await api('/api/orders/status', {
      method: 'PUT',
      body: JSON.stringify({
        orderId: Number(id),
        status
      })
    });

    await loadOrders();
    await loadDrivers();
  } catch (e) {
    alert(e.message || 'تعذر تغيير حالة الطلب');
  }
}

async function acceptOrder(id) {
  await changeOrderStatus(id, 'accepted');
}

async function createDriverLink(id) {
  try {
    const d = await api('/api/orders/tracking-token', {
      method: 'POST',
      body: JSON.stringify({ orderId: Number(id) })
    });

    const full =
      location.origin + d.url;

    prompt(
      'انسخ هذا الرابط وافتحه على موبايل الدليفري:',
      full
    );
  } catch (e) {
    alert(e.message || 'تعذر إنشاء رابط الدليفري');
  }
}

async function editProduct(id) {
  const p =
    state.products.find(x => x.id === id);

  if (!p) return;

  const name =
    prompt('اسم الصنف', p.name);

  if (name === null) return;

  const price =
    prompt('سعر البيع', p.price);

  const stock =
    prompt('المخزون', p.stock);

  try {
    const d = await api('/api/products', {
      method: 'PUT',

      body: JSON.stringify({
        ...p,
        name,
        price: Number(price),
        stock: Number(stock)
      })
    });

    p.name = d.product.name;
    p.price = d.product.price;
    p.stock = d.product.stock;

    render();

  } catch (e) {
    alert(e.message);
  }
}

function addProduct() {
  const name = prompt('اسم الصنف');

  if (!name) return;

  const code =
    prompt('الكود / الباركود');

  if (!code) return;

  const price =
    Number(prompt('سعر البيع', '0'));

  const stock =
    Number(prompt('المخزون', '0'));

  api('/api/products', {
    method: 'PUT',

    body: JSON.stringify({
      name,
      code,
      price,
      cost: 0,
      stock,
      unit: 'قطعة',
      image: ''
    })
  })
    .then(() => load())
    .catch(e => alert(e.message));
}

function esc(s) {
  return String(s ?? '')
    .replace(
      /[&<>"']/g,
      m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m])
    );
}

function logout() {
  token = '';

  localStorage.removeItem(
    'hesbah_token'
  );

  location.reload();
}

if (token) {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');

  load().catch(() => {});
}
// ===== Live Operations Dashboard =====
function setLiveConnection(text){
  const el=$('liveConnection');
  if(el) el.innerHTML='<span class="connection-dot"></span>'+esc(text);
}
function updateDashboard(orders){
  const n=orders.filter(o=>o.status==='new').length;
  const p=orders.filter(o=>o.status==='preparing'||o.status==='accepted').length;
  const d=orders.filter(o=>o.status==='out_for_delivery').length;
  const done=orders.filter(o=>o.status==='completed').length;
  if($('kpiNew')) $('kpiNew').textContent=n;
  if($('kpiPrep')) $('kpiPrep').textContent=p;
  if($('kpiDelivery')) $('kpiDelivery').textContent=d;
  if($('kpiDone')) $('kpiDone').textContent=done;
  const badge=$('newOrderBadge');
  if(badge){ badge.textContent=n+' طلب جديد'; badge.classList.toggle('hidden',n===0); }
  document.title=n ? '🔔 ('+n+') طلب جديد — Hesbah Online' : 'Hesbah Online';
}
function enableOrderSound(){
  try{
    orderAudioContext=orderAudioContext||new (window.AudioContext||window.webkitAudioContext)();
    orderAudioContext.resume();
    soundEnabled=true;
    playOrderSound();
    const b=document.querySelector('.sound-btn');
    if(b)b.textContent='🔊 صوت الطلبات مفعل';
  }catch(e){alert('المتصفح لا يدعم تشغيل الصوت تلقائياً');}
}
function playOrderSound(){
  if(!soundEnabled||!orderAudioContext)return;
  const now=orderAudioContext.currentTime;
  [0,0.16,0.32].forEach((delay,i)=>{
    const osc=orderAudioContext.createOscillator(), gain=orderAudioContext.createGain();
    osc.type='sine'; osc.frequency.value=660+i*110;
    gain.gain.setValueAtTime(0.0001,now+delay);
    gain.gain.exponentialRampToValueAtTime(0.18,now+delay+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.13);
    osc.connect(gain); gain.connect(orderAudioContext.destination);
    osc.start(now+delay); osc.stop(now+delay+0.14);
  });
}
function showNewOrderAlert(list){
  playOrderSound();
  const count=list.length;
  const msg='🔔 وصل '+count+' طلب جديد'+(count>1?'':'');
  const toast=document.createElement('div');
  toast.className='dashboard-toast';
  toast.innerHTML='<b>'+msg+'</b><small>تم تحديث لوحة الطلبات تلقائياً</small>';
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),4500);
  if('Notification' in window && Notification.permission==='granted' && document.hidden)
    new Notification('Hesbah Online',{body:msg});
}
function updateActivity(){
  const box=$('liveActivity');
  if(!box)return;
  if(!activityLog.length){box.innerHTML='<div class="activity-empty">بانتظار النشاط...</div>';return;}
  box.innerHTML=activityLog.map(x=>'<div class="activity-item"><span>'+x.icon+'</span><div><b>'+esc(x.text)+'</b><small>'+new Date(x.time).toLocaleTimeString('ar-EG')+'</small></div></div>').join('');
}
function updateAdminMap(orders){
  const active=orders.filter(o=>o.type==='delivery' && (o.status==='out_for_delivery'||o.status==='ready') && (o.customerLocation||o.driverLocation));
  if(!window.L||!$('adminMap'))return;
  if(!adminMap){
    adminMap=L.map('adminMap').setView([30.0444,31.2357],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(adminMap);
  }
  Object.values(adminMarkers).forEach(m=>m.remove());
  adminMarkers={};
  const points=[];
  active.forEach(o=>{
    if(o.customerLocation){
      const p=[Number(o.customerLocation.lat),Number(o.customerLocation.lng)];
      if(p.every(Number.isFinite)){const m=L.marker(p).addTo(adminMap).bindPopup('<b>🏠 '+esc(o.number)+'</b><br>'+esc(o.customer?.name||'العميل'));adminMarkers['c'+o.id]=m;points.push(p);}
    }
    if(o.driverLocation){
      const p=[Number(o.driverLocation.lat),Number(o.driverLocation.lng)];
      if(p.every(Number.isFinite)){const m=L.marker(p).addTo(adminMap).bindPopup('<b>🛵 '+esc(o.driverName||'المندوب')+'</b><br>'+esc(o.number));adminMarkers['d'+o.id]=m;points.push(p);
        if(o.customerLocation){
          const c=[Number(o.customerLocation.lat),Number(o.customerLocation.lng)];
          if(c.every(Number.isFinite)) L.polyline([p,c],{dashArray:'8 8'}).addTo(adminMap);
        }
      }
    }
  });
  const summary=$('mapSummary');
  if(summary)summary.textContent=active.length ? active.length+' طلب توصيل ظاهر' : 'لا توجد مواقع نشطة';
  if(points.length && adminMap._userHasMoved!==true) adminMap.fitBounds(points,{padding:[25,25],maxZoom:15});
}
setInterval(()=>{ if(token) loadOrders(); },5000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && token) loadOrders(); });
