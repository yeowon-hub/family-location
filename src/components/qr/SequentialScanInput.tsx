import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScanLine } from 'lucide-react'

export interface ScanStep {
  id: string
  label: string
  done?: boolean
}

interface SequentialScanInputProps {
  steps: ScanStep[]
  activeIndex: number
  onScan: (text: string) => void
  /** 완료 직후 안내 (입력칸은 계속 활성) */
  completeHint?: string | null
  /** QR 인식 제목 줄 오른쪽 */
  headerExtra?: ReactNode
  /** 스캔 입력 아래 보조 패널 (카메라/OCR 등) */
  auxiliaryPanel?: ReactNode
}

export function SequentialScanInput({
  steps,
  activeIndex,
  onScan,
  completeHint = null,
  headerExtra,
  auxiliaryPanel,
}: SequentialScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  useEffect(() => {
    focusInput()
  }, [activeIndex, completeHint])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onScan(text)
    setDraft('')
    focusInput()
  }

  return (
    <section className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <ScanLine size={16} className="text-brand" />
            <h3 className="text-xs font-bold text-gray-900 sm:text-sm">QR 인식</h3>
          </div>
          {steps.map((step, index) => {
            const isActive = index === activeIndex
            const isDone = Boolean(step.done)
            return (
              <span
                key={step.id}
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold sm:text-[11px] ${
                  isActive
                    ? 'bg-brand text-white'
                    : isDone
                      ? 'bg-green-100 text-green-800'
                      : 'bg-white text-gray-500 ring-1 ring-gray-200'
                }`}
              >
                {step.label}
              </span>
            )
          })}
        </div>
        {headerExtra && <div className="flex shrink-0 items-center gap-1.5">{headerExtra}</div>}
      </div>

      {completeHint && (
        <p className="mb-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
          {completeHint}
        </p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="스캔…"
        className="w-full rounded-xl border border-brand/40 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand/30 focus:ring-2"
        autoComplete="off"
        spellCheck={false}
      />

      {auxiliaryPanel && (
        <div className="mt-2 flex flex-col gap-2 border-t border-brand/20 pt-2">{auxiliaryPanel}</div>
      )}
    </section>
  )
}
