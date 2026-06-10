import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      selectDirectory: () => Promise<string | null>
      scan(rootPath: string, filters?: { from?: string; to?: string }): Promise<{ inserted: number }>
      reconcile(
        branchPath: string,
        targetAmount: number,
        outputPath: string,
        filters?: { from?: string; to?: string },
        minHighValue?: number,
        maxLowValue?: number,
        includeSrBill?: boolean,
        enablePdfOutput?: boolean
      ): Promise<{ processed: number; totalAmount: number; totalRecordAmount: any; pairsProcessed: number }>
    }
  }
}
