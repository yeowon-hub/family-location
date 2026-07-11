import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  Link2,
  ScanLine,
  Volume2,
} from 'lucide-react'
import { SequentialScanInput } from '@/components/qr/SequentialScanInput'
import { AutoResizeTextarea } from '@/components/AutoResizeTextarea'
import { compareFluidsWithRecognition } from '@/lib/ivFluidCompare'
import { parseGs1Serial } from '@/lib/gs1Parser'
import { extractFluidLineFromLabel, fluidPreviewFromLabel, parsePrepLabel } from '@/lib/prepLabelParser'
import { playBangBang, playDomisol, playVerificationResult } from '@/lib/alertSounds'
import { cleanScanText } from '@/lib/scanDetect'
import { captureVideoFrame, readTextFromFile, readTextFromImageUrl } from '@/lib/readLabel'
import type { CompareStatus, FluidCompareResult, ParsedFluid, RecognitionChar } from '@/types/fluidVerify'

const FLUID_STEPS = [
  { id: 'label', label: '① 조제라벨' },
  { id: 'product', label: '② 수액 외피' },
] as const

interface FluidVerifierProps {
  recognitionChars: RecognitionChar[]
  onRegisterRequest?: (label: string, code: string) => void
  onVerifyAlert?: (status: CompareStatus) => void
}

function LabelPreview({ parsed }: { parsed: ParsedFluid }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs">
      <div>
        <span className="text-gray-500">수액명</span>
        <p className="font-semibold text-gray-900">{parsed.name ?? '인식 안 됨'}</p>
      </div>
      <div>
        <span className="text-gray-500">규격</span>
        <p className="font-semibold text-gray-900">{parsed.volumeLabel ?? '인식 안 됨'}</p>
      </div>
    </div>
  )
}

function ProductPreview({ result }: { result: FluidCompareResult }) {
  const matched = result.matchedRecognition
  const gs1 = result.productCode ? parseGs1Serial(result.productCode) : null

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs">
      {gs1 && (
        <div
          className={`rounded-lg px-2 py-1.5 text-[11px] ${
            result.isExpired ? 'bg-red-100 text-red-900' : 'bg-blue-50 text-blue-900'
          }`}
        >
          GTIN: <span className="font-mono">{gs1.gtin14}</span> · 업체{' '}
          <strong>{gs1.gtin.companyCode}</strong> · 품목 <strong>{gs1.gtin.itemCode}</strong>
          {gs1.expirationLabel && (
            <>
              {' '}
              · 유효{' '}
              <strong className={result.isExpired ? 'text-red-700' : ''}>
                {gs1.expirationLabel}
                {result.isExpired ? ' (경과)' : ''}
              </strong>
            </>
          )}
          {result.checkDigitValid != null && (
            <>
              {' '}
              · 검증번호{' '}
              <strong className={result.checkDigitValid ? 'text-green-700' : 'text-red-700'}>
                {gs1.gtin.checkDigit}
                {result.checkDigitValid ? ' ✓' : ` ✗ (정답 ${result.expectedCheckDigit})`}
              </strong>
            </>
          )}
        </div>
      )}
      {!gs1 && result.scannedCompanyCode && (
        <div className="text-[11px] text-gray-600">
          추출: 업체 {result.scannedCompanyCode} · 품목 {result.scannedItemCode}
        </div>
      )}
      <div>
        <span className="text-gray-500">GS1 일련번호</span>
        <p className="break-all font-mono text-[11px] font-semibold text-gray-900">
          {result.productCode || '—'}
        </p>
      </div>
      {matched ? (
        <>
          <div>
            <span className="text-gray-500">인식문자 매칭</span>
            <p className="font-mono font-semibold text-brand">
              업체 {matched.companyCode} · 품목 {matched.itemCode}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">등록 수액명</span>
              <p className="font-semibold text-gray-900">{matched.fluidName}</p>
            </div>
            <div>
              <span className="text-gray-500">등록 규격</span>
              <p className="font-semibold text-gray-900">{matched.volumeLabel ?? '—'}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-amber-700">
          {result.scannedCompanyCode
            ? `인식문자 미등록 — 업체 ${result.scannedCompanyCode} · 품목 ${result.scannedItemCode}`
            : 'GS1 일련번호에서 업체·품목코드를 추출하지 못했습니다'}
        </p>
      )}
    </div>
  )
}

