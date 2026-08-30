const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hwacanceSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (photoDataUrl) => ipcRenderer.invoke("settings:set", photoDataUrl),
  onUpdate: (callback) => {
    ipcRenderer.on("settings:updated", (_event, photoDataUrl) => callback(photoDataUrl));
  },
  closeSettingsWindow: () => ipcRenderer.send("settings:close")
});
