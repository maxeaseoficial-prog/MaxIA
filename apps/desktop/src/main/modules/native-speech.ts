import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SpeechMode = 'wake' | 'command'

type Pending = {
  resolve: (value: string) => void
  reject: (reason?: unknown) => void
  timer: NodeJS.Timeout
  tempPath: string
}

type HelperResponse = {
  id: number
  ok: boolean
  text?: string
  error?: string
}

export class NativeMacSpeechProcess {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private stdoutBuffer = ''

  constructor(
    private readonly helperPath: string,
    private readonly tempDir: string
  ) {}

  async transcribe(
    samples: Float32Array,
    sampleRate = 48_000,
    mode: SpeechMode = 'command'
  ): Promise<string> {
    await mkdir(this.tempDir, { recursive: true })

    const id = this.nextId++
    const tempPath = join(this.tempDir, `${randomUUID()}.wav`)
    await writeFile(tempPath, encodeWav(samples, sampleRate))

    const child = this.ensureChild()

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        void unlink(tempPath).catch(() => {})
        reject(new Error('Reconhecimento nativo de voz excedeu o tempo limite.'))
      }, mode === 'wake' ? 10_000 : 30_000)

      this.pending.set(id, { resolve, reject, timer, tempPath })
      child.stdin.write(`${JSON.stringify({ id, path: tempPath, mode })}\n`)
    })
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      void unlink(pending.tempPath).catch(() => {})
      pending.reject(new Error('Reconhecimento nativo encerrado.'))
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
          const response = JSON.parse(line) as HelperResponse
          const pending = this.pending.get(response.id)
          if (!pending) continue

          this.pending.delete(response.id)
          clearTimeout(pending.timer)
          void unlink(pending.tempPath).catch(() => {})

          if (response.ok) pending.resolve(response.text ?? '')
          else pending.reject(new Error(response.error || 'Falha no reconhecimento nativo.'))
        } catch (error) {
          console.error('[MAX][NativeSpeech][parse]', error)
        }
      }
    })

    child.stderr.on('data', chunk => {
      const line = String(chunk).trim()
      if (line) console.error('[MAX][NativeSpeech]', line)
    })

    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null

      const error = new Error(
        `Reconhecimento nativo encerrou (code=${String(code)}, signal=${String(signal)}).`
      )

      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer)
        void unlink(pending.tempPath).catch(() => {})
        pending.reject(error)
        this.pending.delete(id)
      }
    })

    return child
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const dataLength = samples.length * 2
  const buffer = Buffer.alloc(44 + dataLength)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    buffer.writeInt16LE(Math.round(clamped * 0x7fff), offset)
    offset += 2
  }

  return buffer
}
