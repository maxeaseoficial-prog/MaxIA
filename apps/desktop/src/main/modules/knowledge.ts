import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, unlink } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import pdfParse from 'pdf-parse'
import type { LocalDatabase } from './database'

export type SourceRow = {
  id: string
  type: string
  title: string
  managed_path: string
  original_path?: string
  status: string
  created_at: string
  metadata_json: string
}

export interface EmbeddingProvider {
  readonly id: string
  embed(texts: string[]): Promise<number[][]>
}

export class KnowledgeEngine {
  constructor(
    private readonly db: LocalDatabase,
    private readonly libraryDir: string,
    private readonly embeddings?: EmbeddingProvider
  ) {}

  async importPdf(originalPath: string, onStatus?: (status: string) => void): Promise<SourceRow> {
    const id = randomUUID()
    await mkdir(this.libraryDir, { recursive: true })
    const title = basename(originalPath)
    const managedPath = join(this.libraryDir, `${id}${extname(originalPath).toLowerCase() || '.pdf'}`)
    const createdAt = new Date().toISOString()
    onStatus?.('importando')
    await copyFile(originalPath, managedPath)
    this.db.run(
      'INSERT INTO sources (id,type,title,managed_path,original_path,status,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?)',
      [id, 'pdf', title, managedPath, originalPath, 'importando', createdAt, '{}']
    )
    await this.db.persist()

    try {
      onStatus?.('extraindo')
      this.db.run('UPDATE sources SET status = ? WHERE id = ?', ['extraindo', id])
      await this.db.persist()
      const bytes = await readFile(managedPath)
      const hash = createHash('sha256').update(bytes).digest('hex')
      const parsed = await pdfParse(bytes)
      const chunks = chunkText(parsed.text)
      onStatus?.('indexando')
      this.db.run('UPDATE sources SET status = ? WHERE id = ?', ['indexando', id])
      await this.db.persist()
      const vectors = this.embeddings ? await this.embeddings.embed(chunks) : []
      chunks.forEach((text, position) => {
        this.db.run(
          'INSERT INTO chunks (id,source_id,position,text,embedding_json,metadata_json) VALUES (?,?,?,?,?,?)',
          [randomUUID(), id, position, text, vectors[position] ? JSON.stringify(vectors[position]) : null, JSON.stringify({ pageCount: parsed.numpages })]
        )
      })
      this.db.run('UPDATE sources SET status = ?, hash = ?, metadata_json = ? WHERE id = ?', [
        'pronto',
        hash,
        JSON.stringify({ pages: parsed.numpages, chunks: chunks.length, embeddings: Boolean(this.embeddings) }),
        id
      ])
      await this.db.persist()
      onStatus?.('pronto')
      return this.getSource(id)!
    } catch (error) {
      this.db.run('UPDATE sources SET status = ? WHERE id = ?', ['erro', id])
      await this.db.persist()
      onStatus?.('erro')
      throw error
    }
  }

  listSources(): SourceRow[] {
    return this.db.query<SourceRow>('SELECT * FROM sources ORDER BY created_at DESC')
  }

  getSource(id: string): SourceRow | undefined {
    return this.db.query<SourceRow>('SELECT * FROM sources WHERE id = ? LIMIT 1', [id])[0]
  }

  search(query: string): Array<{ sourceId: string; title: string; text: string }> {
    const like = `%${query}%`
    return this.db.query<{ sourceId: string; title: string; text: string }>(
      `SELECT chunks.source_id AS sourceId, sources.title AS title, chunks.text AS text
       FROM chunks JOIN sources ON sources.id = chunks.source_id
       WHERE chunks.text LIKE ? ORDER BY chunks.position ASC LIMIT 30`,
      [like]
    )
  }

  async deleteSource(id: string): Promise<void> {
    const source = this.getSource(id)
    if (!source) return
    this.db.run('DELETE FROM chunks WHERE source_id = ?', [id])
    this.db.run('DELETE FROM sources WHERE id = ?', [id])
    await this.db.persist()
    try { await unlink(source.managed_path) } catch {}
  }
}

export function chunkText(input: string, maxLength = 1100): string[] {
  const clean = input.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > maxLength && current) {
      chunks.push(current.trim())
      current = paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
