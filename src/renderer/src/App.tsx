import { useState } from 'react'

interface ScanResult {
  inserted: number
  processed: number
  pairsProcessed: number
  totalAmount: string 
  difference: string
  targetAmount: string
}

export default function App() {
  const [rootPath, setRootPath] = useState('C:\\Users\\Gem\\Desktop\\Giligans\\ARA')
  const [fromDate, setFromDate] = useState('2025-01') // Format: "YYYY-MM"
  const [toDate, setToDate] = useState('2025-01') // Format: "YYYY-MM"
  const [targetAmount, setTargetAmount] = useState(456791.42)
  const [minHighValue, setMinHighValue] = useState(635)
  const [maxLowValue, setMaxLowValue] = useState(100)
  const [outputPath, setOutputPath] = useState('C:\\Users\\Gem\\Desktop\\Giligans\\Output')
  const [includeSrBill, setIncludeSrBill] = useState(false)
  const [enablePdfOutput, setEnablePdfOutput] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleScan() {
    if (!rootPath.trim()) return

    setError(null)
    setResult(null)

    if (!fromDate || !toDate) {
      setError('Both "From month" and "To month" fields are required.')
      return
    }
    if (fromDate > toDate) {
      setError('"From month" cannot be later than "To month".')
      return
    }

    setLoading(true)
    try {
      const scanResultData = await window.api?.scan(rootPath.trim(), {
        from: fromDate || undefined,
        to: toDate || undefined
      })

      const minHigh = minHighValue ? Number(minHighValue) : 0
      const maxLow = maxLowValue ? Number(maxLowValue) : Number.POSITIVE_INFINITY

      const reconcileResult = await window.api?.reconcile(
        rootPath.trim(),
        targetAmount,
        outputPath.trim(),
        {
          from: fromDate || undefined,
          to: toDate || undefined
        },
        minHigh,
        maxLow,
        includeSrBill,
        enablePdfOutput
      )

      const formattedAmount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(reconcileResult?.totalRecordAmount || 0)


      const formattedDifference = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(reconcileResult?.totalRecordAmount - targetAmount || 0)

      const formattedTargetAmount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(targetAmount || 0)


      // Set the structured result state instead of a raw text string
      setResult({
        inserted: scanResultData?.inserted ?? 0,
        processed: reconcileResult?.processed ?? 0,
        pairsProcessed: reconcileResult?.pairsProcessed ?? 0,
        totalAmount: formattedAmount,
        difference: formattedDifference,
        targetAmount: formattedTargetAmount
      })
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-xl rounded-4xl border border-slate-200 bg-white px-6 py-12 shadow-xl shadow-slate-200/40 sm:px-10 flex flex-col items-center text-center">
          {/* Animated Spinner */}
          <div className="relative mb-6 flex h-12 w-12 items-center justify-center">
            <div className="absolute h-full w-full animate-spin rounded-full border-4 border-slate-100 border-t-slate-950" />
          </div>

          <h2 className="text-xl font-semibold text-slate-950 tracking-tight sm:text-2xl">Scanning for OR files...</h2>

          <p className="mt-2 text-sm text-slate-500 max-w-sm">This may take a while depending on the number of files and their sizes. Please don't close this window.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-3xl rounded-4xl border border-slate-200 bg-white px-6 py-8 shadow-xl shadow-slate-200/40 sm:px-10 sm:py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Bir eJournal</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">v1.0.0</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            Branch folder
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="C:\Users\Gem\Desktop\Giligans"
            />
          </label>

          <label className="text-sm text-slate-600">
            Output Path
            <input
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="C:\\Users\\Gem\\Desktop\\Giligans\\Output"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            From month
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              type="month"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-600">
            To month
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              type="month"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm text-slate-600">
            Target Amount
            <input
              type="number"
              min={0}
              value={targetAmount}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>

          <label>
            Min High Value
            <input
              type="number"
              min={0}
              value={minHighValue}
              placeholder="0"
              onChange={(e) => setMinHighValue(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>

          <label className="text-sm text-slate-600">
            Max Low Value
            <input
              type="number"
              min={0}
              value={maxLowValue}
              placeholder="No limit"
              onChange={(e) => setMaxLowValue(Number(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={includeSrBill} onChange={(e) => setIncludeSrBill(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            Include Sr Bill
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={enablePdfOutput} onChange={(e) => setEnablePdfOutput(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            Generate PDF output
          </label>
        </div>

        <button
          onClick={handleScan}
          disabled={loading || !rootPath.trim()}
          className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Processing…' : 'Run'}
        </button>

        {/* 1. Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-600 rounded-md">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}

        {/* 2. Success Result Display */}
        {result && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 shadow-sm">
            <h4 className="text-sm font-semibold text-emerald-600 mb-3 flex items-center gap-1.5">✓ Process Completed Successfully</h4>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-500">Scanned Inserts:</span>
              <span className="font-medium text-right sm:text-left">{result.inserted}</span>

              <span className="text-slate-500">Files Processed:</span>
              <span className="font-medium text-right sm:text-left">{result.processed}</span>

              <span className="text-slate-500">OR Modified:</span>
              <span className="font-medium text-right sm:text-left">{result.pairsProcessed}</span>

              <span className="text-slate-500">Target Amount:</span>
              <span className="font-medium text-right sm:text-left">{result.targetAmount}</span>

              <span className="text-slate-500">Difference:</span>
              <span className="font-medium text-right sm:text-left">{result.difference}</span>

              <div className="col-span-2 my-1 border-t border-slate-200" />

              <span className="font-semibold text-slate-800">Total Amount:</span>
              <span className="font-bold text-emerald-700 text-right sm:text-left">{result.totalAmount}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
