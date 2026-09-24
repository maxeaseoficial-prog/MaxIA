import type { SpeechMode } from './native-speech'
import type { SttProvider, Transcription } from './stt'
import type { TtsEngine } from './tts'

export class AudioEngine {
  constructor(private readonly stt: SttProvider, private readonly tts: TtsEngine) {}

  transcribe(
    samples: Float32Array,
    sampleRate = 48_000,
    mode: SpeechMode = 'command'
  ): Promise<Transcription> {
    return this.stt.transcribe(samples, sampleRate, mode)
  }

  speak(text: string): Promise<void> {
    return this.tts.speak(text)
  }

  interruptSpeech(): void {
    this.tts.stop()
  }
}
