import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      selectDirectory: () => Promise<string | null>
      scan(rootPath: string): Promise<{ inserted: number; skipped: number }>
    }
  }
}
