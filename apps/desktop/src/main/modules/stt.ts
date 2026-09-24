import type { NativeMacSpeechProcess, SpeechMode } from './native-speech'

export type Transcription = { text: string }

export interface SttProvider {
  readonly id: string
  transcribe(
    samples: Float32Array,
    sampleRate?: number,
    mode?: SpeechMode
  ): Promise<Transcription>
}

export class NativeMacSpeechProvider implements SttProvider {
  readonly id = 'macos-speech-analyzer-native'
  private readonly process: NativeMacSpeechProcess

  constructor(process: NativeMacSpeechProcess) {
    this.process = process
  }

  async transcribe(
    samples: Float32Array,
    sampleRate = 48_000,
    mode: SpeechMode = 'command'
  ): Promise<Transcription> {
    if (samples.length < Math.round(sampleRate * 0.2)) return { text: '' }

    const text = sanitizeTranscript(
      await this.process.transcribe(samples, sampleRate, mode)
    )

    return { text }
  }
}

export function sanitizeTranscript(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 420) return ''

  const ambientOnly = /^(?:\[(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\]|\((?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\)|(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel))[.!?]*$/i
  if (ambientOnly.test(text)) return ''

  const words = text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) ?? []

  if (words.length >= 7) {
    const counts = new Map<string, number>()
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
    const maxCount = Math.max(...counts.values())
    if (maxCount / words.length >= 0.55) return ''
  }

  text = text.replace(/\bestam\b/gi, 'está')
  text = text.replace(
    /^((?:(?:hey|ei|e)\s+(?:max|mais|mex)[, ]+)?)abram\b/i,
    (_match, prefix: string) => `${prefix ?? ''}abra`
  )

  return text
}
