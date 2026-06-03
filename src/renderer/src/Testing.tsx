import { useState } from 'react'

export default function Testing() {
  const [rootPath, setRootPath] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleScan() {
    if (!rootPath.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const result = await window.api.scan(rootPath.trim())
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
