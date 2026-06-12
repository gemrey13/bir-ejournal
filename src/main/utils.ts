import * as path from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import * as fs from 'fs'
import { MonthYear } from './main'

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

/**
 * Extracts the year and month from a specific ZIP filename format (e.g., "OR202506.zip").
 * * @param name - The full path or filename of the ZIP file.
 * @returns An object containing the parsed `{ month, year }` as numbers,
 * or `null` if the filename doesn't match the expected `ORYYYYMM` pattern.
 */
export function parseInnerZip(name: string): { month: number; year: number } | null {
  // OR202506.zip → year=2025, month=06
  const match = path
    .basename(name, path.extname(name))
    .toUpperCase()
    .match(/^OR(\d{4})(\d{2})$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

/**
 * Parses a standard string date representation in "YYYY-MM" format into a structured object.
 * * @param value - The optional date string to parse (e.g., "2026-03").
 * @returns A `MonthYear` object with numeric values, or `null` if the input
 * is missing, invalid, or contains an out-of-range month.
 */
export function parseMonthYear(value?: string): MonthYear | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) }
}

/**
 * @returns An integer in the format `YYYYMM`.
 */
export function monthYearValue(date: MonthYear): number {
  return date.year * 100 + date.month
}

/**
 * @returns `true` if the date is within bounds; otherwise `false`.
 */
export function isMonthYearInRange(date: MonthYear, from: MonthYear | null, to: MonthYear | null): boolean {
  const value = monthYearValue(date)
  if (from && value < monthYearValue(from)) return false
  if (to && value > monthYearValue(to)) return false
  return true
}

/**
 * Scans raw text extracted from an Official Receipt (OR) file to determine
 * the total billed amount and the primary classification of the transaction.
 * * - **Amount Extraction:** Sequentially tests multiple patterns ("Total Charge", "Net Sr. Citizen Bill",
 * "Total Bill", "Total") and captures the first match found, automatically stripping out commas.
 * - **Payment/Type Tagging:** * - Categorizes as `'Sr Bill'` if senior citizen keywords are present.
 * - Categorizes as `'Cash'` if explicit cash keywords are detected.
 * - Categorizes as `'Non Cash'` if partner acronym tags (e.g., `-GRAB-`, `-PANDA-`) are found.
 * * @param text - The raw text content of the receipt file.
 * @returns An object containing the parsed numeric `amount` (or null) and the `paymentType` category string (or null).
 */
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

/**
 * Extracts the receipt body (content between the line starting with + and the ending dashed divider)
 * @returns The body content or null if not found
 */
export function extractReceiptBody(text: string): string | null {
  // Match from the first +---+ line to the final dashed footer line (inclusive)
  const bodyMatch = text.match(/(\+[-]{36,}\+[\s\S]*?^[-]{40,}\s*$)/im)
  return bodyMatch ? bodyMatch[1] : null
}

/**
 * Replaces the receipt body with new body content
 * @returns The modified receipt text
 */
export function replaceReceiptBody(text: string, newBody: string): string {
  return text.replace(/(\+[-]{36,}\+[\s\S]*?^[-]{40,}\s*$)/im, newBody)
}

export function getFileKey(year: number, month: number, filename: string): string {
  return `${year}_${month}_${filename.toLowerCase()}`
}

export function buildOutputFilePath(outputDir: string, year: number, month: number, filename: string): string {
  const monthStr = String(month).padStart(2, '0')
  const yearDir = path.join(outputDir, String(year), monthStr)
  fs.mkdirSync(yearDir, { recursive: true })
  return path.join(yearDir, filename)
}
