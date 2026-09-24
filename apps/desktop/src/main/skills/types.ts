import type { BrowserWindow } from 'electron'
import type { AuditLog } from '../modules/audit'
import type { AudioEngine } from '../modules/audio-engine'
import type { BrowserControl } from '../modules/browser-control'
import type { ComputerControl } from '../modules/computer-control'
import type { RiskLevel } from '../modules/risk'
import type { VisionEngine } from '../modules/vision'

export type SkillMatch = {
  confidence: number
  slots?: Record<string, string>
}

export type SkillResult =
  | { kind: 'operational'; detail?: string }
  | { kind: 'spoken'; text: string; detail?: string }
  | { kind: 'sleep'; detail?: string }

export type SkillContext = {
  audio: AudioEngine
  browser: BrowserControl
  computer: ComputerControl
  audit: AuditLog
  vision: VisionEngine
  showBrain: () => BrowserWindow
  hideOrb: () => void
}

export interface MaxSkill {
  readonly id: string
  readonly description: string
  readonly risk: RiskLevel
  readonly priority?: number
  match(text: string): SkillMatch | null
  execute(match: SkillMatch, context: SkillContext): Promise<SkillResult>
}
