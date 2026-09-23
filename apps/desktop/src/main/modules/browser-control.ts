import { shell } from 'electron'

export class BrowserControl {
  async openUrl(url: string): Promise<void> {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL não permitida.')
    await shell.openExternal(parsed.toString())
  }

  async openGoogle(): Promise<void> {
    await this.openUrl('https://www.google.com')
  }
}
