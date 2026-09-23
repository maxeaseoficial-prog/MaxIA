import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { AuditLog } from './modules/audit'
import { AudioEngine } from './modules/audio-engine'
import { BrowserControl } from './modules/browser-control'
import { ComputerControl } from './modules/computer-control'
import { LocalDatabase } from './modules/database'
import { KnowledgeEngine } from './modules/knowledge'
import { LlmProviderRegistry, NativeAppleLlmProvider } from './modules/llm'
import { NativeAppleLanguageProcess } from './modules/native-language'
import { MemoryEngine } from './modules/memory'
import { Orchestrator } from './modules/orchestrator'
import { PermissionsEngine } from './modules/permissions'
import { RiskPolicy } from './modules/risk'
import { StateController } from './modules/state'
import { NativeMacSpeechProcess } from './modules/native-speech'
import { NativeMacSpeechProvider } from './modules/stt'
import { TtsEngine } from './modules/tts'
import { VisionEngine } from './modules/vision'
import { WakeWordEngine } from './modules/wake-word'

const currentDir = dirname(fileURLToPath(import.meta.url))
let orbWindow: BrowserWindow | null = null
let brainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let orchestrator: Orchestrator
let knowledge: KnowledgeEngine
let database: LocalDatabase
let sttProcess: NativeMacSpeechProcess | null = null
let languageProcess: NativeAppleLanguageProcess | null = null
let orbDragState: { screenX: number; screenY: number; windowX: number; windowY: number } | null = null
const permissions = new PermissionsEngine()
const wakeWord = new WakeWordEngine()
let lastTranscript = ''
let lastTranscriptAt = 0

function rendererUrl(route: string): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) return `${devUrl}#${route}`
  return `${pathToFileURL(join(currentDir, '../renderer/index.html')).toString()}#${route}`
}

