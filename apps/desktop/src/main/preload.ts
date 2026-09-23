import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('maxApi', {
  wake: () => ipcRenderer.invoke('max:wake'),
  sleep: () => ipcRenderer.invoke('max:sleep'),
  cancel: () => ipcRenderer.invoke('max:cancel'),
  command: (text: string) => ipcRenderer.invoke('max:command', text),
  transcribe: (samples: number[]) => ipcRenderer.invoke('audio:transcribe', samples),
  bargeIn: () => ipcRenderer.invoke('audio:barge-in'),
  orbDragStart: (screenX: number, screenY: number) => ipcRenderer.send('orb:drag-start', screenX, screenY),
  orbDragMove: (screenX: number, screenY: number) => ipcRenderer.send('orb:drag-move', screenX, screenY),
  orbDragEnd: () => ipcRenderer.send('orb:drag-end'),
  onState: (callback: (state: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: string) => callback(state)
    ipcRenderer.on('max:state', listener)
    return () => ipcRenderer.removeListener('max:state', listener)
  },
  permissions: {
    snapshot: () => ipcRenderer.invoke('permissions:snapshot'),
    request: (kind: 'microphone' | 'camera') => ipcRenderer.invoke('permissions:request', kind),
    accessibility: () => ipcRenderer.invoke('permissions:accessibility')
  },
  knowledge: {
    list: () => ipcRenderer.invoke('knowledge:list'),
    search: (query: string) => ipcRenderer.invoke('knowledge:search', query),
    uploadPdf: () => ipcRenderer.invoke('knowledge:upload-pdf'),
    delete: (id: string, confirmed: boolean) => ipcRenderer.invoke('knowledge:delete', id, confirmed),
    onChanged: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('knowledge:changed', listener)
      return () => ipcRenderer.removeListener('knowledge:changed', listener)
    },
    onProgress: (callback: (status: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: string) => callback(status)
      ipcRenderer.on('knowledge:progress', listener)
      return () => ipcRenderer.removeListener('knowledge:progress', listener)
    }
  }
})
