import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, QrCode } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { ChemoSection, ManageTab, VerifyTab } from '@/types/chemo'
import { APP_NAME, APP_TAGLINE } from '@/types/chemo'
import { FluidVerifier } from '@/components/qr/FluidVerifier'
import { PrepLabelVerifier } from '@/components/qr/PrepLabelVerifier'
import { RecognitionCharManager } from '@/components/qr/RecognitionCharManager'
import { QrConversionPanel } from '@/components/qr/QrConversionPanel'
import { useRecognitionChars } from '@/hooks/useRecognitionChars'
import type { CompareStatus } from '@/types/fluidVerify'
import { isMismatchStatus } from '@/lib/alertSounds'

const VERIFY_TABS: { id: VerifyTab; label: string }[] = [
  { id: 'fluid', label: '수액검증' },
  { id: 'prep', label: '조제검증' },
]

const MANAGE_TABS: { id: ManageTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'recognition', label: '인식문자 관리', icon: BookOpen },
  { id: 'qr', label: 'QR변환', icon: QrCode },
]

const SECTION_ACTIVE_CLASS: Record<ChemoSection, string> = {
  verify: 'bg-chemo-verify text-white border-chemo-verify',
  manage: 'bg-chemo-manage text-white border-chemo-manage',
}

const SECTION_INACTIVE_CLASS =
  'bg-badge-inactive text-gray-500 border-gray-300 hover:bg-gray-200/80'

const SUB_TAB_ACTIVE_CLASS: Record<VerifyTab | ManageTab, string> = {
  fluid: 'bg-brand text-white',
  prep: 'bg-chemo-prep text-white',
  recognition: 'bg-chemo-recognition text-white',
  qr: 'bg-chemo-qr text-white',
}

const SECTION_PANEL_CLASS: Record<ChemoSection, string> = {
  verify: 'border-chemo-verify/50 bg-chemo-verify/20',
  manage: 'border-chemo-manage/45 bg-chemo-manage/14',
}

const SUB_TAB_INACTIVE_CLASS = 'bg-badge-inactive text-gray-500 ring-1 ring-gray-200/80'

interface IndexTabProps {
  label: string
  active: boolean
  zIndex: number
  overlapClass: string
  onClick: () => void
}

function IndexTab({ label, active, zIndex, overlapClass, onClick }: IndexTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ zIndex }}
      className={`relative min-w-[4rem] rounded-t-lg border px-3.5 py-1.5 text-xs font-semibold transition-all ${overlapClass} ${
        active
          ? `${SECTION_ACTIVE_CLASS[label === '검증' ? 'verify' : 'manage']} border-b-transparent pb-2 shadow-sm`
          : `${SECTION_INACTIVE_CLASS} top-0.5 border-b-gray-300 py-1 opacity-90`
      }`}
    >
      {label}
    </button>
  )
}

export function ChemoCrosscheckPage() {
  const [section, setSection] = useState<ChemoSection>('verify')
  const [verifyTab, setVerifyTab] = useState<VerifyTab>('fluid')
  const [manageTab, setManageTab] = useState<ManageTab>('recognition')
  const [fluidTabBlink, setFluidTabBlink] = useState(false)

  const { entries, addEntry, removeEntry, replaceAll } = useRecognitionChars()
  const [registerPreset, setRegisterPreset] = useState({ label: '', code: '' })

  const goRegister = (label: string, code = '') => {
    setRegisterPreset({ label, code })
    setSection('manage')
    setManageTab('recognition')
  }

  const handleFluidVerifyAlert = useCallback((status: CompareStatus) => {
    if (isMismatchStatus(status)) {
      setFluidTabBlink(true)
    } else if (status === 'match') {
      setFluidTabBlink(false)
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="safe-bottom shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">{APP_NAME}</h1>
            <p className="text-xs text-gray-500">{APP_TAGLINE}</p>
          </div>
        </div>
      </header>

      <nav className="mx-auto w-full max-w-2xl shrink-0 px-4 pt-2">
        {/* 색인표 — 겹친 폴더 탭 */}
        <div className="relative flex items-end pl-1">
          <IndexTab
            label="검증"
            active={section === 'verify'}
            zIndex={section === 'verify' ? 30 : 10}
            overlapClass="-mr-2"
            onClick={() => setSection('verify')}
          />
          <IndexTab
            label="관리"
            active={section === 'manage'}
            zIndex={section === 'manage' ? 30 : 20}
            overlapClass=""
            onClick={() => setSection('manage')}
          />
        </div>

        {/* 선택된 폴더 — 하위 기능 패널 */}
        <div
          className={`relative z-20 -mt-px rounded-b-2xl rounded-tr-2xl border shadow-sm ${SECTION_PANEL_CLASS[section]}`}
        >
          <div className="grid grid-cols-2 gap-1.5 p-2">
            {section === 'verify'
              ? VERIFY_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVerifyTab(id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold sm:text-base ${
                      verifyTab === id ? SUB_TAB_ACTIVE_CLASS[id] : SUB_TAB_INACTIVE_CLASS
                    } ${id === 'fluid' && fluidTabBlink ? 'badge-mismatch-blink ring-2 ring-red-400' : ''}`}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                ))
              : MANAGE_TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setManageTab(id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold sm:text-base ${
                      manageTab === id ? SUB_TAB_ACTIVE_CLASS[id] : SUB_TAB_INACTIVE_CLASS
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-2">
        {section === 'verify' && verifyTab === 'fluid' && (
          <FluidVerifier
            recognitionChars={entries}
            onRegisterRequest={(label, code) => goRegister(label, code)}
            onVerifyAlert={handleFluidVerifyAlert}
          />
        )}
        {section === 'verify' && verifyTab === 'prep' && (
          <PrepLabelVerifier recognitionChars={entries} />
        )}
        {section === 'manage' && manageTab === 'recognition' && (
          <RecognitionCharManager
            key={`${registerPreset.label}:${registerPreset.code}`}
            entries={entries}
            onAdd={addEntry}
            onRemove={removeEntry}
            onImport={(imported) => replaceAll([...imported, ...entries])}
            presetLabel={registerPreset.label}
            presetCode={registerPreset.code}
          />
        )}
        {section === 'manage' && manageTab === 'qr' && <QrConversionPanel />}
      </main>
    </div>
  )
}
