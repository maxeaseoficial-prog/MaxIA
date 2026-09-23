export interface LlmProvider {
  readonly id: string
  answer(prompt: string): Promise<string>
}

export class UnconfiguredLlmProvider implements LlmProvider {
  readonly id = 'unconfigured'
  async answer(): Promise<string> {
    return 'Henrique, o provedor de linguagem ainda não está configurado nesta primeira versão.'
  }
}

export class LlmProviderRegistry {
  constructor(private provider: LlmProvider = new UnconfiguredLlmProvider()) {}

  use(provider: LlmProvider): void {
    this.provider = provider
  }

  current(): LlmProvider {
    return this.provider
  }
}
