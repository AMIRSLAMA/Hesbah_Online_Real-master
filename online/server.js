const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),url=require('url');
const PORT=Number(process.env.PORT||8080), HOST=process.env.HOST||'0.0.0.0';
const DATA=path.join(__dirname,'data'); fs.mkdirSync(DATA,{recursive:true});
const SECRET=process.env.HESBAH_SECRET||'CHANGE_THIS_SECRET_BEFORE_PRODUCTION';
const DEMO={
  shop:{
    name:'متجري',
    phone:'',
    address:'',
    device:'Online',
    logo:''
  },

  owner:{
    name:'إدارة Hesbah',
    phone:''
  },

  printer:{
    copies:1,
    drawer:false,
    printer:'النظام الافتراضي',
    prep:false
  },

  activation:{
    status:'مفعل',
    code:'ONLINE',
    customer:'Online'
  },

  users:[
    {
      id:1,
      name:'المدير',
      username:'admin',
      passwordHash:hash('admin'),
      role:'مدير'
    }
  ],

  products:[
    {
      id:1,
      code:'1001',
      name:'مياه معدنية',
      price:10,
      cost:6,
      stock:50,
      unit:'قطعة',
      image:''
    },
    {
      id:2,
      code:'1002',
      name:'عصير',
      price:15,
      cost:9,
      stock:35,
      unit:'قطعة',
      image:''
    }
  ],

  customers:[],
  drivers:[],
  suppliers:[],
  expenses:[],
  invoices:[],
  returns:[],
  shifts:[],
  currentShift:null,
  theme:'light',

  paymentSettings:{
    cash:{
      enabled:true,
      name:'دفع كاش عند الاستلام'
    },

    vodafoneCash:{
      enabled:false,
      name:'Vodafone Cash',
      number:''
    },

    etisalatCash:{
      enabled:false,
      name:'Etisalat Cash',
      number:''
    },

    orangeCash:{
      enabled:false,
      name:'Orange Cash',
      number:''
    },

    wePay:{
      enabled:false,
      name:'WE Pay',
      number:''
    },

    instapay:{
      enabled:false,
      name:'InstaPay',
      account:''
    },

    card:{
      enabled:false,
      name:'Visa / Mastercard',
      provider:'',
      publicKey:''
    },

    delivery:{
      enabled:true,
      name:'رسوم التوصيل',
      fee:0
    }
  }
};
function normalizePhone(v){return String(v??'').replace(/[٠-٩۰-۹]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(d):'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s\-().]/g,'').trim()}
function hash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function storeFile(id){return path.join(DATA,encodeURIComponent(id)+'.json')}
function load(id){const f=storeFile(id);if(!fs.existsSync(f)){save(id,{...structuredClone(DEMO),storeId:id,revision:1});}try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return structuredClone(DEMO)}}
function save(id,d){fs.writeFileSync(storeFile(id),JSON.stringify(d,null,2),'utf8')}
function sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');return body+'.'+sig}
function verifyToken(token){try{const [body,sig]=String(token||'').split('.');const good=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(good)))throw Error();const p=JSON.parse(Buffer.from(body,'base64url'));if(p.exp<Date.now())throw Error();return p}catch{return null}}
function json(res,status,data){const out=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Cache-Control':'no-store'});res.end(out)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>10e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function auth(req){const p=verifyToken((req.headers.authorization||'').replace(/^Bearer\s+/i,''));return p}
function safeUser(u){return {id:u.id,name:u.name,username:u.username,role:u.role}}
function serveStatic(req,res){let p=url.parse(req.url).pathname;if(p==='/'||p==='')p='/index.html';const root=path.join(__dirname,'public');const f=path.normalize(path.join(root,p));if(!f.startsWith(root))return res.end('Forbidden');fs.readFile(f,(e,b)=>{if(e){if(p!=='/index.html')return serveFile404(res);return serveFile404(res)}const ext=path.extname(f);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});res.end(b)})}
function serveDashboardStatic(req,res){
  let p=url.parse(req.url).pathname||'/dashboard/';
  let rel=p.slice('/dashboard'.length);
  if(rel==='/'||rel==='')rel='/dashboard.html';
  rel=decodeURIComponent(rel);
  const allowed=rel==='/dashboard.html'||rel==='/app.js'||rel==='/styles.css'||rel==='/qr-customer-link-fix.js'||rel==='/dashboard-web.js'||rel.startsWith('/assets/');
  if(!allowed)return serveFile404(res);
  const root=path.resolve(__dirname,'public');
  const f=path.resolve(root,'.'+rel);
  if(f!==root && !f.startsWith(root+path.sep))return res.end('Forbidden');
  fs.readFile(f,(e,b)=>{if(e)return serveFile404(res);const ext=path.extname(f);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});res.end(b)});
}
function serveFile404(res){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found')}
async function handle(req,res){if(req.method==='OPTIONS')return json(res,204,{});const u=url.parse(req.url,true),p=u.pathname;
if(p==='/api/health')return json(res,200,{ok:true,service:'Hesbah Online',time:new Date().toISOString()});
if(p==='/dashboard'||p==='/dashboard/') return serveDashboardStatic(req,res);
if(p.startsWith('/dashboard/')) return serveDashboardStatic(req,res);
if(!p.startsWith('/api/')) return serveStatic(req,res);
if(p==='/api/login'&&req.method==='POST'){const b=await body(req);const sid=String(b.storeId||'demo').trim()||'demo',db=load(sid),user=db.users.find(x=>String(x.username).toLowerCase()===String(b.username||'').trim().toLowerCase());if(!user||user.passwordHash!==hash(b.password||''))return json(res,401,{ok:false,message:'بيانات الدخول غير صحيحة'});const token=sign({storeId:sid,userId:user.id,role:user.role,exp:Date.now()+7*86400000});return json(res,200,{ok:true,token,user:safeUser(user),store:{name:db.shop.name},revision:db.revision||1})}
if(!p.startsWith('/api/'))return serveStatic(req,res);
if(p==='/api/public/orders'&&req.method==='POST'){
  const b=await body(req);

  const storeId=String(b.storeId||'demo').trim()||'demo';
  const db=load(storeId);

  const items=Array.isArray(b.items)
    ? b.items.map(x=>({
        productId:Number(x.productId||0),
        code:String(x.code||''),
        name:String(x.name||''),
        price:Number(x.price||0),
        qty:Number(x.qty||0)
      })).filter(x=>x.qty>0)
    : [];

  if(!items.length){
    return json(res,400,{
      ok:false,
      message:'الطلب لا يحتوي على أصناف'
    });
  }

const customerToken = String(
  req.headers.authorization || ""
).replace(/^Bearer\s+/i,"").trim();

let loggedCustomer = null;

if(customerToken){
  try{

    const payload = verifyToken(customerToken);

    if(
      payload &&
      payload.role === "customer" &&
      String(payload.storeId) === storeId
    ){

      loggedCustomer =
        Array.isArray(db.customers)
          ? db.customers.find(
              x => Number(x.id) === Number(payload.customerId)
            )
          : null;
    }

  }catch(error){

    loggedCustomer = null;

  }
}
const customer={
    name:String(b.customer?.name||'').trim(),
    phone:String(b.customer?.phone||'').trim(),
    address:String(b.customer?.address||'').trim(),
    building:String(b.customer?.building||'').trim(),
    floor:String(b.customer?.floor||'').trim(),
    apartment:String(b.customer?.apartment||'').trim(),
    notes:String(b.customer?.notes||'').trim()
  };

  if(!customer.name||!customer.phone){
    return json(res,400,{
      ok:false,
      message:'اسم العميل ورقم الهاتف مطلوبان'
    });
  }

  // Inventory is server-authoritative for online orders.
  // Validate the full cart before changing any stock so a partial order can never be created.
  for(const item of items){
    const product=Array.isArray(db.products)
      ? db.products.find(x=>Number(x.id)===Number(item.productId))
      : null;
    if(!product){
      return json(res,404,{ok:false,message:'المنتج غير موجود: '+String(item.name||'')});
    }
    const stock=Number(product.stock||0);
    const qty=Number(item.qty||0);
    if(stock<qty){
      return json(res,409,{
        ok:false,
        message:'الكمية غير متاحة من المنتج: '+String(product.name||item.name||'')+
          ' — المتاح '+stock
      });
    }
  }

  const subtotal=items.reduce(
    (sum,x)=>sum+(x.price*x.qty),0
  );

  const deliverySettings=db.paymentSettings?.delivery||DEMO.paymentSettings.delivery;
  const deliveryFee=String(b.type||'delivery')==='delivery' && deliverySettings?.enabled!==false
    ? Math.max(0,Number(deliverySettings?.fee||0))
    : 0;
  const total=subtotal+deliveryFee;

const order={
  id:Date.now(),
  number:'ON-'+Date.now().toString().slice(-7),
  storeId,
  source:'online',
  type:String(b.type||'delivery'),
  status:'new',
createdAt:new Date().toISOString(),
addItemsUntil:Date.now() + (3 * 60 * 1000),
  customerId:loggedCustomer
    ? Number(loggedCustomer.id)
    : null,

  customer:{
    id:loggedCustomer
      ? Number(loggedCustomer.id)
      : null,

    name:loggedCustomer
      ? String(loggedCustomer.name||'')
      : customer.name,

    phone:loggedCustomer
      ? String(loggedCustomer.phone||'')
      : customer.phone,

    address:customer.address,
    building:customer.building,
    floor:customer.floor,
    apartment:customer.apartment,
    notes:customer.notes
  },

  location:{
    table:String(b.table||''),
    room:String(b.room||'')
  },

  customerLocation:
    b.customerLocation &&
    Number.isFinite(Number(b.customerLocation.lat)) &&
    Number.isFinite(Number(b.customerLocation.lng))
      ? {
          lat:Number(b.customerLocation.lat),
          lng:Number(b.customerLocation.lng)
        }
      : null,

  driverLocation:null,
  trackingActive:false,

  items,

  subtotal,
  deliveryFee,
  total,

  paymentMethod:String(
    b.paymentMethod||'cash'
  ),

  paymentStatus:'pending'
};

  if(!Array.isArray(db.orders))db.orders=[];

  // Deduct stock only after the complete order has passed validation.
  for(const item of items){
    const product=db.products.find(x=>Number(x.id)===Number(item.productId));
    if(product) product.stock=Number(product.stock||0)-Number(item.qty||0);
  }

  db.orders.unshift(order);
  if(loggedCustomer){

  loggedCustomer.ordersCount =
    Number(loggedCustomer.ordersCount||0) + 1;

  loggedCustomer.totalSpent =
    Number(loggedCustomer.totalSpent||0) + total;

}
  db.revision=(db.revision||1)+1;

  save(storeId,db);

return json(res,201,{
  ok:true,
  order:{
    id:order.id,
    number:order.number,
    status:order.status,
    subtotal:order.subtotal,
    deliveryFee:order.deliveryFee,
    total:order.total,
    createdAt:order.createdAt,
    addItemsUntil:order.addItemsUntil,
    customerId:order.customerId
  }
});
}
if(p==='/api/public/orders/add-items'&&req.method==='POST'){

  const b=await body(req);

  const storeId=String(
    b.storeId||'demo'
  ).trim()||'demo';

  const db=load(storeId);

  const customerToken=String(
    req.headers.authorization||""
  ).replace(/^Bearer\s+/i,"").trim();

  if(!customerToken){
    return json(res,401,{
      ok:false,
      message:'يجب تسجيل الدخول أولاً'
    });
  }

  let payload;

  try{
    payload=verifyToken(customerToken);
  }catch(error){
    return json(res,401,{
      ok:false,
      message:'جلسة العميل غير صالحة'
    });
  }

  if(
    !payload ||
    payload.role!=='customer' ||
    String(payload.storeId)!==storeId
  ){
    return json(res,401,{
      ok:false,
      message:'غير مصرح'
    });
  }

  const orderId=Number(b.orderId||0);

  if(!orderId){
    return json(res,400,{
      ok:false,
      message:'رقم الطلب غير صحيح'
    });
  }

  if(!Array.isArray(db.orders)){
    return json(res,404,{
      ok:false,
      message:'الطلب غير موجود'
    });
  }

  const order=db.orders.find(
    x=>Number(x.id)===orderId
  );

  if(!order){
    return json(res,404,{
      ok:false,
      message:'الطلب غير موجود'
    });
  }

  if(
    Number(order.customerId)!==
    Number(payload.customerId)
  ){
    return json(res,403,{
      ok:false,
      message:'هذا الطلب لا يخص حسابك'
    });
  }

  if(order.status!=='new'){
    return json(res,409,{
      ok:false,
      message:'تم قبول الطلب أو بدأ تجهيزه، ولا يمكن إضافة منتجات الآن'
    });
  }

  if(
    !order.addItemsUntil ||
    Date.now()>Number(order.addItemsUntil)
  ){
    return json(res,409,{
      ok:false,
      message:'انتهت مهلة إضافة المنتجات لهذا الطلب'
    });
  }

  const incoming=Array.isArray(b.items)
    ? b.items
        .map(x=>({
          productId:Number(x.productId||0),
          qty:Number(x.qty||0)
        }))
        .filter(x=>x.productId>0&&x.qty>0)
    : [];

  if(!incoming.length){
    return json(res,400,{
      ok:false,
      message:'لم يتم اختيار منتجات'
    });
  }

  if(!Array.isArray(order.items)){
    order.items=[];
  }

  let addedTotal=0;

  for(const item of incoming){

    const product=Array.isArray(db.products)
      ? db.products.find(
          x=>Number(x.id)===Number(item.productId)
        )
      : null;

    if(!product){
      return json(res,404,{
        ok:false,
        message:'أحد المنتجات غير موجود'
      });
    }

    const qty=Number(item.qty);

    const availableStock=Number(
      product.stock||0
    );

    if(availableStock<qty){
      return json(res,409,{
        ok:false,
        message:
          'الكمية غير متاحة من المنتج: '+
          String(product.name||'')
      });
    }

    const price=Number(product.price||0);

    const existing=order.items.find(
      x=>Number(x.productId)===Number(product.id)
    );

    if(existing){

      existing.qty=
        Number(existing.qty||0)+qty;

      existing.price=price;

    }else{

      order.items.push({
        productId:Number(product.id),
        code:String(product.code||''),
        name:String(product.name||''),
        price,
        qty
      });

    }

    product.stock=
      availableStock-qty;

    addedTotal += price*qty;
  }

  order.subtotal=
    order.items.reduce(
      (sum,item)=>
        sum+
        (Number(item.price)||0)*
        (Number(item.qty)||0),
      0
    );

  order.deliveryFee=Math.max(0,Number(order.deliveryFee||0));
  order.total=order.subtotal+order.deliveryFee;

  const customer=Array.isArray(db.customers)
    ? db.customers.find(
        x=>Number(x.id)===Number(payload.customerId)
      )
    : null;

  if(customer){

    customer.totalSpent=
      Number(customer.totalSpent||0)+
      addedTotal;

  }

  db.revision=(db.revision||1)+1;

  save(storeId,db);

  return json(res,200,{
    ok:true,
    order:{
      id:order.id,
      number:order.number,
      status:order.status,
      total:order.total,
      addItemsUntil:order.addItemsUntil,
      items:order.items
    }
  });
}
// ===============================
// Hesbah Online - Customer Register
// ===============================
if(p==='/api/public/register'&&req.method==='POST'){
  const b=await body(req);

  const storeId=String(b.storeId||'demo').trim()||'demo';
  const db=load(storeId);

  const name=String(b.name||'').trim();
  const phone=normalizePhone(b.phone);
  const password=String(b.password||'');

  if(!name||!phone||!password){
    return json(res,400,{
      ok:false,
      message:'الاسم ورقم الهاتف وكلمة المرور مطلوبة'
    });
  }

  if(password.length<6){
    return json(res,400,{
      ok:false,
      message:'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
    });
  }

  if(!Array.isArray(db.customers)){
    db.customers=[];
  }

  const exists=db.customers.find(
    x=>normalizePhone(x.phone)===phone
  );

  if(exists){
    return json(res,409,{
      ok:false,
      message:'رقم الهاتف مسجل بالفعل'
    });
  }

  const customer={
    id:Date.now(),
    name,
    phone,
    passwordHash:hash(password),
    address:String(b.address||'').trim(),
    building:String(b.building||'').trim(),
    floor:String(b.floor||'').trim(),
    apartment:String(b.apartment||'').trim(),
    notes:String(b.notes||'').trim(),
    createdAt:new Date().toISOString(),
    ordersCount:0,
    totalSpent:0
  };

  db.customers.unshift(customer);
  db.revision=(db.revision||1)+1;

  save(storeId,db);

  return json(res,201,{
    ok:true,
    customer:{
      id:customer.id,
      name:customer.name,
      phone:customer.phone,
      address:customer.address,
      building:customer.building,
      floor:customer.floor,
      apartment:customer.apartment,
      createdAt:customer.createdAt
    }
  });
}
if(p==='/api/public/login'&&req.method==='POST'){
  const b=await body(req);

  const storeId=String(b.storeId||'demo').trim()||'demo';
  const db=load(storeId);

  const phone=normalizePhone(b.phone);
  const password=String(b.password||'');

  if(!phone||!password){
    return json(res,400,{
      ok:false,
      message:'رقم الهاتف وكلمة المرور مطلوبة'
    });
  }

  if(!Array.isArray(db.customers)){
    db.customers=[];
  }

  const customer=db.customers.find(
    x=>normalizePhone(x.phone)===phone
  );

  if(!customer||customer.passwordHash!==hash(password)){
    return json(res,401,{
      ok:false,
      message:'رقم الهاتف أو كلمة المرور غير صحيحة'
    });
  }

  const token=sign({
    storeId,
    customerId:customer.id,
    role:'customer',
    exp:Date.now()+30*86400000
  });

  return json(res,200,{
    ok:true,
    token,
    customer:{
      id:customer.id,
      name:customer.name,
      phone:customer.phone,
      address:customer.address,
      building:customer.building,
      floor:customer.floor,
      apartment:customer.apartment
    }
  });
}


/* ===============================
   Hesbah Online - Customer Session
   =============================== */
if(p==='/api/public/customer/session'&&req.method==='GET'){
  const token=String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'').trim();
  const payload=verifyToken(token);
  if(!payload||payload.role!=='customer') return json(res,401,{ok:false,message:'جلسة العميل غير صالحة'});
  const db=load(payload.storeId);
  const customer=Array.isArray(db.customers)?db.customers.find(x=>Number(x.id)===Number(payload.customerId)):null;
  if(!customer) return json(res,401,{ok:false,message:'حساب العميل غير موجود'});
  return json(res,200,{ok:true,customer:{id:customer.id,name:customer.name,phone:customer.phone,address:customer.address,building:customer.building,floor:customer.floor,apartment:customer.apartment}});
}

/* ===============================
   Hesbah Online - Driver Accounts
   =============================== */

if(p==='/api/public/driver/login'&&req.method==='POST'){
  const b=await body(req);
  const storeId=String(b.storeId||'demo').trim()||'demo';
  const db=load(storeId);
  const username=String(b.username||'').trim();
  const password=String(b.password||'');
  const driver=Array.isArray(db.drivers)
    ? db.drivers.find(x=>String(x.username||'').toLowerCase()===username.toLowerCase() && x.active!==false)
    : null;
  if(!driver||driver.passwordHash!==hash(password)){
    return json(res,401,{ok:false,message:'اسم المستخدم أو كلمة المرور غير صحيحة'});
  }
  const token=sign({
    storeId,
    driverId:Number(driver.id),
    role:'driver_account',
    exp:Date.now()+30*86400000
  });
  return json(res,200,{
    ok:true,
    token,
    driver:{
      id:driver.id,
      name:driver.name,
      phone:driver.phone||'',
      username:driver.username
    }
  });
}

if(p==='/api/public/driver/orders'&&req.method==='GET'){
  const a=auth(req);
  if(!a||a.role!=='driver_account') return json(res,401,{ok:false,message:'جلسة المندوب غير صالحة'});
  const db=load(a.storeId);
  const orders=(db.orders||[]).filter(x=>Number(x.driverId)===Number(a.driverId)&&!['completed','rejected'].includes(x.status));
  return json(res,200,{ok:true,orders});
}

if(p==='/api/public/driver/status-update'&&req.method==='PUT'){
  const a=auth(req);
  if(!a||a.role!=='driver_account') return json(res,401,{ok:false,message:'جلسة المندوب غير صالحة'});
  const b=await body(req);
  const orderId=Number(b.orderId||0);
  const db=load(a.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);
  if(!order) return json(res,404,{ok:false,message:'الطلب غير موجود'});
  if(Number(order.driverId)!==Number(a.driverId)) return json(res,403,{ok:false,message:'الطلب غير مسند إليك'});
  if(order.status!=='out_for_delivery') return json(res,409,{ok:false,message:'الطلب ليس في مرحلة التوصيل'});
  order.status='completed';
  order.statusUpdatedAt=new Date().toISOString();
  order.trackingActive=false;
  db.revision=(db.revision||1)+1;
  save(a.storeId,db);
  return json(res,200,{ok:true,order:{id:order.id,status:order.status}});
}

if(p==='/api/public/driver/location-account'&&req.method==='PUT'){
  const a=auth(req);
  if(!a||a.role!=='driver_account') return json(res,401,{ok:false,message:'جلسة المندوب غير صالحة'});
  const b=await body(req);
  const orderId=Number(b.orderId||0);
  const lat=Number(b.lat), lng=Number(b.lng), accuracy=Number(b.accuracy||0);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180){
    return json(res,400,{ok:false,message:'إحداثيات الموقع غير صحيحة'});
  }
  const db=load(a.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);
  if(!order) return json(res,404,{ok:false,message:'الطلب غير موجود'});
  if(Number(order.driverId)!==Number(a.driverId)) return json(res,403,{ok:false,message:'الطلب غير مسند إليك'});
  if(order.status!=='out_for_delivery') return json(res,409,{ok:false,message:'لا يمكن إرسال الموقع قبل خروج الطلب للتوصيل'});
  order.driverLocation={lat,lng,accuracy:Number.isFinite(accuracy)?accuracy:0,updatedAt:new Date().toISOString()};
  order.trackingActive=true;
  db.revision=(db.revision||1)+1;
  save(a.storeId,db);
  return json(res,200,{ok:true,location:order.driverLocation});
}

