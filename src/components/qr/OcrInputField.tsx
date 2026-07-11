import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { Camera, FileUp, Loader2, ScanLine } from 'lucide-react'
import { AutoResizeTextarea } from '@/components/AutoResizeTextarea'
import { captureVideoFrame, readTextFromFile, readTextFromImageUrl } from '@/lib/readLabel'

interface OcrInputFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  barcodeScan?: boolean
  mono?: boolean
}

export function OcrInputField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  barcodeScan = false,
  mono = false,
}: OcrInputFieldProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastBarcodeRef = useRef('')

  const [auxOpen, setAuxOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auxLabel = barcodeScan ? '카메라/사진' : '카메라/OCR/사진'

  const stopCamera = useCallback(() => {
    readerRef.current?.reset()
    setScanning(false)
    lastBarcodeRef.current = ''
  }, [])

  const toggleAux = () => {
    setAuxOpen((open) => {
      if (open) stopCamera()
      return !open
    })
  }

  useEffect(() => {
    if (!scanning || !videoRef.current) return

    let cancelled = false

    const run = async () => {
      try {
        const reader = readerRef.current ?? new BrowserMultiFormatReader()
        readerRef.current = reader
        const devices = await reader.listVideoInputDevices()
        if (cancelled) return
        const backCamera =
          devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices.at(-1)

        if (barcodeScan) {
          reader.decodeFromVideoDevice(
            backCamera?.deviceId ?? null,
            videoRef.current!,
            (result, err) => {
              if (result) {
                const text = result.getText()
                if (lastBarcodeRef.current === text) return
                lastBarcodeRef.current = text
                onChange(text)
                return
              }
              if (err && !(err instanceof NotFoundException)) {
                setError('바코드 스캔 오류')
              }
            },
          )
        } else {
          await reader.decodeFromVideoDevice(
            backCamera?.deviceId ?? null,
            videoRef.current!,
            () => {},
          )
        }
      } catch {
        if (!cancelled) {
          setError('카메라를 사용할 수 없습니다.')
          setScanning(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      readerRef.current?.reset()
    }
  }, [scanning, barcodeScan, onChange])

  useEffect(() => () => readerRef.current?.reset(), [])

  const captureOcr = async () => {
    if (!videoRef.current?.videoWidth) {
      setError('카메라 영상이 준비되지 않았습니다.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const imageUrl = captureVideoFrame(videoRef.current)
      const text = await readTextFromImageUrl(imageUrl)
      if (!text.trim()) {
        setError('글자를 인식하지 못했습니다.')
        return
      }
      onChange(text.replace(/\s+/g, ' ').trim())
    } catch {
      setError('OCR 분석 실패')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (files: FileList | null) => {
    if (!files?.[0]) return
    setBusy(true)
    setError(null)
    try {
      const text = await readTextFromFile(files[0])
      onChange(text.replace(/\s+/g, ' ').trim())
    } catch {
      setError('파일 분석 실패')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-xs font-medium leading-tight text-gray-600">{label}</span>
        <button
          type="button"
          onClick={toggleAux}
          aria-expanded={auxOpen}
          aria-label={auxLabel}
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold sm:text-[11px] ${
            auxOpen
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <Camera size={12} />
          <span className="max-w-[6.5rem] truncate sm:max-w-none">{auxLabel}</span>
        </button>
      </div>

      {multiline ? (
        <AutoResizeTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2 ${mono ? 'font-mono text-xs' : ''}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2 ${mono ? 'font-mono text-xs' : ''}`}
        />
      )}

      {auxOpen && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-2">
          <div className={`grid gap-2 ${barcodeScan ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <button
              type="button"
              onClick={() => (scanning ? stopCamera() : setScanning(true))}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold text-gray-700"
            >
              <Camera size={14} />
              {scanning ? '중지' : '카메라'}
            </button>
            {!barcodeScan && (
              <button
                type="button"
                disabled={!scanning || busy}
                onClick={() => void captureOcr()}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                OCR
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold disabled:opacity-50"
            >
              <FileUp size={14} />
              사진
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files)}
            />
          </div>
          {scanning && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                muted
                playsInline
              />
            </div>
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
