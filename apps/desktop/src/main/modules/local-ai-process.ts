import { fork, type ChildProcess } from 'node:child_process'

type AiRequestPayload =
  | { type: 'stt'; samplesBase64: string; sampleRate: number }
  | { type: 'llm'; prompt: string }

type AiRequest = AiRequestPayload & { id: number }

type AiResponse = {
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  timer: NodeJS.Timeout
}

export class LocalAiProcess {
  private child: ChildProcess | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(
    private readonly workerPath: string,
    private readonly cacheDir: string,
    private readonly label: string
  ) {}

  async request<T>(payload: AiRequestPayload, timeoutMs = 120_000): Promise<T> {
    const child = this.ensureChild()
    const id = this.nextId++
    const message = { ...payload, id } as AiRequest

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${this.label} excedeu o tempo limite de processamento.`))
        this.restart()
      }, timeoutMs)

      this.pending.set(id, {
        resolve: value => resolve(value as T),
        reject,
        timer
      })

      try {
        child.send?.(message)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
        this.restart()
      }
    })
  }

  dispose(): void {
    this.rejectAll(new Error(`${this.label} foi encerrado.`))
    this.child?.kill('SIGTERM')
    this.child = null
  }

  private ensureChild(): ChildProcess {
    if (this.child && !this.child.killed && this.child.connected) return this.child

    const child = fork(this.workerPath, [], {
      execPath: process.execPath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        MAX_AI_CACHE_DIR: this.cacheDir
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    this.child = child

    child.stdout?.on('data', data => {
      const text = String(data).trim()
      if (text) console.log(`[MAX][${this.label}] ${text}`)
    })

    child.stderr?.on('data', data => {
      const text = String(data).trim()
      if (text) console.error(`[MAX][${this.label}][worker] ${text}`)
    })

    child.on('message', raw => {
      const response = raw as AiResponse
      const pending = this.pending.get(response.id)
      if (!pending) return

      clearTimeout(pending.timer)
      this.pending.delete(response.id)

      if (response.ok) pending.resolve(response.result)
      else pending.reject(new Error(response.error || `${this.label} falhou.`))
    })

    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null
      const reason = new Error(
        `${this.label} reiniciou porque o processo local de IA encerrou` +
        ` (code=${String(code)}, signal=${String(signal)}).`
      )
      console.error('[MAX][AI-WORKER-EXIT]', this.label, { code, signal })
      this.rejectAll(reason)
    })

    child.on('error', error => {
      console.error('[MAX][AI-WORKER-ERROR]', this.label, error)
    })

    return child
  }

  private restart(): void {
    const child = this.child
    this.child = null
    if (child && !child.killed) child.kill('SIGKILL')
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
