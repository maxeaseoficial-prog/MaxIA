import type { BrowserWindow } from 'electron'

export type MaxVisualState = 'sleeping' | 'waking' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'confirming' | 'error'

export class StateController {
  private state: MaxVisualState = 'sleeping'

  constructor(private getOrbWindow: () => BrowserWindow | null) {}

  get current(): MaxVisualState {
    return this.state
  }

  set(next: MaxVisualState): void {
    this.state = next
    const window = this.getOrbWindow()
    window?.webContents.send('max:state', next)
  }
}
