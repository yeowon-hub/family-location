/** 인식문자 종류 */
export type RecognitionKind = 'fluid' | 'chemo'

/** 인식문자 — 조제라벨 약품명 ↔ 코드(GTIN/바코드) 연결 */
export interface RecognitionChar {
  id: string
  /** fluid=수액 외피 GTIN, chemo=항암주사제 바코드/QR */
  kind: RecognitionKind
  /** 조제라벨 약품명 (수액 또는 항암주사제) */
  labelFluidName: string
  fluidName: string
  volumeMl: number | null
  volumeLabel: string | null
  companyCode: string
  itemCode: string
  memo?: string
  createdAt: string
}

export interface ParsedFluid {
  raw: string
  name: string | null
  volumeMl: number | null
  volumeLabel: string | null
}

export type CompareStatus =
  | 'idle'
  | 'match'
  | 'mismatch'
  | 'incomplete'
  | 'unregistered'
  | 'expired'
  | 'invalid_checkdigit'

export interface FluidCompareResult {
  status: CompareStatus
  label: ParsedFluid
  productCode: string
  product: ParsedFluid
  matchedRecognition: RecognitionChar | null
  scannedCompanyCode: string | null
  scannedItemCode: string | null
  expirationLabel: string | null
  isExpired: boolean
  /** GTIN 검증번호 일치 여부 */
  checkDigitValid: boolean | null
  /** 계산된 검증번호 */
  expectedCheckDigit: string | null
  nameMatch: boolean
  volumeMatch: boolean
  message: string
}

export type RecognitionCharInput = Omit<RecognitionChar, 'id' | 'createdAt'>

export function recognitionKey(entry: Pick<RecognitionChar, 'companyCode' | 'itemCode'>): string {
  return entry.companyCode.replace(/\D/g, '') + entry.itemCode.replace(/\D/g, '')
}
