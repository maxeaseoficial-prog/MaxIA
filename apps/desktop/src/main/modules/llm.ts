import type { NativeAppleLanguageProcess } from './native-language'

export interface LlmProvider {
  readonly id: string
  answer(prompt: string): Promise<string>
}

export class NativeAppleLlmProvider implements LlmProvider {
  readonly id = 'apple-foundation-models-local'
  private readonly process: NativeAppleLanguageProcess

  constructor(process: NativeAppleLanguageProcess) {
    this.process = process
  }

  async answer(prompt: string): Promise<string> {
    const userText = prompt.trim()
    if (!userText) return ''

    try {
      const reply = (await this.process.answer(userText)).trim()
      return reply || 'Henrique, não consegui formular uma resposta agora.'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[MAX][LLM][Apple]', detail)
      return 'Henrique, o modelo local da Apple não está disponível agora. Verifique se o Apple Intelligence está ativado.'
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
