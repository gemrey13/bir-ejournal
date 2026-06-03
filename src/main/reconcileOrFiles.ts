import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { getDb, parseInnerZip, parseMonthYear, isMonthYearInRange, monthYearValue } from './utils'

const OR_ZIP_PASSWORD = 'admate'

interface OrRecord {
  id: number
  branch: string
  filename: string
  month: number
  year: number
  amount: number | null
  payment_type: string | null
  fileContent?: string | null
}

/**
 * Extracts the receipt body (content between the line starting with + and ========)
 * @param text - The full receipt text
 * @returns The body content or null if not found
 */
function extractReceiptBody(text: string): string | null {
  // Match from the first +---+ line to the ===== line (inclusive)
  const bodyMatch = text.match(/(\+[-]{36,}\+[\s\S]*?={40,})/i)
  return bodyMatch ? bodyMatch[1] : null
}

/**
 * Replaces the receipt body with new body content
 * @param text - The full receipt text
 * @param newBody - The new body to insert
 * @returns The modified receipt text
 */
function replaceReceiptBody(text: string, newBody: string): string {
  return text.replace(/(\+[-]{36,}\+[\s\S]*?={40,})/i, newBody)
}

function getFileKey(year: number, month: number, filename: string): string {
  return `${year}_${month}_${filename.toLowerCase()}`
}

function buildOutputFilePath(outputDir: string, year: number, month: number, filename: string): string {
  const monthStr = String(month).padStart(2, '0')
  const yearDir = path.join(outputDir, String(year), monthStr)
  fs.mkdirSync(yearDir, { recursive: true })
  return path.join(yearDir, filename)
}

function copyAllOrSrFilesFromBranch(
  branchPath: string,
  outputDir: string,
  overrides: Map<string, string>,
  fromDate: ReturnType<typeof parseMonthYear>,
  toDate: ReturnType<typeof parseMonthYear>
): number {
  const tmpDir = path.join(os.tmpdir(), `or_copy_${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })
  let copied = 0

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

          const info = parseInnerZip(path.basename(entry.entryName))
          if (!info) continue

          const tmpZip = path.join(tmpDir, `${yearFolder}_${path.basename(entry.entryName)}`)
          try {
            const outerBuf: Buffer = (entry as any).getData(OR_ZIP_PASSWORD)
            fs.writeFileSync(tmpZip, outerBuf)

            let innerZip: AdmZip
            try {
              innerZip = new AdmZip(tmpZip)
            } catch {
              continue
            }

            for (const file of innerZip.getEntries()) {
              if (file.isDirectory) continue
              if (!/\.(or|sr)$/i.test(file.entryName)) continue

              const infoDate = { year: info.year, month: info.month }
              if (!isMonthYearInRange(infoDate, fromDate, toDate)) continue

              const filename = path.basename(file.entryName)
              const key = getFileKey(info.year, info.month, filename)
              const outputFile = buildOutputFilePath(outputDir, info.year, info.month, filename)

              if (overrides.has(key)) {
                fs.writeFileSync(outputFile, overrides.get(key)!, 'utf8')
              } else {
                const buf: Buffer = (file as any).getData(OR_ZIP_PASSWORD)
                if (!buf) continue
                fs.writeFileSync(outputFile, buf)
              }
              copied++
            }
          } finally {
            try {
              fs.unlinkSync(tmpZip)
            } catch {}
          }
        }
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  return copied
}

/**
 * Extracts a specific OR file from the zip structure
 */
function extractOrFileContent(
  branchPath: string,
  year: number,
  filename: string
): string | null {
  try {
    const yearPath = path.join(branchPath, String(year))
    if (!fs.existsSync(yearPath)) return null

    // Find outer zip files
    for (const outerName of fs.readdirSync(yearPath)) {
      if (!/\.zip$/i.test(outerName)) continue

      let outerZip: AdmZip
      try {
        outerZip = new AdmZip(path.join(yearPath, outerName))
      } catch {
        continue
      }

      // Find inner zip files
      for (const entry of outerZip.getEntries()) {
        if (entry.isDirectory) continue
        if (!/^OR\d{6}\.zip$/i.test(path.basename(entry.entryName))) continue

        const tmpZip = path.join(os.tmpdir(), `or_temp_${Date.now()}_${Math.random()}.zip`)
        try {
          const outerBuf: Buffer = (entry as any).getData(OR_ZIP_PASSWORD)
          fs.writeFileSync(tmpZip, outerBuf)

          let innerZip: AdmZip
          try {
            innerZip = new AdmZip(tmpZip)
          } catch {
            continue
          }

          // Find the specific file
          for (const file of innerZip.getEntries()) {
            if (file.isDirectory) continue
            if (path.basename(file.entryName).toLowerCase() !== filename.toLowerCase()) continue
            if (!/\.or$/i.test(file.entryName)) continue

            const fileBuf: Buffer = (file as any).getData(OR_ZIP_PASSWORD)
            if (!fileBuf) continue

            return fileBuf.toString('utf8')
          }
        } finally {
          try {
            fs.unlinkSync(tmpZip)
          } catch {}
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting ${filename} from ${branchPath}:`, error)
  }

  return null
}

/**
 * Reconciles OR files to hit target amount
 * @param branchPath - Path to the branch directory containing year/zip structure
 * @param targetAmount - Target total amount (will stop at closest value without going below)
 * @param outputBasePath - Base path where reconciled files will be saved
 */
