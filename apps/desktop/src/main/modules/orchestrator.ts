import type { BrowserWindow } from 'electron'
import { classifyCommand } from './intent'
import type { AuditLog } from './audit'
import type { AudioEngine } from './audio-engine'
import type { BrowserControl } from './browser-control'
import type { ComputerControl } from './computer-control'
import type { LlmProviderRegistry } from './llm'
import type { RiskPolicy } from './risk'
import type { StateController } from './state'
import type { VisionEngine } from './vision'

export class Orchestrator {
  constructor(
    private readonly deps: {
      state: StateController
      audio: AudioEngine
      browser: BrowserControl
      computer: ComputerControl
      llm: LlmProviderRegistry
      audit: AuditLog
      vision: VisionEngine
      risk: RiskPolicy
      showOrb: () => void
      hideOrb: () => void
      showBrain: () => BrowserWindow
    }
  ) {}

  async handleTranscript(raw: string): Promise<void> {
    const intent = classifyCommand(raw)
    this.deps.state.set('thinking')

    try {
      switch (intent.type) {
        case 'sleep':
          this.deps.audio.interruptSpeech()
          this.deps.state.set('sleeping')
          this.deps.hideOrb()
          await this.deps.audit.write({ intent: raw, result: 'success', detail: 'sleep' })
          return
        case 'open-browser':
          this.deps.state.set('executing')
          await this.deps.computer.openDefaultBrowser()
          return this.finishOperational(raw)
        case 'open-google':
          this.deps.state.set('executing')
          await this.deps.browser.openGoogle()
          return this.finishOperational(raw)
        case 'open-brain':
          this.deps.state.set('executing')
          this.deps.showBrain().show()
          return this.finishOperational(raw)
        case 'open-app': {
          const risk = this.deps.risk.assess(`abrir app ${intent.appName}`)
          if (risk.requiresExplicitConfirmation) throw new Error('Esta ação exige confirmação e ainda não possui fluxo de confirmação neste MVP.')
          this.deps.state.set('executing')
          await this.deps.computer.openApp(intent.appName)
          return this.finishOperational(raw)
        }
        case 'screen-question': {
          this.deps.state.set('executing')
          const observation = await this.deps.vision.observePrimaryScreen()
          const response = observation.activeApplication
            ? `Henrique, a janela ativa é ${observation.activeApplication}${observation.activeWindowTitle ? `, ${observation.activeWindowTitle}` : ''}. A interpretação visual completa ainda está marcada como próxima etapa.`
            : 'Henrique, capturei a tela, mas a interpretação visual completa ainda não está configurada nesta versão.'
          return this.say(response, raw)
        }
        case 'conversation': {
          const response = await this.deps.llm.current().answer(intent.text)
          return this.say(response, raw)
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.deps.state.set('error')
      await this.deps.audit.write({ intent: raw, result: 'failure', detail })
      await this.deps.audio.speak(`Henrique, não consegui concluir. ${detail}`)
      this.deps.state.set('listening')
    }
  }

  wake(): void {
    this.deps.showOrb()
    this.deps.state.set('waking')
    setTimeout(() => this.deps.state.set('listening'), 300)
  }

  cancel(): void {
    this.deps.audio.interruptSpeech()
    this.deps.state.set('listening')
    void this.deps.audit.write({ intent: 'cancel', result: 'cancelled' })
  }

  private async finishOperational(intent: string): Promise<void> {
    await this.deps.audit.write({ intent, result: 'success' })
    await this.say('Feito.', intent, false)
  }

  private async say(text: string, intent: string, log = true): Promise<void> {
    this.deps.state.set('speaking')
    await this.deps.audio.speak(text)
    if (log) await this.deps.audit.write({ intent, result: 'success' })
    this.deps.state.set('listening')
  }
}
