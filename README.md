# MAX — Assistente Local de IA por Voz

Primeira versão funcional da **MAX**, assistente desktop local para macOS. O aplicativo roda em segundo plano, acorda por voz com **"Hey Max"**, exibe um orbe azul sempre sobre as janelas, executa ações locais de baixo risco e abre o **Cérebro do Max** para administrar conhecimento.

> Princípio do produto: para uma ação operacional concluída com sucesso, a resposta falada padrão é somente **"Feito."**

## Estado desta versão

Implementado de verdade:

- aplicativo desktop Electron; não depende de aba de navegador;
- execução em background com menu de status/tray;
- orbe transparente, always-on-top e arrastável;
- persistência da última posição do orbe;
- estados visuais: dormindo, acordando, ouvindo, pensando, executando, falando e erro;
- controles de microfone, câmera, permissões e descanso;
- wake word **"Hey Max"** usando reconhecimento local com Whisper Tiny via Transformers.js;
- captura de áudio com WebAudio e processamento adaptativo;
- TTS local pelo `say` do macOS;
- interrupção de fala/barge-in básica;
- comandos:
  - `Hey Max`
  - `Hey Max, descansar`
  - `Abra o navegador`
  - `Abra o Google`
  - `Abra seu cérebro`
  - `Abra o <aplicativo>` no macOS;
- resposta operacional padrão **"Feito."**;
- Cérebro do Max com UI inspirada diretamente nas referências do produto;
- grafo interativo com zoom, pan e seleção;
- upload real de PDF;
- cópia gerenciada do PDF na biblioteca local;
- extração de texto, chunking, metadados e hash;
- biblioteca e busca textual sobre chunks importados;
- exclusão confirmada de fonte, arquivo gerenciado e chunks;
- banco SQLite local via `sql.js`;
- interface desacoplada para embeddings e LLM providers;
- captura temporária da tela e leitura do aplicativo/janela em foco;
- status de permissões para microfone, câmera, Screen Capture e Accessibility;
- política inicial de risco;
- audit log local em JSONL;
- CI para macOS com lint, testes, build e empacotamento `--dir`.

Ainda **não** é anunciado como pronto nesta versão:

- automação genérica de clique/digitação baseada em Accessibility Tree;
- leitura semântica completa de tela com OCR/modelo visual;
- automação de navegador por DOM/CDP;
- envio de WhatsApp/mensagens;
- confirmação conversacional para ações de risco médio/alto;
- embeddings ativos e busca vetorial;
- extração automática de entidades/relações do PDF;
- renomear/mover/reindexar documentos no Cérebro;
- memória de projetos/conversas consolidada;
- provedor LLM configurado por padrão;
- wake-word dedicado de ultrabaixo consumo;
- instalador assinado/notarizado para distribuição pública.

Esses itens permanecem explícitos como próxima etapa em vez de serem simulados.

---

## Stack

- **Desktop:** Electron
- **Frontend:** React + TypeScript
- **Build:** electron-vite + electron-builder
- **STT local:** Whisper Tiny via `@xenova/transformers`
- **TTS local:** `/usr/bin/say`
- **Storage:** SQLite via `sql.js`
- **PDF:** `pdf-parse`
- **Grafo:** `react-force-graph-2d`
- **Ícones:** lucide-react
- **macOS control:** LaunchServices (`open`), Electron Shell, Screen Capture e System Events para metadados da janela ativa

A decisão Electron vs Tauri vs Swift está documentada em [`docs/ADR-001-desktop-stack.md`](docs/ADR-001-desktop-stack.md).

---

## Requisitos

### Desenvolvimento

- macOS recomendado;
- Node.js 22+;
- npm 10+;
- acesso à internet na **primeira** inicialização do reconhecimento de voz para baixar o modelo Whisper Tiny;
- depois do download, a inferência de voz ocorre localmente.

### Permissões macOS

A MAX pode solicitar:

1. **Microfone** — wake word e comandos;
2. **Câmera** — somente quando ativada;
3. **Screen Recording / Screen Capture** — observação da tela;
4. **Accessibility** — necessário para automação semântica mais profunda nas próximas fases.

Abra em:

`System Settings → Privacy & Security`

A versão atual não envia screenshots para serviço externo. Frames de captura usados pelo `VisionEngine` ficam apenas em memória e o contexto é descartado automaticamente.

---

## Instalação

