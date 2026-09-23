import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import defaultBrowser from 'default-browser'

const execFileAsync = promisify(execFile)

export class ComputerControl {
  async openDefaultBrowser(): Promise<void> {
    if (process.platform === 'darwin') {
      const browser = await defaultBrowser()
      await execFileAsync('/usr/bin/open', ['-b', browser.id])
      return
    }
    await shell.openExternal('https://www.google.com')
  }

  async openGoogle(): Promise<void> {
    await shell.openExternal('https://www.google.com')
  }

  async openApp(appName: string): Promise<void> {
    if (process.platform !== 'darwin') throw new Error('Abertura genérica de apps está implementada inicialmente para macOS.')
    await execFileAsync('/usr/bin/open', ['-a', appName])
  }
}
