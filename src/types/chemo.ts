export type ChemoSection = 'verify' | 'manage'

export type VerifyTab = 'fluid' | 'prep'

export type ManageTab = 'recognition' | 'qr'

export type QrConversionTab = 'generate' | 'scan'

export interface ScanResult {
  id: string
  type: string
  content: string
  scannedAt: Date
  source: 'scanner' | 'camera' | 'file' | 'ocr'
  fileName?: string
}

export const APP_NAME = 'Chemo Crosscheck Care'
export const APP_TAGLINE = '항암 조제 교차 확인'
