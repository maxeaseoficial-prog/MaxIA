# ADR-002 — Skill Registry e roteamento determinístico

## Contexto

A MAX começou com um `switch` central no Orchestrator. Esse formato funciona para poucos comandos, mas escala mal: cada nova capacidade aumenta o acoplamento entre voz, interpretação, segurança, automação e resposta.

Foram estudados quatro assistentes open source como referências arquiteturais:

- **sukeesh/Jarvis (MIT)**: usa plugins pequenos para adicionar capacidades sem alterar o núcleo.
- **OpenJarvis (Apache-2.0)**: possui catálogo de skills, descoberta e execução por registro.
- **Priler/jarvis (CC BY-NC-SA)**: separa Wake Word, STT, TTS e NLU. A MAX usa apenas o princípio arquitetural; nenhum código é copiado por causa da licença não comercial.
- **kishanrajput23/Jarvis-Desktop-Voice-Assistant (MIT)**: mostra o valor de comandos determinísticos de desktop antes de recorrer a IA generativa.

## Decisão

A MAX passa a usar um **Skill Registry local**.

Cada skill declara:

- `id`;
- descrição;
- nível de risco;
- prioridade;
- função de `match()`;
- função de `execute()`.

O Orchestrator não conhece detalhes de cada comando. Ele:

1. recebe a transcrição;
2. consulta o Skill Registry;
3. executa a skill determinística quando houver correspondência;
4. aplica política de risco;
5. usa o LLM somente quando nenhuma skill resolver o pedido.

## Skills iniciais

- `system.sleep`
- `system.open-browser`
- `browser.open-google`
- `browser.google-search`
- `max.open-brain`
- `system.open-app`
- `screen.screenshot`
- `screen.describe-context`
- `system.time`
- `system.date`

## Consequências

### Positivas

- comandos operacionais não dependem do modelo de linguagem;
- menor latência;
- testes unitários por skill/registro;
- capacidades podem ser adicionadas sem editar o Orchestrator;
- risco fica explícito por skill;
- abre caminho para catálogo local de skills e plugins assinados.

### Limites atuais

- descoberta automática de skills externas ainda não é permitida;
- scripts importados não são executados;
- skills de risco médio/alto param em confirmação explícita;
- wake word dedicado por áudio continua como módulo separado a ser evoluído.

## Segurança

A MAX **não importa código automaticamente** dos repositórios estudados. Referências externas são usadas como padrões de arquitetura. Qualquer sistema futuro de skills instaláveis deverá validar licença, origem, capacidades e assinatura antes da execução.
