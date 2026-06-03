/// <reference types="vite/client" />

interface Window {
  api?: {
    selectDirectory(): Promise<string | null>
    scan(rootPath: string, filters?: { from?: string; to?: string }): Promise<{ inserted: number; skipped: number }>
    reconcile(branchPath: string, targetAmount: number, outputPath: string): Promise<{ processed: number; totalAmount: number; message: string }>
  }
}
