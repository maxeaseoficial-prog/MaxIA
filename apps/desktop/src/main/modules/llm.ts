import { spawn } from 'node:child_process'

export interface LlmProvider {
  readonly id: string
  answer(prompt: string): Promise<string>
}

type OllamaTags = {
  models?: Array<{ name?: string; model?: string }>
}

export class OllamaLlmProvider implements LlmProvider {
  readonly id = 'ollama-local'
  private bootPromise: Promise<void> | null = null

  constructor(
    private readonly model = 'qwen2.5:0.5b',
    private readonly endpoint = 'http://127.0.0.1:11434'
  ) {}

  async answer(prompt: string): Promise<string> {
    const userText = prompt.trim()
    if (!userText) return ''

    try {
      await this.ensureReady()

      const response = await this.request('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            {
              role: 'system',
              content: [
                'Você é MAX, a assistente local de IA do Henrique.',
                'Responda sempre em português do Brasil.',
                'Seja direta, natural e pouco verbosa.',
                'Chame o usuário de Henrique somente quando isso soar natural.',
                'Não diga "Feito." em conversa comum; essa palavra é reservada para ações operacionais concluídas.',
                'Se não souber algo, diga com clareza em vez de inventar.'
              ].join(' ')
            },
            { role: 'user', content: userText }
          ],
          keep_alive: '30m',
          options: {
            temperature: 0.45,
            top_p: 0.9,
            num_predict: 120
          }
        })
      }, 180_000)

      if (!response.ok) throw new Error(`Ollama respondeu HTTP ${response.status}.`)

      const payload = await response.json() as { message?: { content?: string } }
      const reply = payload.message?.content?.trim()
      return reply || 'Henrique, não consegui formular uma resposta agora.'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[MAX][LLM][Ollama]', detail)

      return [
        'Henrique, meu motor local de conversa não está disponível.',
        'No Terminal, instale/inicie o Ollama e execute: ollama pull qwen2.5:0.5b'
      ].join(' ')
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.bootPromise) {
      this.bootPromise = this.boot().catch(error => {
        this.bootPromise = null
        throw error
      })
    }
    return this.bootPromise
  }

  private async boot(): Promise<void> {
    let tags = await this.tryTags()

    if (!tags) {
      this.tryStartOllama()
      for (let attempt = 0; attempt < 12 && !tags; attempt++) {
        await sleep(500)
        tags = await this.tryTags()
      }
    }

    if (!tags) {
      throw new Error('Ollama não está instalado ou não iniciou em 127.0.0.1:11434.')
    }

    const installed = (tags.models ?? []).some(item => {
      const name = item.name ?? item.model ?? ''
      return name === this.model || name.startsWith(`${this.model}:`)
    })

    if (!installed) {
      console.log(`[MAX][LLM] baixando modelo local ${this.model} pela primeira vez...`)
      const pull = await this.request('/api/pull', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: this.model, stream: false })
      }, 15 * 60_000)

      if (!pull.ok) throw new Error(`Falha ao baixar ${this.model}: HTTP ${pull.status}.`)
      console.log(`[MAX][LLM] modelo ${this.model} pronto.`)
    }

    // Mantém o modelo carregado para reduzir o atraso da primeira resposta real.
    await this.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: '',
        stream: false,
        keep_alive: '30m'
      })
    }, 120_000)
  }

  private async tryTags(): Promise<OllamaTags | null> {
    try {
      const response = await this.request('/api/tags', { method: 'GET' }, 1_500)
      if (!response.ok) return null
      return await response.json() as OllamaTags
    } catch {
      return null
    }
  }

  private tryStartOllama(): void {
    try {
      const child = spawn('/usr/bin/env', ['ollama', 'serve'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
    } catch {
      // A mensagem de fallback explica como instalar/iniciar quando o binário não existe.
    }
  }

  private request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    return fetch(`${this.endpoint}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs)
    })
  }
}

export class LlmProviderRegistry {
  constructor(private provider: LlmProvider) {}

  use(provider: LlmProvider): void {
    this.provider = provider
  }

  current(): LlmProvider {
    return this.provider
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
