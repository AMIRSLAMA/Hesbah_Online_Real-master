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

async function loadOrders() {
  try {
    const d = await api('/api/orders');

    renderOrders(d.orders || []);

  } catch (e) {
    console.error('Orders error:', e);
  }
}

function renderOrders(orders) {
  const box = $('orders');

  if (!orders.length) {
    box.innerHTML = `
      <div class="empty-orders">
        لا توجد طلبات
      </div>
    `;
    return;
  }

  box.innerHTML = orders.map(order => {

    const type =
      order.type === 'table'
        ? `ترابيزة ${esc(order.location?.table || '')}`
        : order.type === 'room'
        ? `غرفة ${esc(order.location?.room || '')}`
        : 'طلب توصيل';

    const payment =
      order.paymentMethod === 'cash'
        ? 'نقدي عند الاستلام'
        : 'دفع إلكتروني';

    const items =
      (order.items || [])
        .map(item => `
          <div class="order-item">
            <span>${esc(item.name)}</span>
            <b>× ${item.qty}</b>
            <span>
              ${money(
                Number(item.price) *
                Number(item.qty)
              )}
            </span>
          </div>
        `)
        .join('');

    return `
      <div class="order-card">

        <div class="order-head">
          <div>
            <strong>
              🔔 ${esc(order.number)}
            </strong>

            <small>
              ${new Date(order.createdAt)
                .toLocaleString('ar-EG')}
            </small>
          </div>

          <span class="order-status">
            ${
              order.status === 'new'
                ? 'جديد'
                : esc(order.status)
            }
          </span>
        </div>

        <div class="order-info">

          <div>
            👤
            <b>العميل:</b>
            ${esc(order.customer?.name || '')}
          </div>

          <div>
            📞
            <b>الهاتف:</b>
            ${esc(order.customer?.phone || '')}
          </div>

          <div>
            📍
            <b>النوع:</b>
            ${type}
          </div>

          ${
            order.type === 'delivery'
              ? `
                <div>
                  🏠
                  <b>العنوان:</b>
                  ${esc(order.customer?.address || '')}

                  ${
                    order.customer?.building
                      ? ' - عمارة ' +
                        esc(order.customer.building)
                      : ''
                  }

                  ${
                    order.customer?.floor
                      ? ' - الدور ' +
                        esc(order.customer.floor)
                      : ''
                  }

                  ${
                    order.customer?.apartment
                      ? ' - شقة ' +
                        esc(order.customer.apartment)
                      : ''
                  }
                </div>
              `
              : ''
          }

        </div>

        <div class="order-items">
          ${items}
        </div>

        <div class="order-footer">

          <div>
            <b>
              الإجمالي:
              ${money(order.total)}
            </b>

            <small>
              ${payment}
            </small>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">

            ${
              (NEXT_STATUS[order.status] || [])
                .map(s => `
                  <button
                    onclick="changeOrderStatus('${order.id}','${s}')">
                    ${STATUS_LABELS[s]}
                  </button>
                `)
                .join('')
            }

            ${
              order.status === 'out_for_delivery'
                ? `
                  <button
                    onclick="createDriverLink('${order.id}')">
                    📍 رابط الدليفري
                  </button>
                `
                : ''
            }

          </div>

        </div>

      </div>
    `;

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