function ResultBanner({
  result,
  onRegister,
}: {
  result: FluidCompareResult
  onRegister?: () => void
}) {
  if (result.status === 'idle') {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-500">
        <strong>① 조제라벨 → ② 수액 외피</strong> 순으로 스캔
      </div>
    )
  }

  if (result.status === 'invalid_checkdigit') {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={22} />
          <div>
            <p className="font-bold text-red-800">GTIN 검증번호 오류</p>
            <p className="mt-1 text-sm text-red-700">{result.message}</p>
            <p className="mt-2 text-xs text-red-600">삑삑삑삑 경고음 · 재스캔해 주세요</p>
          </div>
        </div>
      </div>
    )
  }

  if (result.status === 'expired') {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={22} />
          <div>
            <p className="font-bold text-red-800">유효기간 경과 — 사용 불가</p>
            <p className="mt-1 text-sm text-red-700">{result.message}</p>
            <p className="mt-2 text-xs text-red-600">삑삑삑삑 경고음이 재생됩니다</p>
          </div>
        </div>
      </div>
    )
  }

  if (result.status === 'match') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={22} />
          <div>
            <p className="font-bold text-green-800">제품 일치</p>
            <p className="mt-1 text-sm text-green-700">{result.message}</p>
            <p className="mt-2 text-xs text-green-600">도미 알림음이 재생됩니다</p>
          </div>
        </div>
      </div>
    )
  }

  if (result.status === 'unregistered') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={22} />
          <div className="flex-1">
            <p className="font-bold text-amber-800">인식문자 미등록</p>
            <p className="mt-1 text-sm text-amber-700">{result.message}</p>
            {onRegister && (
              <button
                type="button"
                onClick={onRegister}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
              >
                <Link2 size={14} />
                인식문자 탭에서 등록하기
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isMismatch = result.status === 'mismatch'

  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        isMismatch ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 shrink-0 ${isMismatch ? 'text-red-600' : 'text-amber-600'}`}
          size={22}
        />
        <div>
          <p className={`font-bold ${isMismatch ? 'text-red-800' : 'text-amber-800'}`}>
            {isMismatch ? '제품 불일치 — 확인 필요' : '정보 부족'}
          </p>
          <p className={`mt-1 text-sm ${isMismatch ? 'text-red-700' : 'text-amber-700'}`}>
            {result.message}
          </p>
          {isMismatch && (
            <p className="mt-2 text-xs text-red-600">삑삑삑삑 경고음이 재생됩니다</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function FluidVerifier({ recognitionChars, onRegisterRequest, onVerifyAlert }: FluidVerifierProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastBarcodeRef = useRef('')
  const labelRef = useRef('')

  const [labelText, setLabelText] = useState('')
  const [productCode, setProductCode] = useState('')
  const [scanStep, setScanStep] = useState(0)
  const [completeHint, setCompleteHint] = useState<string | null>(null)
  const [compareResult, setCompareResult] = useState<FluidCompareResult>(() =>
    compareFluidsWithRecognition('', '', []),
  )

  const [scanning, setScanning] = useState(false)
  const [auxOpen, setAuxOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const labelParsed = fluidPreviewFromLabel(labelText)
  const prepParsed = parsePrepLabel(labelText)
  const fluidLine = extractFluidLineFromLabel(labelText)

  const steps = useMemo(
    () =>
      FLUID_STEPS.map((step, index) => ({
        ...step,
        done: index === 0 ? Boolean(labelText) && scanStep > 0 : Boolean(productCode) && scanStep > 1,
      })),
    [labelText, productCode, scanStep],
  )

  const prepareNextCase = useCallback(() => {
    setScanStep(0)
    lastBarcodeRef.current = ''
    setCompleteHint('검증 완료 — 다음 ① 조제라벨을 스캔하세요')
  }, [])

  const runCompare = useCallback(
    (playSound: boolean, label = fluidLine, code = productCode) => {
      const result = compareFluidsWithRecognition(label, code, recognitionChars)
      setCompareResult(result)
      onVerifyAlert?.(result.status)

      if (
        playSound &&
        (result.status === 'match' ||
          result.status === 'mismatch' ||
          result.status === 'expired' ||
          result.status === 'invalid_checkdigit')
      ) {
        playVerificationResult(result.status)
      }
    },
    [fluidLine, productCode, recognitionChars, onVerifyAlert],
  )

  useEffect(() => {
    setCompareResult(compareFluidsWithRecognition(fluidLine, productCode, recognitionChars))
  }, [fluidLine, productCode, recognitionChars])

  const handleSequentialScan = useCallback(
    (raw: string) => {
      const cleaned = cleanScanText(raw)
      if (!cleaned) return

      setCompleteHint(null)

      if (scanStep === 0) {
        labelRef.current = cleaned
        setLabelText(cleaned)
        setProductCode('')
        setScanStep(1)
        setCompareResult(
          compareFluidsWithRecognition(
            extractFluidLineFromLabel(cleaned),
            '',
            recognitionChars,
          ),
        )
        return
      }

      if (scanStep === 1) {
        setProductCode(cleaned)
        const line = extractFluidLineFromLabel(labelRef.current)
        runCompare(true, line, cleaned)
        prepareNextCase()
      }
    },
    [scanStep, runCompare, prepareNextCase, recognitionChars],
  )

  const stopCamera = useCallback(() => {
    readerRef.current?.reset()
    setScanning(false)
    lastBarcodeRef.current = ''
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    lastBarcodeRef.current = ''
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
            if (lastBarcodeRef.current === key) return
            lastBarcodeRef.current = key
            handleSequentialScan(scanResult.getText())
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
  }, [handleSequentialScan])

  useEffect(() => () => readerRef.current?.reset(), [])

  const capturePhoto = async () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setCameraError('카메라 영상이 준비되지 않았습니다.')
      return
    }
    setBusy(true)
    setCameraError(null)
    try {
      const imageUrl = captureVideoFrame(videoRef.current)
      const text = await readTextFromImageUrl(imageUrl)
      if (!text) {
        setCameraError('글자나 코드를 인식하지 못했습니다.')
        return
      }
      handleSequentialScan(text)
    } catch {
      setCameraError('이미지 분석에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files?.[0]) return
    setBusy(true)
    setCameraError(null)
    try {
      const text = await readTextFromFile(files[0])
      if (!text) {
        setCameraError('파일에서 글자나 코드를 인식하지 못했습니다.')
        return
      }
      handleSequentialScan(text)
    } catch {
      setCameraError('파일 분석에 실패했습니다.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <p className="shrink-0 font-semibold">항암주사 조제 수액 검증</p>
        <p className="text-[10px] text-blue-800 sm:text-[11px]">
          <strong>① 조제라벨 → ② 수액 외피</strong> 순으로 스캔
        </p>
      </div>

      <SequentialScanInput
        steps={steps}
        activeIndex={scanStep}
        onScan={handleSequentialScan}
        completeHint={completeHint}
        headerExtra={
          <button
            type="button"
            onClick={() => setAuxOpen((open) => !open)}
            aria-expanded={auxOpen}
            aria-label="카메라 / OCR 보조 입력"
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold sm:text-[11px] ${
              auxOpen
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            <Camera size={12} />
            <span className="max-w-[5.5rem] truncate sm:max-w-none">카메라/OCR</span>
          </button>
        }
        auxiliaryPanel={
          auxOpen ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={scanning ? stopCamera : startCamera}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                >
                  <Camera size={18} />
                  {scanning ? '카메라 중지' : '카메라'}
                </button>
                <button
                  type="button"
                  onClick={() => void capturePhoto()}
                  disabled={!scanning || busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
                  촬영 OCR
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
                >
                  <FileUp size={18} />
                  사진
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void handleFileSelect(event.target.files)}
                />
              </div>
              {cameraError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{cameraError}</p>
              )}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
                <video
                  ref={videoRef}
                  className={`aspect-video w-full object-cover ${scanning ? 'block' : 'hidden'}`}
                  muted
                  playsInline
                />
                {!scanning && (
                  <div className="flex aspect-video items-center justify-center bg-gray-900 px-4 text-center text-xs text-gray-400">
                    현재 단계({steps[scanStep]?.label ?? '완료'})에 맞춰 스캔됩니다
                  </div>
                )}
              </div>
            </>
          ) : null
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-3">
          <h3 className="mb-1.5 text-sm font-bold text-gray-900">① 조제 라벨 — 수액명 (맨 아래 줄)</h3>
          <AutoResizeTextarea
            value={labelText}
            onChange={(event) => {
              labelRef.current = event.target.value
              setLabelText(event.target.value)
              if (!event.target.value) setScanStep(0)
              else if (scanStep === 0) setScanStep(1)
            }}
            placeholder="전체 라벨 또는 수액명만 입력"
            className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
          />
          {prepParsed.chemoDrugs.length > 0 && (
            <p className="mb-2 text-[11px] text-gray-500">
              위쪽 항암주사제 {prepParsed.chemoDrugs.length}건은 무시 · 수액만 사용:{' '}
              <strong className="text-brand">{fluidLine}</strong>
            </p>
          )}
          <LabelPreview parsed={labelParsed} />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-3">
          <h3 className="mb-1.5 text-sm font-bold text-gray-900">② 수액 외피 — GS1 일련번호</h3>
          <AutoResizeTextarea
            value={productCode}
            onChange={(event) => {
              setProductCode(event.target.value)
              if (event.target.value && scanStep < 2) setScanStep(2)
            }}
            placeholder="(01)08806411123459(17)281231(10)LOT5632(21)..."
            className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm outline-none ring-brand/30 focus:ring-2"
          />
          <ProductPreview result={compareResult} />
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runCompare(true)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white sm:flex-none"
        >
          <Volume2 size={18} />
          비교 및 알림 재생
        </button>
        {onRegisterRequest && labelText && productCode && (
          <button
            type="button"
            onClick={() => onRegisterRequest(fluidLine, productCode)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700"
          >
            <Link2 size={18} />
            인식문자로 등록
          </button>
        )}
        <button
          type="button"
          onClick={playDomisol}
          className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-xs font-semibold text-green-700"
        >
          도미 테스트
        </button>
        <button
          type="button"
          onClick={playBangBang}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-700"
        >
          삑삑삑삑 테스트
        </button>
      </div>

      <ResultBanner
        result={compareResult}
        onRegister={
          onRegisterRequest && fluidLine && productCode
            ? () => onRegisterRequest(fluidLine, productCode)
            : onRegisterRequest
              ? () => onRegisterRequest('', productCode)
              : undefined
        }
      />
    </div>
  )
}