/* ===============================
   Hesbah Online - Customer Tracking
   =============================== */

if(p==='/api/public/orders/status'&&req.method==='GET'){
  const storeId=String(u.query?.storeId||'demo').trim()||'demo';
  const orderId=Number(u.query?.orderId||0);
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();

  if(!token){
    return json(res,401,{ok:false,message:'يجب تسجيل الدخول أولاً'});
  }

  const payload=verifyToken(token);
  if(!payload||payload.role!=='customer'||String(payload.storeId)!==storeId){
    return json(res,401,{ok:false,message:'جلسة العميل غير صالحة'});
  }

  const db=load(storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);

  if(!order){
    return json(res,404,{ok:false,message:'الطلب غير موجود'});
  }

  if(Number(order.customerId)!==Number(payload.customerId)){
    return json(res,403,{ok:false,message:'هذا الطلب لا يخص حسابك'});
  }

  const location=order.driverLocation && Number.isFinite(Number(order.driverLocation.lat))
    ? {
        lat:Number(order.driverLocation.lat),
        lng:Number(order.driverLocation.lng),
        accuracy:Number(order.driverLocation.accuracy||0),
        updatedAt:order.driverLocation.updatedAt||null
      }
    : null;

  const customerLocation=order.customerLocation && Number.isFinite(Number(order.customerLocation.lat))
    ? {
        lat:Number(order.customerLocation.lat),
        lng:Number(order.customerLocation.lng)
      }
    : null;

  return json(res,200,{
    ok:true,
    order:{
      id:order.id,
      number:order.number,
      status:order.status||'new',
      statusUpdatedAt:order.statusUpdatedAt||order.createdAt,
      subtotal:Number(order.subtotal||Math.max(0,Number(order.total||0)-Number(order.deliveryFee||0))),
      deliveryFee:Number(order.deliveryFee||0),
      total:Number(order.total||0),
      createdAt:order.createdAt,
      driverLocation:location,
      customerLocation,
      driverName:String(order.driverName||''),
      driverPhone:String(order.driverPhone||''),
      trackingActive:Boolean(order.trackingActive),
      assignedAt:order.assignedAt||null
    }
  });
}

