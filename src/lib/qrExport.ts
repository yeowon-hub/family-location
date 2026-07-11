import * as XLSX from 'xlsx'
import type { ScanResult } from '@/types/qr'

const FORMAT_LABELS: Record<string, string> = {
  QR_CODE: 'QR코드',
  CODE_128: 'Code 128',
  CODE_39: 'Code 39',
  EAN_13: 'EAN-13',
  EAN_8: 'EAN-8',
  UPC_A: 'UPC-A',
  UPC_E: 'UPC-E',
  ITF: 'ITF',
  CODABAR: 'Codabar',
  DATA_MATRIX: 'Data Matrix',
  PDF_417: 'PDF417',
  AZTEC: 'Aztec',
  TEXT: '텍스트',
  OCR: 'OCR',
}

export function formatBarcodeType(type: string): string {
  return FORMAT_LABELS[type] ?? type
}

const SOURCE_LABELS: Record<ScanResult['source'], string> = {
  scanner: 'QR인식기',
  camera: '카메라',
  file: '이미지파일',
  ocr: 'OCR',
}

export function formatScanSource(result: ScanResult): string {
  if (result.source === 'file' || result.source === 'ocr') {
    return result.fileName ? `${SOURCE_LABELS[result.source]} · ${result.fileName}` : SOURCE_LABELS[result.source]
  }
  return SOURCE_LABELS[result.source]
}

export function exportScansToExcel(results: ScanResult[]): void {
  if (results.length === 0) return

  const rows = results.map((row, index) => ({
    번호: index + 1,
    유형: formatBarcodeType(row.type),
    내용: row.content,
    출처: formatScanSource(row),
    파일명: row.fileName ?? '',
    스캔시각: row.scannedAt.toLocaleString('ko-KR'),
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '스캔결과')

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  XLSX.writeFile(workbook, `qr-scan-${stamp}.xlsx`)
}
