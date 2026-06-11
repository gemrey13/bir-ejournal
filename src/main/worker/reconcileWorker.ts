import { parentPort, workerData } from 'worker_threads'
import { reconcileOrFiles } from '../reconcileOrFiles'

const { branchPath, targetAmount, outputBasePath, filters, minHighValue, maxLowValue, includeSrBill, enablePdfOutput, dbPath } = workerData as {
  branchPath: string
  targetAmount: number
  outputBasePath: string
  filters?: { from?: string; to?: string }
  minHighValue: number
  maxLowValue: number
  includeSrBill: boolean
  enablePdfOutput: boolean
  dbPath: string
}

async function run() {
  try {
    const result = await reconcileOrFiles(branchPath, targetAmount, outputBasePath, filters, minHighValue, maxLowValue, includeSrBill, enablePdfOutput, dbPath)
    parentPort?.postMessage({ result })
  } catch (err: any) {
    parentPort?.postMessage({ error: err?.message || String(err) })
  }
}

run()
