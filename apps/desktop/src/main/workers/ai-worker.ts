import { env, pipeline } from '@xenova/transformers'

type Request =
  | { id: number; type: 'stt'; samplesBase64: string; sampleRate: number }
  | { id: number; type: 'llm'; prompt: string }

const cacheDir = process.env.MAX_AI_CACHE_DIR
env.allowLocalModels = true
env.allowRemoteModels = true
env.useBrowserCache = false
if (cacheDir) env.cacheDir = cacheDir

let sttPromise: Promise<any> | null = null
let llmPromise: Promise<any> | null = null

function getStt(): Promise<any> {
  if (!sttPromise) {
    sttPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
  }
  return sttPromise
}

function getLlm(): Promise<any> {
  if (!llmPromise) {
    llmPromise = pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat')
  }
  return llmPromise
}

const SYSTEM_PROMPT = [
  'Você é MAX, a assistente local de IA do Henrique.',
  'Responda sempre em português do Brasil.',
  'Seja direta, natural e pouco verbosa.',
  'Chame o usuário de Henrique somente quando isso soar natural.',
  'Não diga "Feito." em conversa comum; essa palavra é reservada para ações operacionais concluídas.',
  'Se não souber algo, diga com clareza em vez de inventar.'
].join(' ')

process.on('message', async raw => {
  const request = raw as Request

  try {
    if (request.type === 'stt') {
      const buffer = Buffer.from(request.samplesBase64, 'base64')
      const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const copy = bytes.slice()
      const samples = new Float32Array(copy.buffer)

      const stt = await getStt()
      const result = await stt(samples, {
        language: 'portuguese',
        task: 'transcribe',
        chunk_length_s: 15,
        stride_length_s: 2,
        return_timestamps: false
      })

      process.send?.({
        id: request.id,
        ok: true,
        result: { text: String(result?.text ?? '').trim() }
      })
      return
    }

    const llm = await getLlm()
    const formatted = [
      '<|im_start|>system',
      SYSTEM_PROMPT,
      '<|im_end|>',
      '<|im_start|>user',
      request.prompt.trim(),
      '<|im_end|>',
      '<|im_start|>assistant',
      ''
    ].join('\n')

    const output = await llm(formatted, {
      max_new_tokens: 140,
      do_sample: true,
      temperature: 0.55,
      top_p: 0.9,
      repetition_penalty: 1.08
    })

    const generated = String(output?.[0]?.generated_text ?? '')
    const reply = (generated.startsWith(formatted) ? generated.slice(formatted.length) : generated)
      .replace(/<\\|im_end\\|>[\\s\\S]*$/g, '')
      .replace(/<\\|im_start\\|>assistant/g, '')
      .replace(/<\\|im_start\\|>[\\s\\S]*$/g, '')
      .trim()

    process.send?.({
      id: request.id,
      ok: true,
      result: { text: reply }
    })
  } catch (error) {
    process.send?.({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    })
  }
})
