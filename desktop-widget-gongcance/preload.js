const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hwacanceSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (photoDataUrl) => ipcRenderer.invoke("settings:set", photoDataUrl),
  onUpdate: (callback) => {
    ipcRenderer.on("settings:updated", (_event, photoDataUrl) => callback(photoDataUrl));
  },
  chooseAudio: () => ipcRenderer.invoke("audio:choose"),
  resetAudio: () => ipcRenderer.invoke("audio:reset"),
  closeSettingsWindow: () => ipcRenderer.send("settings:close"),
  openSettings: () => ipcRenderer.send("settings:open")
});
