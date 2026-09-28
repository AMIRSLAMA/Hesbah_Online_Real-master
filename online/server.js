const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),url=require('url');
const PORT=Number(process.env.PORT||8080), HOST=process.env.HOST||'0.0.0.0';
const DATA=path.join(__dirname,'data'); fs.mkdirSync(DATA,{recursive:true});
const SECRET=process.env.HESBAH_SECRET||'CHANGE_THIS_SECRET_BEFORE_PRODUCTION';
const DEMO={
  shop:{
    name:'Ù…ØªØ¬Ø±ÙŠ',
    phone:'',
    address:'',
    device:'Online',
    logo:''
  },

  owner:{
    name:'Ø¥Ø¯Ø§Ø±Ø© Hesbah',
    phone:''
  },

  printer:{
    copies:1,
    drawer:false,
    printer:'Ø§Ù„Ù†Ø¸Ø§Ù… Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ',
    prep:false
  },

  activation:{
    status:'Ù…ÙØ¹Ù„',
    code:'ONLINE',
    customer:'Online'
  },

  users:[
    {
      id:1,
      name:'Ø§Ù„Ù…Ø¯ÙŠØ±',
      username:'admin',
      passwordHash:hash('admin'),
      role:'Ù…Ø¯ÙŠØ±'
    }
  ],

  products:[
    {
      id:1,
      code:'1001',
      name:'Ù…ÙŠØ§Ù‡ Ù…Ø¹Ø¯Ù†ÙŠØ©',
      price:10,
      cost:6,
      stock:50,
      unit:'Ù‚Ø·Ø¹Ø©',
      image:''
    },
    {
      id:2,
      code:'1002',
      name:'Ø¹ØµÙŠØ±',
      price:15,
      cost:9,
      stock:35,
      unit:'Ù‚Ø·Ø¹Ø©',
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
      name:'Ø¯ÙØ¹ ÙƒØ§Ø´ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…'
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
    }
  }
};
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
function serveFile404(res){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found')}
async function handle(req,res){if(req.method==='OPTIONS')return json(res,204,{});const u=url.parse(req.url,true),p=u.pathname;
if(p==='/api/health')return json(res,200,{ok:true,service:'Hesbah Online',time:new Date().toISOString()});
if(!p.startsWith('/api/')) return serveStatic(req,res);
if(p==='/api/login'&&req.method==='POST'){const b=await body(req);const sid=String(b.storeId||'demo').trim()||'demo',db=load(sid),user=db.users.find(x=>String(x.username).toLowerCase()===String(b.username||'').trim().toLowerCase());if(!user||user.passwordHash!==hash(b.password||''))return json(res,401,{ok:false,message:'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± ØµØ­ÙŠØ­Ø©'});const token=sign({storeId:sid,userId:user.id,role:user.role,exp:Date.now()+7*86400000});return json(res,200,{ok:true,token,user:safeUser(user),store:{name:db.shop.name},revision:db.revision||1})}
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
      message:'Ø§Ù„Ø·Ù„Ø¨ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø£ØµÙ†Ø§Ù'
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
      message:'Ø§Ø³Ù… Ø§Ù„Ø¹Ù…ÙŠÙ„ ÙˆØ±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ù…Ø·Ù„ÙˆØ¨Ø§Ù†'
    });
  }

  const total=items.reduce(
    (sum,x)=>sum+(x.price*x.qty),0
  );

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

  total,

  paymentMethod:String(
    b.paymentMethod||'cash'
  ),

  paymentStatus:'pending'
};

  if(!Array.isArray(db.orders))db.orders=[];

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

  order.total=
    order.items.reduce(
      (sum,item)=>
        sum+
        (Number(item.price)||0)*
        (Number(item.qty)||0),
      0
    );

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
  const phone=String(b.phone||'').trim();
  const password=String(b.password||'');

  if(!name||!phone||!password){
    return json(res,400,{
      ok:false,
      message:'Ø§Ù„Ø§Ø³Ù… ÙˆØ±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ø·Ù„ÙˆØ¨Ø©'
    });
  }

  if(password.length<6){
    return json(res,400,{
      ok:false,
      message:'ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„'
    });
  }

  if(!Array.isArray(db.customers)){
    db.customers=[];
  }

  const exists=db.customers.find(
    x=>String(x.phone||'').trim()===phone
  );

  if(exists){
    return json(res,409,{
      ok:false,
      message:'Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ù…Ø³Ø¬Ù„ Ø¨Ø§Ù„ÙØ¹Ù„'
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

  const phone=String(b.phone||'').trim();
  const password=String(b.password||'');

  if(!phone||!password){
    return json(res,400,{
      ok:false,
      message:'Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ø·Ù„ÙˆØ¨Ø©'
    });
  }

  if(!Array.isArray(db.customers)){
    db.customers=[];
  }

  const customer=db.customers.find(
    x=>String(x.phone||'').trim()===phone
  );

  if(!customer||customer.passwordHash!==hash(password)){
    return json(res,401,{
      ok:false,
      message:'Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ø£Ùˆ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©'
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

if(p==='/api/public/payment-methods'&&req.method==='GET'){
  const storeId=String(
  u.query?.storeId || 'demo'
).trim() || 'demo';

  const db=load(storeId);

  const payment=db.paymentSettings||{
    cash:{
      enabled:true,
      name:'Ø¯ÙØ¹ ÙƒØ§Ø´ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…'
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
    }
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
          unit:String(x.unit||'Ù‚Ø·Ø¹Ø©'),
          image:String(x.image||''),
          available:Number(x.stock||0)>0
        }))
        .filter(x=>x.name)
    : [];

  return json(res,200,{
    ok:true,
    products
  });
}
if(p==='/api/payment-settings'&&req.method==='PUT'){
  const db=load(a.storeId);

  const current=db.paymentSettings||{};

  db.paymentSettings={
    cash:{
      enabled:Boolean(b.cash?.enabled),
      name:String(
        b.cash?.name||'Ø¯ÙØ¹ ÙƒØ§Ø´ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…'
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
    }
  };

  db.revision=(db.revision||1)+1;

  save(a.storeId,db);

  return json(res,200,{
    ok:true,
    payment:db.paymentSettings
  });
}
const a=auth(req);if(!a)return json(res,401,{ok:false,message:'Ø§Ù†ØªÙ‡Øª Ø§Ù„Ø¬Ù„Ø³Ø© Ø£Ùˆ Ø§Ù„ØªÙˆÙƒÙ† ØºÙŠØ± ØµØ§Ù„Ø­'});const db=load(a.storeId);
 if(p==='/api/bootstrap'&&req.method==='GET')return json(res,200,{ok:true,storeId:a.storeId,revision:db.revision||1,db:{...db,users:db.users.map(safeUser)}});
 if(p==='/api/sync'&&req.method==='POST'){const b=await body(req);const rev=Number(b.revision||0);if(rev && rev!==(db.revision||1))return json(res,409,{ok:false,conflict:true,revision:db.revision||1,db});const incoming=b.db;if(!incoming||typeof incoming!=='object')return json(res,400,{ok:false,message:'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© ØºÙŠØ± ØµØ§Ù„Ø­Ø©'});incoming.users=db.users;incoming.storeId=a.storeId;incoming.revision=(db.revision||1)+1;save(a.storeId,incoming);return json(res,200,{ok:true,revision:incoming.revision})}
 if(p==='/api/products'&&req.method==='GET')return json(res,200,{ok:true,revision:db.revision||1,products:db.products||[]});
 if(p==='/api/products'&&req.method==='PUT'){if(a.role!=='Ù…Ø¯ÙŠØ±')return json(res,403,{ok:false,message:'Ø§Ù„Ø¹Ù…Ù„ÙŠØ© Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·'});const b=await body(req), id=Number(b.id||Date.now()), item={id,code:String(b.code||''),name:String(b.name||''),price:Number(b.price||0),cost:Number(b.cost||0),stock:Number(b.stock||0),unit:String(b.unit||'Ù‚Ø·Ø¹Ø©'),image:String(b.image||'')};if(!item.name||!item.code)return json(res,400,{ok:false,message:'Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù ÙˆØ§Ù„ÙƒÙˆØ¯ Ù…Ø·Ù„ÙˆØ¨Ø§Ù†'});const i=db.products.findIndex(x=>x.id===id);if(i>=0)db.products[i]=item;else db.products.unshift(item);db.revision=(db.revision||1)+1;save(a.storeId,db);return json(res,200,{ok:true,product:item,revision:db.revision})}
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
    return json(res,400,{ok:false,message:'Ø§Ù„Ø·Ù„Ø¨ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø£ØµÙ†Ø§Ù'});

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
  const drivers=Array.isArray(db.drivers)?db.drivers.map(d=>({id:d.id,name:d.name,phone:d.phone||'',username:d.username,active:d.active!==false})):[]; 
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
  if(!name||!username||password.length<6) return json(res,400,{ok:false,message:'الاسم واسم المستخدم وكلمة مرور 6 أحرف على الأقل مطلوبة'});
  const db=load(a.storeId);
  if(!Array.isArray(db.drivers)) db.drivers=[];
  if(db.drivers.some(d=>String(d.username||'').toLowerCase()===username.toLowerCase())){
    return json(res,409,{ok:false,message:'اسم مستخدم المندوب مستخدم بالفعل'});
  }
  const driver={id:Date.now(),name,username,phone,passwordHash:hash(password),active:true,createdAt:new Date().toISOString()};
  db.drivers.push(driver);
  db.revision=(db.revision||1)+1;
  save(a.storeId,db);
  return json(res,201,{ok:true,driver:{id:driver.id,name,username,phone,active:true}});
}

if(p==='/api/orders/assign-driver'&&req.method==='PUT'){
  const a=auth(req);
  if(!a) return json(res,401,{ok:false,message:'غير مصرح'});
  const b=await body(req);
  const orderId=Number(b.orderId||0);
  const driverId=Number(b.driverId||0);
  const db=load(a.storeId);
  const order=(db.orders||[]).find(x=>Number(x.id)===orderId);
  if(!order) return json(res,404,{ok:false,message:'الطلب غير موجود'});
  if(order.type!=='delivery') return json(res,400,{ok:false,message:'تعيين مندوب متاح لطلبات التوصيل فقط'});
  if(driverId===0){
    order.driverId=null; order.driverName=''; order.driverPhone=''; order.assignedAt=null;
  }else{
    const driver=(db.drivers||[]).find(x=>Number(x.id)===driverId&&x.active!==false);
    if(!driver) return json(res,404,{ok:false,message:'المندوب غير موجود أو غير مفعل'});
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


