import { parseGs1Serial } from '@/lib/gs1Parser'

/** GS1 DataMatrix / 일련번호 형태인지 */
export function looksLikeGs1Serial(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/\(01\)/.test(trimmed)) return true
  if (/^01\d{14}/.test(trimmed.replace(/\s/g, ''))) return true
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 14 && parseGs1Serial(trimmed)) return true
  return false
}

export function cleanScanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
