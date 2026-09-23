export {}

declare global {
  interface Window {
    maxApi: {
      wake(): Promise<void>
      sleep(): Promise<void>
      cancel(): Promise<void>
      command(text: string): Promise<void>
      transcribe(samples: number[]): Promise<{ text: string; action: string }>
      bargeIn(): Promise<void>
      orbDragStart(screenX: number, screenY: number): void
      orbDragMove(screenX: number, screenY: number): void
      orbDragEnd(): void
      onState(callback: (state: string) => void): () => void
      permissions: {
        snapshot(): Promise<Record<string, string | boolean>>
        request(kind: 'microphone' | 'camera'): Promise<boolean>
        accessibility(): Promise<boolean>
      }
      knowledge: {
        list(): Promise<Array<Record<string, string>>>
        search(query: string): Promise<Array<Record<string, string>>>
        uploadPdf(): Promise<Record<string, string> | null>
        delete(id: string, confirmed: boolean): Promise<void>
        onChanged(callback: () => void): () => void
        onProgress(callback: (status: string) => void): () => void
      }
    }
  }
}
