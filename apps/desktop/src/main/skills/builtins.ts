import { app } from 'electron'
import { join } from 'node:path'
import { normalizeText, stripWakeWord } from '../modules/intent'
import type { MaxSkill, SkillMatch } from './types'

function exact(pattern: RegExp, confidence = 1): (text: string) => SkillMatch | null {
  return raw => pattern.test(stripWakeWord(raw))
    ? { confidence }
    : null
}

function slot(pattern: RegExp, name: string, confidence = 0.95): (text: string) => SkillMatch | null {
  return raw => {
    const match = stripWakeWord(raw).match(pattern)
    const value = match?.[1]?.trim()
    return value
      ? { confidence, slots: { [name]: value } }
      : null
  }
}

const OPEN = '(?:abra|abre|abrir|abram)'
const YOUTUBE = '(?:youtube|you\\s*tube|iutube|iu\\s*tube)'

export const sleepSkill: MaxSkill = {
  id: 'system.sleep',
  description: 'Coloca a MAX em repouso e oculta o orbe.',
  risk: 'low',
  priority: 100,
  match: exact(/^(?:descansar|descanse|dormir|durma)$/),
  async execute(_match, context) {
    context.audio.interruptSpeech()
    context.hideOrb()
    return { kind: 'sleep', detail: 'sleep' }
  }
}

export const openBrowserSkill: MaxSkill = {
  id: 'system.open-browser',
  description: 'Abre o navegador padrão do macOS.',
  risk: 'low',
  priority: 90,
  match: exact(new RegExp('^' + OPEN + '\\s+(?:o\\s+)?(?:meu\\s+)?navegador$')),
  async execute(_match, context) {
    await context.computer.openDefaultBrowser()
    return { kind: 'operational', detail: 'default-browser' }
  }
}

export const openGoogleSkill: MaxSkill = {
  id: 'browser.open-google',
  description: 'Abre a página inicial do Google.',
  risk: 'low',
  priority: 90,
  match: exact(new RegExp('^' + OPEN + '\\s+(?:o\\s+)?google$')),
  async execute(_match, context) {
    await context.browser.openGoogle()
    return { kind: 'operational', detail: 'google' }
  }
}

export const openYouTubeSkill: MaxSkill = {
  id: 'browser.open-youtube',
  description: 'Abre o YouTube no navegador padrão.',
  risk: 'low',
  priority: 91,
  match: exact(new RegExp('^' + OPEN + '\\s+(?:o\\s+)?' + YOUTUBE + '$')),
  async execute(_match, context) {
    await context.browser.openYouTube()
    return { kind: 'operational', detail: 'youtube' }
  }
}

export const youtubeSearchSkill: MaxSkill = {
  id: 'browser.youtube-search',
  description: 'Pesquisa diretamente no YouTube sem passar pelo modelo de linguagem.',
  risk: 'low',
  priority: 94,
  match: slot(
    new RegExp(
      '^(?:(?:pesquise|pesquisar|pesquisa|procure|procurar|busque|buscar)\\s+(?:no\\s+)?' +
      YOUTUBE +
      '(?:\\s+por)?|' +
      YOUTUBE +
      '\\s+(?:pesquise|procure|busque)(?:\\s+por)?)\\s+(.+)$'
    ),
    'query'
  ),
  async execute(match, context) {
    const query = match.slots?.query ?? ''
    await context.browser.searchYouTube(query)
    return { kind: 'operational', detail: 'youtube-search:' + query }
  }
}

export const googleSearchSkill: MaxSkill = {
  id: 'browser.google-search',
  description: 'Pesquisa diretamente no Google sem passar pelo modelo de linguagem.',
  risk: 'low',
  priority: 92,
  match: slot(
    /^(?:(?:pesquise|pesquisar|pesquisa|procure|procurar|busque|buscar)(?:\s+no\s+google)?(?:\s+por)?|google\s+pesquise(?:\s+por)?)\s+(.+)$/,
    'query'
  ),
  async execute(match, context) {
    const query = match.slots?.query ?? ''
    await context.browser.searchGoogle(query)
    return { kind: 'operational', detail: 'google-search:' + query }
  }
}

