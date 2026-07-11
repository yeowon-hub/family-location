import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  ScanLine,
  Volume2,
} from 'lucide-react'
import { SequentialScanInput } from '@/components/qr/SequentialScanInput'
import { AutoResizeTextarea } from '@/components/AutoResizeTextarea'
import { playBangBang, playDomisol } from '@/lib/alertSounds'
import { compareDrugNameText } from '@/lib/drugNameCompare'
import { fluidPreviewFromLabel, parsePrepLabel } from '@/lib/prepLabelParser'
import { findChemoRecognition, findRecognitionByCode } from '@/lib/recognitionStore'
import { cleanScanText } from '@/lib/scanDetect'
import { captureVideoFrame, readTextFromFile, readTextFromImageUrl } from '@/lib/readLabel'
import type { RecognitionChar } from '@/types/fluidVerify'

type ItemStatus = 'pending' | 'match' | 'mismatch' | 'unregistered'

interface ChemoScan {
  drugName: string
  code: string
  status: ItemStatus
  message: string
}

interface PrepLabelVerifierProps {
  recognitionChars: RecognitionChar[]
}

function statusIcon(status: ItemStatus) {
  if (status === 'match') return <CheckCircle2 size={16} className="text-green-600" />
  if (status === 'pending') return null
  return <AlertTriangle size={16} className="text-red-600" />
}

function buildChemoScans(labelText: string): ChemoScan[] {
  const drugs = parsePrepLabel(labelText).chemoDrugs
  if (drugs.length === 0 && labelText.trim()) {
    return [
      {
        drugName: '항암주사제 1',
        code: '',
        status: 'pending' as ItemStatus,
        message: '항암주사제 바코드/QR 스캔 대기',
      },
    ]
  }
  return drugs.map((d) => ({
    drugName: d.name,
    code: '',
    status: 'pending' as ItemStatus,
    message: '항암주사제 바코드/QR 스캔 대기',
  }))
}

function getChemoScanSlots(labelText: string): number {
  if (!labelText.trim()) return 1
  return Math.max(parsePrepLabel(labelText).chemoDrugs.length, 1)
}

const DEFAULT_CHEMO_SCAN: ChemoScan = {
  drugName: '항암주사제',
  code: '',
  status: 'pending',
  message: '① 조제라벨 스캔 후 항목이 표시됩니다',
}

function applyChemoCodeScan(
  prev: ChemoScan[],
  code: string,
  drugs: { name: string }[],
  recognitionChars: RecognitionChar[],
): { next: ChemoScan[]; matched: boolean; hadBad: boolean } {
  const trimmed = code.trim()
  if (!trimmed) {
    return { next: prev, matched: false, hadBad: false }
  }

  const next = [...prev]

  if (drugs.length === 0) {
    const reg = findRecognitionByCode(trimmed, recognitionChars, 'chemo')
    const slot = next.findIndex((s) => s.status === 'pending')
    const index = slot >= 0 ? slot : 0

    if (reg) {
      next[index] = {
        drugName: reg.labelFluidName,
        code: trimmed,
        status: 'match',
        message: `일치: ${reg.labelFluidName}`,
      }
      return { next, matched: true, hadBad: false }
    }

    next[index] = {
      drugName: next[index]?.drugName ?? '항암주사제',
      code: trimmed,
      status: 'unregistered',
      message: '인식문자 미등록 — 관리에서 항암주사제 등록 필요',
    }
    return { next, matched: false, hadBad: true }
  }

  let matchedIndex = -1

  for (let i = 0; i < drugs.length; i++) {
    const reg = findChemoRecognition(drugs[i].name, trimmed, recognitionChars)
    if (reg) {
      matchedIndex = i
      break
    }
  }

  if (matchedIndex >= 0) {
    next[matchedIndex] = {
      drugName: drugs[matchedIndex].name,
      code: trimmed,
      status: 'match',
      message: `일치: ${drugs[matchedIndex].name}`,
    }
    return { next, matched: true, hadBad: false }
  }

  const anyReg = findRecognitionByCode(trimmed, recognitionChars, 'chemo')
  const fallbackIndex = next.findIndex((s) => s.status === 'pending')

  if (anyReg && fallbackIndex >= 0) {
    next[fallbackIndex] = {
      drugName: next[fallbackIndex].drugName,
      code: trimmed,
      status: 'mismatch',
      message: `코드는 ${anyReg.labelFluidName}용 — 라벨 ${next[fallbackIndex].drugName}와 불일치`,
    }
    return { next, matched: false, hadBad: true }
  }

  if (fallbackIndex >= 0) {
    next[fallbackIndex] = {
      drugName: next[fallbackIndex].drugName,
      code: trimmed,
      status: 'unregistered',
      message: '인식문자 미등록 — 관리에서 항암주사제 등록 필요',
    }
    return { next, matched: false, hadBad: true }
  }

  return { next, matched: false, hadBad: false }
}

