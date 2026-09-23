import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export type AuditEntry = {
  at: string
  intent: string
  result: 'success' | 'failure' | 'cancelled' | 'confirmation-required'
  detail?: string
}

export class AuditLog {
  constructor(private readonly filePath: string) {}

  async write(entry: Omit<AuditEntry, 'at'>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const row: AuditEntry = { at: new Date().toISOString(), ...entry }
    await appendFile(this.filePath, `${JSON.stringify(row)}\n`, 'utf8')
  }
}
