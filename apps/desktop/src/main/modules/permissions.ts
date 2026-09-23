import { systemPreferences } from 'electron'

export type PermissionSnapshot = {
  microphone: string
  camera: string
  screen: string
  accessibility: boolean
}

export class PermissionsEngine {
  snapshot(): PermissionSnapshot {
    if (process.platform !== 'darwin') {
      return { microphone: 'unknown', camera: 'unknown', screen: 'unknown', accessibility: false }
    }
    return {
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      camera: systemPreferences.getMediaAccessStatus('camera'),
      screen: systemPreferences.getMediaAccessStatus('screen'),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false)
    }
  }

  async request(kind: 'microphone' | 'camera'): Promise<boolean> {
    if (process.platform !== 'darwin') return false
    return systemPreferences.askForMediaAccess(kind)
  }

  requestAccessibilityPrompt(): boolean {
    if (process.platform !== 'darwin') return false
    return systemPreferences.isTrustedAccessibilityClient(true)
  }
}
