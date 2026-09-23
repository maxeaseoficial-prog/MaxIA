import type { LocalAiProcess } from './local-ai-process'

export interface LlmProvider {
  readonly id: string
  answer(prompt: string): Promise<string>
}

export class LocalTransformersLlmProvider implements LlmProvider {
  readonly id = 'isolated-local-qwen-0.5b'

  constructor(private readonly process: LocalAiProcess) {}

  async answer(prompt: string): Promise<string> {
    const userText = prompt.trim()
    if (!userText) return ''

    try {
      const result = await this.process.request<{ text: string }>({
        type: 'llm',
        prompt: userText
      }, 180_000)

      const reply = result.text.trim()
      if (reply) return reply
      return 'Henrique, não consegui formular uma resposta agora.'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[MAX][LLM][isolated-worker]', detail)
      return 'Henrique, meu modelo local reiniciou durante essa resposta. Pode repetir?'
    }
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
