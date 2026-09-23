import { FileText, Folder, Link, NotebookText, Plus, Search, Settings, Trash2, X } from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Source = { id: string; title: string; type: string; status: string; created_at: string; metadata_json?: string }
type GraphNode = { id: string; label: string; kind: string; val?: number }
type GraphLink = { source: string; target: string }
type Filter = 'all' | 'documents' | 'links' | 'notes' | 'folders' | 'trash'

const taxonomy = [
  ['clientes', 'Clientes'], ['projetos', 'Projetos'], ['estrategia', 'Estratégia'], ['documentos', 'Documentos'],
  ['ia', 'IA e Tecnologia'], ['pessoal', 'Conhecimento Pessoal'], ['mercado', 'Mercado'], ['outros', 'Outros']
]

export function Brain() {
  const [sources, setSources] = useState<Source[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<Record<string, string>>>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [permissionSnapshot, setPermissionSnapshot] = useState<Record<string, string | boolean>>({})
  const [processingStatus, setProcessingStatus] = useState('')
  const graphRef = useRef<any>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [graphSize, setGraphSize] = useState({ width: 900, height: 620 })

  async function refresh() {
    setSources(await window.maxApi.knowledge.list() as Source[])
  }

  useEffect(() => {
    void refresh()
    const removeChanged = window.maxApi.knowledge.onChanged(refresh)
    const removeProgress = window.maxApi.knowledge.onProgress(setProcessingStatus)
    return () => { removeChanged(); removeProgress() }
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => setResults(query.trim() ? await window.maxApi.knowledge.search(query.trim()) : []), 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const target = stageRef.current
    if (!target) return
    const update = () => setGraphSize({ width: target.clientWidth, height: target.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(target)
    update()
    return () => observer.disconnect()
  }, [])

  const visibleSources = useMemo(() => {
    if (filter === 'documents' || filter === 'all') return sources
    return []
  }, [filter, sources])

  const graph = useMemo(() => {
    const nodes: GraphNode[] = [{ id: 'max', label: 'MAX', kind: 'center', val: 18 }]
    const links: GraphLink[] = []
    taxonomy.forEach(([id, label]) => {
      nodes.push({ id, label, kind: 'category', val: 8 })
      links.push({ source: 'max', target: id })
    })
    sources.forEach(source => {
      nodes.push({ id: source.id, label: source.title, kind: 'source', val: 4 })
      links.push({ source: 'documentos', target: source.id })
    })
    return { nodes, links }
  }, [sources])

  async function uploadPdf() {
    try {
      setProcessingStatus('importando')
      const result = await window.maxApi.knowledge.uploadPdf()
      if (!result) setProcessingStatus('')
      await refresh()
      if (result) window.setTimeout(() => setProcessingStatus(''), 1800)
    } catch {
      setProcessingStatus('erro')
    }
  }

  async function openSettings() {
    setPermissionSnapshot(await window.maxApi.permissions.snapshot())
    setShowSettings(true)
  }

  async function removeSource(source: Source) {
    const approved = window.confirm(`Excluir "${source.title}" do Cérebro do Max? O arquivo gerenciado e seus chunks serão removidos.`)
    if (!approved) return
    await window.maxApi.knowledge.delete(source.id, true)
    await refresh()
  }

  return (
    <main className="brain-shell">
      <aside className="brain-sidebar">
        <div className="brand-row"><div className="brand-orb" /><div><strong>MAX</strong><small>SEU ASSISTENTE INTELIGENTE</small></div></div>
        <button className="upload-button" onClick={uploadPdf} disabled={Boolean(processingStatus && processingStatus !== 'pronto' && processingStatus !== 'erro')}><Plus size={20} /> Fazer upload de conteúdo</button>
        {processingStatus && <div className={`ingest-status status-${processingStatus}`}><span className="status-dot" />{labelStatus(processingStatus)}</div>}
        <nav>
          <SidebarItem icon={<FileText />} label="Todos os conteúdos" count={sources.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          <SidebarItem icon={<FileText />} label="Documentos" count={sources.filter(item => item.type === 'pdf').length} active={filter === 'documents'} onClick={() => setFilter('documents')} />
          <SidebarItem icon={<Link />} label="Links" count={0} active={filter === 'links'} onClick={() => setFilter('links')} />
          <SidebarItem icon={<NotebookText />} label="Notas" count={0} active={filter === 'notes'} onClick={() => setFilter('notes')} />
          <SidebarItem icon={<Folder />} label="Pastas" count={0} active={filter === 'folders'} onClick={() => setFilter('folders')} />
          <SidebarItem icon={<Trash2 />} label="Lixeira" count={0} active={filter === 'trash'} onClick={() => setFilter('trash')} />
        </nav>
        <section className="recent-section">
          <h3>{filter === 'all' ? 'RECENTES' : filter.toUpperCase()}</h3>
          {visibleSources.slice(0, 9).map(source => (
            <div className="recent-item" key={source.id}>
              <FileText size={18} />
              <button className="recent-content" onClick={() => setQuery(source.title)} title="Buscar conteúdo deste documento">
                <span>{source.title}</span><small>{source.status === 'pronto' ? 'PDF · pronto' : `PDF · ${source.status}`}</small>
              </button>
              <button className="recent-delete" onClick={() => removeSource(source)} title="Excluir do cérebro"><Trash2 size={15} /></button>
            </div>
          ))}
          {!visibleSources.length && <p className="empty-copy">Nenhum conteúdo nesta categoria.</p>}
        </section>
        <button className="settings-row" onClick={openSettings}><Settings size={20} /> Configurações</button>
      </aside>

      <section className="brain-main">
        <header className="brain-header">
          <div><h1>Cérebro <span>do</span> Max</h1><p>Todo o seu conhecimento conectado.</p></div>
          <label className="search-box"><Search size={22} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no seu conhecimento..." /><kbd>⌘ K</kbd></label>
        </header>

        <div className="graph-stage" ref={stageRef}>
          <div className="ambient-network" />
          <ForceGraph2D
            ref={graphRef}
            graphData={graph}
            width={graphSize.width}
            height={graphSize.height}
            backgroundColor="rgba(0,0,0,0)"
            linkColor={() => 'rgba(35, 133, 255, .42)'}
            linkWidth={1.2}
            nodeRelSize={5}
            cooldownTicks={80}
            enablePanInteraction
            enableZoomInteraction
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => drawNode(node, ctx, scale)}
            onNodeClick={(node: any) => {
              if (node.kind === 'source') setQuery(node.label)
              graphRef.current?.centerAt(node.x, node.y, 500)
              graphRef.current?.zoom(Math.max(1.5, graphRef.current.zoom()), 500)
            }}
          />
          <div className="graph-center-label"><strong>MAX</strong><span>SEU CONHECIMENTO<br />CONECTADO</span></div>
          {!!results.length && (
            <div className="search-results">
              {results.slice(0, 5).map((result, index) => <article key={`${result.sourceId}-${index}`}><strong>{result.title}</strong><p>{String(result.text).slice(0, 220)}…</p></article>)}
            </div>
          )}
        </div>

        <div className="brain-bottom-bar">
          <div className="brain-prompt"><div className="prompt-mic">⌁</div><span>Hey Max...</span></div>
          <button onClick={() => graphRef.current?.zoomToFit(500, 60)}>Atualizar visualização</button>
        </div>
      </section>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <section className="settings-panel" onClick={event => event.stopPropagation()}>
            <header><div><h2>Configurações</h2><p>Permissões locais da MAX</p></div><button onClick={() => setShowSettings(false)}><X /></button></header>
            <Permission label="Microfone" value={permissionSnapshot.microphone} />
            <Permission label="Câmera" value={permissionSnapshot.camera} />
            <Permission label="Captura de tela" value={permissionSnapshot.screen} />
            <Permission label="Acessibilidade" value={permissionSnapshot.accessibility} />
            <div className="settings-note"><strong>Indexação semântica</strong><span>Estrutura pronta; embeddings ainda não são gerados por padrão no MVP.</span></div>
            <button className="permission-button" onClick={() => window.maxApi.permissions.accessibility()}>Abrir solicitação de Acessibilidade</button>
          </section>
        </div>
      )}
    </main>
  )
}

function SidebarItem({ icon, label, count, active = false, onClick }: { icon: ReactNode; label: string; count: number; active?: boolean; onClick: () => void }) {
  return <button className={`sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span><em>{count}</em></button>
}

function Permission({ label, value }: { label: string; value: string | boolean | undefined }) {
  const text = typeof value === 'boolean' ? (value ? 'Ativa' : 'Não concedida') : String(value ?? 'unknown')
  return <div className="permission-row"><span>{label}</span><strong>{text}</strong></div>
}

function drawNode(node: any, ctx: CanvasRenderingContext2D, scale: number) {
  if (node.kind === 'center') return
  const size = node.kind === 'category' ? 8 : 4
  const hue = node.kind === 'category' && ['projetos', 'ia', 'mercado', 'documentos'].includes(node.id) ? '#9d64ff' : '#29b6ff'
  ctx.beginPath()
  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
  ctx.fillStyle = hue
  ctx.shadowBlur = 18
  ctx.shadowColor = hue
  ctx.fill()
  ctx.shadowBlur = 0
  if (node.kind === 'category' || scale > 2) {
    const fontSize = node.kind === 'category' ? 14 : 10
    ctx.font = `${fontSize}px Inter, -apple-system, sans-serif`
    ctx.fillStyle = 'rgba(239,247,255,.92)'
    ctx.textAlign = 'center'
    ctx.fillText(node.label, node.x, node.y - size - 8)
  }
}

function labelStatus(status: string): string {
  const labels: Record<string, string> = { importando: 'Importando', extraindo: 'Extraindo', indexando: 'Indexando', pronto: 'Pronto', erro: 'Erro' }
  return labels[status] ?? status
}
