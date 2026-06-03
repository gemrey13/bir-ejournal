import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
  scan: (rootPath: string, filters?: { from?: string; to?: string }): Promise<{ inserted: number; skipped: number }> => ipcRenderer.invoke('scan', rootPath, filters)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
