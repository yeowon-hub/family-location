import { parseFluidText } from '@/lib/ivFluidParser'

function normalizeDrugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]]/g, '')
    .replace(/주사|주|inj|injection/gi, '')
}

export function compareDrugNameText(labelName: string, scannedName: string): boolean {
  const a = normalizeDrugKey(labelName)
  const b = normalizeDrugKey(scannedName)
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true

  const pa = parseFluidText(labelName)
  const pb = parseFluidText(scannedName)

  if (pa.name && pb.name && pa.name === pb.name) {
    if (pa.volumeMl != null && pb.volumeMl != null) {
      return Math.abs(pa.volumeMl - pb.volumeMl) < 1
    }
    return true
  }

  return false
}

export function drugNamesMatch(labelName: string, registeredName: string): boolean {
  return compareDrugNameText(labelName, registeredName)
}
