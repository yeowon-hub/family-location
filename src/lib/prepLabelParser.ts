import { parseFluidText } from '@/lib/ivFluidParser'

export interface PrepLabelDrugRow {
  name: string
  raw: string
}

export interface PrepLabelParsed {
  raw: string
  rows: PrepLabelDrugRow[]
  fluid: PrepLabelDrugRow | null
  chemoDrugs: PrepLabelDrugRow[]
}

const HEADER_PATTERN = /약품명|횟수|용법|1회량|조제/i

/** Water for inj 등 — 조제검증 대상에서 제외 */
export function isVerificationExcluded(name: string): boolean {
  const key = name.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '')
  return (
    /waterforinj/i.test(key) ||
    /waterforinjection/i.test(key) ||
    /주사용수/i.test(key) ||
    /^wfij/i.test(key)
  )
}

export function extractDrugNameFromRow(row: string): string {
  let line = row.replace(/\s+/g, ' ').trim()
  if (!line || HEADER_PATTERN.test(line)) return ''

  line = line.replace(/\s+CHD\s*$/i, '').trim()
  line = line.replace(
    /\s+\d+\s+(?:\(?[\d.]+(?:mg|g|ml|mL|L)\)?\s*)+(?:\([\d.]+ml\))?\s*$/i,
    '',
  )
  line = line.replace(/\s+\d+\s+[\d.]+\s*(?:mg|g|ml|mL|L)\s*(\([\d.]+ml\))?\s*$/i, '')
  line = line.replace(/\s+\d+\s+[\d.]+\s*(?:ml|mL|L)\s*$/i, '')
  line = line.replace(/\s+\d+\s*$/, '')

  return line.trim()
}

function splitLabelLines(text: string): string[] {
  const raw = text.trim()
  if (!raw) return []

  const fromNewlines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !HEADER_PATTERN.test(line))

  if (fromNewlines.length > 1) return fromNewlines

  const fromDelimiters = raw
    .split(/[\t|;]+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !HEADER_PATTERN.test(line))

  if (fromDelimiters.length > 1) return fromDelimiters

  const singleLine = raw.replace(/\s+/g, ' ').trim()
  const fromManufacturers = singleLine
    .split(/(?<=\))\s*(?:W\d+)?\s+(?=[A-Za-z가-힣0-9])/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !HEADER_PATTERN.test(line))

  if (fromManufacturers.length > 1) return fromManufacturers

  if (fromNewlines.length === 1) return fromNewlines

  return singleLine && !HEADER_PATTERN.test(singleLine) ? [singleLine] : []
}

export function parsePrepLabel(text: string): PrepLabelParsed {
  const raw = text.trim()
  const lineTexts = splitLabelLines(raw)

  const rows: PrepLabelDrugRow[] = lineTexts
    .map((line) => {
      const name = extractDrugNameFromRow(line)
      return name ? { name, raw: line } : null
    })
    .filter((row): row is PrepLabelDrugRow => row != null)

  if (rows.length === 0) {
    const single = extractDrugNameFromRow(raw) || raw
    return {
      raw,
      rows: single ? [{ name: single, raw }] : [],
      fluid: single ? { name: single, raw } : null,
      chemoDrugs: [],
    }
  }

  const fluid = rows.at(-1) ?? null
  const chemoDrugs = (rows.length > 1 ? rows.slice(0, -1) : []).filter(
    (row) => !isVerificationExcluded(row.name),
  )

  return { raw, rows, fluid, chemoDrugs }
}

export function extractFluidLineFromLabel(text: string): string {
  const parsed = parsePrepLabel(text)
  return parsed.fluid?.name ?? extractDrugNameFromRow(text) ?? text.trim()
}

export function fluidPreviewFromLabel(text: string) {
  return parseFluidText(extractFluidLineFromLabel(text))
}
