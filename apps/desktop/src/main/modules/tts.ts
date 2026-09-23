import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class TtsEngine {
  private process: ChildProcessWithoutNullStreams | null = null
  private voicePromise: Promise<string | null> | null = null

  async speak(text: string): Promise<void> {
    this.stop()

    const voice = await this.resolveMalePtBrVoice()
    const args: string[] = []

    if (voice) args.push('-v', voice)

    // Um pouco mais lento que o padrão deixa a voz masculina mais natural.
    args.push('-r', '185', text)

    await new Promise<void>((resolve, reject) => {
      const process = spawn('/usr/bin/say', args, { stdio: 'pipe' })
      this.process = process
      process.once('error', reject)
      process.once('exit', code => {
        if (this.process === process) this.process = null
        if (code === 0 || code === null) resolve()
        else reject(new Error(`say encerrou com código ${code}`))
      })
    })
  }

  stop(): void {
    if (this.process && !this.process.killed) this.process.kill('SIGTERM')
    this.process = null
  }

  private resolveMalePtBrVoice(): Promise<string | null> {
    if (!this.voicePromise) {
      this.voicePromise = this.findMalePtBrVoice()
    }
    return this.voicePromise
  }

  private async findMalePtBrVoice(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('/usr/bin/say', ['-v', '?'])
      const voices = String(stdout)
        .split('\n')
        .map(line => line.match(/^(.+?)\s+pt_BR\s+#/i)?.[1]?.trim())
        .filter((voice): voice is string => Boolean(voice))

      const malePrefixes = ['felipe', 'eddy', 'reed', 'rocko']
      const maleVoice = voices.find(voice => {
        const normalized = voice.toLowerCase()
        return malePrefixes.some(prefix => normalized.startsWith(prefix))
      })

      if (maleVoice) {
        console.log(`[MAX][TTS] voz masculina pt-BR: ${maleVoice}`)
        return maleVoice
      }

      throw new Error(
        'Nenhuma voz masculina pt-BR está instalada. Instale a voz Felipe em Ajustes do Sistema > Acessibilidade > Leitura e Fala > Voz do sistema.'
      )
    } catch (error) {
      console.warn('[MAX][TTS] não foi possível listar as vozes do macOS.', error)
      return null
    }
  }
}
