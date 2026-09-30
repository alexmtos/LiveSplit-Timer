# Desenvolvimento

Rode o projeto localmente, teste sem o LiveSplit aberto e entenda como o código está organizado.

## Requisitos

- Node.js 22.12 ou mais recente (o Vitest 5 exige essa versão; o app sozinho roda a partir da 20.9).
- npm.

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:3000` |
| `npm run build` | Build de produção |
| `npm start` | Serve a build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação de tipos do TypeScript |
| `npm test` | Testes unitários (Vitest) |
| `npm run mock:server` | Servidor LiveSplit falso em `ws://localhost:15721` |

Antes de abrir um pull request, rode `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` publica o app em `https://<usuário>.github.io/<repositório>/` a cada push na branch `main`. Você também pode rodá-lo manualmente em *Actions → Deploy to GitHub Pages → Run workflow*.

Ele roda lint, typecheck e testes e gera uma exportação estática (`STATIC_EXPORT=1`) com o caminho base informado pelo GitHub Pages (`PAGES_BASE_PATH`). Em seguida, publica a pasta `out/`.

Para ativar a publicação:

1. Em *Settings → Pages*, escolha **GitHub Actions** em **Source**.
2. Faça um push na `main`, ou rode o workflow manualmente.

> **Nota:** no plano gratuito do GitHub, o Pages só funciona em repositórios públicos.

Para reproduzir a build do Pages localmente:

```bash
STATIC_EXPORT=1 PAGES_BASE_PATH=/LiveSplit-Timer npm run build
```

Sem essas variáveis, `npm run build` gera a build normal usada por `npm start`.

## Testar sem o LiveSplit

`scripts/mock-livesplit-server.mjs` imita o componente LiveSplit WebSocket Server 2.x. Ele fala o protocolo 2 com quem conecta com `?protocol=2` e o protocolo 1 com os demais, envia o estado ao conectar, a cada evento e a cada 15 segundos, e aceita os comandos usados pelo app.

```bash
npm run mock:server -- --scale 0.05
```

| Opção | Efeito |
|-------|--------|
| `--port <n>` | Porta do servidor (padrão `15721`) |
| `--scale <n>` | Multiplica os tempos do PB e dos melhores segmentos; `0.05` gera uma run de menos de um minuto |
| `--game-time` | Usa Game Time como método atual (3% mais lento que o Real Time) |
| `--src` | Associa a run a um jogo e categoria do speedrun.com, para testar o recorde mundial |
| `--token <token>` | Exige `?token=<token>`, como a opção **Token** do componente |
| `--read-only` | Recusa os comandos de controle, como a opção **Read only** do componente |
| `--legacy` | Imita o componente 1.x: só protocolo 1, ignorando `?protocol=2` |

## Arquitetura

O app é uma aplicação Next.js 16 (App Router) totalmente estática. Toda a lógica roda no navegador.

```text
src/
├── app/                 Rotas: / e /[view] (uma página por seção)
├── components/          Componentes de interface; só renderizam
├── contexts/
│   ├── SettingsContext      Configurações salvas + parâmetros de URL
│   ├── LiveSplitContext     Conexão WebSocket, estado do timer, recorde mundial
│   └── RunControlsContext   Regras dos botões e atalhos (proteções de reset)
├── hooks/               Relógio local, atalhos, exportação, i18n
├── lib/                 Lógica pura, coberta por testes
│   ├── run.ts           Deltas, previsões, cores e seções (regras do LiveSplit)
│   ├── time.ts          Formatação de tempos
│   ├── state.ts         Validação das mensagens do servidor
│   ├── speedrun.ts      Cliente da API do speedrun.com
│   ├── settings.ts      Padrões, validação e parâmetros de URL
│   └── connection.ts    Endereços WebSocket
└── types/               Tipos do protocolo e das configurações
```

Mantenha cálculos de tempo e regras de negócio em `src/lib/` e cubra-os com testes. Os componentes devem apenas ler do contexto e renderizar.

