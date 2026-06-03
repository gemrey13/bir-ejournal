import * as path from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { MonthYear } from './Main'

let db: Database.Database

export function getDb(): Database.Database {
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
        amount   REAL,
        payment_type TEXT,
        UNIQUE(branch, filename, month, year)
      );
    `)
  }
  return db
}

export function parseInnerZip(name: string): { month: number; year: number } | null {
  // OR202506.zip → year=2025, month=06
  const match = path
    .basename(name, path.extname(name))
    .toUpperCase()
    .match(/^OR(\d{4})(\d{2})$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

export function parseMonthYear(value?: string): MonthYear | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

export function monthYearValue(date: MonthYear): number {
  return date.year * 100 + date.month
}

export function isMonthYearInRange(date: MonthYear, from: MonthYear | null, to: MonthYear | null): boolean {
  const value = monthYearValue(date)
  if (from && value < monthYearValue(from)) return false
  if (to && value > monthYearValue(to)) return false
  return true
}

export function parseOrFileMetadata(text: string): { amount: number | null; paymentType: string | null } {
  // Try multiple amount locations: Total Charge, Net Sr. Citizen Bill, Total Bill, Total
  const patterns = [
    /Total Charge\s*:\s*P\s*([\d,]+\.\d{2})/im,
    /Net\s*Sr\.?\s*Citizen\s*Bill\s*[:\-]?\s*P?\s*([\d,]+\.\d{2})/im,
    /Total Bill\s*[:\-]?\s*P?\s*([\d,]+\.\d{2})/im,
    /Total\s*[:]\s*P?\s*([\d,]+\.\d{2})/im
  ]

  let amount: number | null = null
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      amount = parseFloat(m[1].replace(/,/g, ''))
      break
    }
  }

  const isSrCitizen = /Sr\.?\s*Citizen|SENIOR\s+CITIZEN|SENIOR\s+CITIZEN\s+TRANSACTION|ACKNOWLEDGMENT\s+SLIP|Net\s*Sr\.?\s*Citizen\s*Bill/i.test(text)
  const hasPaidByCash = /-CASH-|Paid by\s+Cash/i.test(text)
  let paymentType: string | null = null

  if (isSrCitizen) {
    paymentType = 'Sr Bill'
  } else if (hasPaidByCash) {
    paymentType = 'Cash'
  } else if (/-[A-Z0-9]{2,}-/i.test(text)) {
    // common partner tags like -GRAB-, -PANDA-, etc.
    paymentType = 'Non Cash'
  }

  return { amount, paymentType }
}
