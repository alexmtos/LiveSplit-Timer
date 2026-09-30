# LiveSplit Timer

LiveSplit Timer é um overlay web para o [LiveSplit](https://livesplit.org/). Ele mostra o timer, os splits, um gráfico de comparação e previsões da sua run em tempo real, e pode ser usado como fonte de navegador no OBS, numa segunda tela ou como controle remoto no celular.

O app segue o que está configurado no LiveSplit: método de tempo (Real Time ou Game Time), comparação selecionada, subsplits e seções. Ele recebe os dados pelo componente [LiveSplit WebSocket Server](https://github.com/alexmtos/LiveSplit.WebSocketServer), de preferência na versão 2, que envia um evento a cada mudança e permite controlar o LiveSplit pelo app.

## O que você pode fazer

- Exibir timer, delta ao vivo, splits com cores de gold / ganhando / perdendo tempo e gráfico da run.
- Ver o melhor tempo ainda possível e a previsão do tempo final, atualizados durante a run.
- Mostrar o recorde mundial do speedrun.com para a categoria e subcategoria da run.
- Colocar o overlay inteiro ou cada seção separada no OBS, com fundo transparente.
- Controlar o timer pelo teclado ou por uma página de controle remoto com botões grandes.
- Trocar a comparação e o método de tempo do LiveSplit pelo painel de configurações.
- Exportar a run como imagem PNG ou planilha CSV.

## Início rápido

### Pré-requisitos

- Node.js 22, apenas para rodar o app no seu computador (a versão mínima é 20.9).
- A versão atual do LiveSplit com o componente LiveSplit WebSocket Server 2.x. A versão 1.x também funciona, com os recursos reduzidos descritos em [Versões do componente](docs/referencia.md#versões-do-componente).

> **Nota:** o app não funciona com o servidor embutido do LiveSplit (*Control → Start TCP Server* ou *Start WebSocket Server*, porta 16834). Ele usa outro protocolo e não envia o estado do timer.

### 1. Configure o LiveSplit

1. Copie `LiveSplit.WebSocketServer.dll` para a pasta `Components` do LiveSplit. O `websocket-sharp.dll` já vem com o LiveSplit.
2. No LiveSplit, abra *Edit Layout*, clique em **+** e escolha *Control → LiveSplit WebSocket Server*.
3. Em *Layout Settings*, na aba do componente, ative **Start the server automatically**. A porta padrão é `15721`.

Se você não ativar o início automático, inicie o servidor manualmente: clique com o botão direito no LiveSplit e escolha *Control → Start WebSocket Server (JSON)*.

> **Nota:** um componente adicionado na versão 2 só aceita conexões do próprio computador; layouts criados com a versão 1 continuam aceitando conexões da rede. Para abrir o app em outro aparelho, como o celular, escolha **Other devices on the network too** em **Accept connections from**. Se você definir um **Token** ou **Allowed web origins**, veja [Proteger o acesso ao LiveSplit](docs/referencia.md#proteger-o-acesso-ao-livesplit).

### 2. Abra o app

Você pode usar a versão publicada ou rodar o app no seu computador.

**Versão publicada:** acesse [https://alexmtos.github.io/LiveSplit-Timer/](https://alexmtos.github.io/LiveSplit-Timer/). Ela funciona no navegador e no OBS do mesmo computador do LiveSplit, sem instalar nada.

> **Nota:** a versão publicada usa HTTPS. Navegadores só permitem que uma página HTTPS se conecte ao LiveSplit do próprio computador (`localhost`). Para conectar a um LiveSplit em outro computador ou usar o controle remoto pelo celular, rode o app localmente.

**No seu computador:** requer Node.js.

```bash
npm install
npm run build
npm start
```

Depois, acesse [http://localhost:3000](http://localhost:3000).

### 3. Confirme a conexão

O nome do jogo e os splits aparecem assim que o app se conecta ao LiveSplit.

Se o LiveSplit estiver em outro computador, clique na engrenagem no canto superior direito, informe o IP e a porta e clique em **Testar & Salvar**.

## Próximos passos

| Guia | Quando usar |
|------|-------------|
| [Usar no OBS](docs/usar-no-obs.md) | Colocar o overlay na sua live, com fundo transparente ou uma fonte por seção |
| [Usar como controle remoto](docs/controle-remoto.md) | Controlar o timer pelo celular, tablet ou outra tela |
| [Referência de configurações](docs/referencia.md) | Todas as opções, parâmetros de URL, páginas e atalhos de teclado |
| [Como os tempos são calculados](docs/como-funciona.md) | Entender deltas, previsões, cores e o recorde mundial |
| [Solução de problemas](docs/solucao-de-problemas.md) | O app não conecta, não mostra dados ou mostra tempos diferentes do LiveSplit |
| [Desenvolvimento](docs/desenvolvimento.md) | Rodar o projeto localmente, testar e entender a arquitetura |
