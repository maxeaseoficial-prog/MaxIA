export interface LlmProvider {
  readonly id: string
  answer(prompt: string): Promise<string>
}

const SYSTEM_PROMPT = [
  'Você é MAX, a assistente local de IA do Henrique.',
  'Responda sempre em português do Brasil.',
  'Seja direta, natural e pouco verbosa.',
  'Chame o usuário de Henrique somente quando isso soar natural.',
  'Não diga "Feito." em conversa comum; essa palavra é reservada para ações operacionais concluídas.',
  'Se não souber algo, diga com clareza em vez de inventar.'
].join(' ')

export class LocalTransformersLlmProvider implements LlmProvider {
  readonly id = 'local-qwen-0.5b'
  private generatorPromise: Promise<any> | null = null

  constructor(
    private readonly cacheDir?: string,
    private readonly model = 'Xenova/Qwen1.5-0.5B-Chat'
  ) {}

  private async generator(): Promise<any> {
    if (!this.generatorPromise) {
      this.generatorPromise = import('@xenova/transformers').then(async transformers => {
        const runtime = transformers as any
        runtime.env.allowLocalModels = true
        runtime.env.allowRemoteModels = true
        runtime.env.useBrowserCache = false
        if (this.cacheDir) runtime.env.cacheDir = this.cacheDir

        return runtime.pipeline('text-generation', this.model)
      })
    }
    return this.generatorPromise
  }

  async answer(prompt: string): Promise<string> {
    const userText = prompt.trim()
    if (!userText) return ''

    try {
      const generator = await this.generator()
      const formatted = [
        '<|im_start|>system',
        SYSTEM_PROMPT,
        '<|im_end|>',
        '<|im_start|>user',
        userText,
        '<|im_end|>',
        '<|im_start|>assistant',
        ''
      ].join('\n')

      const output = await generator(formatted, {
        max_new_tokens: 140,
        do_sample: true,
        temperature: 0.55,
        top_p: 0.9,
        repetition_penalty: 1.08
      })

      const generated = String(output?.[0]?.generated_text ?? '')
      const reply = (generated.startsWith(formatted) ? generated.slice(formatted.length) : generated)
        .replace(/<\|im_end\|>[\s\S]*$/g, '')
        .replace(/<\|im_start\|>assistant/g, '')
        .replace(/<\|im_start\|>[\s\S]*$/g, '')
        .trim()

      if (reply) return reply
      return 'Henrique, não consegui formular uma resposta agora.'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return `Henrique, não consegui carregar o modelo local de conversa agora. Na primeira execução ele precisa ser baixado. Detalhe: ${detail}`
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
