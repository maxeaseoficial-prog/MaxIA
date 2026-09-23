import type { SttProvider, Transcription } from './stt'
import type { TtsEngine } from './tts'

export class AudioEngine {
  constructor(private readonly stt: SttProvider, private readonly tts: TtsEngine) {}

  transcribe(samples: Float32Array): Promise<Transcription> {
    return this.stt.transcribe(samples, 16000)
  }

  speak(text: string): Promise<void> {
    return this.tts.speak(text)
  }

  interruptSpeech(): void {
    this.tts.stop()
  }
}
