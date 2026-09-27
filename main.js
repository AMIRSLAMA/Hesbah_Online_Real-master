const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

let win;
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqU4cfPQ+GwuNPMxcej0j
8uKZEWOtbu4cSSRry7pnkL+eG3ib+e0N1j8K7nLEdFPc1LvGtGtNK2WNzm86aWPF
URc/vUxAm86vx/y5f2YauN80eyZCAuI2PPrga6CB/APTlHDK+1ynSMOUmtvijbVe
S1KzZt+isgk01mwcQ8eg/jHsKBzPoCdyr13a45y6Tg93LhEG1QzqDbh+2IqNI8tl
okrsqGsmU5UZWin624AyVyMNtzEZDyKWJ2l0ovEPVbhGSQm+FXROtm13+ctGJ0jy
K9bv9v9uTXzHL0FLJjM8ga7vQ1r27Hc4DPQiWyNsTHyDoWYZdqagNbdick/lv0rp
v+3dD1JaH3ba0rFwL4sIUmAWm21nPkwbsZfeuxq75YmIDD1tYTlCkeSMhGDfSG1q
SND/lVs2jNUsRuzR2eLvMX73F6aZcUNI8dU1+YY9LSYm0ao94BXuLo80sv0V9YdS
ryvF1CnkNiSkwbJsohja29GDkx7kyyB1AjdOtYVyiHtDAgMBAAE=
-----END PUBLIC KEY-----`;

function licenseFile() { return path.join(app.getPath("userData"), "amircasher-license.json"); }
function machineId() {
  const raw = [process.platform, os.hostname(), os.userInfo().username].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 20).toUpperCase();
}
function readLicense() { try { return JSON.parse(fs.readFileSync(licenseFile(), "utf8")); } catch { return null; } }
function writeLicense(data) { fs.mkdirSync(app.getPath("userData"), {recursive:true}); fs.writeFileSync(licenseFile(), JSON.stringify(data,null,2), "utf8"); }
function decodeLicense(code) {
  const parts=String(code||"").trim().split(".");
  if(parts.length!==2) throw new Error("صيغة كود التفعيل غير صحيحة");
  const body=parts[0], sig=parts[1];
  const verify=crypto.createVerify("RSA-SHA256"); verify.update(body); verify.end();
  if(!verify.verify(PUBLIC_KEY,sig,"base64url")) throw new Error("كود التفعيل غير صالح");
  const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  if(payload.product!=="AmirCasher") throw new Error("الكود ليس لبرنامج AmirCasher");
  if(payload.machineId!==machineId()) throw new Error("كود التفعيل خاص بجهاز آخر");
  if(!payload.expiresAt || new Date(payload.expiresAt).getTime() < Date.now()) throw new Error("انتهت صلاحية كود التفعيل");
  return payload;
}
function licenseStatus() {
  const now=Date.now(); let st=readLicense();
  if(!st){ st={trialStartedAt:new Date().toISOString()}; writeLicense(st); }
  if(st.licenseCode){ try { const p=decodeLicense(st.licenseCode); return {status:"مفعل", customer:p.customer, expiresAt:p.expiresAt, machineId:machineId(), trial:false}; } catch(e){ return {status:"منتهي", error:e.message, machineId:machineId(), trial:false}; } }
  const trialEnd=new Date(st.trialStartedAt).getTime()+15*86400000;
  if(now<trialEnd) return {status:"تجريبي", expiresAt:new Date(trialEnd).toISOString(), machineId:machineId(), trial:true, daysLeft:Math.ceil((trialEnd-now)/86400000)};
  return {status:"منتهي", expiresAt:new Date(trialEnd).toISOString(), machineId:machineId(), trial:true, daysLeft:0};
}


function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: "#f5f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.once("ready-to-show", () => win.show());
}

ipcMain.handle("license-info", async () => licenseStatus());
ipcMain.handle("activate-license", async (event, code) => {
  try { const payload=decodeLicense(code); writeLicense({trialStartedAt:readLicense()?.trialStartedAt||new Date().toISOString(), licenseCode:String(code).trim()}); return {ok:true, status:"مفعل", customer:payload.customer, expiresAt:payload.expiresAt, machineId:machineId()}; }
  catch(e){ return {ok:false, error:e.message, machineId:machineId()}; }
});

ipcMain.handle("print-receipt", async (event, html) => {
  const p = new BrowserWindow({ show: false, width: 420, height: 700 });
  await p.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await p.webContents.executeJavaScript(`new Promise(resolve=>{const imgs=[...document.images];if(!imgs.length)return resolve();let left=imgs.length;const done=()=>{if(--left<=0)resolve()};imgs.forEach(img=>{if(img.complete)done();else{img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true})}})})`);
  return await new Promise(resolve => {
    p.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      p.close();
      resolve({ success, reason });
    });
  });
});

ipcMain.handle("print-labels", async (event, html) => {
  const p = new BrowserWindow({ show: false, width: 600, height: 800 });
  await p.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await p.webContents.executeJavaScript(`new Promise(resolve=>{const imgs=[...document.images];if(!imgs.length)return resolve();let left=imgs.length;const done=()=>{if(--left<=0)resolve()};imgs.forEach(img=>{if(img.complete)done();else{img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true})}})})`);
  return await new Promise(resolve => {
    p.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      p.close();
      resolve({ success, reason });
    });
  });
});

ipcMain.handle("save-backup", async (event, content) => {
  const result = await dialog.showSaveDialog(win, {
    title: "حفظ النسخة الاحتياطية",
    defaultPath: `AmirCasher_Backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: "AmirCasher Backup", extensions: ["json"] }]
  });
  if (result.canceled) return { canceled: true };
  fs.writeFileSync(result.filePath, content, "utf8");
  return { canceled: false, path: result.filePath };
});

ipcMain.handle("restore-backup", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "استرجاع نسخة احتياطية",
    properties: ["openFile"],
    filters: [{ name: "AmirCasher Backup", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return { canceled: false, content: fs.readFileSync(result.filePaths[0], "utf8"), path: result.filePaths[0] };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
