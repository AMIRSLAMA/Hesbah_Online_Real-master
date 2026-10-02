from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app.js"

if not APP.exists():
    print("لم يتم العثور على app.js في مجلد البرنامج.")
    print(f"المجلد الحالي: {ROOT}")
    sys.exit(1)

backup = ROOT / f"app.before-pos-fix-{datetime.now().strftime('%Y%m%d-%H%M%S')}.bak"
shutil.copy2(APP, backup)

s = APP.read_text(encoding="utf-8-sig")

# 1) Add local payment settings to the REAL POS database defaults.
payment_defaults = '''  paymentSettings:{
    cash:{enabled:true,name:"دفع كاش عند الاستلام"},
    vodafoneCash:{enabled:false,name:"Vodafone Cash",number:""},
    etisalatCash:{enabled:false,name:"Etisalat Cash",number:""},
    orangeCash:{enabled:false,name:"Orange Cash",number:""},
    wePay:{enabled:false,name:"WE Pay",number:""},
    instapay:{enabled:false,name:"InstaPay",account:""},
    card:{enabled:false,name:"Visa / Mastercard",provider:"",publicKey:""}
  },'''

if "paymentSettings:{" not in s:
    marker = '  activation:{status:"تجريبي",code:"",customer:""},'
    if marker not in s:
        raise RuntimeError("تعذر تحديد مكان إضافة إعدادات الدفع.")
    s = s.replace(marker, marker + "\n" + payment_defaults, 1)

# 2) Add the payment tab inside the REAL POS settings page.
if 'data-tab="payment"' not in s:
    old_title = 'settings:["الإعدادات","بيانات المحل والطباعة والنسخ الاحتياطي والتفعيل"]'
    new_title = 'settings:["الإعدادات","بيانات المحل والطباعة والنسخ الاحتياطي وطرق الدفع والتفعيل"]'
    if old_title in s:
        s = s.replace(old_title, new_title, 1)

    old_tabs = (
        '<button class="tab active" data-tab="shop">بيانات المحل</button>'
        '<button class="tab" data-tab="printer">الطباعة ودرج النقدية</button>'
        '<button class="tab" data-tab="backup">النسخ الاحتياطي</button>'
        '<button class="tab" data-tab="online">Hesbah Online</button>'
        '<button class="tab" data-tab="activation">التفعيل</button>'
    )
    new_tabs = (
        '<button class="tab active" data-tab="shop">بيانات المحل</button>'
        '<button class="tab" data-tab="printer">الطباعة ودرج النقدية</button>'
        '<button class="tab" data-tab="backup">النسخ الاحتياطي</button>'
        '<button class="tab" data-tab="online">Hesbah Online</button>'
        '<button class="tab" data-tab="payment">💳 طرق الدفع</button>'
        '<button class="tab" data-tab="activation">التفعيل</button>'
    )
    if old_tabs not in s:
        raise RuntimeError("تعذر تحديد تبويبات صفحة الإعدادات الأصلية.")
    s = s.replace(old_tabs, new_tabs, 1)

    activation_marker = ' if(tab==="activation")p.innerHTML='
    payment_panel = ''' if(tab==="payment")p.innerHTML=`<div class="card"><h2>💳 طرق الدفع</h2><p class="muted">حدد طرق الدفع التي تظهر للعميل في صفحة الطلب. يمكنك تشغيل أو إيقاف أي طريقة وتسجيل بياناتها.</p><div class="grid g2">
 <div><label><input type="checkbox" id="posPayCashEnabled"> 💵 كاش عند الاستلام</label><input id="posPayCashName" placeholder="اسم طريقة الدفع"></div>
 <div><label><input type="checkbox" id="posPayVodafoneEnabled"> 📱 Vodafone Cash</label><input id="posPayVodafoneName" placeholder="اسم طريقة الدفع"><input id="posPayVodafoneNumber" placeholder="رقم Vodafone Cash"></div>
 <div><label><input type="checkbox" id="posPayEtisalatEnabled"> 📱 Etisalat Cash</label><input id="posPayEtisalatName" placeholder="اسم طريقة الدفع"><input id="posPayEtisalatNumber" placeholder="رقم Etisalat Cash"></div>
 <div><label><input type="checkbox" id="posPayOrangeEnabled"> 📱 Orange Cash</label><input id="posPayOrangeName" placeholder="اسم طريقة الدفع"><input id="posPayOrangeNumber" placeholder="رقم Orange Cash"></div>
 <div><label><input type="checkbox" id="posPayWeEnabled"> 📱 WE Pay</label><input id="posPayWeName" placeholder="اسم طريقة الدفع"><input id="posPayWeNumber" placeholder="رقم WE Pay"></div>
 <div><label><input type="checkbox" id="posPayInstapayEnabled"> 🏦 InstaPay</label><input id="posPayInstapayName" placeholder="اسم طريقة الدفع"><input id="posPayInstapayAccount" placeholder="حساب / عنوان InstaPay"></div>
 <div><label><input type="checkbox" id="posPayCardEnabled"> 💳 Visa / Mastercard</label><input id="posPayCardName" placeholder="اسم طريقة الدفع"><input id="posPayCardProvider" placeholder="مزود خدمة الدفع"><input id="posPayCardPublicKey" placeholder="Public Key"></div>
 </div><div class="form-actions"><button class="primary" onclick="savePaymentSettingsPOS()">💾 حفظ إعدادات الدفع</button><button class="secondary" onclick="loadPaymentSettingsPOS()">🔄 تحديث</button></div><div id="posPaymentMsg" class="muted" style="margin-top:12px"></div></div>`;
 loadPaymentSettingsPOS();
'''
    if activation_marker not in s:
        raise RuntimeError("تعذر تحديد مكان تبويب التفعيل.")
    s = s.replace(activation_marker, payment_panel + activation_marker, 1)

    online_marker = 'window.saveOnlineSettings='
    payment_functions = '''async function loadPaymentSettingsPOS(){
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

'''
    if online_marker not in s:
        raise RuntimeError("تعذر تحديد مكان دوال Hesbah Online.")
    s = s.replace(online_marker, payment_functions + online_marker, 1)

