import { Camera, Mic, MicOff, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type State = 'sleeping' | 'waking' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'confirming' | 'error'

const labels: Record<State, string> = {
  sleeping: 'Dormindo',
  waking: 'Acordando…',
  listening: 'Ouvindo…',
  thinking: 'Pensando…',
  executing: 'Executando…',
  speaking: 'Falando…',
  confirming: 'Confirmar',
  error: 'Erro'
}

export function Orb() {
  const [state, setState] = useState<State>('sleeping')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const audioContext = useRef<AudioContext | null>(null)
  const samples = useRef<number[]>([])
  const speakingFrames = useRef(0)
  const stateRef = useRef<State>('sleeping')
  const cameraStream = useRef<MediaStream | null>(null)

  useEffect(() => window.maxApi.onState(value => {
    const next = value as State
    stateRef.current = next
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

    async function start() {
      try {
        await window.maxApi.permissions.request('microphone')
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        if (cancelled) return
        const ctx = new AudioContext()
        audioContext.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = event => {
          const input = event.inputBuffer.getChannelData(0)
          const rms = Math.sqrt(input.reduce((sum, sample) => sum + sample * sample, 0) / input.length)
          if (stateRef.current === 'speaking') {
            speakingFrames.current = rms > 0.035 ? speakingFrames.current + 1 : 0
            if (speakingFrames.current >= 2) void window.maxApi.bargeIn()
          }
          const downsampled = downsample(input, ctx.sampleRate, 16000)
          samples.current.push(...downsampled)
          const max = 16000 * 4
          if (samples.current.length > max) samples.current.splice(0, samples.current.length - max)
        }
        source.connect(processor)
        processor.connect(ctx.destination)
        setAudioReady(true)
      } catch {
        setAudioReady(false)
      }
    }

    void start()
    let timer = 0
    const schedule = () => {
      const delay = stateRef.current === 'sleeping' ? 3600 : stateRef.current === 'listening' ? 1900 : 2800
      timer = window.setTimeout(async () => {
        if (samples.current.length) {
          const snapshot = samples.current.splice(0)
          try { await window.maxApi.transcribe(snapshot) } catch {}
        }
        if (!cancelled) schedule()
      }, delay)
    }
    schedule()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      processor?.disconnect()
      stream?.getTracks().forEach(track => track.stop())
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

  return (
    <main className="orb-shell">
      <div className="speech-bubble">{labels[state]}</div>
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
    for (let j = offset; j < next && j < input.length; j++) { sum += input[j]; count++ }
    output[i] = count ? sum / count : 0
    offset = next
  }
  return output
}