export function PrepLabelVerifier({ recognitionChars }: PrepLabelVerifierProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastBarcodeRef = useRef('')
  const labelRef = useRef('')

  const [labelText, setLabelText] = useState('')
  const [scanStep, setScanStep] = useState(0)
  const [completeHint, setCompleteHint] = useState<string | null>(null)
  const [chemoScans, setChemoScans] = useState<ChemoScan[]>([DEFAULT_CHEMO_SCAN])
  const [innerFluidText, setInnerFluidText] = useState('')
  const [fluidStatus, setFluidStatus] = useState<ItemStatus>('pending')
  const [fluidMessage, setFluidMessage] = useState('')

  const [scanning, setScanning] = useState(false)
  const [auxOpen, setAuxOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const prep = parsePrepLabel(labelText)
  const fluidLine = prep.fluid?.name ?? ''
  const fluidParsed = fluidPreviewFromLabel(labelText)
  const chemoCount = prep.chemoDrugs.length
  const chemoSlots = getChemoScanSlots(labelText)

  const steps = useMemo(() => {
    const list = [
      {
        id: 'label',
        label: '① 조제라벨',
        done: scanStep > 0 && Boolean(labelText),
      },
      {
        id: 'fluid',
        label: '② 수액 내피',
        done: scanStep > 1 || fluidStatus === 'match',
      },
    ]
    for (let i = 0; i < chemoSlots; i++) {
      const drugName = chemoScans[i]?.drugName ?? prep.chemoDrugs[i]?.name
      list.push({
        id: `chemo-${i}`,
        label:
          chemoSlots === 1
            ? '③ 항암주사제'
            : drugName
              ? `③ ${drugName.length > 8 ? `항암 ${i + 1}` : drugName}`
              : `③ 항암 ${i + 1}`,
        done: chemoScans[i]?.status === 'match',
      })
    }
    return list
  }, [scanStep, labelText, fluidStatus, chemoSlots, chemoScans, prep.chemoDrugs])

  const verifyFluidInner = useCallback(
    (innerText: string, playSound = false) => {
      const line = parsePrepLabel(labelRef.current).fluid?.name ?? ''
      setInnerFluidText(innerText)
      if (!line) {
        setFluidStatus('pending')
        setFluidMessage('조제 라벨에서 수액명을 먼저 읽어 주세요.')
        return
      }
      if (!innerText.trim()) {
        setFluidStatus('pending')
        setFluidMessage('수액 내피 약품명을 읽어 주세요.')
        return
      }
      if (compareDrugNameText(line, innerText)) {
        setFluidStatus('match')
        setFluidMessage(`일치: 라벨 "${line}" ↔ 내피 "${innerText.trim()}"`)
        if (playSound) playDomisol()
      } else {
        setFluidStatus('mismatch')
        setFluidMessage(`불일치: 라벨 "${line}" ↔ 내피 "${innerText.trim()}"`)
        if (playSound) playBangBang()
      }
    },
    [],
  )

  const prepareNextCase = useCallback(() => {
    setScanStep(0)
    lastBarcodeRef.current = ''
    setCompleteHint('검증 완료 — 다음 ① 조제라벨을 스캔하세요')
  }, [])

  const runFullVerify = useCallback(
    (scans = chemoScans, fluid: ItemStatus = fluidStatus) => {
      const drugs = parsePrepLabel(labelRef.current).chemoDrugs
      const line = parsePrepLabel(labelRef.current).fluid?.name ?? ''
      const allChemoDone = drugs.length === 0 || scans.every((s) => s.status === 'match')
      const fluidOk = fluid === 'match'
      const allMatch = allChemoDone && fluidOk && Boolean(line)
      const anyBad =
        scans.some((s) => s.status === 'mismatch' || s.status === 'unregistered') ||
        fluid === 'mismatch'

      if (allMatch) playDomisol()
      else if (anyBad) playBangBang()
    },
    [chemoScans, fluidStatus],
  )

  const finishSequence = useCallback(() => {
    prepareNextCase()
  }, [prepareNextCase])

  const handleSequentialScan = useCallback(
    (raw: string) => {
      const cleaned = cleanScanText(raw)
      if (!cleaned) return

      setCompleteHint(null)

      if (scanStep === 0) {
        labelRef.current = cleaned
        setLabelText(cleaned)
        setChemoScans(buildChemoScans(cleaned))
        setInnerFluidText('')
        setFluidStatus('pending')
        setFluidMessage('')
        setScanStep(1)
        return
      }

      if (scanStep === 1) {
        const line = parsePrepLabel(labelRef.current).fluid?.name ?? ''
        if (line && cleaned) {
          if (compareDrugNameText(line, cleaned)) {
            setFluidStatus('match')
            setFluidMessage(`일치: 라벨 "${line}" ↔ 내피 "${cleaned}"`)
            playDomisol()
          } else {
            setFluidStatus('mismatch')
            setFluidMessage(`불일치: 라벨 "${line}" ↔ 내피 "${cleaned}"`)
            playBangBang()
          }
        }
        setInnerFluidText(cleaned)
        setScanStep(2)
        return
      }

      if (scanStep >= 2) {
        const drugs = parsePrepLabel(labelRef.current).chemoDrugs
        const stepsTotal = 2 + getChemoScanSlots(labelRef.current)
        if (scanStep >= stepsTotal) return

        const { next, matched, hadBad } = applyChemoCodeScan(
          chemoScans,
          cleaned,
          drugs,
          recognitionChars,
        )
        setChemoScans(next)
        if (matched) playDomisol()
        else if (hadBad) playBangBang()

        const nextStep = scanStep + 1
        if (nextStep >= stepsTotal) {
          finishSequence()
        } else {
          setScanStep(nextStep)
        }
      }
    },
    [scanStep, chemoScans, recognitionChars, finishSequence],
  )

  useEffect(() => {
    if (!labelText.trim()) {
      setChemoScans([DEFAULT_CHEMO_SCAN])
      return
    }
    setChemoScans(buildChemoScans(labelText))
    if (scanStep === 0) {
      setInnerFluidText('')
      setFluidStatus('pending')
      setFluidMessage('')
    }
  }, [labelText, scanStep])

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
        devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices.at(-1)

      reader.decodeFromVideoDevice(
        backCamera?.deviceId ?? null,
        videoRef.current,
        (scanResult, error) => {
          if (scanResult) {
            const key = scanResult.getText()
            if (lastBarcodeRef.current === key) return
            lastBarcodeRef.current = key
            handleSequentialScan(key)
            return
          }
          if (error && !(error instanceof NotFoundException)) {
            setCameraError('카메라 스캔 중 오류')
          }
        },
      )
      setScanning(true)
    } catch {
      setCameraError('카메라를 사용할 수 없습니다.')
      setScanning(false)
    }
  }, [handleSequentialScan])

  useEffect(() => () => readerRef.current?.reset(), [])

  const captureAndRead = async () => {
    if (!videoRef.current?.videoWidth) {
      setCameraError('카메라 영상이 준비되지 않았습니다.')
      return
    }
    setBusy(true)
    setCameraError(null)
    try {
      const imageUrl = captureVideoFrame(videoRef.current)
      const text = await readTextFromImageUrl(imageUrl)
      if (!text.trim()) {
        setCameraError('글자를 인식하지 못했습니다.')
        return
      }
      handleSequentialScan(text)
    } catch {
      setCameraError('이미지 분석 실패')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (files: FileList | null) => {
    if (!files?.[0]) return
    setBusy(true)
    try {
      const text = await readTextFromFile(files[0])
      handleSequentialScan(text)
    } catch {
      setCameraError('파일 분석 실패')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const allChemoDone =
    prep.chemoDrugs.length === 0 || chemoScans.every((s) => s.status === 'match')
  const fluidOk = fluidStatus === 'match'
  const allMatch = allChemoDone && fluidOk && Boolean(fluidLine)
  const anyBad =
    chemoScans.some((s) => s.status === 'mismatch' || s.status === 'unregistered') ||
    fluidStatus === 'mismatch'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <p className="shrink-0 font-semibold">조제검증</p>
        <p className="text-[10px] text-violet-800 sm:text-[11px]">
          <strong>① 조제라벨 → ② 수액 내피 → ③ 항암주사제</strong> 순으로 스캔
          <span className="text-violet-600"> (Water for inj 은 대상 아님)</span>
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
                  {scanning ? '중지' : '카메라'}
                </button>
                <button
                  type="button"
                  disabled={!scanning || busy}
                  onClick={() => void captureAndRead()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
                  촬영 OCR
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <FileUp size={18} />
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
              {cameraError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{cameraError}</p>
              )}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
                <video
                  ref={videoRef}
                  className={`aspect-video w-full ${scanning ? 'block' : 'hidden'}`}
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

      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <h3 className="mb-1.5 text-sm font-bold">조제라벨 (전체)</h3>
        <AutoResizeTextarea
          value={labelText}
          onChange={(e) => {
            labelRef.current = e.target.value
            setLabelText(e.target.value)
            if (!e.target.value) {
              setScanStep(0)
            } else if (scanStep === 0) {
              setScanStep(1)
            }
          }}
          placeholder="Uromitexan... Holoxan... Water for inj... Half saline 0.45% 1L(이노엔)"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <h3 className="mb-1.5 text-sm font-bold">수액 (맨 아래) — 내피 약품명</h3>
        <p className="mb-2 text-xs text-brand">라벨: {fluidLine || '—'}</p>
        <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs">
          <div>
            <span className="text-gray-500">수액명</span>
            <p className="font-semibold">{fluidParsed.name ?? '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">규격</span>
            <p className="font-semibold">{fluidParsed.volumeLabel ?? '—'}</p>
          </div>
        </div>
        <AutoResizeTextarea
          value={innerFluidText}
          onChange={(e) => verifyFluidInner(e.target.value)}
          placeholder="수액 내피에서 읽은 약품명"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        {fluidMessage && <p className="mt-2 text-xs text-gray-600">{fluidMessage}</p>}
      </section>

      <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-3">
        <h3 className="mb-1.5 text-sm font-bold text-gray-900">
          ③ 항암주사제 ({chemoSlots}) — 바코드/QR
        </h3>
        {!labelText.trim() && (
          <p className="mb-2 text-xs text-orange-700">
            ① 조제라벨 스캔 후 항암주사제 목록이 채워집니다. ③ 단계에서 바코드/QR을 스캔하세요.
          </p>
        )}
        {labelText.trim() && chemoCount === 0 && (
          <p className="mb-2 text-xs text-orange-700">
            라벨에서 항암주사제명을 분리하지 못했습니다. 바코드/QR을 스캔하면 인식문자와
            대조합니다.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {chemoScans.map((item, index) => (
            <li
              key={`${item.drugName}-${index}`}
              className="rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-orange-100"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{item.drugName}</p>
                {statusIcon(item.status)}
              </div>
              {item.code && <p className="mt-1 font-mono text-[10px]">{item.code}</p>}
              <p className="mt-1 text-gray-600">{item.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => runFullVerify()}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white"
      >
        <Volume2 size={18} />
        전체 검증 및 알림
      </button>

      {allMatch && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          <CheckCircle2 className="mb-1 inline" size={18} /> 조제검증 일치 — 도미
        </div>
      )}
      {anyBad && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertTriangle className="mb-1 inline" size={18} /> 불일치 또는 미등록 — 삑삑삑삑
        </div>
      )}
    </div>
  )
}
