import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import AdmZip from 'adm-zip'
import PDFDocument from 'pdfkit'
import { getDb, parseInnerZip, parseMonthYear, isMonthYearInRange, monthYearValue, extractReceiptBody, replaceReceiptBody, getFileKey, buildOutputFilePath } from './utils'
import { OrRecord } from './main'
import Database from 'better-sqlite3'

const OR_ZIP_PASSWORD = 'admate'

async function createPdfBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 32, size: 'A4' })
    const buffers: Buffer[] = []

    doc.on('data', (chunk) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    // Clean up encoding issues: replace special characters with proper line breaks
    // The Ð character often represents a line break that wasn't properly handled
    const cleanedText = text
      .replace(/[ÐðŃ]/g, '\n') // Replace weird symbols with line breaks
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim()

    doc.font('Courier').fontSize(9).text(cleanedText, {
      lineGap: 1,
      paragraphGap: 0,
      continued: false,
      align: 'left'
    })
    doc.end()
  })
}

function buildPdfOutputFilePath(outputPdfDir: string, year: number, month: number, filename: string, isSrFile = false): string {
  const monthStr = String(month).padStart(2, '0')
  const yearDir = path.join(outputPdfDir, String(year), monthStr)
  fs.mkdirSync(yearDir, { recursive: true })

  // For SR files, preserve the SR extension: 088812.SR.pdf
  // For OR files, just use the base name: 088812.pdf
  const baseName = path.basename(filename, path.extname(filename))
  const pdfName = isSrFile ? `${baseName}.SR.pdf` : `${baseName}.pdf`

  return path.join(yearDir, pdfName)
}

