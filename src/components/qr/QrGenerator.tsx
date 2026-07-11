import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, QrCode } from 'lucide-react'

export function QrGenerator() {
  const [text, setText] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setDataUrl(null)
      setError(null)
      return
    }

    try {
      const url = await QRCode.toDataURL(trimmed, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setDataUrl(url)
      setError(null)
    } catch {
      setDataUrl(null)
      setError('QR 코드를 만들 수 없습니다. 입력 내용을 확인해 주세요.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void generate(text)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [text, generate])

  const download = () => {
    if (!dataUrl) return

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `qr-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">숫자 또는 글자 입력</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="예: 1234567890, https://example.com, 제품명 ABC-001"
          rows={4}
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none ring-brand/30 focus:ring-2"
        />
      </label>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-6">
        {dataUrl ? (
          <>
            <img src={dataUrl} alt="생성된 QR 코드" className="h-[280px] w-[280px] rounded-lg" />
            <button
              type="button"
              onClick={download}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Download size={16} />
              PNG 저장
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <QrCode size={48} strokeWidth={1.5} />
            <p className="text-sm">입력하면 QR 코드가 여기에 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
