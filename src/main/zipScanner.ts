import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import Database from 'better-sqlite3'
import { app } from 'electron'

const OR_ZIP_PASSWORD = 'admate'

let db: Database.Database

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'orfiles.db')
    db = new Database(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS or_records (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        branch   TEXT    NOT NULL,
        filename TEXT    NOT NULL,
        month    INTEGER NOT NULL,
        year     INTEGER NOT NULL,
        UNIQUE(branch, filename, month, year)
      );
    `)
  }
  return db
}

type MonthYear = { year: number; month: number }

type ScanFilters = {
  from?: string
  to?: string
}

function parseInnerZip(name: string): { month: number; year: number } | null {
  // OR202506.zip → year=2025, month=06
  const match = path
    .basename(name, path.extname(name))
    .toUpperCase()
    .match(/^OR(\d{4})(\d{2})$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

function parseMonthYear(value?: string): MonthYear | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

function monthYearValue(date: MonthYear): number {
  return date.year * 100 + date.month
}

function isMonthYearInRange(date: MonthYear, from: MonthYear | null, to: MonthYear | null): boolean {
  const value = monthYearValue(date)
  if (from && value < monthYearValue(from)) return false
  if (to && value > monthYearValue(to)) return false
  return true
}

export async function scanAndSave(branchPath: string, filters?: ScanFilters): Promise<{ inserted: number; skipped: number }> {
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
    INSERT OR IGNORE INTO or_records (branch, filename, month, year)
    VALUES (@branch, @filename, @month, @year)
  `)

  const branch = path.basename(branchPath)
  let inserted = 0
  let skipped = 0

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
              const r = insert.run({
                branch,
                filename: path.basename(file.entryName),
                month: info.month,
                year: info.year
              })
              if (r.changes > 0) inserted++
              else skipped++
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

  return { inserted, skipped }
}
