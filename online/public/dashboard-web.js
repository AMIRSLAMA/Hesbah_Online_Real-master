(function(){
"use strict";
const WEB=true;
function api(path,opt){
  opt=opt||{};
  opt.headers=Object.assign({"Content-Type":"application/json"},opt.headers||{});
  const t=localStorage.getItem("hesbah_online_token");
  if(t) opt.headers.Authorization="Bearer "+t;
  return fetch(path,opt).then(async r=>{
    let d={}; try{d=await r.json()}catch(_){}
    if(!r.ok) throw new Error(d.message||("خطأ اتصال "+r.status));
    return d;
  });
}
async function webLogin(){
  const store=(document.getElementById("loginUser")?.dataset.store||"demo").trim()||"demo";
  const user=(document.getElementById("loginUser")?.value||"").trim();
  const pass=document.getElementById("loginPass")?.value||"";
  const msg=document.getElementById("loginMsg");
  if(!user||!pass){if(msg)msg.textContent="اكتب اسم المستخدم وكلمة المرور.";return;}
  try{
    const d=await api("/api/login",{method:"POST",body:JSON.stringify({storeId:store,username:user,password:pass})});
    localStorage.setItem("hesbah_online_token",d.token);
    const boot=await api("/api/bootstrap");
    const remote=Object.assign({},boot.db,{
      online:{enabled:true,url:location.origin,storeId:store,autoSync:true,revision:Number(boot.revision||1)}
    });
    localStorage.setItem("amircasher_db_v1",JSON.stringify(remote));
    sessionStorage.setItem("amir_session",JSON.stringify(d.user));
    location.reload();
  }catch(e){if(msg)msg.textContent=e.message||"تعذر تسجيل الدخول";}
}
window.HESBAH_WEB_MODE=true;
window.amir={
  licenseInfo:async()=>({status:"مفعل",trial:false,machineId:"ONLINE",customer:"Online"}),
  activateLicense:async()=>({ok:true,status:"مفعل",customer:"Online",machineId:"ONLINE"}),
  printReceipt:async html=>{const w=window.open("","_blank","width=520,height=760");if(!w){alert("اسمح للنوافذ المنبثقة للطباعة");return {success:false}}w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),200);return {success:true}},
  printLabels:async html=>{const w=window.open("","_blank","width=700,height=850");if(!w){alert("اسمح للنوافذ المنبثقة للطباعة");return {success:false}}w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),200);return {success:true}},
  saveBackup:async content=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:"application/json;charset=utf-8"}));a.download="Hesbah_Backup_"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return {canceled:false}},
  restoreBackup:async()=>{return await new Promise(resolve=>{const i=document.createElement("input");i.type="file";i.accept=".json,application/json";i.onchange=()=>{const f=i.files?.[0];if(!f)return resolve({canceled:true});const r=new FileReader();r.onload=()=>resolve({canceled:false,content:String(r.result||"")});r.onerror=()=>resolve({canceled:true});r.readAsText(f)};i.click()})}
};
window.__hesbahWebLogin=webLogin;
window.__hesbahWebLogout=function(){localStorage.removeItem("hesbah_online_token");sessionStorage.removeItem("amir_session");localStorage.removeItem("amircasher_db_v1");location.href="/dashboard/";};
setTimeout(function(){
  const b=document.getElementById("loginBtn");
  const p=document.getElementById("loginPass");
  if(b)b.onclick=webLogin;
  if(p)p.onkeydown=function(e){if(e.key==="Enter")webLogin()};
  const u=document.getElementById("loginUser");
  if(u)u.dataset.store=new URLSearchParams(location.search).get("storeId")||"demo";
  const out=document.getElementById("logoutBtn");
  if(out)out.onclick=window.__hesbahWebLogout;
},0);
})();