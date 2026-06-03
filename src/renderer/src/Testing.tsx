import { useState } from 'react'

export default function Testing() {
  const [rootPath, setRootPath] = useState('')
  const [fromDate, setFromDate] = useState('') // Format: "YYYY-MM"
  const [toDate, setToDate] = useState('') // Format: "YYYY-MM"
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleScan() {
    if (!rootPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.api.scan(rootPath.trim(), {
        from: fromDate || undefined,
        to: toDate || undefined
      })

      console.log('Scan fromDate:', fromDate)
      console.log('Scan toDate:', toDate)
      setStatus(`Done — inserted: ${result.inserted}, duplicates skipped: ${result.skipped}`)
    } catch (e) {
      setStatus(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
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

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>From Month</label>
          <input
            type="month"
            value={fromDate}
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563' }}>To Month</label>
          <input
            type="month"
            value={toDate}
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
