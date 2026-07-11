import { useCallback, useEffect, useState } from 'react'
import type { RecognitionChar } from '@/types/fluidVerify'
import {
  createRecognitionChar,
  loadRecognitionChars,
  saveRecognitionChars,
} from '@/lib/recognitionStore'

export function useRecognitionChars() {
  const [entries, setEntries] = useState<RecognitionChar[]>(() => loadRecognitionChars())

  useEffect(() => {
    saveRecognitionChars(entries)
  }, [entries])

  const addEntry = useCallback(
    (input: Omit<RecognitionChar, 'id' | 'createdAt'>) => {
      const entry = createRecognitionChar(input)
      setEntries((prev) => [entry, ...prev])
      return entry
    },
    [],
  )

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<RecognitionChar>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    )
  }, [])

  const replaceAll = useCallback((next: RecognitionChar[]) => {
    setEntries(next)
  }, [])

  return { entries, addEntry, removeEntry, updateEntry, replaceAll }
}
