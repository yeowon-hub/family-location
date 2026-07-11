import {
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react'

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function AutoResizeTextarea({
  value,
  onChange,
  className = '',
  rows = 1,
  style,
  ...props
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const syncHeight = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useLayoutEffect(() => {
    syncHeight()
    requestAnimationFrame(syncHeight)
  }, [value, syncHeight])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange?.(event)
        syncHeight()
      }}
      style={{ fieldSizing: 'content', ...style }}
      className={`min-h-0 resize-none overflow-hidden ${className}`}
      {...props}
    />
  )
}