/* Staff creates a short-lived driver tracking token for a specific order. */
if(p==='/api/orders/tracking-token'&&req.method==='POST'){
  const a=auth(req);
  if(!a){
    return json(res,401,{ok:false,message:'غير مصرح'});
  }

  const b=await body(req);
  const orderId=Number(b.orderId||0);
  const db=load(a.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);

  if(!order){
    return json(res,404,{ok:false,message:'الطلب غير موجود'});
  }

  if(order.type!=='delivery'){
    return json(res,400,{ok:false,message:'الطلب ليس طلب توصيل'});
  }

  const token=sign({
    storeId:a.storeId,
    orderId:order.id,
    role:'driver',
    exp:Date.now()+24*60*60*1000
  });

  return json(res,200,{
    ok:true,
    token,
    url:'/driver.html?token='+encodeURIComponent(token),
    orderId:order.id,
    number:order.number
  });
}


if(p==='/api/public/driver/status'&&req.method==='GET'){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  const payload=verifyToken(token);
  if(!payload||payload.role!=='driver'){
    return json(res,401,{ok:false,message:'رابط التوصيل غير صالح أو منتهي'});
  }
  const db=load(payload.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===Number(payload.orderId));
  if(!order){
    return json(res,404,{ok:false,message:'الطلب غير موجود'});
  }
  return json(res,200,{
    ok:true,
    order:{
      id:order.id,
      number:order.number,
      status:order.status
    }
  });
}

