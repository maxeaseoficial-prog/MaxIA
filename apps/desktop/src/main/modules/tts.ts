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

    const speechText = prepareSpeechText(text)
    if (!speechText) return

    const voice = await this.resolvePortugueseVoice()
    const args = ['-v', voice, '-r', '165', speechText]

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

  private resolvePortugueseVoice(): Promise<string> {
    if (!this.voicePromise) this.voicePromise = this.findPortugueseVoice()
    return this.voicePromise
  }

  private async findPortugueseVoice(): Promise<string> {
    const { stdout } = await execFileAsync('/usr/bin/say', ['-v', '?'])
    const voices = parseVoices(String(stdout))

    const preferredMalePtBr = ['felipe', 'thiago', 'eddy', 'reed', 'rocko']
    const malePtBr = voices.find(voice =>
      voice.locale.toLowerCase() === 'pt_br' &&
      preferredMalePtBr.some(prefix => voice.name.toLowerCase().startsWith(prefix))
    )

    if (malePtBr) {
      console.log('[MAX][TTS] voz pt-BR preferida: ' + malePtBr.name)
      return malePtBr.name
    }

    const anyPtBr = voices.find(voice => voice.locale.toLowerCase() === 'pt_br')
    if (anyPtBr) {
      console.warn('[MAX][TTS] usando voz pt-BR nativa: ' + anyPtBr.name)
      return anyPtBr.name
    }

    const anyPortuguese = voices.find(voice =>
      voice.locale.toLowerCase().startsWith('pt_')
    )

    if (anyPortuguese) {
      console.warn('[MAX][TTS] voz pt-BR não instalada; usando ' + anyPortuguese.name + ' (' + anyPortuguese.locale + ')')
      return anyPortuguese.name
    }

    throw new Error(
      'Nenhuma voz em português está instalada no macOS. ' +
      'Instale uma voz pt-BR em Ajustes do Sistema > Acessibilidade > Leitura e Fala.'
    )
  }
}

export function prepareSpeechText(input: string): string {
  let text = input.normalize('NFC').trim()
  if (!text) return ''

  text = text
    .replace(/\b(?:ponto final|ponto de exclama(?:ção|cao)|ponto de interroga(?:ção|cao)|vírgula|virgula|abre aspas|fecha aspas)\b/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' link ')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, '$1 horas e $2')
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\s*C\b/gi, '$1 graus')
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\b/g, '$1 graus')
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 por cento')
    .replace(/[*_~#>|]/g, ' ')
    .replace(/[.!?…]+/g, '\n')
    .replace(/[,;:]+/g, ' ')
    .replace(/[()[\]{}<>“”"‘’'\\/]+/g, ' ')
    .replace(/[—–-]+/g, ' ')
    .replace(/&/g, ' e ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim()

  return text
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