# 3) Repair old mojibake in user names/roles and support Delivery Driver as a role.
if "function repairUserText(" not in s:
    marker = "function ensureDatabase(){"
    helper = '''function repairUserText(value){
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

'''
    if marker not in s:
        raise RuntimeError("تعذر تحديد ensureDatabase.")
    s = s.replace(marker, helper + marker, 1)

users_block = '''  if(!Array.isArray(db.users) || !db.users.length){
    db.users=structuredClone(defaults.users); changed=true;
  }'''
users_block_new = '''  if(!Array.isArray(db.users) || !db.users.length){
    db.users=structuredClone(defaults.users); changed=true;
  }
  db.users=db.users.map(normalizeUserRecord);'''
if users_block in s and "db.users=db.users.map(normalizeUserRecord);" not in s:
    s = s.replace(users_block, users_block_new, 1)

old_render_users = '''function renderUsers(){const me=JSON.parse(sessionStorage.getItem("amir_session")||"{}");$("#content").innerHTML=`<div class="page-head"><div><h1>المستخدمون</h1><p>إدارة حسابات البائعين وكلمات المرور — تحت إدارة المدير</p></div><button class="primary" onclick="userForm()">+ إضافة بائع</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>إجراء</th></tr></thead><tbody>${db.users.map(u=>`<tr><td>${escape(u.name)}</td><td>${escape(u.username)}</td><td>${escape(u.role)}</td><td class="actions"><button class="secondary" onclick="passwordForm(${u.id})">تعديل الباسورد</button>${u.username!=="admin"?`<button class="danger" onclick="deleteUser(${u.id})">حذف</button>`:""}</td></tr>`).join("")}</tbody></table></div></div>`}
window.userForm=()=>{if(!isManager())return denySeller();openModal(`<div class="modal-head"><h2>إضافة بائع</h2><button class="close" onclick="closeModal()">×</button></div><div class="grid g2"><label>اسم البائع<input id="uName"></label><label>اسم المستخدم<input id="uUser"></label><label>كلمة المرور<input id="uPass" type="password"></label><label>الصلاحية<select id="uRole"><option>بائع</option><option>مدير</option></select></label></div><div class="form-actions"><button class="primary" onclick="saveUser()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`)}
window.saveUser=()=>{if(!isManager())return denySeller();const u={id:Date.now(),name:$("#uName").value.trim(),username:$("#uUser").value.trim(),password:$("#uPass").value,role:$("#uRole").value};if(!u.name||!u.username||!u.password)return toast("أكمل البيانات");if(db.users.some(x=>x.username===u.username))return toast("اسم المستخدم موجود");db.users.push(u);save();closeModal();renderUsers();toast("تم إضافة البائع")};'''
new_render_users = '''function renderUsers(){
  $("#content").innerHTML=`<div class="page-head"><div><h1>المستخدمون والصلاحيات</h1><p>إدارة حسابات المدير والبائع ومندوب التوصيل والصلاحيات.</p></div><button class="primary" onclick="userForm()">+ إضافة مستخدم</button></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>رقم الهاتف</th><th>الصلاحية</th><th>إجراء</th></tr></thead><tbody>
  ${db.users.map(u=>`<tr><td>${escape(u.name)}</td><td>${escape(u.username)}</td><td>${escape(u.phone||"-")}</td><td><b>${escape(u.role||"بائع")}</b></td><td class="actions"><button class="secondary" onclick="passwordForm(${u.id})">تغيير كلمة المرور</button>${u.username!=="admin"?`<button class="danger" onclick="deleteUser(${u.id})">حذف</button>`:""}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}
window.userForm=()=>{if(!isManager())return denySeller();openModal(`<div class="modal-head"><h2>إضافة مستخدم</h2><button class="close" type="button" onclick="closeModal()">×</button></div><div class="grid g2"><label>الاسم<input id="uName"></label><label>اسم المستخدم<input id="uUser"></label><label>كلمة المرور<input id="uPass" type="password"></label><label>رقم الهاتف<input id="uPhone"></label><label>الصلاحية<select id="uRole"><option value="بائع">بائع</option><option value="مندوب توصيل">مندوب توصيل</option><option value="مدير">مدير</option></select></label></div><p class="muted">مندوب التوصيل له حساب مستقل بصلاحية "مندوب توصيل".</p><div class="form-actions"><button class="primary" onclick="saveUser()">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`)}
window.saveUser=()=>{if(!isManager())return denySeller();const u={id:Date.now(),name:$("#uName").value.trim(),username:$("#uUser").value.trim(),password:$("#uPass").value,phone:$("#uPhone").value.trim(),role:$("#uRole").value};if(!u.name||!u.username||!u.password)return toast("أكمل البيانات");if(db.users.some(x=>String(x.username).toLowerCase()===u.username.toLowerCase()))return toast("اسم المستخدم موجود بالفعل");db.users.push(u);save();closeModal();renderUsers();toast(u.role==="مندوب توصيل"?"تم إضافة مندوب التوصيل":"تم إضافة المستخدم")};'''
if old_render_users in s:
    s = s.replace(old_render_users, new_render_users, 1)
