import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

type SystemVoice = {
  name: string
  locale: string
}

export class TtsEngine {
  private process: ChildProcessWithoutNullStreams | null = null
  private voicePromise: Promise<string> | null = null

  async speak(text: string): Promise<void> {
    this.stop()

    const voice = await this.resolveMaleVoice()
    const args = ['-v', voice, '-r', '185', text]

    await new Promise<void>((resolve, reject) => {
      const process = spawn('/usr/bin/say', args, { stdio: 'pipe' })
      this.process = process

      process.once('error', reject)
      process.once('exit', code => {
        if (this.process === process) this.process = null
        if (code === 0 || code === null) resolve()
        else reject(new Error(\`say encerrou com código \${code}\`))
      })
    })
  }

  stop(): void {
    if (this.process && !this.process.killed) this.process.kill('SIGTERM')
    this.process = null
  }

  private resolveMaleVoice(): Promise<string> {
    if (!this.voicePromise) this.voicePromise = this.findMaleVoice()
    return this.voicePromise
  }

  private async findMaleVoice(): Promise<string> {
    const { stdout } = await execFileAsync('/usr/bin/say', ['-v', '?'])
    const voices = parseVoices(String(stdout))

    const preferredPtBr = ['felipe', 'eddy', 'reed', 'rocko']
    const ptBr = voices.find(voice =>
      voice.locale.toLowerCase() === 'pt_br' &&
      preferredPtBr.some(prefix => voice.name.toLowerCase().startsWith(prefix))
    )

    if (ptBr) {
      console.log(\`[MAX][TTS] voz masculina pt-BR: \${ptBr.name}\`)
      return ptBr.name
    }

    const preferredPortuguese = ['joão', 'joao', 'felipe']
    const portuguese = voices.find(voice =>
      voice.locale.toLowerCase().startsWith('pt_') &&
      preferredPortuguese.some(prefix => voice.name.toLowerCase().startsWith(prefix))
    )

    if (portuguese) {
      console.log(\`[MAX][TTS] voz masculina portuguesa: \${portuguese.name} (\${portuguese.locale})\`)
      return portuguese.name
    }

    const guaranteedMaleFallbacks = ['Alex', 'Daniel', 'Fred', 'Ralph', 'Bruce']
    for (const fallback of guaranteedMaleFallbacks) {
      const voice = voices.find(item => item.name.toLowerCase() === fallback.toLowerCase())
      if (voice) {
        console.warn(
          \`[MAX][TTS] voz masculina pt-BR não instalada; usando \${voice.name} (\${voice.locale}). \` +
          'Para português natural, instale Felipe em Ajustes do Sistema > Acessibilidade > Leitura e Fala.'
        )
        return voice.name
      }
    }

    throw new Error(
      'Nenhuma voz masculina compatível foi encontrada no macOS. ' +
      'Instale Felipe em Ajustes do Sistema > Acessibilidade > Leitura e Fala > Voz do sistema.'
    )
  }
}

function parseVoices(output: string): SystemVoice[] {
  const voices: SystemVoice[] = []

  for (const line of output.split('\n')) {
    const match = line.match(/^(.+?)\s+([a-z]{2}(?:_[A-Z]{2})?)\s+#/i)
    if (!match?.[1] || !match[2]) continue

    voices.push({
      name: match[1].trim(),
      locale: match[2].trim()
    })
  }

  return voices
}