/* Driver sends GPS position. The token is scoped to one order only. */
if(p==='/api/public/driver/location'&&req.method==='PUT'){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  const payload=verifyToken(token);

  if(!payload||payload.role!=='driver'){
    return json(res,401,{ok:false,message:'رابط التوصيل غير صالح أو منتهي'});
  }

  const b=await body(req);
  const lat=Number(b.lat);
  const lng=Number(b.lng);
  const accuracy=Number(b.accuracy||0);

  if(!Number.isFinite(lat)||!Number.isFinite(lng)||
     lat<-90||lat>90||lng<-180||lng>180){
    return json(res,400,{ok:false,message:'موقع GPS غير صحيح'});
  }

  const db=load(payload.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===Number(payload.orderId));

  if(!order){
    return json(res,404,{ok:false,message:'الطلب غير موجود'});
  }

  if(order.status!=='out_for_delivery'){
    return json(res,409,{ok:false,message:'يجب أن تكون حالة الطلب: خرج للتوصيل'});
  }

  order.driverLocation={
    lat,lng,
    accuracy:Number.isFinite(accuracy)?accuracy:0,
    updatedAt:new Date().toISOString()
  };
  order.trackingActive=true;
  db.revision=(db.revision||1)+1;
  save(payload.storeId,db);

  return json(res,200,{ok:true,location:order.driverLocation});
}


