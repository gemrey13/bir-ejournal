import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import { getDb } from './utils'

const OR_ZIP_PASSWORD = 'admate'

interface OrRecord {
  id: number
  branch: string
  filename: string
  month: number
  year: number
  amount: number | null
  payment_type: string | null
  fileContent?: string
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

/**
 * Extracts a specific OR file from the zip structure
 */
function extractOrFileContent(
  branchPath: string,
  year: number,
  month: number,
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
  outputBasePath: string
): Promise<{ processed: number; totalAmount: number; message: string }> {
  console.log(`Starting reconciliation with target: ${targetAmount}`)

  const db = getDb()

  // Get all cash payment records from DB, sorted by amount DESC
  const records = db
    .prepare(`
      SELECT id, branch, filename, month, year, amount, payment_type
      FROM or_records
      WHERE payment_type = 'Cash'
      ORDER BY amount DESC NULLS LAST
    `)
    .all() as OrRecord[]

  if (records.length < 2) {
    return {
      processed: 0,
      totalAmount: 0,
      message: 'Not enough cash records to reconcile'
    }
  }

  // Extract file contents for all records
  console.log(`Extracting ${records.length} cash receipt files...`)
  const enrichedRecords = records.map((record) => ({
    ...record,
    fileContent: extractOrFileContent(branchPath, record.year, record.month, record.filename)
  }))

  let totalAmount = 0
  let pairsProcessed = 0
  const processedFiles: Set<number> = new Set()
  const outputDir = path.join(outputBasePath, `reconciled_${Date.now()}`)
  fs.mkdirSync(outputDir, { recursive: true })

  let leftIdx = 0 // Highest amounts
  let rightIdx = enrichedRecords.length - 1 // Lowest amounts

  while (leftIdx < rightIdx && totalAmount < targetAmount) {
    const highestRecord = enrichedRecords[leftIdx]
    const lowestRecord = enrichedRecords[rightIdx]

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

    // Replace highest's body with lowest's body
    const modifiedContent = replaceReceiptBody(highestRecord.fileContent, lowestBody)

    // Create output directory structure: year/month
    const monthStr = String(highestRecord.month).padStart(2, '0')
    const yearDir = path.join(outputDir, String(highestRecord.year), monthStr)
    fs.mkdirSync(yearDir, { recursive: true })

    // Save modified file with same filename
    const outputFile = path.join(yearDir, highestRecord.filename)
    fs.writeFileSync(outputFile, modifiedContent, 'utf8')

    // Track total (use lowest amount since that's what the file now contains)
    const lowestAmount = lowestRecord.amount || 0
    totalAmount += lowestAmount

    processedFiles.add(highestRecord.id)
    processedFiles.add(lowestRecord.id)
    pairsProcessed++

    console.log(
      `Pair ${pairsProcessed}: Highest(${highestRecord.id}) amount=${highestRecord.amount} paired with Lowest(${lowestRecord.id}) amount=${lowestAmount}. Total: ${totalAmount}`
    )

    leftIdx++
    rightIdx--

    // Check if we've reached target
    if (totalAmount >= targetAmount) {
      break
    }
  }

  // Copy remaining unprocessed files
  let remainingCopied = 0
  for (const record of enrichedRecords) {
    if (processedFiles.has(record.id)) continue
    if (!record.fileContent) continue

    const monthStr = String(record.month).padStart(2, '0')
    const yearDir = path.join(outputDir, String(record.year), monthStr)
    fs.mkdirSync(yearDir, { recursive: true })

    const outputFile = path.join(yearDir, record.filename)
    fs.writeFileSync(outputFile, record.fileContent, 'utf8')
    remainingCopied++
  }

  return {
    processed: pairsProcessed * 2 + remainingCopied,
    totalAmount,
    message: `Reconciliation complete. Processed ${pairsProcessed} pairs, copied ${remainingCopied} remaining files. Total amount: ${totalAmount.toFixed(2)}`
  }
}

/**
 * Reconciles with configurable target
 */
export function reconcileWithTarget(
  branchPath: string,
  targetAmount: number,
  outputBasePath: string
): Promise<{ processed: number; totalAmount: number; message: string }> {
  return reconcileOrFiles(branchPath, targetAmount, outputBasePath)
}
