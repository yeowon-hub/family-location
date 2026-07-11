import { useState } from 'react'
import { QrCode, ScanLine } from 'lucide-react'
import type { QrConversionTab } from '@/types/chemo'
import { QrGenerator } from '@/components/qr/QrGenerator'
import { QrScanner } from '@/components/qr/QrScanner'

const TABS: { id: QrConversionTab; label: string; icon: typeof QrCode }[] = [
  { id: 'generate', label: 'QR 만들기', icon: QrCode },
  { id: 'scan', label: 'QR/바코드 읽기', icon: ScanLine },
]

export function QrConversionPanel() {
  const [tab, setTab] = useState<QrConversionTab>('generate')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
        <p className="shrink-0 font-semibold">QR 변환</p>
        <p className="text-[10px] text-gray-600 sm:text-[11px]">
          글자·숫자 ↔ QR/바코드 변환 및 엑셀 내보내기
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              tab === id
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'generate' ? <QrGenerator /> : <QrScanner />}
    </div>
  )
}