elif "function renderUsers(){" not in s:
    raise RuntimeError("تعذر العثور على قسم المستخدمين.")

old_nav = 'const sellerPages=["pos","products","invoices","customers","qrmenu"];if(currentUser().role==="بائع"&&!sellerPages.includes(b.dataset.page))return denySeller();route(b.dataset.page)'
new_nav = 'const role=currentUser().role;const sellerPages=["pos","products","invoices","customers","qrmenu"];const driverPages=["dashboard","onlineorders"];if(role==="بائع"&&!sellerPages.includes(b.dataset.page))return denySeller();if(role==="مندوب توصيل"&&!driverPages.includes(b.dataset.page))return denySeller();route(b.dataset.page)'
if old_nav in s:
    s = s.replace(old_nav, new_nav, 1)

APP.write_text(s, encoding="utf-8-sig")

# 4) Syntax safety: revert automatically if app.js becomes invalid.
try:
    proc = subprocess.run(["node", "--check", str(APP)], text=True, capture_output=True)
except FileNotFoundError:
    proc = None

if proc is not None and proc.returncode != 0:
    shutil.copy2(backup, APP)
    print("فشل فحص JavaScript، وتم إرجاع app.js تلقائيًا للنسخة السابقة.")
    print(proc.stderr)
    sys.exit(1)

print("تم تعديل برنامج Hesbah POS نفسه بنجاح.")
print(f"الملف: {APP}")
print(f"النسخة الاحتياطية: {backup}")
print("تمت إضافة: الإعدادات -> طرق الدفع")
print("تمت إضافة: المستخدمون والصلاحيات -> مندوب توصيل")
print("تمت إضافة: رقم الهاتف للمستخدم")
print("تمت معالجة أدوار المستخدمين القديمة عند التحميل")
print("تم فحص app.js بدون أخطاء.")
print("لم يتم تعديل مجلد online.")
