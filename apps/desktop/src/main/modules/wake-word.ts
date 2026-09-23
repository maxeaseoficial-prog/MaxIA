import { hasWakeWord, stripWakeWord } from './intent'

export type WakeWordDetection = { detected: boolean; commandAfterWakeWord: string }

export class WakeWordEngine {
  readonly phrase = 'Hey Max'

  detect(transcript: string): WakeWordDetection {
    const detected = hasWakeWord(transcript)
    return { detected, commandAfterWakeWord: detected ? stripWakeWord(transcript) : '' }
  }
}
