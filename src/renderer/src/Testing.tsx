import { useState } from 'react'

export default function Testing() {
  const [rootPath, setRootPath] = useState('C:\\Users\\Gem\\Desktop\\Giligans\\ARA')
  const [fromDate, setFromDate] = useState('') // Format: "YYYY-MM"
  const [toDate, setToDate] = useState('') // Format: "YYYY-MM"
  const [targetAmount, setTargetAmount] = useState(456791.42)
  const [minHighValue, setMinHighValue] = useState(1000)
  const [maxLowValue, setMaxLowValue] = useState(500)
  const [outputPath, setOutputPath] = useState('C:\\Users\\Gem\\Desktop\\Giligans\\Output')
  const [includeSrBill, setIncludeSrBill] = useState(false)
  const [enablePdfOutput, setEnablePdfOutput] = useState(false)

  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleScan() {
    if (!rootPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.api?.scan(rootPath.trim(), {
        from: fromDate || undefined,
        to: toDate || undefined
      })

      const minHigh = minHighValue ? parseFloat(minHighValue) : 0
      const maxLow = maxLowValue ? parseFloat(maxLowValue) : Number.POSITIVE_INFINITY

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

      console.log('Scan fromDate:', fromDate)
      console.log('Scan toDate:', toDate)

      setStatus(`Done — scanned: inserted ${result?.inserted}. Reconciled: ${reconcileResult?.processed} files, total amount ${reconcileResult?.totalAmount}, TOTAL RECORD AMOUNT: ${reconcileResult?.totalRecordAmount}, TOTAL PAIRS PROCESSED: ${reconcileResult?.pairsProcessed}`)
    } catch (e) {
      setStatus(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, fontFamily: 'Segoe UI, sans-serif', maxWidth: 560 }}>
        <h2 style={{ marginBottom: 20 }}>Scanning for OR files...</h2>
        <p style={{ fontSize: 13, color: '#4b5563' }}>This may take a while depending on the number of files and their sizes.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, fontFamily: 'Segoe UI, sans-serif', maxWidth: 560 }}>
      <h2 style={{ marginBottom: 20 }}>OR File Scanner</h2>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          placeholder="C:\Users\Gem\Desktop\Giligans"
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'Consolas, monospace',
            borderRadius: 6,
            border: '1px solid #ccc'
          }}
        />
        <button
          onClick={handleScan}
          disabled={loading || !rootPath.trim()}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>Target Amount</label>
          <input
            type="number"
            min={0}
            value={targetAmount}
            onChange={(e) => setTargetAmount(Number(e.target.value))}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>Output Path</label>
          <input
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="C:\\Users\\Gem\\Desktop\\Giligans\\Output"
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>From Month</label>
          <input
            type="month"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>To Month</label>
          <input
            type="month"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>Min High Value</label>
          <input
            type="number"
            min={0}
            value={minHighValue}
            placeholder="0"
            onChange={(e) => setMinHighValue(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>Max Low Value</label>
          <input
            type="number"
            min={0}
            value={maxLowValue}
            placeholder="No limit"
            onChange={(e) => setMaxLowValue(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeSrBill}
              onChange={(e) => setIncludeSrBill(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Include Sr Bill in Reconciliation
          </label>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enablePdfOutput}
              onChange={(e) => setEnablePdfOutput(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Generate PDF version of OR files
          </label>
        </div>
      </div>

      {status && (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: status.startsWith('Error') ? '#dc2626' : '#16a34a'
          }}
        >
          {status}
        </p>
      )}
    </div>
  )
}
