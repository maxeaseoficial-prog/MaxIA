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

const MIN_UTTERANCE_SECONDS = 0.22
const END_SILENCE_SECONDS = 0.38
const WAKE_END_SILENCE_SECONDS = 0.28
const MAX_UTTERANCE_SECONDS = 12
const WAKE_SCAN_SECONDS = 2.6
const PRE_ROLL_SECONDS = 0.34
const DRAG_THRESHOLD_PX = 6

export function Orb() {
  const [state, setState] = useState<State>('sleeping')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const audioContext = useRef<AudioContext | null>(null)
  const sampleRateRef = useRef(48_000)
  const stateRef = useRef<State>('sleeping')
  const cameraStream = useRef<MediaStream | null>(null)
  const speechActive = useRef(false)
  const speechFrames = useRef(0)
  const silenceSamples = useRef(0)
  const speechBuffer = useRef<number[]>([])
  const preRoll = useRef<number[]>([])
  const noiseFloor = useRef(0.004)
  const sending = useRef(false)
  const dragStart = useRef<{ x: number; y: number; moved: boolean; pointerId: number } | null>(null)

  useEffect(() => window.maxApi.onState(value => {
    const next = value as State
    stateRef.current = next

    if (next === 'speaking') resetSpeechBuffers()

    if (next === 'sleeping' || next === 'waking') {
      setControlsOpen(false)
      setMenuOpen(false)
    }

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

      const sampleRate = sampleRateRef.current
      const utterance = speechBuffer.current.splice(0)
      speechActive.current = false
      speechFrames.current = 0
      silenceSamples.current = 0
      preRoll.current = []

      if (utterance.length < Math.round(sampleRate * MIN_UTTERANCE_SECONDS)) return

      sending.current = true
      try {
        await window.maxApi.transcribe(utterance, sampleRate)
      } catch {
        // O processo principal registra erros; o microfone permanece ativo.
      } finally {
        sending.current = false
      }
    }

    async function start() {
      try {
        await window.maxApi.permissions.request('microphone')

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            sampleRate: { ideal: 48_000 },
            latency: { ideal: 0.01 }
          }
        })

        if (cancelled) return

        const ctx = new AudioContext({ latencyHint: 'interactive' })
        audioContext.current = ctx
        sampleRateRef.current = ctx.sampleRate

        const track = stream.getAudioTracks()[0]
        if (track) {
          console.log('[MAX][mic]', track.label, track.getSettings())
        }

        const source = ctx.createMediaStreamSource(stream)
        processor = ctx.createScriptProcessor(1024, 1, 1)

        processor.onaudioprocess = event => {
          const input = event.inputBuffer.getChannelData(0)

          if (stateRef.current === 'speaking') {
            resetSpeechBuffers()
            return
          }

          const sampleRate = ctx.sampleRate
          const rms = Math.sqrt(input.reduce((sum, sample) => sum + sample * sample, 0) / input.length)
          const frame = Array.from(input)

          if (!speechActive.current) {
            noiseFloor.current = Math.max(0.0025, Math.min(0.03, noiseFloor.current * 0.96 + rms * 0.04))
          }

          const sleeping = stateRef.current === 'sleeping'
          const threshold = sleeping
            ? Math.max(0.016, noiseFloor.current * 3.8)
            : Math.max(0.010, noiseFloor.current * 2.8)
          const voiceDetected = rms >= threshold

          if (!speechActive.current) {
            preRoll.current.push(...frame)
            const preRollSamples = Math.round(sampleRate * PRE_ROLL_SECONDS)
            if (preRoll.current.length > preRollSamples) {
              preRoll.current.splice(0, preRoll.current.length - preRollSamples)
            }

            speechFrames.current = voiceDetected ? speechFrames.current + 1 : 0

            if (speechFrames.current >= 2) {
              speechActive.current = true
              speechBuffer.current = [...preRoll.current, ...frame]
              silenceSamples.current = 0
            }
            return
          }

          speechBuffer.current.push(...frame)
          silenceSamples.current = voiceDetected ? 0 : silenceSamples.current + frame.length

          const maxUtteranceSamples = Math.round(
            sampleRate * (sleeping ? WAKE_SCAN_SECONDS : MAX_UTTERANCE_SECONDS)
          )
          const endSilenceSamples = Math.round(
            sampleRate * (sleeping ? WAKE_END_SILENCE_SECONDS : END_SILENCE_SECONDS)
          )

          if (
            silenceSamples.current >= endSilenceSamples ||
            speechBuffer.current.length >= maxUtteranceSamples
          ) {
            void flushUtterance()
          }
        }

        source.connect(processor)
        processor.connect(ctx.destination)
      } catch (error) {
        console.error('[MAX][microphone]', error)
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
      return
    }

    cameraStream.current?.getTracks().forEach(track => track.stop())
    cameraStream.current = null
    setCameraEnabled(false)
  }

  function resetSpeechBuffers() {
    speechActive.current = false
    speechFrames.current = 0
    silenceSamples.current = 0
    speechBuffer.current = []
    preRoll.current = []
  }

  function onOrbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = {
      x: event.screenX,
      y: event.screenY,
      moved: false,
      pointerId: event.pointerId
    }
    window.maxApi.orbDragStart(event.screenX, event.screenY)
  }

  function onOrbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    const distance = Math.hypot(event.screenX - start.x, event.screenY - start.y)
    if (distance >= DRAG_THRESHOLD_PX) start.moved = true

    if (start.moved) {
      window.maxApi.orbDragMove(event.screenX, event.screenY)
    }
  }

  function onOrbPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    window.maxApi.orbDragEnd()
    dragStart.current = null

    if (!start.moved) {
      setControlsOpen(value => {
        const next = !value
        if (!next) setMenuOpen(false)
        return next
      })
    }
  }

  return (
    <main className={`orb-shell${controlsOpen ? ' controls-open' : ''}`}>
      <div
        className={`orb orb-${state}`}
        aria-label={`MAX ${labels[state]}`}
        onPointerDown={onOrbPointerDown}
        onPointerMove={onOrbPointerMove}
        onPointerUp={onOrbPointerUp}
        onPointerCancel={() => {
          window.maxApi.orbDragEnd()
          dragStart.current = null
        }}
      >
        <span className="orb-ring ring-a" />
        <span className="orb-ring ring-b" />
        <span className="orb-ring ring-c" />
        <span className="orb-core" />
      </div>

      <div className="orb-controls" aria-hidden={!controlsOpen}>
        <button className={micEnabled ? 'active' : ''} tabIndex={controlsOpen ? 0 : -1} title={micEnabled ? 'Mutar microfone' : 'Ativar microfone'} onClick={() => setMicEnabled(value => !value)}>
          {micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button className={cameraEnabled ? 'active' : ''} tabIndex={controlsOpen ? 0 : -1} title="Câmera" onClick={toggleCamera}><Camera size={22} /></button>
        <button tabIndex={controlsOpen ? 0 : -1} title="Configurações" onClick={() => setMenuOpen(value => !value)}><Settings size={22} /></button>
        <button tabIndex={controlsOpen ? 0 : -1} title="Descansar" onClick={() => window.maxApi.sleep()}><X size={25} /></button>
      </div>

      {controlsOpen && menuOpen && (
        <div className="orb-menu">
          <button onClick={() => setMicEnabled(value => !value)}>{micEnabled ? <MicOff /> : <Mic />} {micEnabled ? 'Mutar microfone' : 'Ativar microfone'}</button>
          <button onClick={toggleCamera}><Camera /> {cameraEnabled ? 'Desativar câmera' : 'Ativar câmera'}</button>
          <button onClick={() => window.maxApi.permissions.accessibility()}><Settings /> Permissões</button>
          <div className="menu-separator" />
          <button onClick={() => window.maxApi.sleep()}><X /> Fechar Max</button>
        </div>
      )}
    </main>
  )
}