function createOrbWindow(): BrowserWindow {
  const saved = database.query<{ value_json: string }>('SELECT value_json FROM preferences WHERE key = ? LIMIT 1', ['orb-position'])[0]
  const parsed = saved ? JSON.parse(saved.value_json) as { x: number; y: number } : null
  const workArea = screen.getPrimaryDisplay().workArea
  const width = 330
  const height = 430
  const window = new BrowserWindow({
    width,
    height,
    x: parsed?.x ?? workArea.x + workArea.width - width - 20,
    y: parsed?.y ?? workArea.y + 40,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(currentDir, '../preload/preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  window.setAlwaysOnTop(true, 'floating')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  void window.loadURL(rendererUrl('/orb'))
  window.on('moved', async () => {
    const [x, y] = window.getPosition()
    database.run(
      'INSERT OR REPLACE INTO preferences (key,value_json,updated_at) VALUES (?,?,?)',
      ['orb-position', JSON.stringify({ x, y }), new Date().toISOString()]
    )
    await database.persist()
  })
  return window
}

function createBrainWindow(): BrowserWindow {
  if (brainWindow && !brainWindow.isDestroyed()) return brainWindow
  brainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    title: 'Cérebro do Max',
    backgroundColor: '#020814',
    webPreferences: {
      preload: join(currentDir, '../preload/preload.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })
  void brainWindow.loadURL(rendererUrl('/brain'))
  brainWindow.on('closed', () => { brainWindow = null })
  return brainWindow
}

function installTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setTitle('MAX')
  tray.setToolTip('MAX — Assistente Local')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Acordar MAX', click: () => orchestrator.wake() },
    { label: 'Abrir Cérebro', click: () => createBrainWindow().show() },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]))
}

async function setup(): Promise<void> {
  const userData = app.getPath('userData')
  await mkdir(userData, { recursive: true })
  database = new LocalDatabase(join(userData, 'max.sqlite'))
  await database.open()
  const memory = new MemoryEngine(database)
  if (!memory.getPreference('user.name')) await memory.setPreference('user.name', 'Henrique')
  if (!memory.getPreference('response.operationalSuccess')) await memory.setPreference('response.operationalSuccess', 'Feito.')

  knowledge = new KnowledgeEngine(database, join(userData, 'library'))
  orbWindow = createOrbWindow()

  const state = new StateController(() => orbWindow)
  const nativeDir = app.isPackaged
    ? join(process.resourcesPath, 'native')
    : join(process.cwd(), 'build', 'native')

  const speechHelperPath = join(nativeDir, 'speech-helper')
  const languageHelperPath = join(nativeDir, 'language-helper')

  sttProcess = new NativeMacSpeechProcess(speechHelperPath, join(userData, 'speech-temp'))
  languageProcess = new NativeAppleLanguageProcess(languageHelperPath)
  languageProcess.start()

  const audio = new AudioEngine(new NativeMacSpeechProvider(sttProcess), new TtsEngine())
  orchestrator = new Orchestrator({
    state,
    audio,
    browser: new BrowserControl(),
    computer: new ComputerControl(),
    llm: new LlmProviderRegistry(new NativeAppleLlmProvider(languageProcess)),
    audit: new AuditLog(join(userData, 'audit', 'actions.jsonl')),
    vision: new VisionEngine(),
    risk: new RiskPolicy(),
    showOrb: () => orbWindow?.showInactive(),
    hideOrb: () => orbWindow?.hide(),
    showBrain: createBrainWindow
  })
  installTray()

  ipcMain.handle('max:wake', () => orchestrator.wake())
  ipcMain.handle('max:sleep', () => orchestrator.handleTranscript('descansar'))
  ipcMain.handle('max:cancel', () => orchestrator.cancel())
  ipcMain.handle('max:command', (_event, text: string) => orchestrator.handleTranscript(text))
  ipcMain.handle('audio:barge-in', () => orchestrator.cancel())

  ipcMain.on('orb:drag-start', (_event, screenX: number, screenY: number) => {
    if (!orbWindow || orbWindow.isDestroyed()) return
    const [windowX, windowY] = orbWindow.getPosition()
    orbDragState = { screenX, screenY, windowX, windowY }
  })

  ipcMain.on('orb:drag-move', (_event, screenX: number, screenY: number) => {
    if (!orbWindow || orbWindow.isDestroyed() || !orbDragState) return

    const x = Math.round(orbDragState.windowX + screenX - orbDragState.screenX)
    const y = Math.round(orbDragState.windowY + screenY - orbDragState.screenY)
    orbWindow.setPosition(x, y, false)
  })

  ipcMain.on('orb:drag-end', () => {
    orbDragState = null
  })

  ipcMain.handle('audio:transcribe', async (_event, samples: number[], sampleRate: number) => {
    try {
      const safeSampleRate = Number.isFinite(sampleRate) && sampleRate >= 8_000 && sampleRate <= 192_000 ? sampleRate : 48_000
      const result = await audio.transcribe(Float32Array.from(samples), safeSampleRate)
      const text = result.text.trim()
      if (!text) return { text: '', action: 'none' }
      const ambientOnly = /^(?:\[(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\]|\((?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel)\)|(?:m[uú]sica|risos?|aplausos?|sil[eê]ncio|inaud[ií]vel))[.!?]*$/i.test(text.trim())
      if (ambientOnly) return { text: '', action: 'ambient' }

      const now = Date.now()
    if (text === lastTranscript && now - lastTranscriptAt < 3500) return { text, action: 'duplicate' }
    lastTranscript = text
    lastTranscriptAt = now

    const wake = wakeWord.detect(text)
    if (state.current === 'sleeping') {
      if (!wake.detected) return { text, action: 'sleeping' }
      console.log(`[MAX][WAKE] ${JSON.stringify(text)}`)
      orchestrator.wake()
      if (wake.commandAfterWakeWord) void orchestrator.handleTranscript(wake.commandAfterWakeWord)
      return { text, action: wake.commandAfterWakeWord ? 'wake-command' : 'wake' }
    }

    console.log(`[MAX][STT] ${JSON.stringify(text)}`)

    if (wake.detected && /descans/.test(wake.commandAfterWakeWord)) {
      void orchestrator.handleTranscript('descansar')
      return { text, action: 'sleep' }
    }

      if (state.current !== 'speaking') void orchestrator.handleTranscript(text)
      return { text, action: 'command' }
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error)
      console.error('[MAX][STT][erro]', detail)
      return { text: '', action: 'stt-error' }
    }
  })
  ipcMain.handle('permissions:snapshot', () => permissions.snapshot())
  ipcMain.handle('permissions:request', (_event, kind: 'microphone' | 'camera') => permissions.request(kind))
  ipcMain.handle('permissions:accessibility', () => permissions.requestAccessibilityPrompt())
  ipcMain.handle('knowledge:list', () => knowledge.listSources())
  ipcMain.handle('knowledge:search', (_event, query: string) => knowledge.search(query))
  ipcMain.handle('knowledge:upload-pdf', async () => {
    const selected = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (selected.canceled || !selected.filePaths[0]) return null
    const source = await knowledge.importPdf(selected.filePaths[0], status => brainWindow?.webContents.send('knowledge:progress', status))
    brainWindow?.webContents.send('knowledge:changed')
    return source
  })
  ipcMain.handle('knowledge:delete', async (_event, id: string, confirmed: boolean) => {
    if (!confirmed) throw new Error('Exclusão permanente exige confirmação explícita.')
    await knowledge.deleteSource(id)
    brainWindow?.webContents.send('knowledge:changed')
  })
}

process.on('uncaughtException', error => console.error('[MAX][uncaughtException]', error))
process.on('unhandledRejection', error => console.error('[MAX][unhandledRejection]', error))

app.on('child-process-gone', (_event, details) => console.error('[MAX][child-process-gone]', details))
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[MAX][render-process-gone]', details)
  if (orbWindow && webContents.id === orbWindow.webContents.id && !orbWindow.isDestroyed()) {
    void orbWindow.reload()
  }
})

void app.whenReady().then(setup)
app.on('window-all-closed', () => {})
app.on('before-quit', () => {
  console.log('[MAX][lifecycle] before-quit')
  sttProcess?.dispose()
  languageProcess?.dispose()
  tray?.destroy()
})
