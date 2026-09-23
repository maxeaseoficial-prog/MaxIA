import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

export class TtsEngine {
  private process: ChildProcessWithoutNullStreams | null = null

  async speak(text: string): Promise<void> {
    this.stop()
    await new Promise<void>((resolve, reject) => {
      const process = spawn('/usr/bin/say', [text], { stdio: 'pipe' })
      this.process = process
      process.once('error', reject)
      process.once('exit', () => {
        if (this.process === process) this.process = null
        resolve()
      })
    })
  }

  stop(): void {
    if (this.process && !this.process.killed) this.process.kill('SIGTERM')
    this.process = null
  }
}