/* ===============================
   Hesbah Online - Order Chat
   Customer <-> Delivery Driver
   =============================== */

if(p==='/api/public/orders/chat' && (req.method==='GET' || req.method==='POST')){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  if(!token) return json(res,401,{ok:false,message:'يجب تسجيل الدخول أولاً'});

  const payload=verifyToken(token);
  if(!payload || !['customer','driver_account'].includes(payload.role)){
    return json(res,401,{ok:false,message:'جلسة المحادثة غير صالحة'});
  }

  const bodyData=req.method==='POST' ? await body(req) : {};
  const storeId=String(
    payload.storeId || u.query?.storeId || bodyData.storeId || 'demo'
  ).trim() || 'demo';
  const orderId=Number(
    u.query?.orderId || bodyData.orderId || payload.orderId || 0
  );

  const db=load(storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);

  if(!order) return json(res,404,{ok:false,message:'الطلب غير موجود'});

  const isCustomer=payload.role==='customer';
  const isDriver=payload.role==='driver_account';

  if(isCustomer && Number(order.customerId)!==Number(payload.customerId)){
    return json(res,403,{ok:false,message:'هذا الطلب لا يخص حسابك'});
  }

  if(isDriver && Number(order.driverId)!==Number(payload.driverId)){
    return json(res,403,{ok:false,message:'هذا الطلب غير مسند إليك'});
  }

  if(req.method==='GET'){
    const messages=Array.isArray(order.chat)?order.chat:[];
    return json(res,200,{ok:true,messages});
  }

  const text=String(bodyData.text||'').trim();
  if(!text) return json(res,400,{ok:false,message:'اكتب رسالة أولاً'});
  if(text.length>1000) return json(res,400,{ok:false,message:'الرسالة طويلة جدًا'});

  if(!Array.isArray(order.chat)) order.chat=[];

  const message={
    id:Date.now()+Math.floor(Math.random()*1000),
    sender:isCustomer?'customer':'driver',
    senderName:isCustomer
      ? String(order.customer?.name||'العميل')
      : String(order.driverName||'المندوب'),
    text,
    createdAt:new Date().toISOString()
  };

  order.chat.push(message);
  if(order.chat.length>200) order.chat=order.chat.slice(-200);

  db.revision=(db.revision||1)+1;
  save(storeId,db);

  return json(res,201,{ok:true,message});
}

