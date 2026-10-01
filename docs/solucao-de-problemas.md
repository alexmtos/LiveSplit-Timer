# Solução de problemas

Encontre aqui a causa e a solução dos problemas mais comuns.

## O app mostra "Desconectado"

A faixa vermelha abaixo do cabeçalho e o ponto vermelho na engrenagem indicam que o app não alcança o servidor. Enquanto isso, ele tenta reconectar sozinho, com intervalos de 1 a 10 segundos. Se isso acontecer logo ao abrir a página, o painel de configurações abre sozinho, com um quadro vermelho listando o que verificar (exceto no modo stream e nas páginas de uma seção).

Verifique, nesta ordem:

1. O LiveSplit está aberto e o layout atual contém o componente **LiveSplit WebSocket Server**.
2. O servidor foi iniciado: ative **Start the server automatically** no componente ou use *Control → Start WebSocket Server (JSON)*.
3. O IP e a porta nas configurações do app são os do componente (porta padrão `15721`). Use **Testar & Salvar** para confirmar.
4. Se o app estiver em outro aparelho, **Accept connections from** está em *Other devices on the network too* e o firewall do Windows permite conexões de entrada na porta do componente.
5. Se o componente tiver **Allowed web origins**, o endereço em que você abre o app está na lista. Caso contrário, o navegador é recusado sem nenhuma mensagem e o app mostra apenas "Desconectado".

## O app mostra que o LiveSplit recusou o token

O componente tem um **Token** definido e o app enviou outro, ou nenhum. Copie o token das configurações do componente para o campo **Token** do painel e clique em **Testar & Salvar**. Nas fontes do OBS, gere a URL de novo em **URL para o OBS**, porque ela inclui o token.

## Os controles mostram "Somente leitura"

O componente está com **Read only** ativado. Desative a opção nas configurações do componente para controlar o timer pelo app.

## Uma mensagem diz que o LiveSplit recusou um comando

Com o componente 2.x, o app mostra por alguns segundos o motivo quando o LiveSplit recusa um comando, por exemplo uma ação bloqueada nas configurações do componente. Comandos que só chegaram depois de o timer mudar de estado, como um split duplo, são ignorados sem aviso.

## O app conecta, mas não mostra dados

O app mostra um aviso amarelo quando a conexão abre, mas nenhum estado do timer chega em cerca de 8 segundos. Abra o painel de configurações: a seção **Conexão** explica o que aconteceu e mostra o que o servidor enviou. **Testar & Salvar** repete o diagnóstico.

