import initSqlJs, { type Database } from 'sql.js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export class LocalDatabase {
  private db: Database | null = null

  constructor(private readonly filePath: string) {}

  async open(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const SQL = await initSqlJs()
    try {
      const bytes = await readFile(this.filePath)
      this.db = new SQL.Database(bytes)
    } catch {
      this.db = new SQL.Database()
    }
    this.migrate()
    await this.persist()
  }

  private migrate(): void {
    const db = this.requireDb()
    db.run(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        managed_path TEXT NOT NULL,
        original_path TEXT,
        status TEXT NOT NULL,
        hash TEXT,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding_json TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        aliases_json TEXT NOT NULL DEFAULT '[]',
        attributes_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        type TEXT NOT NULL,
        confidence REAL,
        source_ids_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL,
        origin TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS action_logs (
        id TEXT PRIMARY KEY,
        intent TEXT NOT NULL,
        plan_json TEXT,
        tools_json TEXT,
        result TEXT NOT NULL,
        confirmation_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  run(sql: string, params: unknown[] = []): void {
    this.requireDb().run(sql, params as any[])
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const statement = this.requireDb().prepare(sql)
    statement.bind(params as any[])
    const rows: T[] = []
    while (statement.step()) rows.push(statement.getAsObject() as T)
    statement.free()
    return rows
  }

  async persist(): Promise<void> {
    const data = this.requireDb().export()
    await writeFile(this.filePath, Buffer.from(data))
  }

  private requireDb(): Database {
    if (!this.db) throw new Error('Banco local não foi aberto.')
    return this.db
  }
}
