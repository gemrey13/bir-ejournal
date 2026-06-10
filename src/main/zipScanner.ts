import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { getDb, isMonthYearInRange, monthYearValue, parseInnerZip, parseMonthYear, parseOrFileMetadata } from './utils'
import { ScanFilters } from './main'

const OR_ZIP_PASSWORD = 'admate'

export async function scanAndSave(branchPath: string, filters?: ScanFilters): Promise<{ inserted: number }> {
  const fromDate = parseMonthYear(filters?.from)
  const toDate = parseMonthYear(filters?.to)

  if (filters?.from && !fromDate) {
    throw new Error('Invalid "from" date format. Use YYYY-MM.')
  }
  if (filters?.to && !toDate) {
    throw new Error('Invalid "to" date format. Use YYYY-MM.')
  }
  if (fromDate && toDate && monthYearValue(fromDate) > monthYearValue(toDate)) {
    throw new Error('The "from" date must be earlier than or equal to the "to" date.')
  }

  const database = getDb()
  const insert = database.prepare(`
    INSERT OR IGNORE INTO or_records (branch, filename, month, year, amount, payment_type)
    VALUES (@branch, @filename, @month, @year, @amount, @payment_type)
  `)

  const branch = path.basename(branchPath)
  let inserted = 0

  const tmpDir = path.join(os.tmpdir(), `or_scan_${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    for (const yearFolder of fs.readdirSync(branchPath)) {
      if (!/^\d{4}$/.test(yearFolder)) continue
      const yearNumber = parseInt(yearFolder, 10)
      if (fromDate && yearNumber < fromDate.year) continue
      if (toDate && yearNumber > toDate.year) continue

      const yearPath = path.join(branchPath, yearFolder)
      if (!fs.statSync(yearPath).isDirectory()) continue

      for (const outerName of fs.readdirSync(yearPath)) {
        if (!/\.zip$/i.test(outerName)) continue

        let outerZip: AdmZip
        try {
          outerZip = new AdmZip(path.join(yearPath, outerName))
        } catch {
          continue
        }

        for (const entry of outerZip.getEntries()) {
          if (entry.isDirectory) continue
          if (!/^OR\d{6}\.zip$/i.test(path.basename(entry.entryName))) continue

          const info = parseInnerZip(entry.entryName)
          if (!info) continue
          if (!isMonthYearInRange(info, fromDate, toDate)) continue

          const tmpZip = path.join(tmpDir, `${branch}_${path.basename(entry.entryName)}`)
          const outerBuf: Buffer = (entry as any).getData(OR_ZIP_PASSWORD)
          fs.writeFileSync(tmpZip, outerBuf)

          let innerZip: AdmZip
          try {
            innerZip = new AdmZip(tmpZip)
          } catch {
            fs.unlinkSync(tmpZip)
            continue
          }

          const insertBatch = database.transaction(() => {
            for (const file of innerZip.getEntries()) {
              if (file.isDirectory) continue
              // Accept both .or and .sr files
              if (!/\.(or|sr)$/i.test(file.entryName)) continue

              const fileBuf: Buffer = (file as any).getData(OR_ZIP_PASSWORD)
              if (!fileBuf) continue
              const extension = path.extname(file.entryName).toLowerCase()
              let amount: number | null = null
              let payment_type: string | null = null
              if (extension === '.or') {
                const text = fileBuf.toString('utf8')
                const metadata = parseOrFileMetadata(text)
                amount = metadata.amount
                payment_type = metadata.paymentType
              }
              const r = insert.run({
                branch,
                filename: path.basename(file.entryName),
                month: info.month,
                year: info.year,
                amount,
                payment_type
              })
              if (r.changes > 0) inserted++
            }
          })
          insertBatch()

          fs.unlinkSync(tmpZip)
        }
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  return { inserted }
}
