# Arquitetura da MAX v0.1

## Princípios

A MAX é um aplicativo desktop local e não uma página web. O processo Electron principal é o núcleo de coordenação; as janelas React são apenas a camada visual. O projeto separa voz, orquestração, controle do computador, visão, conhecimento, memória/configuração, permissões e auditoria.

## Módulos atuais

- **Desktop Shell**: Electron, BrowserWindow transparente e always-on-top, tray e janela do Cérebro.
- **Wake Word / Audio / STT**: captura WebAudio no renderer e inferência local com Whisper Tiny via Transformers.js. O modelo é baixado na primeira execução e depois fica em cache local do provider.
- **TTS**: `/usr/bin/say` no macOS.
- **Orchestrator**: roteamento de intenções operacionais e conversacionais.
- **LLM Provider**: interface substituível; o MVP não configura um provedor remoto por padrão.
- **Computer Control**: LaunchServices/`open`, `shell.openExternal` e app padrão do sistema. A camada evita coordenadas de mouse.
- **Browser Control**: inicialmente via navegador padrão e URLs; automação semântica de DOM/Accessibility é próxima etapa.
- **Vision**: captura temporária da tela e leitura do app/janela em foco. Interpretação visual/OCR completo ainda é TODO.
- **Knowledge Engine**: upload de PDF, cópia gerenciada, extração de texto, chunking, metadados, busca textual e pontos de extensão para embeddings.
- **Memory / Local Storage**: SQLite via sql.js, com preferências e posição do orbe persistentes.
- **Permissions**: microfone, câmera, tela e Accessibility.
- **Audit Log**: JSONL local com intenção e resultado.

## Loop de automação visual

O contrato da próxima fase seguirá: **OBSERVAR → ENTENDER → PLANEJAR → AGIR → OBSERVAR → VALIDAR**. A v0.1 já possui o estágio `observePrimaryScreen()` e captura temporária em memória, mas não afirma que OCR, árvore AX completa ou modelo visual estejam prontos.

## Política de risco

- Baixo: abrir app, URL, pesquisa ou arquivo autorizado — execução direta.
- Médio: envio, edição, publicação ou sobrescrita — confirmar quando houver impacto externo/ambiguidade.
- Alto: compra, pagamento, senha, exclusão permanente ou alteração crítica — confirmação explícita obrigatória.

O MVP ainda não expõe ferramentas destrutivas. Quando forem adicionadas, devem passar pelo Permissions Engine e Audit Log.
