import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
  scan: (rootPath: string, filters?: { from?: string; to?: string }): Promise<{ inserted: number }> => ipcRenderer.invoke('scan', rootPath, filters),
  reconcile: (
    branchPath: string,
    targetAmount: number,
    outputPath: string,
    filters?: { from?: string; to?: string },
    minHighValue?: number,
    maxLowValue?: number,
    includeSrBill?: boolean
  ): Promise<{ processed: number; totalAmount: number; totalRecordAmount: any; pairsProcessed: number }> =>
    ipcRenderer.invoke('reconcile', branchPath, targetAmount, outputPath, filters, minHighValue, maxLowValue, includeSrBill)
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