| O painel diz | Causa provável | O que fazer |
|--------------|----------------|-------------|
| O servidor não enviou nenhuma mensagem | A conexão abriu, mas o componente não respondeu nem ao pedido de estado. A causa mais comum é uma DLL do componente feita para outra versão do LiveSplit. | Siga os passos de [O servidor não envia nenhuma mensagem](#o-servidor-não-envia-nenhuma-mensagem). |
| O LiveSplit WebSocket Server fechou a conexão sem enviar o estado | O componente não conseguiu montar o estado e fechou a conexão; o código e o motivo aparecem abaixo do aviso. | Veja o erro completo no Visualizador de Eventos (*Logs do Windows → Aplicativo*, fonte **LiveSplit**) e siga os passos de [O servidor não envia nenhuma mensagem](#o-servidor-não-envia-nenhuma-mensagem). |
| O LiveSplit WebSocket Server respondeu com um erro | O componente recusou enviar o estado; o código e a mensagem aparecem abaixo do aviso. | Reinicie o servidor do componente. Se o erro continuar, reporte-o no repositório do componente com a mensagem exibida. |
| O servidor enviou uma mensagem que o app não reconhece | A porta é de outro programa, ou o formato do estado mudou no componente. | Confira a porta. O início da mensagem aparece abaixo do aviso. |
| Este app usa o componente LiveSplit.WebSocketServer, não o servidor embutido | O endereço aponta para o servidor embutido do LiveSplit (*Control → Start TCP Server* ou *Start WebSocket Server*, normalmente na porta 16834). | Instale o componente e use a porta dele. Veja o [início rápido](../README.md#início-rápido). |

Para ver as mensagens brutas, abra o console do navegador (F12) na página do app e rode:

```js
const ws = new WebSocket('ws://localhost:15721/?protocol=2');
ws.onopen = () => { console.log('aberto'); setTimeout(() => ws.send('state'), 2000); };
ws.onmessage = (e) => console.log('mensagem:', e.data.slice(0, 300));
ws.onerror = () => console.log('erro');
ws.onclose = (e) => console.log('fechado', e.code, e.reason);
```

Se o componente exigir token, acrescente `&token=<token>` ao endereço. Espere cerca de 10 segundos: `aberto` seguido de nenhuma `mensagem` confirma que o componente aceitou a conexão e não respondeu.

## O servidor não envia nenhuma mensagem

A conexão abre, mas o componente não envia o estado inicial nem responde ao pedido de estado. O componente 2.x sempre responde, mesmo com um erro, então o problema está no lado do LiveSplit.

1. Confira se a DLL do componente foi feita para a sua versão do LiveSplit (veja a versão em *About*). O componente usa bibliotecas que vêm com o LiveSplit, e uma DLL feita para uma versão mais nova aceita conexões, mas não consegue enviar nada. Baixe do workflow *Build* do componente o artefato `LiveSplit.WebSocketServer-for-LiveSplit-<versão>` com a sua versão ou uma anterior, e substitua a DLL na pasta `Components`. As versões mais recentes do componente mostram um erro e não iniciam o servidor nesse caso.
2. Confira a versão do componente. Clique com o botão direito no LiveSplit: o menu *Control* deve mostrar **Start WebSocket Server (JSON)**, e as configurações do componente em *Edit Layout* devem ter os campos **Token** e **Read only**. Se houver cópias antigas da DLL do componente na pasta `Components`, remova-as e deixe só a 2.x.
3. Teste o protocolo 1. No console, rode o mesmo código com `ws://localhost:15721/` (sem `?protocol=2`). Se chegar uma mensagem com `open` e `state`, o LiveSplit está rodando um componente 1.x.
4. Procure erros do LiveSplit. Abra o *Visualizador de Eventos* do Windows, vá em *Logs do Windows → Aplicativo* e use *Filtrar Log Atual* com a fonte **LiveSplit**. O LiveSplit registra apenas avisos e erros.
5. Feche o LiveSplit por completo e abra de novo. O componente lê o timer pela janela principal do LiveSplit, então nada é enviado enquanto ela estiver travada.

> **Nota:** a pasta *Logs de Aplicativos e Serviços* não tem uma entrada do LiveSplit. Os erros ficam no log *Aplicativo*.

## A conexão funciona no computador, mas não pela internet ou por HTTPS

Navegadores bloqueiam conexões `ws://` feitas a partir de páginas abertas por `https://`, como a [versão publicada](https://alexmtos.github.io/LiveSplit-Timer/). A exceção é o próprio computador (`localhost` ou `127.0.0.1`), que Chrome, Edge, Firefox e o OBS permitem. O Safari bloqueia até essa exceção. O painel de configurações avisa quando o endereço será bloqueado.

Para resolver, faça uma destas opções:

- Use `localhost` como IP quando o LiveSplit estiver no mesmo computador.
- Rode o app localmente e abra-o por `http://`, por exemplo `http://localhost:3000` ou `http://<IP-do-computador>:3000`.
- Coloque o servidor atrás de um proxy com TLS e use um endereço `wss://`.

> **Nota:** versões recentes do Chrome podem pedir permissão para que um site acesse dispositivos da rede local. Permita o acesso para o app alcançar o LiveSplit.

## Os tempos são diferentes dos do LiveSplit

- **Método de tempo:** o app segue o método ativo no LiveSplit. Confira se o selo `IGT` aparece no cabeçalho quando você usa Game Time.
- **Game Time durante loadings:** com o componente 2.x, o app é avisado quando uma pausa de loading começa e termina. Com o 1.x, ele corrige o relógio a cada 3 segundos, então pode haver uma diferença breve logo depois de um loading. Atualize o componente para eliminar essa diferença.
- **Comparação:** o app usa a comparação selecionada no LiveSplit. Se ela não existir nos splits, usa o Personal Best.

Veja [Como os tempos são calculados](como-funciona.md) para as regras completas.

## O recorde mundial não aparece

| Mensagem | Causa | Solução |
|----------|-------|---------|
| `WR: -` | A run não está associada a um jogo do speedrun.com. | No LiveSplit, abra *Edit Splits → Additional Info* e escolha o jogo e a categoria. |
| `WR não encontrado` | O ranking daquela categoria e subcategoria está vazio. | Confira a subcategoria em *Additional Info*. |
| `WR indisponível` | O speedrun.com não respondeu ou limitou as requisições. | O app tenta de novo depois de 1 minuto. |

## O fundo continua preto no OBS

Ative **Modo Transparente** nas configurações ou adicione `transparent=1` à URL da fonte. Confira também se a URL da fonte não contém `transparent=0`: ela tem prioridade sobre o valor salvo.

## A engrenagem sumiu

O **Modo stream** está ligado. Passe o cursor no canto superior direito da página para ver a engrenagem. No OBS, faça isso pela janela **Interagir** da fonte.

## Espaço ou R não fazem nada

- Os atalhos só funcionam com a página em foco. Clique na página antes de usar o teclado.
- Confira se **Atalhos de teclado** está ligado e se a URL não tem `hotkeys=0`.
- Durante a run, R precisa ser pressionado duas vezes em até 3 segundos.
- Logo depois do último split, Espaço fica bloqueado por 1 segundo para evitar um reset acidental.