```bash
git clone https://github.com/maxeaseoficial-prog/MaxIA.git
cd MaxIA
npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

A MAX inicia em background. Use o item **MAX** da barra de menus para acordar manualmente durante desenvolvimento, ou conceda acesso ao microfone e diga:

```text
Hey Max
```

Na primeira transcrição, o modelo Whisper Tiny será baixado e armazenado no cache local do provider.

---

## Comandos do MVP

```text
Hey Max
Hey Max, descansar
Abra o navegador
Abra o Google
Abra seu cérebro
Abra o WhatsApp
Abra o Google Chrome
```

Ao completar uma ação operacional com sucesso:

```text
Feito.
```

---

## Testes e validação

```bash
npm run lint
npm test
npm run build
```

Tudo junto:

```bash
npm run check
```

Empacotamento macOS sem criar instalador final:

```bash
npm run package:mac:dir
```

Gerar DMG/ZIP:

```bash
npm run package:mac
```

Para distribuição pública ainda será necessário configurar assinatura Apple Developer e notarização.

---

## Estrutura

```text
MaxIA/
├── apps/
│   └── desktop/
│       └── src/
│           ├── main/
│           │   ├── index.ts
│           │   ├── preload.ts
│           │   └── modules/
│           │       ├── audio-engine.ts
│           │       ├── audit.ts
│           │       ├── browser-control.ts
│           │       ├── computer-control.ts
│           │       ├── database.ts
│           │       ├── intent.ts
│           │       ├── knowledge.ts
│           │       ├── llm.ts
│           │       ├── memory.ts
│           │       ├── orchestrator.ts
│           │       ├── permissions.ts
│           │       ├── risk.ts
│           │       ├── state.ts
│           │       ├── stt.ts
│           │       ├── tts.ts
│           │       ├── vision.ts
│           │       └── wake-word.ts
│           └── renderer/
│               ├── index.html
│               └── src/
│                   ├── App.tsx
│                   ├── main.tsx
│                   ├── styles.css
│                   └── components/
│                       ├── Brain.tsx
│                       └── Orb.tsx
├── build/
│   └── entitlements.mac.plist
├── docs/
│   ├── ADR-001-desktop-stack.md
│   └── ARCHITECTURE.md
├── scripts/
│   └── lint.mjs
└── .github/workflows/ci.yml
```

---

## Dados locais

Os dados são mantidos em `app.getPath('userData')` do Electron, incluindo:

- `max.sqlite` — fontes, chunks, preferências e estrutura de conhecimento;
- `library/` — cópias gerenciadas dos PDFs;
- `models/` — reservado/cache para modelos locais;
- `audit/actions.jsonl` — histórico local de ações.

Ao excluir um PDF pelo Cérebro, a MAX remove a fonte, os chunks associados e o arquivo gerenciado.

---

## Cérebro do Max

O Cérebro possui:

- sidebar de conteúdos;
- upload de PDF;
- documentos recentes;
- busca textual sobre conteúdo extraído;
- grafo visual interativo;
- categorias-base do conhecimento;
- configurações e permissões;
- exclusão explícita e confirmada.

### Indexação semântica

A estrutura já possui:

- `EmbeddingProvider` substituível;
- coluna `embedding_json` por chunk;
- metadados de fonte/chunk;
- schema para entidades e relações.

Nesta primeira versão o provider de embeddings **não é ativado por padrão**. Portanto a busca disponível agora é textual. A interface não mascara essa limitação.

---

## Visão da tela

A arquitetura de percepção já segue o começo do loop:

```text
OBSERVAR → ENTENDER → PLANEJAR → AGIR → OBSERVAR → VALIDAR
```

O MVP implementa o estágio **OBSERVAR**:

- captura temporária da tela via Electron `desktopCapturer`;
- identificação do app/janela em foco quando permitido;
- contexto de tela temporário com TTL;
- nenhuma persistência de screenshot por padrão.

Ainda falta para completar o loop:

- AXUIElement / Accessibility Tree completo;
- OCR;
- modelo visual local/remoto configurável;
- grounding semântico de elementos;
- validação visual após cada ação.

---

## Segurança

Política inicial:

- **baixo risco:** abrir app, URL e arquivo autorizado — execução direta;
- **médio risco:** enviar mensagem, editar arquivo, publicar — exige confirmação quando implementado;
- **alto risco:** pagamento, compra, senha, exclusão permanente — confirmação explícita obrigatória.

A exclusão de um conteúdo do Cérebro já exige confirmação visual antes da operação.

A MAX nunca deve tratar conteúdo de documentos importados como instruções confiáveis do sistema.

---

## Troubleshooting

### A MAX não ouve "Hey Max"

1. confira `Privacy & Security → Microphone`;
2. aguarde o primeiro download do Whisper Tiny;
3. rode em terminal e procure erro do provider local;
4. confirme que o microfone não está mutado no menu do orbe.

### O orbe não aparece

Use o item **MAX** na barra de menus e clique em **Acordar MAX**. Isso testa o shell independentemente do STT.

### O navegador não abre

A implementação tenta descobrir o navegador padrão do sistema e abrir seu bundle no macOS. Confirme que há um navegador padrão configurado.

### Screen Capture não funciona

Conceda acesso em `Privacy & Security → Screen Recording` e reinicie a aplicação se o macOS solicitar.

### PDF dá erro ao importar

Verifique se o arquivo é um PDF válido e não está protegido por senha. O status fica como `erro`; a aplicação não marca o documento como pronto silenciosamente.

---

## Próxima etapa recomendada

A prioridade técnica seguinte é completar o **Computer/Vision Agent** no macOS:

1. helper nativo Swift com Accessibility API / `AXUIElement`;
2. árvore semântica da janela ativa;
3. Browser Control por Chrome DevTools Protocol quando aplicável;
4. OCR/modelo visual apenas como fallback;
5. loop observar → agir → validar;
6. mecanismo de confirmação para impacto externo;
7. embeddings locais e busca híbrida no Cérebro.

Isso transforma a MAX de assistente por comandos básicos em agente desktop multimodal sem depender de coordenadas fixas.
