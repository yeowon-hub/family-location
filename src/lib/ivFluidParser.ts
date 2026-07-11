import type { ParsedFluid } from '@/types/fluidVerify'

const NAME_ALIASES: { pattern: RegExp; name: string }[] = [
  { pattern: /5\s*%\s*D\s*W|5\s*%\s*DW|D\s*5\s*W|5\s*%\s*덱|5\s*%\s*포도|DEXTROSE\s*5/i, name: '5%DW' },
  { pattern: /10\s*%\s*D\s*W|10\s*%\s*DW|D\s*10\s*W|DEXTROSE\s*10/i, name: '10%DW' },
  { pattern: /0\.9\s*%\s*N\s*S|0\.9\s*%\s*NS|0\.9\s*%\s*NACL|NORMAL\s*SALINE|생리\s*식염|\bNS\b/i, name: 'NS' },
  { pattern: /RINGER|하트만|HARTMANN|\bRL\b|\bLR\b/i, name: 'LR' },
  {
    pattern: /HALF\s*NORMAL|HALF\s*SALINE|0\.45\s*%\s*N\s*S|0\.45\s*%\s*NS|0\.45\s*%|하프\s*식염|반장\s*식염/i,
    name: '0.45%NS',
  },
  { pattern: /3\s*%\s*N\s*S|3\s*%\s*NS/i, name: '3%NS' },
  { pattern: /D\s*W\b|DISTILLED\s*WATER|증류\s*수/i, name: 'DW' },
  { pattern: /5\s*%\s*DW\s*[\+\/]\s*NS|5\s*%\s*DW\s*NS/i, name: '5%DW+NS' },
]

function normalizeText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, ' ')
    .trim()
}

function parseVolumeMl(text: string): { ml: number | null; label: string | null } {
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML|cc|CC|밀리리터)/i)
  if (mlMatch) {
    const ml = Number.parseFloat(mlMatch[1])
    return { ml, label: `${mlMatch[1]}ml` }
  }

  const literMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|L|리터)(?![a-zA-Z])/i)
  if (literMatch) {
    const ml = Number.parseFloat(literMatch[1]) * 1000
    return { ml, label: `${literMatch[1]}L` }
  }

  return { ml: null, label: null }
}

function parseName(text: string): string | null {
  for (const alias of NAME_ALIASES) {
    if (alias.pattern.test(text)) return alias.name
  }

  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*([A-Z]{1,4})/i)
  if (percentMatch) {
    return `${percentMatch[1]}%${percentMatch[2].toUpperCase()}`
  }

  const shortName = text.match(/\b([A-Z]{2,6})\b/)
  if (shortName) return shortName[1].toUpperCase()

  return null
}

export function parseFluidText(raw: string): ParsedFluid {
  const normalized = normalizeText(raw)
  const { ml, label } = parseVolumeMl(normalized)
  const name = parseName(normalized)

  return {
    raw: normalized,
    name,
    volumeMl: ml,
    volumeLabel: label,
  }
}
