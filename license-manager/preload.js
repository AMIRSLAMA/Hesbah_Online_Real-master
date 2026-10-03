const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("licenseManager",{
  getStatus:()=>ipcRenderer.invoke("license-status"),
  importPrivateKey:()=>ipcRenderer.invoke("import-private-key"),
  generate:data=>ipcRenderer.invoke("generate-license",data),
  records:()=>ipcRenderer.invoke("open-records")
});
