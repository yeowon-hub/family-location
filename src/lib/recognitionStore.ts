import { extractRecognitionFromScan } from '@/lib/gs1Parser'
import { drugNamesMatch } from '@/lib/drugNameCompare'
import type { RecognitionChar } from '@/types/fluidVerify'
import { recognitionKey } from '@/types/fluidVerify'

const STORAGE_KEY = 'family-location:recognition-chars'

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** 구버전 codePattern → companyCode/itemCode 마이그레이션 */
function migrateEntry(entry: RecognitionChar & { codePattern?: string }): RecognitionChar {
  const kind: RecognitionChar['kind'] = entry.kind ?? 'fluid'

  if (entry.companyCode && entry.itemCode) {
    return {
      id: entry.id,
      kind,
      labelFluidName: entry.labelFluidName,
      fluidName: entry.fluidName,
      volumeMl: entry.volumeMl,
      volumeLabel: entry.volumeLabel,
      companyCode: normalizeDigits(entry.companyCode),
      itemCode: normalizeDigits(entry.itemCode),
      memo: entry.memo,
      createdAt: entry.createdAt,
    }
  }

  if (entry.codePattern) {
    const fromGs1 = extractRecognitionFromScan(entry.codePattern)
    if (fromGs1) {
      return {
        ...entry,
        kind,
        companyCode: fromGs1.companyCode,
        itemCode: fromGs1.itemCode,
      }
    }
    const digits = normalizeDigits(entry.codePattern)
    if (digits.length >= 9) {
      return {
        ...entry,
        kind,
        companyCode: digits.slice(0, 4),
        itemCode: digits.slice(4, 9),
      }
    }
  }

  return {
    ...entry,
    kind,
    companyCode: normalizeDigits(entry.companyCode ?? ''),
    itemCode: normalizeDigits(entry.itemCode ?? ''),
  }
}

export function loadRecognitionChars(): RecognitionChar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as (RecognitionChar & { codePattern?: string })[]
    return Array.isArray(parsed) ? parsed.map(migrateEntry) : []
  } catch {
    return []
  }
}

export function saveRecognitionChars(entries: RecognitionChar[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function findRecognitionByCode(
  code: string,
  entries: RecognitionChar[],
  kind?: RecognitionChar['kind'],
): RecognitionChar | null {
  const extracted = extractRecognitionFromScan(code)
  if (!extracted) return null

  const pool = kind ? entries.filter((e) => e.kind === kind) : entries
  const { companyCode, itemCode } = extracted
  const key = companyCode + itemCode

  return (
    pool.find(
      (entry) =>
        recognitionKey(entry) === key ||
        (entry.companyCode === companyCode && entry.itemCode === itemCode),
    ) ?? null
  )
}

export function findChemoRecognition(
  labelDrugName: string,
  code: string,
  entries: RecognitionChar[],
): RecognitionChar | null {
  const matched = findRecognitionByCode(code, entries, 'chemo')
  if (!matched) return null
  if (!drugNamesMatch(labelDrugName, matched.labelFluidName)) return null
  return matched
}

export function recognitionToFluid(entry: RecognitionChar, rawCode: string) {
  return {
    raw: rawCode,
    name: entry.fluidName,
    volumeMl: entry.volumeMl,
    volumeLabel: entry.volumeLabel,
  }
}

export function createRecognitionChar(
  input: Omit<RecognitionChar, 'id' | 'createdAt'>,
): RecognitionChar {
  return {
    ...input,
    kind: input.kind ?? 'fluid',
    companyCode: normalizeDigits(input.companyCode),
    itemCode: normalizeDigits(input.itemCode),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
}

export function exportRecognitionCharsJson(entries: RecognitionChar[]): string {
  return JSON.stringify(entries, null, 2)
}

export function importRecognitionCharsJson(json: string): RecognitionChar[] {
  const parsed = JSON.parse(json) as (RecognitionChar & { codePattern?: string })[]
  if (!Array.isArray(parsed)) throw new Error('올바른 인식문자 목록이 아닙니다.')
  return parsed.map((entry) =>
    migrateEntry({
      ...entry,
      id: entry.id || crypto.randomUUID(),
      createdAt: entry.createdAt || new Date().toISOString(),
    }),
  )
}

export { extractRecognitionFromScan }
