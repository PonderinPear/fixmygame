const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fixMyGame", {
  ping: () => "Electron is working",
  scanLogsForGame: (gameKey) => ipcRenderer.invoke("scan-logs-for-game", gameKey),
  pickLogFile: () => ipcRenderer.invoke("pick-log-file"),
  pickScanFolder: () => ipcRenderer.invoke("pick-scan-folder"),
  scanCustomFolder: (folderPath) => ipcRenderer.invoke("scan-custom-folder", folderPath),
  readLogFile: (filePath) => ipcRenderer.invoke("read-log-file", filePath),
  saveAnalysis: (defaultPath, content) =>
    ipcRenderer.invoke("file:saveText", { defaultPath, content }),
  openModsFolder: (gameKey) => ipcRenderer.invoke("open-mods-folder", gameKey),
  openLogsFolder: (gameKey) => ipcRenderer.invoke("open-logs-folder", gameKey),
  openFolderPath: (targetPath) => ipcRenderer.invoke("open-folder-path", targetPath),
});