import type { LocalDatabase } from './database'

export class MemoryEngine {
  private readonly session = new Map<string, unknown>()

  constructor(private readonly db: LocalDatabase) {}

  setSession(key: string, value: unknown): void {
    this.session.set(key, value)
  }

  getSession<T>(key: string): T | undefined {
    return this.session.get(key) as T | undefined
  }

  async setPreference(key: string, value: unknown): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO preferences (key,value_json,updated_at) VALUES (?,?,?)',
      [key, JSON.stringify(value), new Date().toISOString()]
    )
    await this.db.persist()
  }

  getPreference<T>(key: string): T | undefined {
    const row = this.db.query<{ value_json: string }>('SELECT value_json FROM preferences WHERE key = ? LIMIT 1', [key])[0]
    return row ? JSON.parse(row.value_json) as T : undefined
  }
}
