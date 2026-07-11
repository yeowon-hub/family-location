import { parseFluidText } from '@/lib/ivFluidParser'
import {
  extractRecognitionFromScan,
  findRecognitionByCode,
  recognitionToFluid,
} from '@/lib/recognitionStore'
import { formatTodayLabel, isExpirationExpired } from '@/lib/gs1Parser'
import type { FluidCompareResult, RecognitionChar } from '@/types/fluidVerify'

function volumesEqual(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false
  return Math.abs(a - b) < 1
}

function emptyProduct(code: string) {
  return {
    raw: code,
    name: null,
    volumeMl: null,
    volumeLabel: null,
  }
}

function buildExpiredResult(
  partial: Omit<
    FluidCompareResult,
    'status' | 'isExpired' | 'message' | 'nameMatch' | 'volumeMatch'
  >,
  expirationLabel: string,
): FluidCompareResult {
  return {
    ...partial,
    status: 'expired',
    isExpired: true,
    nameMatch: false,
    volumeMatch: false,
    message: `유효기간 경과: ${expirationLabel} (오늘 ${formatTodayLabel()}) — 사용 불가`,
  }
}

export function compareFluidsWithRecognition(
  labelRaw: string,
  productCodeRaw: string,
  recognitionChars: RecognitionChar[],
): FluidCompareResult {
  const label = parseFluidText(labelRaw)
  const productCode = productCodeRaw.trim()
  const extracted = productCode ? extractRecognitionFromScan(productCode) : null
  const expirationRaw = extracted?.gs1?.expirationRaw
  const expirationLabel = extracted?.gs1?.expirationLabel ?? null
  const expired = expirationRaw ? isExpirationExpired(expirationRaw) : false
  const checkDigitValid = extracted?.gs1?.gtin.checkDigitValid ?? null
  const expectedCheckDigit = extracted?.gs1?.gtin.expectedCheckDigit ?? null

  const base = {
    label,
    productCode,
    scannedCompanyCode: extracted?.companyCode ?? null,
    scannedItemCode: extracted?.itemCode ?? null,
    expirationLabel,
    isExpired: expired,
    checkDigitValid,
    expectedCheckDigit,
  }

  if (!productCode) {
    return {
      ...base,
      status: 'idle',
      product: emptyProduct(productCode),
      matchedRecognition: null,
      nameMatch: false,
      volumeMatch: false,
      message: '조제 라벨과 수액 외피 일련번호를 모두 입력해 주세요.',
    }
  }

  if (checkDigitValid === false && extracted?.gs1) {
    const actual = extracted.gs1.gtin.checkDigit
    return {
      ...base,
      status: 'invalid_checkdigit',
      product: emptyProduct(productCode),
      matchedRecognition: null,
      nameMatch: false,
      volumeMatch: false,
      message: `GTIN 검증번호 오류: 읽은 값 ${actual} ≠ 계산값 ${expectedCheckDigit} — 바코드 재스캔 필요`,
    }
  }

  if (expired && expirationLabel) {
    const matched = findRecognitionByCode(productCode, recognitionChars, 'fluid')
    return buildExpiredResult(
      {
        ...base,
        product: matched ? recognitionToFluid(matched, productCode) : emptyProduct(productCode),
        matchedRecognition: matched,
      },
      expirationLabel,
    )
  }

  if (!labelRaw.trim()) {
    return {
      ...base,
      status: 'idle',
      product: emptyProduct(productCode),
      matchedRecognition: null,
      nameMatch: false,
      volumeMatch: false,
      message: expirationLabel
        ? `유효기간 ${expirationLabel} — 조제 라벨을 읽어 주세요.`
        : '조제 라벨과 수액 외피 일련번호를 모두 입력해 주세요.',
    }
  }

  if (!extracted) {
    return {
      ...base,
      status: 'incomplete',
      product: emptyProduct(productCode),
      matchedRecognition: null,
      nameMatch: false,
      volumeMatch: false,
      message: 'GS1 일련번호에서 GTIN(01) 업체코드·품목코드를 추출하지 못했습니다.',
    }
  }

  const matched = findRecognitionByCode(productCode, recognitionChars, 'fluid')

  if (!matched) {
    return {
      ...base,
      status: 'unregistered',
      product: emptyProduct(productCode),
      matchedRecognition: null,
      nameMatch: false,
      volumeMatch: false,
      message: `인식문자 미등록: 업체 ${extracted.companyCode} · 품목 ${extracted.itemCode}`,
    }
  }

  const product = recognitionToFluid(matched, productCode)
  const hasLabelInfo = Boolean(label.name || label.volumeMl)

  if (!hasLabelInfo) {
    return {
      ...base,
      status: 'incomplete',
      product,
      matchedRecognition: matched,
      nameMatch: false,
      volumeMatch: false,
      message: '조제 라벨에서 수액명·규격을 인식하지 못했습니다.',
    }
  }

  const nameMatch = label.name != null && label.name === matched.fluidName
  const volumeMatch = volumesEqual(label.volumeMl, matched.volumeMl)

  if (nameMatch && volumeMatch) {
    return {
      ...base,
      status: 'match',
      product,
      matchedRecognition: matched,
      nameMatch: true,
      volumeMatch: true,
      message: `일치: ${matched.labelFluidName} ↔ ${matched.companyCode}+${matched.itemCode}${
        expirationLabel ? ` · 유효 ${expirationLabel}` : ''
      }`,
    }
  }

  const mismatches: string[] = []
  if (!nameMatch) {
    mismatches.push(`수액명 (라벨 ${label.name ?? '?'} ≠ 등록 ${matched.fluidName})`)
  }
  if (!volumeMatch) {
    mismatches.push(
      `규격 (라벨 ${label.volumeLabel ?? '?'} ≠ 등록 ${matched.volumeLabel ?? '?'})`,
    )
  }

  return {
    ...base,
    status: 'mismatch',
    product,
    matchedRecognition: matched,
    nameMatch,
    volumeMatch,
    message: `불일치: ${mismatches.join(', ')}`,
  }
}

export function buildRecognitionFromCodes(
  labelFluidName: string,
  companyCode: string,
  itemCode: string,
  kind: RecognitionChar['kind'] = 'fluid',
  memo?: string,
): Omit<RecognitionChar, 'id' | 'createdAt'> {
  const parsed = kind === 'fluid' ? parseFluidText(labelFluidName) : { name: null, volumeMl: null, volumeLabel: null }

  return {
    kind,
    labelFluidName: labelFluidName.trim(),
    fluidName: parsed.name ?? labelFluidName.trim(),
    volumeMl: parsed.volumeMl,
    volumeLabel: parsed.volumeLabel,
    companyCode: companyCode.replace(/\D/g, ''),
    itemCode: itemCode.replace(/\D/g, ''),
    memo,
  }
}

export function buildRecognitionFromGs1(
  labelFluidName: string,
  gs1Serial: string,
  memo?: string,
): Omit<RecognitionChar, 'id' | 'createdAt'> | null {
  const extracted = extractRecognitionFromScan(gs1Serial)
  if (!extracted) return null
  return buildRecognitionFromCodes(
    labelFluidName,
    extracted.companyCode,
    extracted.itemCode,
    'fluid',
    memo,
  )
}
