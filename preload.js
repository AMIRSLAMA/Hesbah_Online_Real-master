const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("amir", {
  printReceipt: html => ipcRenderer.invoke("print-receipt", html),
  printLabels: html => ipcRenderer.invoke("print-labels", html),
  saveBackup: content => ipcRenderer.invoke("save-backup", content),
  restoreBackup: () => ipcRenderer.invoke("restore-backup"),
  licenseInfo: () => ipcRenderer.invoke("license-info"),
  activateLicense: code => ipcRenderer.invoke("activate-license", code),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: callback => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  }
});