async function copyAllOrSrFilesFromBranch(
  branchPath: string,
  outputDir: string,
  overrides: Map<string, string>,
  fromDate: ReturnType<typeof parseMonthYear>,
  toDate: ReturnType<typeof parseMonthYear>,
  enablePdfOutput = false
): Promise<number> {
  const tmpDir = path.join(os.tmpdir(), `or_copy_${Date.now()}`)
  const outputPdfDir = enablePdfOutput ? path.join(path.dirname(outputDir), `${path.basename(outputDir)}-pdf`) : undefined
  if (outputPdfDir) fs.mkdirSync(outputPdfDir, { recursive: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  let copied = 0

  // Remove any existing month output folders for this branch and date range
  const monthDirsToDelete = new Set<string>()
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
        if (!isMonthYearInRange(info, fromDate, toDate)) continue

        const monthDir = path.join(outputDir, yearFolder, String(info.month).padStart(2, '0'))
        monthDirsToDelete.add(monthDir)
      }
    }
  }

  for (const monthDir of monthDirsToDelete) {
    try {
      fs.rmSync(monthDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup failures and continue copying
    }
  }

  if (outputPdfDir) {
    for (const monthDir of monthDirsToDelete) {
      const pdfMonthDir = path.join(outputPdfDir, path.relative(outputDir, monthDir))
      try {
        fs.rmSync(pdfMonthDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup failures and continue copying
      }
    }
  }

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
              const isOrFile = /\.or$/i.test(filename)
              const isSrFile = /\.sr$/i.test(filename)

              const buf: Buffer = (file as any).getData(OR_ZIP_PASSWORD)
              if (!buf) continue

              const outputContent = overrides.has(key) ? overrides.get(key)! : buf.toString('utf8')
              if (overrides.has(key) && isOrFile) {
                const originalExt = path.extname(filename)
                const oldFilename = `${path.basename(filename, originalExt)}-OLD${originalExt.toUpperCase()}`
                const oldFilePath = path.join(path.dirname(outputFile), oldFilename)
                fs.writeFileSync(oldFilePath, buf)
              }

              if (isOrFile) {
                fs.writeFileSync(outputFile, outputContent, 'utf8')
              } else {
                fs.writeFileSync(outputFile, buf)
              }

              // Generate PDF for both OR and SR files if PDF output is enabled
              if (outputPdfDir && (isOrFile || isSrFile)) {
                const pdfFilePath = buildPdfOutputFilePath(outputPdfDir, info.year, info.month, filename, isSrFile)
                try {
                  const pdfBuffer = await createPdfBuffer(outputContent)
                  fs.writeFileSync(pdfFilePath, pdfBuffer)
                } catch (err) {
                  console.error(`Error generating PDF for ${filename}:`, err)
                }
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

function extractOrFileContentsMap(branchPath: string, records: OrRecord[], fromDate: ReturnType<typeof parseMonthYear>, toDate: ReturnType<typeof parseMonthYear>): Map<string, string> {
  const neededKeys = new Set<string>()
  for (const record of records) {
    neededKeys.add(getFileKey(record.year, record.month, record.filename))
  }

  const contents = new Map<string, string>()
  if (neededKeys.size === 0) return contents

  const yearSet = new Set<number>(records.map((record) => record.year))

  for (const yearFolder of fs.readdirSync(branchPath)) {
    if (!/^\d{4}$/.test(yearFolder)) continue
    const yearNumber = parseInt(yearFolder, 10)
    if (!yearSet.has(yearNumber)) continue
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
        if (!isMonthYearInRange(info, fromDate, toDate)) continue

        let innerZip: AdmZip
        try {
          const outerBuf: Buffer = (entry as any).getData(OR_ZIP_PASSWORD)
          innerZip = new AdmZip(outerBuf)
        } catch {
          continue
        }

        for (const file of innerZip.getEntries()) {
          if (file.isDirectory) continue
          if (!/\.or$/i.test(file.entryName)) continue

          const filename = path.basename(file.entryName)
          const key = getFileKey(info.year, info.month, filename)
          if (!neededKeys.has(key) || contents.has(key)) continue

          try {
            const fileBuf: Buffer = (file as any).getData(OR_ZIP_PASSWORD)
            if (!fileBuf) continue
            contents.set(key, fileBuf.toString('utf8'))
          } catch {
            continue
          }

          if (contents.size === neededKeys.size) return contents
        }
      }
    }
  }

  return contents
}

/**
 * Reconciles OR files to hit target amount
 * @param branchPath - Path to the branch directory containing year/zip structure
 * @param targetAmount - Target total amount (will stop at closest value without going below)
 * @param outputBasePath - Base path where reconciled files will be saved
 * @param filters - Optional date filters
 * @param minHighValue - Minimum value for high records
 * @param maxLowValue - Maximum value for low records
 * @param includeSrBill - Whether to include Sr Bill records in reconciliation (default: true)
 * @param enablePdfOutput - Whether to enable PDF output (default: false)
 * @param dbPath - Path to the database file (default: uses default database)
 */
export async function reconcileOrFiles(
  branchPath: string,
  targetAmount: number,
  outputBasePath: string,
  filters?: { from?: string; to?: string },
  minHighValue = 0,
  maxLowValue = Number.POSITIVE_INFINITY,
  minLowValue = Number.NEGATIVE_INFINITY,
  includeSrBill?: boolean,
  enablePdfOutput = false,
  dbPath?: string
): Promise<{ processed: number; totalAmount: number; totalRecordAmount: any; pairsProcessed: number }> {
  console.log(`Starting reconciliation with target: ${targetAmount}, minHighValue: ${minHighValue}, maxLowValue: ${maxLowValue}`)

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

  const db = dbPath ? new Database(dbPath) : getDb()

  const hasDateFilter = Boolean(fromDate || toDate)
  const dateFilterClause = hasDateFilter ? 'AND (year * 100 + month) BETWEEN @fromValue AND @toValue' : ''
  const paymentTypeFilter = includeSrBill ? "('Cash', 'Non Cash', 'Sr Bill')" : "('Cash', 'Non Cash')"
  const queryParams = {
    fromValue: fromDate ? monthYearValue(fromDate) : 0,
    toValue: toDate ? monthYearValue(toDate) : 999999
  }

  const allRecords = db
    .prepare(
      `
      SELECT id, branch, filename, month, year, amount, payment_type
      FROM or_records
      WHERE payment_type IN ${paymentTypeFilter}
      ${dateFilterClause}
      ORDER BY amount DESC NULLS LAST
    `
    )
    .all(queryParams) as OrRecord[]

  const totalRecords = allRecords.length
  if (totalRecords < 2) {
    return {
      processed: 0,
      totalAmount: 0,
      totalRecordAmount: 0,
      pairsProcessed: 0
    }
  }

  console.log(`Extracting ${totalRecords} receipt files...`)
  const fileContentMap = extractOrFileContentsMap(branchPath, allRecords, fromDate, toDate)
  const enrichedRecords = allRecords.map((record) => ({
    ...record,
    fileContent: fileContentMap.get(getFileKey(record.year, record.month, record.filename)) ?? null
  }))

  const outputDir = path.join(outputBasePath, path.basename(branchPath))
  fs.mkdirSync(outputDir, { recursive: true })

  const availableRecords = enrichedRecords.filter((record) => record.amount !== null)

  // Exclude Sr Bill from low records if includeSrBill is false
  const lowRecordsCandidates = includeSrBill ? availableRecords : availableRecords.filter((record) => record.payment_type !== 'Sr Bill')

  const lowRecords = [...lowRecordsCandidates].sort((a, b) => (a.amount! as number) - (b.amount! as number))
  const highCashNonCashRecords = [...availableRecords]
    .filter((record) => record.payment_type === 'Cash' || record.payment_type === 'Non Cash')
    .sort((a, b) => (b.amount! as number) - (a.amount! as number))
  const highSrBillRecords = includeSrBill ? [...availableRecords].filter((record) => record.payment_type === 'Sr Bill').sort((a, b) => (b.amount! as number) - (a.amount! as number)) : []

  let totalAmount = 0
  let pairsProcessed = 0
  const modifiedFiles = new Map<string, string>()

  const usedHigh = new Set<number>()
  let highStage = 0 // 0 = Cash/Non Cash, 1 = Sr Bill (only if includeSrBill is true)
  let highIdx = 0
  let lowIdx = 0

  function findNextLowIndex(startIndex: number, highestId: number): number | null {
    if (lowRecords.length === 0) return null
    let attempts = 0
    let idx = startIndex

    while (attempts < lowRecords.length) {
      const record = lowRecords[idx]
      if (record.amount !== null && record.amount <= maxLowValue && record.amount >= minLowValue && record.id !== highestId) {
        return idx
      }
      idx = (idx + 1) % lowRecords.length
      attempts++
    }

    return null
  }

  while (totalAmount < targetAmount) {
    const currentHighRecords = highStage === 0 ? highCashNonCashRecords : highSrBillRecords

    while (highIdx < currentHighRecords.length && (currentHighRecords[highIdx].amount === null || usedHigh.has(currentHighRecords[highIdx].id))) {
      highIdx++
    }

    if (highIdx >= currentHighRecords.length) {
      if (highStage === 0 && includeSrBill && highSrBillRecords.length > 0) {
        highStage = 1
        highIdx = 0
        continue
      }
      break
    }

    const highestRecord = currentHighRecords[highIdx]
    if (!highestRecord) break

    const nextLowIdx = findNextLowIndex(lowIdx, highestRecord.id)
    if (nextLowIdx === null) break

    lowIdx = nextLowIdx
    const lowestRecord = lowRecords[lowIdx]
    if (!lowestRecord) break

    const highestAmount = highestRecord.amount ?? 0
    const lowestAmount = lowestRecord.amount ?? 0

    if (highestAmount < minHighValue) {
      highIdx++
      continue
    }
    if (lowestAmount > maxLowValue || lowestAmount < minLowValue) {
      lowIdx = (lowIdx + 1) % lowRecords.length
      continue
    }

    if (!highestRecord.fileContent || !lowestRecord.fileContent) {
      if (!highestRecord.fileContent) highIdx++
      if (!lowestRecord.fileContent) {
        lowIdx = (lowIdx + 1) % lowRecords.length
      }
      continue
    }

    const highestBody = extractReceiptBody(highestRecord.fileContent)
    const lowestBody = extractReceiptBody(lowestRecord.fileContent)
    if (!highestBody || !lowestBody) {
      if (!highestBody) highIdx++
      lowIdx = (lowIdx + 1) % lowRecords.length
      continue
    }

    const modifiedContent = replaceReceiptBody(highestRecord.fileContent, lowestBody)
    modifiedFiles.set(getFileKey(highestRecord.year, highestRecord.month, highestRecord.filename), modifiedContent)

    try {
      db.prepare(`UPDATE or_records SET amount = @amount WHERE id = @id`).run({ amount: lowestAmount, id: highestRecord.id })
    } catch (err) {
      console.error(`Failed to update DB for id=${highestRecord.id}:`, err)
    }

    totalAmount += lowestAmount
    pairsProcessed++
    usedHigh.add(highestRecord.id)

    console.log(
      `Pair ${pairsProcessed}: ${highStage === 0 ? 'Cash/Non Cash' : includeSrBill ? 'Sr Bill' : ''} highest(${highestRecord.filename}) amount=${highestAmount} paired with lowest(${lowestRecord.filename}) amount=${lowestAmount}. Total: ${totalAmount}`
    )

    highIdx++
    lowIdx = (lowIdx + 1) % lowRecords.length
  }

  const totalCopied = await copyAllOrSrFilesFromBranch(branchPath, outputDir, modifiedFiles, fromDate, toDate, enablePdfOutput)

  const totalRecordAmountsample = db
    .prepare(
      `
    SELECT sum(amount) AS total FROM or_records
    `
    )
    .get() as any

  try {
    db.prepare(`DELETE FROM or_records`).run()
  } catch (err) {
    console.error(`Failed to delete records:`, err)
  }

  const totalRecordAmount = totalRecordAmountsample ? totalRecordAmountsample.total : 0
  console.log('********************************************************')
  console.log(`Total Amount: ${totalRecordAmount}`)
  console.log('********************************************************')
  return {
    processed: totalCopied,
    totalAmount,
    totalRecordAmount,
    pairsProcessed
  }
}
