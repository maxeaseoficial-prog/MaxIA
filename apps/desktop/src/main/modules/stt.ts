import type { LocalAiProcess } from './local-ai-process'

export type Transcription = { text: string }

export interface SttProvider {
  readonly id: string
  transcribe(samples: Float32Array, sampleRate?: number): Promise<Transcription>
}

export class LocalWhisperProvider implements SttProvider {
  readonly id = 'isolated-xenova-whisper-tiny'

  constructor(private readonly process: LocalAiProcess) {}

  async transcribe(samples: Float32Array, sampleRate = 16_000): Promise<Transcription> {
    if (samples.length < Math.round(sampleRate * 0.35)) return { text: '' }

    const view = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
    const result = await this.process.request<{ text: string }>({
      type: 'stt',
      samplesBase64: view.toString('base64'),
      sampleRate
    }, 90_000)

    return { text: sanitizeTranscript(result.text) }
  }
}

export function sanitizeTranscript(raw: string): string {
  const text = raw
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')

  if (!text || text.length > 360) return ''

  const words = text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) ?? []

  if (!words.length) return ''

  if (words.length >= 7) {
    const counts = new Map<string, number>()
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)

    const maxCount = Math.max(...counts.values())
    const uniqueRatio = counts.size / words.length

    // Whisper pode alucinar uma mesma palavra centenas de vezes em silêncio.
    if (maxCount / words.length >= 0.42) return ''
    if (words.length >= 12 && uniqueRatio < 0.28) return ''
  }

  if (/^(?:não[\s,.;!?]*){4,}$/i.test(text)) return ''
  if (/^(?:no[\s,.;!?]*){5,}$/i.test(text)) return ''

  return text
}
