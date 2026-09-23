import { normalizeText, stripWakeWord } from './intent'

export type WakeWordDetection = { detected: boolean; commandAfterWakeWord: string }

const WAKE_PREFIX = /\b(?:hey|ei|e)\s+(?:max|mais|mex)\b/i

export class WakeWordEngine {
  readonly phrase = 'Hey Max'

  detect(transcript: string): WakeWordDetection {
    const normalized = normalizeText(transcript)
    const match = normalized.match(WAKE_PREFIX)

    if (!match) return { detected: false, commandAfterWakeWord: '' }

    const canonical = normalized.replace(WAKE_PREFIX, 'hey max')
    return {
      detected: true,
      commandAfterWakeWord: stripWakeWord(canonical)
    }
  }
}
