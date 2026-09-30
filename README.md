# LiveSplit Timer

Overlay web para o [LiveSplit](https://livesplit.org/) feito com Next.js, TypeScript e Tailwind CSS: timer em tempo real, tabela de splits com seções, gráfico de comparação, previsões e recorde mundial do speedrun.com. Funciona como fonte de navegador no OBS, numa segunda tela ou como controle remoto no celular/tablet.

## Requisitos

- Node.js 22 (mínimo 20.9 para rodar o app; os testes usam Vitest 5, que exige 22.12+).
- LiveSplit com o componente **LiveSplit WebSocket Server** ([alexmtos/LiveSplit.WebSocketServer](https://github.com/alexmtos/LiveSplit.WebSocketServer)).

> ⚠️ Não é o "LiveSplit Server" embutido do LiveSplit (TCP/WebSocket na porta 16834): ele usa outro protocolo e não envia o estado do timer. Se o app conectar mas não mostrar dados, ele avisa na tela.

### Configurando o LiveSplit

1. Copie `LiveSplit.WebSocketServer.dll` e `websocket-sharp.dll` para a pasta `Components` do LiveSplit.
2. Em *Edit Layout* → `+` → *Control* → **LiveSplit WebSocket Server**. Nas configurações do componente você pode mudar a porta (padrão **15721**) e ligar o *Auto Start*.
3. Se o *Auto Start* estiver desligado: clique com o botão direito no LiveSplit → *Control* → **Start WebSocket Server**.

## Uso

```bash
npm install
npm run dev          # http://localhost:3000
```

Produção:

```bash
npm run build
npm start
```

Abra a engrenagem no canto superior direito para configurar IP/porta (botão **Testar & Salvar**), tema, modo transparente, seções visíveis, atalhos e idioma. As configurações ficam salvas no navegador.

### No OBS

Adicione uma **Fonte de navegador** apontando para `http://localhost:3000`, ligue o **Modo Transparente** nas configurações (use *Interagir* na fonte para abrir a engrenagem). A largura de ~450 px funciona bem.

> A página precisa ser servida por `http://`: navegadores bloqueiam `ws://` a partir de páginas `https://`.

### Atalhos de teclado (na página)

| Tecla | Ação |
|-------|------|
| Espaço | Iniciar / split / continuar / resetar após o fim (1 s de proteção) |
| P | Pausar / continuar |
| U | Desfazer split |
| K | Pular split |
| R | Resetar (pressione duas vezes para confirmar) |

Os atalhos globais do próprio LiveSplit continuam funcionando normalmente; estes servem para usar a página como controle remoto e podem ser desligados nas configurações.

## Funcionalidades

- **Segue o LiveSplit**: usa o método de tempo (Real Time / Game Time, com indicador IGT) e a comparação selecionados no LiveSplit.
- **Delta ao vivo** com as mesmas regras do LiveSplit (aparece quando você fica atrás, perde tempo no segmento ou passa do melhor segmento).
- **Tabela de splits** com subsplits (`-Nome`) e seções (`{Seção}Nome`), tempo/delta por seção, ícones, splits pulados e cores de gold / ganhando / perdendo tempo.
- **Gráfico de comparação** do delta ao longo da run.
- **Previsões**: Tempo Ideal (melhor tempo ainda possível) e Previsão Atual (ritmo atual), calculados localmente.
- **Recorde mundial** do speedrun.com, respeitando as subcategorias da run (com cache de 30 min).
- **Exportação** em PNG (com o tema atual) e CSV (separado por `;`, compatível com Excel).
- **11 temas**, **modo transparente** para OBS e **5 idiomas** (PT-BR, EN-US, FR, DE, ES).

## Desenvolvimento

```bash
npm run mock:server -- --scale 0.05   # LiveSplit.WebSocketServer falso em ws://localhost:15721
npm run lint
npm run typecheck
npm test
```

O servidor falso (`scripts/mock-livesplit-server.mjs`) aceita `--port`, `--scale` (multiplica os tempos do PB), `--game-time` (Game Time como método atual) e `--src` (vincula a run a um jogo do speedrun.com).

A lógica de tempo fica em módulos puros em `src/lib/` (`run.ts`, `time.ts`, `state.ts`, `speedrun.ts`) cobertos por testes Vitest; os componentes React só renderizam.