export async function reconcileOrFiles(
  branchPath: string,
  targetAmount: number,
  outputBasePath: string,
  filters?: { from?: string; to?: string },
  minHighValue = 0,
  maxLowValue = Number.POSITIVE_INFINITY
): Promise<{ processed: number; totalAmount: number; message: string }> {
  console.log(
    `Starting reconciliation with target: ${targetAmount}, minHighValue: ${minHighValue}, maxLowValue: ${maxLowValue}`
  )

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

  const db = getDb()

  const cashRecords = db
    .prepare(`
      SELECT id, branch, filename, month, year, amount, payment_type
      FROM or_records
      WHERE payment_type = 'Cash'
      ORDER BY amount DESC NULLS LAST
    `)
    .all() as OrRecord[]

  const nonCashRecords = db
    .prepare(`
      SELECT id, branch, filename, month, year, amount, payment_type
      FROM or_records
      WHERE payment_type = 'Non Cash'
      ORDER BY amount DESC NULLS LAST
    `)
    .all() as OrRecord[]

  const totalRecords = cashRecords.length + nonCashRecords.length
  if (totalRecords < 2) {
    return {
      processed: 0,
      totalAmount: 0,
      message: 'Not enough records to reconcile'
    }
  }

  console.log(`Extracting ${totalRecords} receipt files...`)
  const enrichedRecordsByType: Record<string, OrRecord[]> = {
    Cash: cashRecords.map((record) => ({
      ...record,
      fileContent: extractOrFileContent(branchPath, record.year, record.filename)
    })),
    'Non Cash': nonCashRecords.map((record) => ({
      ...record,
      fileContent: extractOrFileContent(branchPath, record.year, record.filename)
    }))
  }

  const outputDir = path.join(outputBasePath, path.basename(branchPath))
  fs.mkdirSync(outputDir, { recursive: true })

  const paymentTypes = ['Cash', 'Non Cash']
  let typeIndex = 0
  let currentRecords = enrichedRecordsByType[paymentTypes[typeIndex]]
  let leftIdx = 0
  let rightIdx = currentRecords.length - 1

  let totalAmount = 0
  let pairsProcessed = 0
  const modifiedFiles = new Map<string, string>()

  while (totalAmount < targetAmount) {
    if (!currentRecords || currentRecords.length < 2 || leftIdx >= rightIdx) {
      if (typeIndex + 1 < paymentTypes.length) {
        typeIndex += 1
        currentRecords = enrichedRecordsByType[paymentTypes[typeIndex]]
        leftIdx = 0
        rightIdx = currentRecords.length - 1
        continue
      }
      break
    }

    const highestRecord = currentRecords[leftIdx]
    const lowestRecord = currentRecords[rightIdx]

    if (!highestRecord || !lowestRecord) break

    const highestAmount = highestRecord.amount ?? 0
    const lowestAmount = lowestRecord.amount ?? 0

    if (highestRecord.amount === null) {
      leftIdx++
      continue
    }

    if (highestAmount < minHighValue) {
      if (typeIndex + 1 < paymentTypes.length) {
        typeIndex += 1
        currentRecords = enrichedRecordsByType[paymentTypes[typeIndex]]
        leftIdx = 0
        rightIdx = currentRecords.length - 1
        continue
      }
      break
    }

    if (lowestRecord.amount === null) {
      rightIdx--
      continue
    }

    if (lowestAmount > maxLowValue) {
      if (rightIdx !== currentRecords.length - 1) {
        rightIdx = currentRecords.length - 1
        continue
      }
      break
    }

    if (!highestRecord.fileContent || !lowestRecord.fileContent) {
      if (!highestRecord.fileContent) leftIdx++
      if (!lowestRecord.fileContent) rightIdx--
      continue
    }

    const highestBody = extractReceiptBody(highestRecord.fileContent)
    const lowestBody = extractReceiptBody(lowestRecord.fileContent)

    if (!highestBody || !lowestBody) {
      leftIdx++
      rightIdx--
      continue
    }

    const modifiedContent = replaceReceiptBody(highestRecord.fileContent, lowestBody)
    modifiedFiles.set(getFileKey(highestRecord.year, highestRecord.month, highestRecord.filename), modifiedContent)

    totalAmount += lowestAmount
    pairsProcessed++

    console.log(
      `Pair ${pairsProcessed}: ${paymentTypes[typeIndex]} highest(${highestRecord.id}) amount=${highestAmount} paired with lowest(${lowestRecord.id}) amount=${lowestAmount}. Total: ${totalAmount}`
    )

    leftIdx++
    rightIdx--
  }

  const totalCopied = copyAllOrSrFilesFromBranch(branchPath, outputDir, modifiedFiles, fromDate, toDate)

  return {
    processed: totalCopied,
    totalAmount,
    message: `Reconciliation complete. Processed ${pairsProcessed} pairs and copied ${totalCopied} files into ${outputDir}. Total amount: ${totalAmount.toFixed(2)}`
  }
}

/**
 * Reconciles with configurable target
 */
export function reconcileWithTarget(
  branchPath: string,
  targetAmount: number,
  outputBasePath: string,
  filters?: { from?: string; to?: string },
  minHighValue = 0,
  maxLowValue = Number.POSITIVE_INFINITY
): Promise<{ processed: number; totalAmount: number; message: string }> {
  return reconcileOrFiles(branchPath, targetAmount, outputBasePath, filters, minHighValue, maxLowValue)
}
