const WEATHER_QUERY = /\b(?:previs[aã]o|tempo|clima|chuva|chover|sol|temperatura)\b/i

const TECHNICAL_WEATHER_TERMS = [
  /\bpress[aã]o\b/i,
  /\bhpa\b/i,
  /\bponto de orvalho\b/i,
  /\bvisibilidade\b/i,
  /\b[ií]ndice uv\b/i,
  /\bcobertura de nuvens\b/i,
  /\bdire[cç][aã]o do vento\b/i,
  /\brajadas?\b/i
]

export function shapeAssistantReply(prompt: string, reply: string): string {
  const clean = stripFormatting(reply)
  if (!clean) return ''

  if (WEATHER_QUERY.test(prompt)) {
    return shapeWeatherReply(clean)
  }

  return limitSentences(clean, 3)
}

export function shapeWeatherReply(reply: string): string {
  const clean = stripFormatting(reply)
  const condition = detectWeatherCondition(clean)
  const max = extractTemperature(clean, /(?:m[aá]xima|max(?:imum)?)[^\d-]{0,18}(-?\d{1,2}(?:[.,]\d+)?)/i)
  const min = extractTemperature(clean, /(?:m[ií]nima|min(?:imum)?)[^\d-]{0,18}(-?\d{1,2}(?:[.,]\d+)?)/i)
  const current = extractTemperature(clean, /(?:temperatura(?: atual)?|agora)[^\d-]{0,18}(-?\d{1,2}(?:[.,]\d+)?)/i)
    ?? extractFirstDegreeTemperature(clean)
  const rainChance = extractRainChance(clean)

  const details: string[] = []

  if (max !== null && min !== null) {
    details.push('máxima de ' + formatNumber(max) + ' graus e mínima de ' + formatNumber(min) + ' graus')
  } else if (current !== null) {
    details.push(formatNumber(current) + ' graus')
  } else if (max !== null) {
    details.push('máxima de ' + formatNumber(max) + ' graus')
  } else if (min !== null) {
    details.push('mínima de ' + formatNumber(min) + ' graus')
  }

  if (rainChance !== null) {
    details.push('chance de chuva de ' + formatNumber(rainChance) + ' por cento')
  }

  if (condition && details.length) {
    return 'Previsão de ' + condition + ', com ' + joinNatural(details) + '.'
  }

  if (condition) {
    const useful = firstUsefulWeatherSentence(clean)
    if (useful && !new RegExp(condition, 'i').test(useful)) {
      return 'Previsão de ' + condition + '. ' + useful
    }
    return 'Previsão de ' + condition + '.'
  }

  return limitSentences(removeTechnicalWeatherSentences(clean), 2)
}

function stripFormatting(value: string): string {
  return value
    .replace(/[\x60*_~#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectWeatherCondition(text: string): string | null {
  if (/\b(?:chuva|chuvoso|chover|garoa|temporal|trovoad)/i.test(text)) return 'chuva'
  if (/\b(?:sol|ensolarad|céu aberto|ceu aberto)\b/i.test(text)) return 'sol'
  if (/\b(?:nublado|nuvens|encoberto)\b/i.test(text)) return 'tempo nublado'
  if (/\b(?:frio|queda de temperatura)\b/i.test(text)) return 'tempo frio'
  if (/\b(?:calor|quente|temperaturas? altas?)\b/i.test(text)) return 'tempo quente'
  return null
}

function extractTemperature(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function extractFirstDegreeTemperature(text: string): number | null {
  const match = text.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*(?:°\s*C|graus(?:\s+celsius)?)/i)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function extractRainChance(text: string): number | null {
  const patterns = [
    /(?:chance|probabilidade)[^\d]{0,18}(\d{1,3})\s*%[^\n.!?]{0,20}(?:chuva|precipita)/i,
    /(?:chuva|precipita)[^\d]{0,22}(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%[^\n.!?]{0,20}(?:chance|probabilidade)[^\n.!?]{0,20}(?:chuva|precipita)/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value
  }

  return null
}

function removeTechnicalWeatherSentences(text: string): string {
  const sentences = splitSentences(text)
  const filtered = sentences.filter(sentence =>
    !TECHNICAL_WEATHER_TERMS.some(pattern => pattern.test(sentence))
  )
  return filtered.join('. ')
}

function firstUsefulWeatherSentence(text: string): string {
  return splitSentences(removeTechnicalWeatherSentences(text))[0] ?? ''
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

function limitSentences(text: string, max: number): string {
  const sentences = splitSentences(text)
  if (sentences.length <= max) return text.trim()
  return sentences.slice(0, max).join(' ')
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace('.', ',')
}

function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1]
}
