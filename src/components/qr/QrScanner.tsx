import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { Camera, FileUp, Loader2, ScanLine, Trash2, Download } from 'lucide-react'
import type { ScanResult } from '@/types/qr'
import { exportScansToExcel, formatBarcodeType, formatScanSource } from '@/lib/qrExport'
import { captureVideoFrame, readTextFromFile, readTextFromImageUrl } from '@/lib/readLabel'

function createScanResult(
  type: string,
  content: string,
  source: ScanResult['source'],
  fileName?: string,
): ScanResult {
  return {
    id: crypto.randomUUID(),
    type,
    content,
    scannedAt: new Date(),
    source,
    fileName,
  }
}

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ocrFileInputRef = useRef<HTMLInputElement>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const lastCameraScanRef = useRef('')

  const [results, setResults] = useState<ScanResult[]>([])
  const [scannerDraft, setScannerDraft] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)

  const focusScanner = () => {
    requestAnimationFrame(() => scannerInputRef.current?.focus())
  }

  useEffect(() => {
    focusScanner()
  }, [])

  const addResult = useCallback((result: ScanResult) => {
    setResults((prev) => [result, ...prev])
  }, [])

  const stopCamera = useCallback(() => {
    readerRef.current?.reset()
    setScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    lastCameraScanRef.current = ''

    if (!videoRef.current) return

    try {
      const reader = readerRef.current ?? new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices = await reader.listVideoInputDevices()
      const backCamera =
        devices.find((device) => /back|rear|environment/i.test(device.label)) ?? devices.at(-1)

      reader.decodeFromVideoDevice(
        backCamera?.deviceId ?? null,
        videoRef.current,
        (scanResult, error) => {
          if (scanResult) {
            const key = `${scanResult.getBarcodeFormat()}:${scanResult.getText()}`
            if (lastCameraScanRef.current === key) return
            lastCameraScanRef.current = key

            addResult(
              createScanResult(
                scanResult.getBarcodeFormat().toString(),
                scanResult.getText(),
                'camera',
              ),
            )
            return
          }

          if (error && !(error instanceof NotFoundException)) {
            setCameraError('카메라 스캔 중 오류가 발생했습니다.')
          }
        },
      )

      setScanning(true)
    } catch {
      setCameraError('카메라를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.')
      setScanning(false)
    }
  }, [addResult])

  useEffect(() => {
    return () => {
      readerRef.current?.reset()
    }
  }, [])

  const submitScanner = () => {
    const text = scannerDraft.trim()
    if (!text) return
    addResult(createScanResult('TEXT', text, 'scanner'))
    setScannerDraft('')
    focusScanner()
  }

  const captureOcr = async () => {
    if (!videoRef.current?.videoWidth) {
      setCameraError('OCR을 위해 카메라를 먼저 시작해 주세요.')
      return
    }

    setOcrBusy(true)
    setCameraError(null)
    try {
      const imageUrl = captureVideoFrame(videoRef.current)
      const text = await readTextFromImageUrl(imageUrl)
      if (!text.trim()) {
        setCameraError('글자를 인식하지 못했습니다.')
        return
      }
      addResult(createScanResult('OCR', text, 'ocr'))
    } catch {
      setCameraError('OCR 분석에 실패했습니다.')
    } finally {
      setOcrBusy(false)
    }
  }

  const scanFiles = async (files: FileList | null) => {
    if (!files?.length) return

    setFileBusy(true)
    const reader = readerRef.current ?? new BrowserMultiFormatReader()
    readerRef.current = reader

    try {
      for (const file of Array.from(files)) {
        const objectUrl = URL.createObjectURL(file)

        try {
          const scanResult = await reader.decodeFromImageUrl(objectUrl)
          addResult(
            createScanResult(
              scanResult.getBarcodeFormat().toString(),
              scanResult.getText(),
              'file',
              file.name,
            ),
          )
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            addResult(
              createScanResult('UNKNOWN', `[인식 실패] ${file.name}`, 'file', file.name),
            )
          } else {
            addResult(
              createScanResult('UNKNOWN', `[QR/바코드 없음] ${file.name}`, 'file', file.name),
            )
          }
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
    } finally {
      setFileBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const scanOcrFiles = async (files: FileList | null) => {
    if (!files?.[0]) return

    setOcrBusy(true)
    setCameraError(null)
    try {
      const text = await readTextFromFile(files[0])
      if (!text.trim()) {
        setCameraError('글자를 인식하지 못했습니다.')
        return
      }
      addResult(createScanResult('OCR', text, 'ocr', files[0].name))
    } catch {
      setCameraError('OCR 분석에 실패했습니다.')
    } finally {
      setOcrBusy(false)
      if (ocrFileInputRef.current) ocrFileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <section className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <ScanLine size={16} className="text-brand" />
          <h3 className="text-xs font-bold text-gray-900 sm:text-sm">QR/바코드 읽기</h3>
        </div>

        <input
          ref={scannerInputRef}
          type="text"
          value={scannerDraft}
          onChange={(e) => setScannerDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitScanner()
            }
          }}
          placeholder="스캔…"
          className="mb-2 w-full rounded-xl border border-brand/40 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand/30 focus:ring-2"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={scanning ? stopCamera : startCamera}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold text-gray-700"
          >
            <Camera size={14} />
            {scanning ? '중지' : '카메라'}
          </button>
          <button
            type="button"
            disabled={ocrBusy || (!scanning && false)}
            onClick={() => {
              if (scanning) {
                void captureOcr()
                return
              }
              ocrFileInputRef.current?.click()
            }}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold disabled:opacity-50"
          >
            {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
            OCR
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={fileBusy}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold disabled:opacity-50"
          >
            <FileUp size={14} />
            {fileBusy ? '분석…' : '이미지'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void scanFiles(event.target.files)}
          />
          <input
            ref={ocrFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void scanOcrFiles(event.target.files)}
          />
        </div>

        {cameraError && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700">{cameraError}</p>
        )}

        {scanning && (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              playsInline
            />
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700">
          스캔 결과 <span className="text-brand">({results.length})</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportScansToExcel(results)}
            disabled={results.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            <Download size={14} />
            엑셀 저장
          </button>
          <button
            type="button"
            onClick={() => setResults([])}
            disabled={results.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            <Trash2 size={14} />
            목록 비우기
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-xs text-gray-500">
          QR인식기 · 카메라 · OCR · 이미지파일로 읽은 결과가 여기에 쌓입니다
        </div>
      ) : (
        <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
          {results.map((result) => (
            <li
              key={result.id}
              className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                  {formatBarcodeType(result.type)}
                </span>
                <span className="text-[11px] text-gray-400">
                  {result.scannedAt.toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="break-all text-sm font-medium text-gray-900">{result.content}</p>
              <p className="mt-1 text-[11px] text-gray-500">{formatScanSource(result)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