if(p==='/api/public/payment-methods'&&req.method==='GET'){
  const storeId=String(
  u.query?.storeId || 'demo'
).trim() || 'demo';

  const db=load(storeId);

  // Keep legacy stores compatible with delivery-fee settings.
  if(!db.paymentSettings || typeof db.paymentSettings!=='object') db.paymentSettings={};
  if(!db.paymentSettings.delivery || typeof db.paymentSettings.delivery!=='object'){
    db.paymentSettings.delivery={enabled:true,name:'رسوم التوصيل',fee:35};
    db.revision=(db.revision||1)+1;
    save(storeId,db);
  }

  const payment=db.paymentSettings||{
    cash:{
      enabled:true,
      name:'دفع كاش عند الاستلام'
    },

    vodafoneCash:{
      enabled:false,
      name:'Vodafone Cash',
      number:''
    },

    etisalatCash:{
      enabled:false,
      name:'Etisalat Cash',
      number:''
    },

    orangeCash:{
      enabled:false,
      name:'Orange Cash',
      number:''
    },

    wePay:{
      enabled:false,
      name:'WE Pay',
      number:''
    },

    instapay:{
      enabled:false,
      name:'InstaPay',
      account:''
    },

    card:{
      enabled:false,
      name:'Visa / Mastercard',
      provider:'',
      publicKey:''
    },

    delivery:{
      enabled:true,
      name:'رسوم التوصيل',
      fee:0
    }
  };

  payment.delivery={
    enabled:payment.delivery?.enabled!==false,
    name:String(payment.delivery?.name||'رسوم التوصيل'),
    fee:Math.max(0,Number(payment.delivery?.fee||0))
  };

  return json(res,200,{
    ok:true,
    payment
  });
}
if(p==='/api/public/products'&&req.method==='GET'){
  const storeId=String(
    u.query?.storeId || 'demo'
  ).trim() || 'demo';

  const db=load(storeId);

  const products=Array.isArray(db.products)
    ? db.products
        .map(x=>({
          id:Number(x.id||0),
          code:String(x.code||''),
          name:String(x.name||''),
          price:Number(x.price||0),
          unit:String(x.unit||'قطعة'),
          image:String(x.image||''),
          category:String(x.category||'عام'),
          stock:Math.max(0,Number(x.stock||0)),
          available:Number(x.stock||0)>0
        }))
        .filter(x=>x.name)
    : [];

  const categories=Array.isArray(db.categories)
    ? db.categories.map(c=>String(c||'').trim()).filter(Boolean)
    : [];
  const categorySet=new Set(categories);
  products.forEach(x=>{ if(!categorySet.has(x.category)) categories.push(x.category); });
  if(!categories.length) categories.push('عام');

  return json(res,200,{
    ok:true,
    categories,
    products
  });
}
if(p==='/api/payment-settings'&&req.method==='PUT'){
  const a=auth(req);
  if(!a)return json(res,401,{ok:false,message:'انتهت الجلسة أو التوكن غير صالح'});
  if(a.role!=='مدير')return json(res,403,{ok:false,message:'تعديل إعدادات الدفع والتوصيل للمدير فقط'});
  const b=await body(req);
  const db=load(a.storeId);

  db.paymentSettings={
    cash:{
      enabled:Boolean(b.cash?.enabled),
      name:String(
        b.cash?.name||'دفع كاش عند الاستلام'
      )
    },

    vodafoneCash:{
      enabled:Boolean(b.vodafoneCash?.enabled),
      name:String(
        b.vodafoneCash?.name||'Vodafone Cash'
      ),
      number:String(
        b.vodafoneCash?.number||''
      ).trim()
    },

    etisalatCash:{
      enabled:Boolean(b.etisalatCash?.enabled),
      name:String(
        b.etisalatCash?.name||'Etisalat Cash'
      ),
      number:String(
        b.etisalatCash?.number||''
      ).trim()
    },

    orangeCash:{
      enabled:Boolean(b.orangeCash?.enabled),
      name:String(
        b.orangeCash?.name||'Orange Cash'
      ),
      number:String(
        b.orangeCash?.number||''
      ).trim()
    },

    wePay:{
      enabled:Boolean(b.wePay?.enabled),
      name:String(
        b.wePay?.name||'WE Pay'
      ),
      number:String(
        b.wePay?.number||''
      ).trim()
    },

    instapay:{
      enabled:Boolean(b.instapay?.enabled),
      name:String(
        b.instapay?.name||'InstaPay'
      ),
      account:String(
        b.instapay?.account||''
      ).trim()
    },

    card:{
      enabled:Boolean(b.card?.enabled),
      name:String(
        b.card?.name||'Visa / Mastercard'
      ),
      provider:String(
        b.card?.provider||''
      ).trim(),
      publicKey:String(
        b.card?.publicKey||''
      ).trim()
    },

    delivery:{
      enabled:b.delivery?.enabled!==false,
      name:String(
        b.delivery?.name||'رسوم التوصيل'
      ).trim() || 'رسوم التوصيل',
      fee:Math.max(0,Number(b.delivery?.fee||0))
    }
  };

  db.revision=(db.revision||1)+1;

  save(a.storeId,db);

  return json(res,200,{
    ok:true,
    payment:db.paymentSettings
  });
}
const a=auth(req);if(!a)return json(res,401,{ok:false,message:'انتهت الجلسة أو التوكن غير صالح'});const db=load(a.storeId);
 if(p==='/api/bootstrap'&&req.method==='GET')return json(res,200,{ok:true,storeId:a.storeId,revision:db.revision||1,db:{...db,users:db.users.map(safeUser)}});
 if(p==='/api/sync'&&req.method==='POST'){const b=await body(req);const rev=Number(b.revision||0);if(rev && rev!==(db.revision||1))return json(res,409,{ok:false,conflict:true,revision:db.revision||1,db});const incoming=b.db;if(!incoming||typeof incoming!=='object')return json(res,400,{ok:false,message:'بيانات المزامنة غير صالحة'});if(!Array.isArray(db.users))db.users=[];const incomingUsers=Array.isArray(incoming.users)?incoming.users:[];for(const u of incomingUsers){const id=Number(u.id||0);const username=String(u.username||'').trim();if(!id||!username)continue;let existing=db.users.find(x=>Number(x.id)===id);if(!existing)existing=db.users.find(x=>String(x.username||'').toLowerCase()===username.toLowerCase());if(existing){existing.name=String(u.name||existing.name||'');existing.username=username;existing.role=String(u.role||existing.role||'بائع');existing.phone=String(u.phone||existing.phone||'');if(u.password)existing.passwordHash=hash(String(u.password));}else{db.users.push({id,name:String(u.name||''),username,phone:String(u.phone||''),role:String(u.role||'بائع'),passwordHash:u.password?hash(String(u.password)):String(u.passwordHash||'')});}}incoming.users=db.users;
// Online-owned data must never be lost when a POS syncs its local database.
// Orders and delivery drivers are created/updated by the web/customer side and must remain server-authoritative.
incoming.orders=Array.isArray(db.orders)?db.orders:[];
incoming.drivers=Array.isArray(db.drivers)?db.drivers:[];
// Payment and delivery settings are server-owned.
incoming.paymentSettings=db.paymentSettings||incoming.paymentSettings||DEMO.paymentSettings;
incoming.storeId=a.storeId;
incoming.revision=(db.revision||1)+1;for(const u of incomingUsers){if(String(u.role||'').trim()!=='مندوب توصيل')continue;const id=Number(u.id||0);if(!id)continue;let d=incoming.drivers.find(x=>Number(x.userId||0)===id);if(!d){d={id,userId:id,name:String(u.name||'مندوب'),username:String(u.username||''),phone:String(u.phone||''),passwordHash:u.password?hash(String(u.password)):String(u.passwordHash||''),active:true,createdAt:new Date().toISOString()};incoming.drivers.push(d);}else{d.name=String(u.name||d.name||'مندوب');d.username=String(u.username||d.username||'');d.phone=String(u.phone||d.phone||'');if(u.password)d.passwordHash=hash(String(u.password));d.active=true;}}save(a.storeId,incoming);return json(res,200,{ok:true,revision:incoming.revision})}
 if(p==='/api/products'&&req.method==='GET')return json(res,200,{ok:true,revision:db.revision||1,products:db.products||[]});
 if(p==='/api/products'&&req.method==='PUT'){if(a.role!=='مدير')return json(res,403,{ok:false,message:'العملية للمدير فقط'});const b=await body(req), id=Number(b.id||Date.now()), item={id,code:String(b.code||''),name:String(b.name||''),price:Number(b.price||0),cost:Number(b.cost||0),stock:Number(b.stock||0),unit:String(b.unit||'قطعة'),image:String(b.image||'')};if(!item.name||!item.code)return json(res,400,{ok:false,message:'اسم الصنف والكود مطلوبان'});const i=db.products.findIndex(x=>x.id===id);if(i>=0)db.products[i]=item;else db.products.unshift(item);db.revision=(db.revision||1)+1;save(a.storeId,db);return json(res,200,{ok:true,product:item,revision:db.revision})}
 if(p==='/api/invoices'&&req.method==='GET')return json(res,200,{ok:true,invoices:db.invoices||[],revision:db.revision||1});
 if(p==='/api/orders/status'&&req.method==='PUT'){

  const a=auth(req);

  if(!a){
    return json(res,401,{
      ok:false,
      message:'غير مصرح'
    });
  }

  const b=await body(req);

  const orderId=Number(b.orderId||0);
  const newStatus=String(b.status||'').trim();

  const allowedStatuses=[
    'new',
    'accepted',
    'preparing',
    'ready',
    'out_for_delivery',
    'completed',
    'rejected'
  ];

  if(!orderId){
    return json(res,400,{
      ok:false,
      message:'رقم الطلب غير صحيح'
    });
  }

  if(!allowedStatuses.includes(newStatus)){
    return json(res,400,{
      ok:false,
      message:'حالة الطلب غير صحيحة'
    });
  }

  const db=load(a.storeId);

  if(!Array.isArray(db.orders)){
    return json(res,404,{
      ok:false,
      message:'لا توجد طلبات'
    });
  }

  const order=db.orders.find(
    x=>Number(x.id)===orderId
  );

  if(!order){
    return json(res,404,{
      ok:false,
      message:'الطلب غير موجود'
    });
  }

  const currentStatus=String(
    order.status||'new'
  );

  const transitions={
    new:['accepted','rejected'],
    accepted:['preparing'],
    preparing:['ready'],
    ready:['out_for_delivery','completed'],
    out_for_delivery:['completed'],
    completed:[],
    rejected:[]
  };

  if(
    newStatus!==currentStatus &&
    !transitions[currentStatus]?.includes(newStatus)
  ){
    return json(res,409,{
      ok:false,
      message:
        'لا يمكن تغيير حالة الطلب من '+
        currentStatus+
        ' إلى '+
        newStatus
    });
  }

  // Stock was reserved when the online order was created.
  // Return it exactly once if the manager rejects the order.
  if(newStatus==='rejected' && currentStatus!=='rejected' && !order.stockReleased){
    for(const item of (Array.isArray(order.items)?order.items:[])){
      const product=Array.isArray(db.products)
        ? db.products.find(x=>Number(x.id)===Number(item.productId))
        : null;
      if(product) product.stock=Number(product.stock||0)+Number(item.qty||0);
    }
    order.stockReleased=true;
  }

  order.status=newStatus;

  order.statusUpdatedAt=
    new Date().toISOString();

  /*
   * بمجرد قبول الطلب أو بدء تجهيزه
   * يتم إغلاق إمكانية إضافة منتجات فوراً.
   */
  if(newStatus!=='new'){
    order.addItemsUntil=Date.now();
  }

  db.revision=(db.revision||1)+1;

  save(a.storeId,db);

  return json(res,200,{
    ok:true,
    order:{
      id:order.id,
      number:order.number,
      status:order.status,
      statusUpdatedAt:order.statusUpdatedAt,
      addItemsUntil:order.addItemsUntil,
      total:order.total
    },
    revision:db.revision
  });
}
 if(p==='/api/orders'&&req.method==='POST'){
  const b=await body(req);

  const items=Array.isArray(b.items)?b.items.map(x=>({
    productId:Number(x.productId||0),
    code:String(x.code||''),
    name:String(x.name||''),
    price:Number(x.price||0),
    qty:Number(x.qty||0),
    total:Number(x.total||0)
  })).filter(x=>x.name&&x.qty>0):[];

  if(!items.length)
    return json(res,400,{ok:false,message:'الطلب لا يحتوي على أصناف'});

  const total=items.reduce((sum,x)=>sum+(Number(x.price)||0)*(Number(x.qty)||0),0);

  const orders=db.orders||[];

  const order={
    id:Date.now(),
    number:'ORD-'+Date.now(),
    storeId:a.storeId,

    type:String(b.type||'delivery'),

    customer:{
      name:String(b.customer?.name||''),
      phone:String(b.customer?.phone||''),
      address:String(b.customer?.address||''),
      building:String(b.customer?.building||''),
      floor:String(b.customer?.floor||''),
      apartment:String(b.customer?.apartment||''),
      notes:String(b.customer?.notes||'')
    },

    location:{
      table:String(b.table||''),
      room:String(b.room||'')
    },

    items,
    total,

    paymentMethod:String(b.paymentMethod||'cash'),
    paymentStatus:'pending',

    status:'new',

    createdAt:new Date().toISOString()
  };

  orders.unshift(order);

  db.orders=orders;
  db.revision=(db.revision||1)+1;

  save(a.storeId,db);

  return json(res,201,{
    ok:true,
    order,
    revision:db.revision
  });
}


