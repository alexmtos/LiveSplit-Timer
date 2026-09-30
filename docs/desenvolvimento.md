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

## Testar sem o LiveSplit

`scripts/mock-livesplit-server.mjs` imita o componente LiveSplit WebSocket Server: envia o estado ao conectar, a cada evento e a cada 15 segundos, e aceita os mesmos comandos.

```bash
npm run mock:server -- --scale 0.05
```

| Opção | Efeito |
|-------|--------|
| `--port <n>` | Porta do servidor (padrão `15721`) |
| `--scale <n>` | Multiplica os tempos do PB e dos melhores segmentos; `0.05` gera uma run de menos de um minuto |
| `--game-time` | Usa Game Time como método atual (3% mais lento que o Real Time) |
| `--src` | Associa a run a um jogo e categoria do speedrun.com, para testar o recorde mundial |

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

O componente ([código-fonte](https://github.com/alexmtos/LiveSplit.WebSocketServer)) escuta em `ws://<host>:15721/`.

**Mensagens do servidor**, sempre em JSON:

| Quando | Formato |
|--------|---------|
| Ao conectar | `{ "open": { "response": "success" }, "state": { … } }` |
| A cada evento (start, split, pausa, reset, …) | `{ "action": { "action": "split", "data": null }, "state": { … } }` |
| A cada 15 segundos | `{ "action": { "action": "refresh", "data": null }, "state": { … } }` |
| Resposta a `state` | `{ "response": { "response": "state" }, "state": { … } }` |
| Resposta a `hi` | `{ "response": { "response": "hi" } }` |

O formato de `state` está em `src/types/livesplit.ts`. Todos os tempos são milissegundos inteiros no formato `{ "realTime": n, "gameTime": n }`, com `null` quando não há tempo. O nome do jogo e da categoria ficam em `state.run`.

**Comandos do cliente**, em texto puro: `hi`, `state`, `starttimer`, `startorsplit`, `split`, `unsplit`, `skipsplit`, `pause`, `resume`, `reset`, `pausegametime`, `unpausegametime`.

> **Aviso:** o servidor não responde aos comandos do servidor embutido do LiveSplit, como `getbestpossibletime` ou `getpredictedtime`. Os valores equivalentes são calculados em `src/lib/run.ts`.

## Conexão

- Tempo limite de conexão: 5 segundos.
- Reconexão com espera crescente de 1 a 10 segundos. A espera volta ao início só depois que um estado é recebido.
- Sem mensagens por 20 segundos, o app envia `hi`. Sem mensagens por 45 segundos, descarta a conexão e reconecta.
- Se nenhum estado chegar em 4 segundos após conectar, o app pede `state`. Se ainda assim nada chegar, mostra o aviso de servidor incompatível.

## Traduções

As traduções ficam em `src/lib/translations.ts`. O tipo `Dictionary` exige que todos os idiomas tenham as mesmas chaves, então o `typecheck` falha se alguma tradução estiver faltando.

Para adicionar um idioma:

1. Adicione o código em `LANGUAGES`, em `src/types/settings.ts`.
2. Crie o dicionário em `src/lib/translations.ts` e inclua-o em `translations` e em `LANGUAGE_OPTIONS`.
