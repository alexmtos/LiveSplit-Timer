# LiveSplit Timer

LiveSplit Timer é um overlay web para o [LiveSplit](https://livesplit.org/). Ele mostra o timer, os splits, um gráfico de comparação e previsões da sua run em tempo real, e pode ser usado como fonte de navegador no OBS, numa segunda tela ou como controle remoto no celular.

O app segue o que está configurado no LiveSplit: método de tempo (Real Time ou Game Time), comparação selecionada, subsplits e seções. Ele recebe os dados pelo componente [LiveSplit WebSocket Server](https://github.com/alexmtos/LiveSplit.WebSocketServer).

## O que você pode fazer

- Exibir timer, delta ao vivo, splits com cores de gold / ganhando / perdendo tempo e gráfico da run.
- Ver o melhor tempo ainda possível e a previsão do tempo final, atualizados durante a run.
- Mostrar o recorde mundial do speedrun.com para a categoria e subcategoria da run.
- Colocar o overlay inteiro ou cada seção separada no OBS, com fundo transparente.
- Controlar o timer pelo teclado ou por uma página de controle remoto com botões grandes.
- Exportar a run como imagem PNG ou planilha CSV.

## Início rápido

### Pré-requisitos

- Node.js 22 (a versão mínima para rodar o app é 20.9).
- LiveSplit com o componente LiveSplit WebSocket Server instalado.

> **Nota:** o app não funciona com o servidor embutido do LiveSplit (*Control → Start TCP Server* ou *Start WebSocket Server*, porta 16834). Ele usa outro protocolo e não envia o estado do timer.

### 1. Configure o LiveSplit

1. Copie `LiveSplit.WebSocketServer.dll` e `websocket-sharp.dll` para a pasta `Components` do LiveSplit.
2. No LiveSplit, abra *Edit Layout*, clique em **+** e escolha *Control → LiveSplit WebSocket Server*.
3. Nas configurações do componente, ative **Auto Start**. A porta padrão é `15721`.

Se você não ativar o Auto Start, inicie o servidor manualmente: clique com o botão direito no LiveSplit e escolha *Control → Start WebSocket Server*.

### 2. Instale e inicie o app

```bash
npm install
npm run build
npm start
```

### 3. Abra o overlay

Acesse [http://localhost:3000](http://localhost:3000). O nome do jogo e os splits aparecem assim que o app se conecta ao LiveSplit.

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
