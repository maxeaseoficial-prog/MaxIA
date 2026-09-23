import { Camera, Mic, MicOff, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type State = 'sleeping' | 'waking' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'confirming' | 'error'

const labels: Record<State, string> = {
  sleeping: 'Dormindo',
  waking: 'Acordando',
  listening: 'Ouvindo',
  thinking: 'Pensando',
  executing: 'Executando',
  speaking: 'Falando',
  confirming: 'Confirmar',
  error: 'Erro'
}

const TARGET_SAMPLE_RATE = 16_000
const MIN_UTTERANCE_SAMPLES = Math.round(TARGET_SAMPLE_RATE * 0.35)
const END_SILENCE_SAMPLES = Math.round(TARGET_SAMPLE_RATE * 0.72)
const MAX_UTTERANCE_SAMPLES = TARGET_SAMPLE_RATE * 12
const PRE_ROLL_SAMPLES = Math.round(TARGET_SAMPLE_RATE * 0.28)

export function Orb() {
  const [state, setState] = useState<State>('sleeping')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const audioContext = useRef<AudioContext | null>(null)
  const stateRef = useRef<State>('sleeping')
  const cameraStream = useRef<MediaStream | null>(null)
  const speechActive = useRef(false)
  const speechFrames = useRef(0)
  const silenceSamples = useRef(0)
  const speechBuffer = useRef<number[]>([])
  const preRoll = useRef<number[]>([])
  const noiseFloor = useRef(0.004)
  const sending = useRef(false)

  useEffect(() => window.maxApi.onState(value => {
    const next = value as State
    stateRef.current = next

    // Nunca deixe a própria voz da MAX voltar para o STT.
    if (next === 'speaking') resetSpeechBuffers()

    if (next === 'sleeping') {
      cameraStream.current?.getTracks().forEach(track => track.stop())
      cameraStream.current = null
      setCameraEnabled(false)
    }
    setState(next)
  }), [])

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!micEnabled) return
    let stream: MediaStream | null = null
    let processor: ScriptProcessorNode | null = null
    let cancelled = false

    const flushUtterance = async () => {
      if (sending.current) return
      const utterance = speechBuffer.current.splice(0)
      speechActive.current = false
      speechFrames.current = 0
      silenceSamples.current = 0
      preRoll.current = []

      if (utterance.length < MIN_UTTERANCE_SAMPLES) return

      sending.current = true
      try {
        await window.maxApi.transcribe(utterance)
      } catch {
        // O processo principal registra erros de STT; o microfone continua vivo.
      } finally {
        sending.current = false
      }
    }

    async function start() {
      try {
        await window.maxApi.permissions.request('microphone')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        if (cancelled) return

        const ctx = new AudioContext()
        audioContext.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        processor = ctx.createScriptProcessor(4096, 1, 1)

        processor.onaudioprocess = event => {
          const input = event.inputBuffer.getChannelData(0)

          // Enquanto a MAX fala, o áudio dos alto-falantes não pode virar um novo comando.
          // Barge-in acústico volta quando houver AEC confiável; nesta versão o botão cancelar
          // continua disponível e evita o loop em que a MAX escutava a própria voz.
          if (stateRef.current === 'speaking') {
            resetSpeechBuffers()
            return
          }

          const rms = Math.sqrt(input.reduce((sum, sample) => sum + sample * sample, 0) / input.length)
          const downsampled = downsample(input, ctx.sampleRate, TARGET_SAMPLE_RATE)

          if (!speechActive.current) {
            noiseFloor.current = Math.max(0.0025, Math.min(0.03, noiseFloor.current * 0.96 + rms * 0.04))
          }

          const threshold = Math.max(0.012, noiseFloor.current * 3.15)
          const voiceDetected = rms >= threshold

          if (!speechActive.current) {
            preRoll.current.push(...downsampled)
            if (preRoll.current.length > PRE_ROLL_SAMPLES) {
              preRoll.current.splice(0, preRoll.current.length - PRE_ROLL_SAMPLES)
            }

            speechFrames.current = voiceDetected ? speechFrames.current + 1 : 0

            // Dois frames seguidos reduzem disparos por clique, ventilador e ruído ambiente.
            if (speechFrames.current >= 2) {
              speechActive.current = true
              speechBuffer.current = [...preRoll.current, ...downsampled]
              silenceSamples.current = 0
            }
            return
          }

          speechBuffer.current.push(...downsampled)

          if (voiceDetected) {
            silenceSamples.current = 0
          } else {
            silenceSamples.current += downsampled.length
          }

          if (
            silenceSamples.current >= END_SILENCE_SAMPLES ||
            speechBuffer.current.length >= MAX_UTTERANCE_SAMPLES
          ) {
            void flushUtterance()
          }
        }

        source.connect(processor)
        processor.connect(ctx.destination)
        setAudioReady(true)
      } catch {
        setAudioReady(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      processor?.disconnect()
      stream?.getTracks().forEach(track => track.stop())
      resetSpeechBuffers()
      void audioContext.current?.close()
    }
  }, [micEnabled])

  async function toggleCamera() {
    if (!cameraEnabled) {
      const allowed = await window.maxApi.permissions.request('camera')
      if (!allowed) return
      try {
        cameraStream.current = await navigator.mediaDevices.getUserMedia({ video: true })
        setCameraEnabled(true)
      } catch {
        setCameraEnabled(false)
      }
    } else {
      cameraStream.current?.getTracks().forEach(track => track.stop())
      cameraStream.current = null
      setCameraEnabled(false)
    }
  }

  function resetSpeechBuffers() {
    speechActive.current = false
    speechFrames.current = 0
    silenceSamples.current = 0
    speechBuffer.current = []
    preRoll.current = []
  }

  return (
    <main className="orb-shell">
      <div className={`orb orb-${state}`} aria-label={`MAX ${labels[state]}`} onDoubleClick={() => window.maxApi.wake()}>
        <span className="orb-ring ring-a" />
        <span className="orb-ring ring-b" />
        <span className="orb-ring ring-c" />
        <span className="orb-core" />
      </div>
      <div className="orb-controls">
        <button className={micEnabled ? 'active' : ''} title={micEnabled ? 'Mutar microfone' : 'Ativar microfone'} onClick={() => setMicEnabled(value => !value)}>
          {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button className={cameraEnabled ? 'active' : ''} title="Câmera" onClick={toggleCamera}><Camera size={22} /></button>
        <button title="Configurações" onClick={() => setMenuOpen(value => !value)}><Settings size={22} /></button>
        <button title="Descansar" onClick={() => window.maxApi.sleep()}><X size={25} /></button>
      </div>
      {menuOpen && (
        <div className="orb-menu">
          <button onClick={() => setMicEnabled(value => !value)}>{micEnabled ? <MicOff /> : <Mic />} {micEnabled ? 'Mutar microfone' : 'Ativar microfone'}</button>
          <button onClick={toggleCamera}><Camera /> {cameraEnabled ? 'Desativar câmera' : 'Ativar câmera'}</button>
          <button onClick={() => window.maxApi.permissions.accessibility()}><Settings /> Permissões</button>
          <div className="menu-separator" />
          <button onClick={() => window.maxApi.sleep()}><X /> Fechar Max</button>
        </div>
      )}
      <div className={`voice-dot ${audioReady ? 'ready' : ''}`} title={audioReady ? 'Voz local pronta' : 'Aguardando microfone'} />
    </main>
  )
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): number[] {
  if (outputRate >= inputRate) return Array.from(input)
  const ratio = inputRate / outputRate
  const length = Math.round(input.length / ratio)
  const output = new Array<number>(length)
  let offset = 0
  for (let i = 0; i < length; i++) {
    const next = Math.round((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = offset; j < next && j < input.length; j++) {
      sum += input[j]
      count++
    }
    output[i] = count ? sum / count : 0
    offset = next
  }
  return output
}
