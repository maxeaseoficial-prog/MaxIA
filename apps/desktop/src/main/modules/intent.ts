export type MaxIntent =
  | { type: 'sleep' }
  | { type: 'open-browser' }
  | { type: 'open-google' }
  | { type: 'open-brain' }
  | { type: 'open-app'; appName: string }
  | { type: 'screen-question' }
  | { type: 'conversation'; text: string }

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripWakeWord(value: string): string {
  return normalizeText(value).replace(/^(ei|hey)\s+max\b\s*/i, '').trim()
}

export function hasWakeWord(value: string): boolean {
  return /\b(?:ei|hey)\s+max\b/i.test(normalizeText(value))
}

export function classifyCommand(raw: string): MaxIntent {
  const text = stripWakeWord(raw)

  if (/^(descansar|descanse|dormir|durma)$/.test(text)) return { type: 'sleep' }
  if (/^(abra|abrir)\s+(o\s+)?(meu\s+)?navegador$/.test(text)) return { type: 'open-browser' }
  if (/^(abra|abrir)\s+(o\s+)?google$/.test(text)) return { type: 'open-google' }
  if (/^(abra|abrir)\s+(o\s+)?(seu\s+)?cerebro$/.test(text)) return { type: 'open-brain' }
  if (/^(o que|oque).*(na|minha) tela|o que.*aparecendo.*tela|olha isso/.test(text)) return { type: 'screen-question' }

  const app = text.match(/^(?:abra|abrir)\s+(?:o\s+|a\s+)?(.+)$/)
  if (app?.[1]) return { type: 'open-app', appName: app[1].trim() }

  return { type: 'conversation', text: raw.trim() }
}
