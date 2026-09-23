import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

type Pending = {
  resolve: (value: string) => void
  reject: (reason?: unknown) => void
  timer: NodeJS.Timeout
}

type LanguageResponse = {
  id: number
  ok: boolean
  text?: string
  error?: string
}

export class NativeAppleLanguageProcess {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private stdoutBuffer = ''

  constructor(private readonly helperPath: string) {}

  start(): void {
    this.ensureChild()
  }

  async answer(prompt: string): Promise<string> {
    const child = this.ensureChild()
    const id = this.nextId++

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Modelo local da Apple excedeu o tempo limite.'))
      }, 60_000)

      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(`${JSON.stringify({ id, prompt })}\n`)
    })
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Modelo local da Apple encerrado.'))
      this.pending.delete(id)
    }

    this.child?.kill('SIGTERM')
    this.child = null
  }

  private ensureChild(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed) return this.child

    const child = spawn(this.helperPath, [], { stdio: 'pipe' })
    this.child = child

    child.stdout.on('data', chunk => {
      this.stdoutBuffer += String(chunk)

      while (true) {
        const newline = this.stdoutBuffer.indexOf('\n')
        if (newline < 0) break

        const line = this.stdoutBuffer.slice(0, newline).trim()
        this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1)
        if (!line) continue

        try {
          const response = JSON.parse(line) as LanguageResponse
          const pending = this.pending.get(response.id)
          if (!pending) continue

          this.pending.delete(response.id)
          clearTimeout(pending.timer)

          if (response.ok) pending.resolve(response.text ?? '')
          else pending.reject(new Error(response.error || 'Falha no modelo local da Apple.'))
        } catch (error) {
          console.error('[MAX][NativeLanguage][parse]', error)
        }
      }
    })

    child.stderr.on('data', chunk => {
      const line = String(chunk).trim()
      if (line) console.error('[MAX][NativeLanguage]', line)
    })

    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null
      const error = new Error(
        `Modelo local da Apple encerrou (code=${String(code)}, signal=${String(signal)}).`
      )

      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer)
        pending.reject(error)
        this.pending.delete(id)
      }
    })

    return child
  }
}
