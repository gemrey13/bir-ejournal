export type MonthYear = { year: number; month: number }

export type ScanFilters = {
  from?: string
  to?: string
}

export interface OrRecord {
  id: number
  branch: string
  filename: string
  month: number
  year: number
  amount: number | null
  payment_type: string | null
  fileContent?: string | null
}
