import type { NativeMacSpeechProcess } from './native-speech'

export type Transcription = { text: string }

export interface SttProvider {
  readonly id: string
  transcribe(samples: Float32Array, sampleRate?: number): Promise<Transcription>
}

export class NativeMacSpeechProvider implements SttProvider {
  readonly id = 'macos-speech-analyzer-native'
  private readonly process: NativeMacSpeechProcess

  constructor(process: NativeMacSpeechProcess) {
    this.process = process
  }

  async transcribe(samples: Float32Array, sampleRate = 16_000): Promise<Transcription> {
    if (samples.length < Math.round(sampleRate * 0.3)) return { text: '' }

    const text = sanitizeTranscript(await this.process.transcribe(samples, sampleRate))
    return { text }
  }
}

export function sanitizeTranscript(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 420) return ''

  const ambientOnly = /^(?:\[(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\]|\((?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\)|(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel))[.!?]*$/i
  if (ambientOnly.test(text)) return ''

  return text
}
