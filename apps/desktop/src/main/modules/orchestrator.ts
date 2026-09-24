import type { BrowserWindow } from 'electron'
import type { AuditLog } from './audit'
import type { AudioEngine } from './audio-engine'
import type { BrowserControl } from './browser-control'
import type { ComputerControl } from './computer-control'
import type { LlmProviderRegistry } from './llm'
import type { RiskPolicy } from './risk'
import type { StateController } from './state'
import type { VisionEngine } from './vision'
import type { SkillRegistry } from '../skills/registry'
import type { SkillContext } from '../skills/types'

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
      skills: SkillRegistry
      showOrb: () => void
      hideOrb: () => void
      showBrain: () => BrowserWindow
    }
  ) {}

  async handleTranscript(raw: string): Promise<void> {
    const clean = raw.trim()
    if (!clean) return

    this.deps.state.set('thinking')

    try {
      const resolved = this.deps.skills.resolve(clean)

      if (resolved) {
        if (resolved.skill.risk !== 'low') {
          this.deps.state.set('confirming')
          await this.deps.audit.write({
            intent: clean,
            result: 'confirmation-required',
            detail: `${resolved.skill.id}:${resolved.skill.risk}`
          })
          await this.deps.audio.speak('Henrique, essa ação precisa de confirmação explícita.')
          this.deps.state.set('listening')
          return
        }

        this.deps.state.set('executing')
        const result = await resolved.skill.execute(resolved.match, this.skillContext())

        if (result.kind === 'sleep') {
          this.deps.state.set('sleeping')
          await this.deps.audit.write({
            intent: clean,
            result: 'success',
            detail: result.detail ?? resolved.skill.id
          })
          return
        }

        if (result.kind === 'spoken') {
          return this.say(result.text, clean, true, result.detail ?? resolved.skill.id)
        }

        await this.deps.audit.write({
          intent: clean,
          result: 'success',
          detail: result.detail ?? resolved.skill.id
        })
        return this.say('Feito.', clean, false)
      }

      const response = await this.deps.llm.current().answer(clean)
      return this.say(response, clean)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.deps.state.set('error')
      await this.deps.audit.write({ intent: clean, result: 'failure', detail })

      try {
        await this.deps.audio.speak(`Henrique, não consegui concluir. ${detail}`)
      } finally {
        this.deps.state.set('listening')
      }
    }
  }

  wake(): void {
    this.deps.showOrb()
    this.deps.state.set('waking')
    setTimeout(() => this.deps.state.set('listening'), 180)
  }

  cancel(): void {
    this.deps.audio.interruptSpeech()
    this.deps.state.set('listening')
    void this.deps.audit.write({ intent: 'cancel', result: 'cancelled' })
  }

  private skillContext(): SkillContext {
    return {
      audio: this.deps.audio,
      browser: this.deps.browser,
      computer: this.deps.computer,
      audit: this.deps.audit,
      vision: this.deps.vision,
      showBrain: this.deps.showBrain,
      hideOrb: this.deps.hideOrb
    }
  }

  private async say(
    text: string,
    intent: string,
    log = true,
    detail?: string
  ): Promise<void> {
    this.deps.state.set('speaking')
    await this.deps.audio.speak(text)

    if (log) {
      await this.deps.audit.write({
        intent,
        result: 'success',
        detail
      })
    }

    this.deps.state.set('listening')
  }
}
