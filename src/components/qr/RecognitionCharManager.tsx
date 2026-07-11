import { useEffect, useState } from 'react'
import { Plus, Trash2, BookOpen, Download, Upload, Volume2 } from 'lucide-react'
import { OcrInputField } from '@/components/qr/OcrInputField'
import { playBangBang, playDomisol } from '@/lib/alertSounds'
import { drugNamesMatch } from '@/lib/drugNameCompare'
import { buildRecognitionFromCodes } from '@/lib/ivFluidCompare'
import { parseFluidText } from '@/lib/ivFluidParser'
import { parseGs1Serial, explainCheckDigit } from '@/lib/gs1Parser'
import {
  exportRecognitionCharsJson,
  findRecognitionByCode,
  importRecognitionCharsJson,
} from '@/lib/recognitionStore'
import type { RecognitionChar } from '@/types/fluidVerify'

interface RecognitionCharManagerProps {
  entries: RecognitionChar[]
  onAdd: (input: Omit<RecognitionChar, 'id' | 'createdAt'>) => void
  onRemove: (id: string) => void
  onImport: (entries: RecognitionChar[]) => void
  presetLabel?: string
  presetCode?: string
}

function EntryList({
  title,
  items,
  onRemove,
}: {
  title: string
  items: RecognitionChar[]
  onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-bold text-gray-900">{title}</h3>
        <p className="py-4 text-center text-xs text-gray-500">등록된 항목 없음</p>
      </section>
    )
  }

  return (
      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-bold text-gray-900">
        {title} <span className="text-brand">({items.length})</span>
      </h3>
      <ul className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
        {items.map((entry) => (
          <li key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-gray-900">
                <span className="font-semibold">{entry.fluidName}</span>
                <span className="text-gray-400">-</span>
                <span className="font-mono text-brand">{entry.companyCode}</span>
                <span className="text-gray-400">-</span>
                <span className="font-mono text-brand">{entry.itemCode}</span>
              </p>
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
                aria-label="삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RecognitionCharManager({
  entries,
  onAdd,
  onRemove,
  onImport,
  presetLabel = '',
  presetCode = '',
}: RecognitionCharManagerProps) {
  const [kind, setKind] = useState<RecognitionChar['kind']>('fluid')
  const [labelFluidName, setLabelFluidName] = useState(presetLabel)
  const [gs1Serial, setGs1Serial] = useState(presetCode)
  const [companyCode, setCompanyCode] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [matchMessage, setMatchMessage] = useState<string | null>(null)

  const preview = parseFluidText(labelFluidName)
  const gs1Preview = gs1Serial ? parseGs1Serial(gs1Serial) : null
  const checkBreakdown = gs1Preview ? explainCheckDigit(gs1Preview.gtin14) : null

  const fluidEntries = entries.filter((e) => e.kind === 'fluid')
  const chemoEntries = entries.filter((e) => e.kind === 'chemo')

  useEffect(() => {
    if (!presetCode) return
    const parsed = parseGs1Serial(presetCode)
    if (parsed) {
      setCompanyCode(parsed.gtin.companyCode)
      setItemCode(parsed.gtin.itemCode)
    }
  }, [presetCode])

  useEffect(() => {
    if (gs1Preview) {
      setCompanyCode(gs1Preview.gtin.companyCode)
      setItemCode(gs1Preview.gtin.itemCode)
    }
  }, [gs1Serial])

  const handleMatchTest = () => {
    setMatchMessage(null)
    setError(null)

    if (!labelFluidName.trim() || !gs1Serial.trim()) {
      setError('조제라벨 약품명과 일련번호를 모두 입력해 주세요.')
      playBangBang()
      return
    }

    if (gs1Preview && !gs1Preview.gtin.checkDigitValid) {
      setMatchMessage('GTIN 검증번호 오류 — 일련번호를 다시 확인하세요.')
      playBangBang()
      return
    }

    const existing = findRecognitionByCode(gs1Serial, entries, kind)

    if (existing && drugNamesMatch(labelFluidName, existing.labelFluidName)) {
      setMatchMessage(`일치: 등록된 "${existing.labelFluidName}" ↔ 업체 ${existing.companyCode} · 품목 ${existing.itemCode}`)
      playDomisol()
      return
    }

    if (existing && !drugNamesMatch(labelFluidName, existing.labelFluidName)) {
      setMatchMessage(
        `불일치: 코드는 "${existing.labelFluidName}"용 — 입력 "${labelFluidName.trim()}"와 다릅니다.`,
      )
      playBangBang()
      return
    }

    if (companyCode && itemCode && labelFluidName.trim()) {
      setMatchMessage('신규 등록 가능 — 아직 인식문자에 없는 코드입니다.')
      playBangBang()
      return
    }

    setMatchMessage('일련번호에서 코드를 추출하지 못했습니다.')
    playBangBang()
  }

  const handleAdd = () => {
    if (!labelFluidName.trim()) {
      setError(kind === 'fluid' ? '조제라벨 수액명을 입력해 주세요.' : '조제라벨 약품명을 입력해 주세요.')
      playBangBang()
      return
    }
    if (!companyCode.trim() || !itemCode.trim()) {
      setError('일련번호에서 업체·품목코드를 추출하거나 직접 입력해 주세요.')
      playBangBang()
      return
    }

    const duplicate = entries.some(
      (entry) =>
        entry.kind === kind &&
        entry.companyCode === companyCode.replace(/\D/g, '') &&
        entry.itemCode === itemCode.replace(/\D/g, ''),
    )
    if (duplicate) {
      setError('같은 업체코드·품목코드가 이미 등록되어 있습니다.')
      playBangBang()
      return
    }

    onAdd(buildRecognitionFromCodes(labelFluidName, companyCode, itemCode, kind, memo || undefined))
    setLabelFluidName('')
    setGs1Serial('')
    setCompanyCode('')
    setItemCode('')
    setMemo('')
    setError(null)
    setMatchMessage(null)
    playDomisol()
  }

  const handleExport = () => {
    const blob = new Blob([exportRecognitionCharsJson(entries)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `인식문자-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (files: FileList | null) => {
    if (!files?.[0]) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = importRecognitionCharsJson(String(reader.result))
        onImport(imported)
      } catch {
        setError('JSON 파일을 불러오지 못했습니다.')
      }
    }
    reader.readAsText(files[0])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen size={16} />
          인식문자 관리
        </div>
        <p className="mt-1 text-xs text-violet-800">
          조제라벨 약품명 ↔ 일련번호(GTIN)를 연결
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-bold text-gray-900">새 인식문자 등록</h3>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('fluid')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                kind === 'fluid'
                  ? 'bg-brand text-white'
                  : 'bg-badge-inactive text-gray-500 ring-1 ring-gray-200/80'
              }`}
            >
              수액
            </button>
            <button
              type="button"
              onClick={() => setKind('chemo')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                kind === 'chemo'
                  ? 'bg-chemo-prep text-white'
                  : 'bg-badge-inactive text-gray-500 ring-1 ring-gray-200/80'
              }`}
            >
              항암주사제
            </button>
          </div>

          <OcrInputField
            label={kind === 'fluid' ? '조제라벨 수액명 (맨 아래 줄)' : '조제라벨 약품명'}
            value={labelFluidName}
            onChange={setLabelFluidName}
            placeholder={
              kind === 'fluid'
                ? 'Half saline 0.45% 1L(이노엔)'
                : 'Holoxan 주1g(부광) W25'
            }
            multiline
          />

          <OcrInputField
            label="수액/약품 일련번호 (GTIN)"
            value={gs1Serial}
            onChange={setGs1Serial}
            placeholder="(01)08806411123459(17)281231(10)LOT5632(21)..."
            multiline
            barcodeScan
            mono
          />

          {gs1Preview && (
            <div
              className={`rounded-xl px-3 py-2 text-[11px] ${
                gs1Preview.gtin.checkDigitValid ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-900'
              }`}
            >
              <p>
                GTIN-14: <span className="font-mono font-semibold">{gs1Preview.gtin14}</span>
              </p>
              <p className="mt-1">
                업체 <strong>{gs1Preview.gtin.companyCode}</strong> · 품목{' '}
                <strong>{gs1Preview.gtin.itemCode}</strong> · 검증{' '}
                {gs1Preview.gtin.checkDigitValid ? 'OK' : `NG → ${gs1Preview.gtin.expectedCheckDigit}`}
              </p>
              {checkBreakdown && (
                <p className="mt-1 font-mono text-[10px] opacity-90">
                  홀수합 {checkBreakdown.oddSum}×3={checkBreakdown.oddWeighted} + 짝수합{' '}
                  {checkBreakdown.evenSum} = {checkBreakdown.total} → {checkBreakdown.expected}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">업체코드</span>
              <input
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6411"
                className="rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm outline-none ring-brand/30 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">품목코드</span>
              <input
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="12345"
                className="rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm outline-none ring-brand/30 focus:ring-2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">메모 (선택)</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
            />
          </label>

          {kind === 'fluid' && (preview.name || preview.volumeLabel) && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
              파싱: <strong>{preview.name ?? '?'}</strong>
              {preview.volumeLabel ? ` · ${preview.volumeLabel}` : ''}
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {matchMessage && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                matchMessage.startsWith('일치')
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {matchMessage}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleMatchTest}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
              <Volume2 size={14} />
              매칭 확인
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus size={14} />
              등록
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={entries.length === 0}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          <Download size={14} />
          JSON 내보내기
        </button>
        <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold">
          <Upload size={14} />
          JSON 가져오기
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => handleImport(e.target.files)} />
        </label>
      </div>

      {kind === 'fluid' ? (
        <EntryList title="수액 인식문자" items={fluidEntries} onRemove={onRemove} />
      ) : (
        <EntryList title="항암주사제 인식문자" items={chemoEntries} onRemove={onRemove} />
      )}
    </div>
  )
}
