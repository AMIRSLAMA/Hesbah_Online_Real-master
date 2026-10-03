const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const EXPECTED_PUBLIC_KEY = [
"-----BEGIN PUBLIC KEY-----",
"MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqU4cfPQ+GwuNPMxcej0j",
"8uKZEWOtbu4cSSRry7pnkL+eG3ib+e0N1j8K7nLEdFPc1LvGtGtNK2WNzm86aWPF",
"URc/vUxAm86vx/y5f2YauN80eyZCAuI2PPrga6CB/APTlHDK+1ynSMOUmtvijbVe",
"S1KzZt+isgk01mwcQ8eg/jHsKBzPoCdyr13a45y6Tg93LhEG1QzqDbh+2IqNI8tl",
"okrsqGsmU5UZWin624AyVyMNtzEZDyKWJ2l0ovEPVbhGSQm+FXROtm13+ctGJ0jy",
"K9bv9v9uTXzHL0FLJjM8ga7vQ1r27Hc4DPQiWyNsTHyDoWYZdqagNbdick/lv0rp",
"v+3dD1JaH3ba0rFwL4sIUmAWm21nPkwbsZfeuxq75YmIDD1tYTlCkeSMhGDfSG1q",
"SND/lVs2jNUsRuzR2eLvMX73F6aZcUNI8dU1+YY9LSYm0ao94BXuLo80sv0V9YdS",
"ryvF1CnkNiSkwbJsohja29GDkx7kyyB1AjdOtYVyiHtDAgMBAAE=",
"-----END PUBLIC KEY-----"
].join("\n");

function keyFile(){ return path.join(app.getPath("userData"),"hesbah-license-private-key.pem"); }
function recordsFile(){ return path.join(app.getPath("userData"),"hesbah-license-records.json"); }
function normalizePem(s){ return String(s||"").replace(/\\r/g,"").trim(); }
function readPrivateKey(){ const p=keyFile(); return fs.existsSync(p)?fs.readFileSync(p,"utf8"):null; }
function validatePrivateKey(privateKey){
  try{
    const key=crypto.createPrivateKey(privateKey);
    const derived=crypto.createPublicKey(key).export({type:"spki",format:"pem"}).toString();
    return normalizePem(derived)===normalizePem(EXPECTED_PUBLIC_KEY);
  }catch{return false;}
}
function loadRecords(){try{return JSON.parse(fs.readFileSync(recordsFile(),"utf8"));}catch{return [];}}
function saveRecords(records){fs.writeFileSync(recordsFile(),JSON.stringify(records,null,2),"utf8");}

function createWindow(){
  const win=new BrowserWindow({
    width:1100,height:760,minWidth:900,minHeight:650,
    backgroundColor:"#0b1220",
    webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}
  });
  win.loadFile(path.join(__dirname,"index.html"));
}

ipcMain.handle("license-status",()=>{
  const privateKey=readPrivateKey();
  return {configured:Boolean(privateKey),valid:Boolean(privateKey&&validatePrivateKey(privateKey)),keyPath:keyFile(),records:loadRecords()};
});

ipcMain.handle("import-private-key",async()=>{
  const result=await dialog.showOpenDialog({
    title:"اختيار مفتاح Hesbah الخاص",
    properties:["openFile"],
    filters:[{name:"PEM Key",extensions:["pem","key","txt"]}]
  });
  if(result.canceled||!result.filePaths[0])return {canceled:true};
  const content=fs.readFileSync(result.filePaths[0],"utf8");
  if(!validatePrivateKey(content))return {ok:false,error:"المفتاح المختار لا يطابق مفتاح Hesbah العام الموجود في البرنامج."};
  fs.writeFileSync(keyFile(),content,{encoding:"utf8",mode:0o600});
  return {ok:true,path:keyFile()};
});

ipcMain.handle("generate-license",(_event,data)=>{
  const privateKey=readPrivateKey();
  if(!privateKey||!validatePrivateKey(privateKey))throw new Error("يجب أولاً استيراد private-key.pem الصحيح لمفتاح Hesbah.");
  const customer=String(data?.customer||"").trim();
  const machineId=String(data?.machineId||"").trim();
  const days=Number(data?.days);
  if(!customer)throw new Error("اكتب اسم العميل.");
  if(!machineId)throw new Error("اكتب Machine ID.");
  if(!Number.isFinite(days)||days<=0||days>3650)throw new Error("مدة الترخيص يجب أن تكون بين يوم واحد و3650 يومًا.");

  const issuedAt=new Date();
  const expiresAt=new Date(issuedAt.getTime()+days*86400000);
  const payload={product:"Hesbah",customer,machineId,issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString()};
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signer=crypto.createSign("RSA-SHA256");
  signer.update(body); signer.end();
  const signature=signer.sign(privateKey,"base64url");
  const code=body+"."+signature;

  const records=loadRecords();
  records.unshift({id:crypto.randomUUID(),customer,machineId,days,issuedAt:payload.issuedAt,expiresAt:payload.expiresAt,code});
  saveRecords(records.slice(0,500));
  return {code,payload,records:loadRecords()};
});

ipcMain.handle("open-records",()=>loadRecords());

app.whenReady().then(createWindow);
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