export const openBrainSkill: MaxSkill = {
  id: 'max.open-brain',
  description: 'Abre a janela local Cérebro do Max.',
  risk: 'low',
  priority: 95,
  match: exact(new RegExp('^' + OPEN + '\\s+(?:o\\s+)?(?:seu\\s+)?cerebro$')),
  async execute(_match, context) {
    context.showBrain().show()
    return { kind: 'operational', detail: 'brain' }
  }
}

export const timeSkill: MaxSkill = {
  id: 'system.time',
  description: 'Informa a hora local do computador sem usar LLM.',
  risk: 'low',
  priority: 85,
  match: exact(/^(?:que horas sao|qual a hora|me diga as horas|horas)$/),
  async execute() {
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())
    return { kind: 'spoken', text: 'Agora são ' + time + '.', detail: 'local-time' }
  }
}

export const dateSkill: MaxSkill = {
  id: 'system.date',
  description: 'Informa a data local do computador sem usar LLM.',
  risk: 'low',
  priority: 85,
  match: exact(/^(?:que dia e hoje|qual a data de hoje|data de hoje|hoje e que dia)$/),
  async execute() {
    const date = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date())
    return { kind: 'spoken', text: 'Hoje é ' + date + '.', detail: 'local-date' }
  }
}

export const screenshotSkill: MaxSkill = {
  id: 'screen.screenshot',
  description: 'Captura a tela principal e salva uma imagem local no Desktop.',
  risk: 'low',
  priority: 93,
  match: exact(/^(?:tire|tira|faca|faça|capture)(?:\s+uma)?\s+(?:captura|screenshot|print)(?:\s+da)?\s*(?:tela)?$/),
  async execute(_match, context) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = join(app.getPath('desktop'), 'MAX-' + timestamp + '.png')
    await context.vision.savePrimaryScreenshot(path)
    return { kind: 'operational', detail: 'screenshot:' + path }
  }
}

export const screenQuestionSkill: MaxSkill = {
  id: 'screen.describe-context',
  description: 'Lê o aplicativo e a janela atualmente em foco.',
  risk: 'low',
  priority: 88,
  match(raw) {
    const text = stripWakeWord(raw)
    return /^(?:o que|oque).*(?:na|minha) tela|o que.*aparecendo.*tela|olha isso/.test(text)
      ? { confidence: 0.98 }
      : null
  },
  async execute(_match, context) {
    const observation = await context.vision.observePrimaryScreen()
    const response = observation.activeApplication
      ? 'Henrique, a janela ativa é ' +
        observation.activeApplication +
        (observation.activeWindowTitle ? ', ' + observation.activeWindowTitle : '') +
        '.'
      : 'Henrique, capturei a tela, mas não consegui identificar a janela ativa.'
    return { kind: 'spoken', text: response, detail: 'screen-context' }
  }
}

const APP_ALIASES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  safari: 'Safari',
  finder: 'Finder',
  terminal: 'Terminal',
  notas: 'Notes',
  notes: 'Notes',
  calendario: 'Calendar',
  calendar: 'Calendar',
  configuracoes: 'System Settings',
  ajustes: 'System Settings',
  spotify: 'Spotify'
}

export const openAppSkill: MaxSkill = {
  id: 'system.open-app',
  description: 'Abre um aplicativo instalado no macOS.',
  risk: 'low',
  priority: 10,
  match: slot(new RegExp('^' + OPEN + '\\s+(?:o\\s+|a\\s+)?(.+)$'), 'appName', 0.72),
  async execute(match, context) {
    const rawName = match.slots?.appName ?? ''
    const normalized = normalizeText(rawName)
    const appName = APP_ALIASES[normalized] ?? rawName
    await context.computer.openApp(appName)
    return { kind: 'operational', detail: 'open-app:' + appName }
  }
}

export function createBuiltinSkills(): MaxSkill[] {
  return [
    sleepSkill,
    openBrainSkill,
    screenshotSkill,
    youtubeSearchSkill,
    openYouTubeSkill,
    googleSearchSkill,
    openBrowserSkill,
    openGoogleSkill,
    screenQuestionSkill,
    timeSkill,
    dateSkill,
    openAppSkill
  ]
}