if(p==='/api/drivers'&&req.method==='GET'){
  const a=auth(req);
  if(!a) return json(res,401,{ok:false,message:'غير مصرح'});
  const db=load(a.storeId);
  const orders=Array.isArray(db.orders)?db.orders:[];
  // Keep delivery representatives created from Users & Permissions visible here.
  // Older data may have the role "مندوب توصيل" in users but no matching db.drivers record.
  if(!Array.isArray(db.drivers)) db.drivers=[];
  const driverUsers=Array.isArray(db.users)
    ? db.users.filter(u=>String(u.role||'').trim()==='مندوب توصيل')
    : [];
  let driversChanged=false;
  for(const u of driverUsers){
    const existing=db.drivers.find(d=>Number(d.userId||0)===Number(u.id));
    if(!existing){
      db.drivers.push({
        id:Number(u.id),
        userId:Number(u.id),
        name:String(u.name||'مندوب'),
        username:String(u.username||''),
        phone:String(u.phone||''),
        passwordHash:String(u.passwordHash||''),
        active:u.active!==false,
        createdAt:u.createdAt||new Date().toISOString()
      });
      driversChanged=true;
    }else{
      existing.name=String(u.name||existing.name||'مندوب');
      existing.username=String(u.username||existing.username||'');
      existing.phone=String(u.phone||'');
      existing.active=u.active!==false;
    }
  }
  if(driversChanged){
    db.revision=(db.revision||1)+1;
    save(a.storeId,db);
  }
  const busyStatuses=['accepted','preparing','ready','out_for_delivery'];
  const drivers=db.drivers.map(d=>{
    const activeOrder=orders.find(o=>Number(o.driverId)===Number(d.id)&&busyStatuses.includes(String(o.status||'')));
    return {
      id:d.id,
      name:d.name,
      phone:d.phone||'',
      username:d.username,
      active:d.active!==false,
      busy:Boolean(activeOrder),
      status:d.active===false?'inactive':(activeOrder?'busy':'available'),
      currentOrderId:activeOrder?Number(activeOrder.id):null,
      currentOrderNumber:activeOrder?String(activeOrder.number||activeOrder.id):''
    };
  });
  return json(res,200,{ok:true,drivers});
}

