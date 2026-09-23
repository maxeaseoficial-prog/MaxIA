# ADR-001 — Electron + React para o primeiro MVP

## Contexto

A prioridade é macOS, mas a arquitetura deve permanecer evolutiva. A MAX precisa de janela transparente always-on-top, execução em background, tray, microfone/câmera, Screen Capture, integração com sistema, múltiplas janelas e distribuição instalável.

## Decisão

Usar **Electron + React + TypeScript** no primeiro MVP.

### Por que Electron agora

1. BrowserWindow atende diretamente o orbe transparente, sem moldura, always-on-top e arrastável.
2. O processo principal tem acesso a LaunchServices, child processes, arquivos, SQLite e Screen Capture.
3. WebAudio simplifica captura do microfone e VAD/streaming de áudio.
4. A janela do Cérebro pode usar um grafo Canvas/WebGL sem criar uma segunda stack.
5. A equipe consegue iterar UI/UX muito mais rápido em TypeScript/React.

### Tauri

É mais leve e tem distribuição menor, mas neste MVP adicionaria Rust e plugins/bridges justamente nas áreas mais sensíveis: áudio contínuo, Screen Capture, automação e empacotamento de modelos locais. Continua sendo candidato para uma fase de otimização.

### App nativo Swift

Seria a melhor integração macOS para AXUIElement, ScreenCaptureKit e AVFoundation, mas reduziria a portabilidade e aumentaria o tempo para validar produto/UX. A arquitetura prevê helpers nativos quando necessário sem reescrever toda a aplicação.

## Consequências

- Consumo de RAM maior que Tauri/nativo.
- Acesso profundo a Accessibility provavelmente usará um helper Swift/Objective-C na fase 2.
- Os módulos de modelo, visão e controle permanecem desacoplados do shell para permitir migração futura.
