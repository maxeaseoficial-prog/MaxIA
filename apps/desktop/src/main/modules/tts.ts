import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class TtsEngine {
  private process: ChildProcessWithoutNullStreams | null = null
  private voicePromise: Promise<string | null> | null = null

  async speak(text: string): Promise<void> {
    this.stop()

    const speechText = prepareSpeechText(text)
    if (!speechText) return

    const voice = await this.resolvePreferredVoice()
    const args: string[] = []

    if (voice) args.push('-v', voice)

    // 185 era a velocidade da versão que soava mais natural.
    args.push('-r', '185', speechText)

    await new Promise<void>((resolve, reject) => {
      const child = spawn('/usr/bin/say', args, { stdio: 'pipe' })
      this.process = child

      child.once('error', reject)
      child.once('exit', code => {
        if (this.process === child) this.process = null
        if (code === 0 || code === null) resolve()
        else reject(new Error('say encerrou com código ' + String(code)))
      })
    })
  }

  stop(): void {
    if (this.process && !this.process.killed) this.process.kill('SIGTERM')
    this.process = null
  }

  private resolvePreferredVoice(): Promise<string | null> {
    if (!this.voicePromise) this.voicePromise = this.findPreferredVoice()
    return this.voicePromise
  }

  private async findPreferredVoice(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('/usr/bin/say', ['-v', '?'])
      const voices = String(stdout)
        .split('\n')
        .map(line => line.match(/^(.+?)\s+pt_BR\s+#/i)?.[1]?.trim())
        .filter((voice): voice is string => Boolean(voice))

      const preferred = [
        'Felipe',
        'Eddy (Portuguese (Brazil))',
        'Reed (Portuguese (Brazil))',
        'Rocko (Portuguese (Brazil))'
      ]

      for (const candidate of preferred) {
        const exact = voices.find(voice => voice.toLowerCase() === candidate.toLowerCase())
        if (exact) {
          console.log('[MAX][TTS] voz restaurada: ' + exact)
          return exact
        }
      }

      const felipeVariant = voices.find(voice => voice.toLowerCase().startsWith('felipe'))
      if (felipeVariant) {
        console.log('[MAX][TTS] voz restaurada: ' + felipeVariant)
        return felipeVariant
      }

      // A versão anterior deixava o macOS usar a voz escolhida no sistema.
      // Isso tende a soar melhor que escolher uma voz pt-BR arbitrária.
      console.warn('[MAX][TTS] Felipe não encontrado; usando a voz padrão configurada no macOS.')
      return null
    } catch (error) {
      console.warn('[MAX][TTS] não foi possível listar as vozes; usando a voz padrão do macOS.', error)
      return null
    }
  }
}

export function prepareSpeechText(input: string): string {
  let text = input.normalize('NFC').trim()
  if (!text) return ''

  // Remove nomes de pontuação caso venham escritos pela resposta.
  // Mantemos a pontuação real porque ela dá prosódia natural ao /usr/bin/say.
  text = text
    .replace(/\b(?:ponto final|ponto de exclama(?:ção|cao)|ponto de interroga(?:ção|cao)|vírgula|virgula|abre aspas|fecha aspas)\b/gi, ' ')
    .replace(/https?:\/\/\S+/gi, 'link')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, '$1 horas e $2')
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\s*C\b/gi, '$1 graus')
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\b/g, '$1 graus')
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 por cento')
    .replace(/\x60\x60\x60[a-z0-9_-]*\n?/gi, '')
    .replace(/\x60\x60\x60/g, '')
    .replace(/[*_~#>|]/g, '')
    .replace(/[“”"]/g, '')
    .replace(/[‘’']/g, '')
    .replace(/[()[\]{}<>]/g, ' ')
    .replace(/[—–]/g, ', ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])(?=\S)/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}
