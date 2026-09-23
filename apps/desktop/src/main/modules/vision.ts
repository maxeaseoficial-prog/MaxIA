import { desktopCapturer, screen } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ScreenObservation = {
  capturedAt: string
  activeApplication?: string
  activeWindowTitle?: string
  dataUrl: string
}

export class VisionEngine {
  private lastObservation: ScreenObservation | null = null
  private clearTimer: NodeJS.Timeout | null = null

  get screenContext(): ScreenObservation | null {
    return this.lastObservation
  }

  async observePrimaryScreen(): Promise<ScreenObservation> {
    const primary = screen.getPrimaryDisplay()
    const size = primary.size
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.min(size.width, 1600), height: Math.min(size.height, 1000) }
    })
    const source = sources[0]
    if (!source) throw new Error('Nenhuma tela disponível para captura.')

    const frontmost = await this.frontmostApp()
    const observation = {
      capturedAt: new Date().toISOString(),
      activeApplication: frontmost.app,
      activeWindowTitle: frontmost.title,
      dataUrl: source.thumbnail.toDataURL()
    }
    this.lastObservation = observation
    if (this.clearTimer) clearTimeout(this.clearTimer)
    this.clearTimer = setTimeout(() => { this.lastObservation = null }, 30_000)
    return observation
  }

  private async frontmostApp(): Promise<{ app?: string; title?: string }> {
    if (process.platform !== 'darwin') return {}
    const script = 'tell application "System Events" to tell (first process whose frontmost is true) to return {name, name of front window}'
    try {
      const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script])
      const parts = stdout.trim().split(', ')
      return { app: parts[0], title: parts.slice(1).join(', ') }
    } catch {
      return {}
    }
  }
}