## Protocolo do LiveSplit WebSocket Server

O componente ([código-fonte](https://github.com/alexmtos/LiveSplit.WebSocketServer), especificação em `docs/PROTOCOL.md`) escuta em `ws://<host>:15721/`. O app sempre conecta em `ws://<host>:<porta>/?protocol=2`, com `&token=<token>` quando há token:

- O **componente 2.x** responde com o protocolo 2.
- O **componente 1.x** ignora a query string e responde com o protocolo 1.

O app descobre a versão pela primeira mensagem: `hello` significa protocolo 2, `{ open, state }` significa protocolo 1.

### Protocolo 2

Toda mensagem do servidor tem um `type`:

| `type` | Quando | Uso no app |
|--------|--------|------------|
| `hello` | Ao conectar | Versões, `readOnly` e o estado inicial (sem ícones) |
| `event` | A cada mudança: timer, comparação, método de tempo, pausa do Game Time, troca de splits… | Novo estado (sem ícones) |
| `response` | Uma por requisição, com `ok` e, em caso de erro, `error.code` | Erros de comando; `unauthorized` indica token recusado |
| `tick` | Só com `subscribe { tickMs }` | Não é assinado; é tratado caso chegue |

O app envia requisições em JSON, `{ "id": 1, "action": "split" }`. Os comandos usados são: `starttimer`, `split`, `unsplit`, `skipsplit`, `togglepause`, `reset`, `setcomparison { comparison }`, `settimingmethod { method }`, `state { includeIcons }` e `ping`.

Os eventos do protocolo 2 não trazem ícones. O app pede `state` com `includeIcons: true` depois do `hello` e dos eventos `run-changed` e `run-manually-modified`, guarda os ícones por posição e nome do split e os aplica aos estados seguintes (`withCachedIcons` em `src/lib/state.ts`).

### Protocolo 1

| Quando | Formato |
|--------|---------|
| Ao conectar | `{ "open": { "response": "success" }, "state": { … } }` |
| A cada evento e a cada 15 segundos | `{ "action": { "action": "split", "data": null }, "state": { … } }` |
| Resposta a `state` | `{ "response": { "response": "state" }, "state": { … } }` |

Os comandos são enviados em texto puro (`split`, `pause`, `resume`, …) e não têm resposta.

### Estado

O formato de `state` está em `src/types/livesplit.ts` e é validado por `normalizeState` em `src/lib/state.ts`. Todos os tempos são milissegundos inteiros no formato `{ "realTime": n, "gameTime": n }`, com `null` quando não há tempo. O nome do jogo e da categoria ficam em `state.run`.

> **Nota:** o componente 2.x também envia `currentDelta`, `predictedTime` e `bestPossibleTime`, calculados pelo LiveSplit no momento do evento. O app calcula os mesmos valores em `src/lib/run.ts`, porque precisa atualizá-los continuamente entre um evento e outro.

## Conexão

- Tempo limite de conexão: 5 segundos.
- Reconexão com espera crescente de 1 a 10 segundos. A espera volta ao início só depois que um estado é recebido.
- Sem mensagens por 20 segundos, o app envia `ping` (protocolo 2) ou `hi` (protocolo 1). Sem mensagens por 45 segundos, descarta a conexão e reconecta.
- Se nenhum estado chegar em 4 segundos após conectar, o app pede `state`. Se ainda assim nada chegar, mostra o aviso de servidor incompatível.
- Apenas no protocolo 1, durante uma run em Game Time, o app pede o estado a cada 3 segundos para acompanhar os loadings.

## Traduções

As traduções ficam em `src/lib/translations.ts`. O tipo `Dictionary` exige que todos os idiomas tenham as mesmas chaves, então o `typecheck` falha se alguma tradução estiver faltando.

Para adicionar um idioma:

1. Adicione o código em `LANGUAGES`, em `src/types/settings.ts`.
2. Crie o dicionário em `src/lib/translations.ts` e inclua-o em `translations` e em `LANGUAGE_OPTIONS`.