if(p==='/api/drivers'&&req.method==='POST'){
  const a=auth(req);
  if(!a) return json(res,401,{ok:false,message:'غير مصرح'});
  const b=await body(req);
  const name=String(b.name||'').trim();
  const username=String(b.username||'').trim();
  const password=String(b.password||'');
  const phone=String(b.phone||'').trim();
  const userId=Number(b.userId||0);
  if(!name||!username||password.length<6) return json(res,400,{ok:false,message:'الاسم واسم المستخدم وكلمة مرور 6 أحرف على الأقل مطلوبة'});
  const db=load(a.storeId);
  if(!Array.isArray(db.drivers)) db.drivers=[];
  const linked=db.drivers.find(d=>userId && Number(d.userId||0)===userId);
  if(linked){
    linked.name=name;
    linked.username=username;
    linked.phone=phone;
    linked.passwordHash=hash(password);
    linked.active=true;
    db.revision=(db.revision||1)+1;
    save(a.storeId,db);
    return json(res,200,{ok:true,driver:{id:linked.id,name,username,phone,active:true}});
  }
  if(db.drivers.some(d=>String(d.username||'').toLowerCase()===username.toLowerCase())){
    return json(res,409,{ok:false,message:'اسم مستخدم المندوب مستخدم بالفعل'});
  }
  const driver={id:userId||Date.now(),userId:userId||null,name,username,phone,passwordHash:hash(password),active:true,createdAt:new Date().toISOString()};
  db.drivers.push(driver);
  db.revision=(db.revision||1)+1;
  save(a.storeId,db);
  return json(res,201,{ok:true,driver:{id:driver.id,name,username,phone,active:true}});
}

if(p==='/api/orders/assign-driver'&&req.method==='PUT'){
  const a=auth(req);
  if(!a) return json(res,401,{ok:false,message:'غير مصرح'});
  if(!['مدير','بائع'].includes(a.role)) return json(res,403,{ok:false,message:'تعيين المندوب للمدير والبائع فقط'});
  const b=await body(req);
  const orderId=Number(b.orderId||0);
  const driverId=Number(b.driverId||0);
  const db=load(a.storeId);
  // Migrate a delivery user into the driver table on first assignment.
  if(!Array.isArray(db.drivers)) db.drivers=[];
  const userDriver=Array.isArray(db.users)
    ? db.users.find(u=>Number(u.id)===driverId && String(u.role||'').trim()==='مندوب توصيل')
    : null;
  if(userDriver && !db.drivers.some(d=>Number(d.id)===driverId)){
    db.drivers.push({
      id:Number(userDriver.id),
      userId:Number(userDriver.id),
      name:String(userDriver.name||'مندوب'),
      username:String(userDriver.username||''),
      phone:String(userDriver.phone||''),
      passwordHash:String(userDriver.passwordHash||''),
      active:userDriver.active!==false,
      createdAt:userDriver.createdAt||new Date().toISOString()
    });
  }
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);
  if(!order) return json(res,404,{ok:false,message:'الطلب غير موجود'});
  if(order.type!=='delivery') return json(res,400,{ok:false,message:'تعيين مندوب متاح لطلبات التوصيل فقط'});
  if(driverId===0){
    order.driverId=null; order.driverName=''; order.driverPhone=''; order.assignedAt=null;
  }else{
    const driver=(db.drivers||[]).find(x=>Number(x.id)===driverId&&x.active!==false);
    if(!driver) return json(res,404,{ok:false,message:'المندوب غير موجود أو غير مفعل'});
    const busyStatuses=['accepted','preparing','ready','out_for_delivery'];
    const busyOrder=(db.orders||[]).find(x=>Number(x.driverId)===Number(driver.id)&&Number(x.id)!==Number(order.id)&&busyStatuses.includes(String(x.status||'')));
    if(busyOrder) return json(res,409,{ok:false,message:'المندوب مشغول حاليًا بطلب آخر',busyOrderId:busyOrder.id,busyOrderNumber:busyOrder.number});
    order.driverId=driver.id;
    order.driverName=driver.name;
    order.driverPhone=driver.phone||'';
    order.assignedAt=new Date().toISOString();
  }
  db.revision=(db.revision||1)+1;
  save(a.storeId,db);
  return json(res,200,{ok:true,order});
}

if(p==='/api/orders'&&req.method==='GET'){
  return json(res,200,{
    ok:true,
    orders:db.orders||[],
    revision:db.revision||1
  });
}
 return serveStatic(req,res)
}
http.createServer((req,res)=>handle(req,res).catch(e=>json(res,500,{ok:false,message:e.message||'Server error'}))).listen(PORT,HOST,()=>console.log(`Hesbah Online running on http://${HOST}:${PORT}`));



