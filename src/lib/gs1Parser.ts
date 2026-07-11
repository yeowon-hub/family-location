/** GS1 GTIN-14 (대한민국 의약품) 파싱 결과 */
export interface Gtin14Parsed {
  raw: string
  /** 물류 식별자 (0=낱개) */
  packagingUnit: string
  /** 국가코드 (880=대한민국) */
  countryCode: string
  /** 제약업체 코드 */
  companyCode: string
  /** 품목 코드 (상품명·규격) */
  itemCode: string
  /** 검증 번호 */
  checkDigit: string
  /** 계산된 검증 번호와 일치 여부 */
  checkDigitValid: boolean
  /** 공식으로 계산한 검증 번호 */
  expectedCheckDigit: string
  /** 업체코드+품목코드 = 인식문자 */
  recognitionKey: string
}

export interface Gs1SerialParsed {
  raw: string
  gtin14: string
  gtin: Gtin14Parsed
  expirationRaw?: string
  expirationLabel?: string
  lot?: string
  serial?: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export interface CheckDigitBreakdown {
  oddSum: number
  evenSum: number
  oddWeighted: number
  total: number
  expected: number
  actual: number
  valid: boolean
}

/**
 * GTIN 검증번호(Check Digit) 계산
 * 홀수 자리(1,3,5…) 합 × 3 + 짝수 자리(2,4,6…) 합 → 10의 배수로 올림 후 차 = 검증번호
 */
export function calculateGtinCheckDigit(first13: string): number | null {
  const digits = digitsOnly(first13)
  if (digits.length !== 13) return null

  let oddSum = 0
  let evenSum = 0
  for (let i = 0; i < 13; i++) {
    const n = Number.parseInt(digits[i], 10)
    if (Number.isNaN(n)) return null
    if (i % 2 === 0) oddSum += n
    else evenSum += n
  }

  const total = oddSum * 3 + evenSum
  return (10 - (total % 10)) % 10
}

export function explainCheckDigit(gtin14: string): CheckDigitBreakdown | null {
  const digits = digitsOnly(gtin14)
  if (digits.length !== 14) return null

  let oddSum = 0
  let evenSum = 0
  for (let i = 0; i < 13; i++) {
    const n = Number.parseInt(digits[i], 10)
    if (i % 2 === 0) oddSum += n
    else evenSum += n
  }

  const oddWeighted = oddSum * 3
  const total = oddWeighted + evenSum
  const expected = calculateGtinCheckDigit(digits.slice(0, 13))
  const actual = Number.parseInt(digits[13], 10)
  if (expected == null || Number.isNaN(actual)) return null

  return {
    oddSum,
    evenSum,
    oddWeighted,
    total,
    expected,
    actual,
    valid: expected === actual,
  }
}

export function validateGtinCheckDigit(gtin14: string): boolean {
  return explainCheckDigit(gtin14)?.valid ?? false
}

/** GTIN-14 → 업체코드(4) + 품목코드(5) + 검증(1), 국가 880 기준 */
export function parseGtin14(gtin: string): Gtin14Parsed | null {
  const digits = digitsOnly(gtin)
  if (digits.length !== 14) return null

  const packagingUnit = digits[0]
  const countryCode = digits.slice(1, 4)
  const companyCode = digits.slice(4, 8)
  const itemCode = digits.slice(8, 13)
  const checkDigit = digits[13]
  const expected = calculateGtinCheckDigit(digits.slice(0, 13))
  const expectedCheckDigit = expected != null ? String(expected) : ''

  return {
    raw: digits,
    packagingUnit,
    countryCode,
    companyCode,
    itemCode,
    checkDigit,
    checkDigitValid: expected != null && checkDigit === expectedCheckDigit,
    expectedCheckDigit,
    recognitionKey: companyCode + itemCode,
  }
}

function formatExpiration(yymmdd: string): string {
  if (yymmdd.length !== 6) return yymmdd
  const yy = yymmdd.slice(0, 2)
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  return `20${yy}-${mm}-${dd}`
}

/** GS1 (17) YYMMDD → Date (해당일 23:59:59까지 유효) */
export function parseExpirationDate(yymmdd: string): Date | null {
  if (yymmdd.length !== 6) return null
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10)
  const mm = Number.parseInt(yymmdd.slice(2, 4), 10) - 1
  const dd = Number.parseInt(yymmdd.slice(4, 6), 10)
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null
  return new Date(2000 + yy, mm, dd, 23, 59, 59, 999)
}

/** 오늘 날짜 기준 유효기간 경과 여부 (당일까지는 유효) */
export function isExpirationExpired(yymmdd: string, today = new Date()): boolean {
  const expiration = parseExpirationDate(yymmdd)
  if (!expiration) return false
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return todayStart.getTime() > expiration.getTime()
}

export function formatTodayLabel(today = new Date()): string {
  return today.toLocaleDateString('ko-KR')
}

/** GS1 DataMatrix / 바코드 문자열 파싱 */
export function parseGs1Serial(text: string): Gs1SerialParsed | null {
  const raw = text.trim()
  if (!raw) return null

  const gtinFromAi = raw.match(/\(01\)(\d{14})/)?.[1]
  const expFromAi = raw.match(/\(17\)(\d{6})/)?.[1]
  const lotFromAi = raw.match(/\(10\)([^(\x1d]+)/)?.[1]?.trim()
  const serialFromAi = raw.match(/\(21\)([^(\x1d]+)/)?.[1]?.trim()

  let gtin14 = gtinFromAi

  if (!gtin14) {
    const embedded = raw.match(/\d{14}/)
    if (embedded) gtin14 = embedded[0]
  }

  if (!gtin14) return null

  const gtin = parseGtin14(gtin14)
  if (!gtin) return null

  return {
    raw,
    gtin14,
    gtin,
    expirationRaw: expFromAi,
    expirationLabel: expFromAi ? formatExpiration(expFromAi) : undefined,
    lot: lotFromAi,
    serial: serialFromAi,
  }
}

export function extractRecognitionFromScan(text: string): {
  companyCode: string
  itemCode: string
  recognitionKey: string
  gs1: Gs1SerialParsed | null
} | null {
  const gs1 = parseGs1Serial(text)
  if (gs1) {
    return {
      companyCode: gs1.gtin.companyCode,
      itemCode: gs1.gtin.itemCode,
      recognitionKey: gs1.gtin.recognitionKey,
      gs1,
    }
  }

  const digits = digitsOnly(text)
  if (digits.length >= 9) {
    const companyCode = digits.slice(0, 4)
    const itemCode = digits.slice(4, 9)
    return {
      companyCode,
      itemCode,
      recognitionKey: companyCode + itemCode,
      gs1: null,
    }
  }

  return null
}

export function formatGtinBreakdown(gtin: Gtin14Parsed): string {
  return `${gtin.packagingUnit}|${gtin.countryCode}|${gtin.companyCode}|${gtin.itemCode}|${gtin.checkDigit}`
}
