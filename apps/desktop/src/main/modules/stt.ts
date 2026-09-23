export type Transcription = { text: string }

export interface SttProvider {
  readonly id: string
  transcribe(samples: Float32Array, sampleRate?: number): Promise<Transcription>
}

export class LocalWhisperProvider implements SttProvider {
  readonly id = 'xenova-whisper-tiny-local'
  private transcriberPromise: Promise<any> | null = null

  constructor(private readonly cacheDir?: string) {}

  private async transcriber(): Promise<any> {
    if (!this.transcriberPromise) {
      this.transcriberPromise = import('@xenova/transformers').then(async ({ pipeline, env }) => {
        env.allowLocalModels = true
        env.allowRemoteModels = true
        env.useBrowserCache = false
        if (this.cacheDir) env.cacheDir = this.cacheDir
        return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
      })
    }
    return this.transcriberPromise
  }

  async transcribe(samples: Float32Array): Promise<Transcription> {
    if (samples.length < 1600) return { text: '' }
    const pipe = await this.transcriber()
    const result = await pipe(samples, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: 20,
      stride_length_s: 3
    })
    return { text: String(result?.text ?? '').trim() }
  }
}
