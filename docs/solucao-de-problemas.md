# Solução de problemas

Encontre aqui a causa e a solução dos problemas mais comuns.

## O app mostra "Desconectado"

A faixa vermelha abaixo do cabeçalho e o ponto vermelho na engrenagem indicam que o app não alcança o servidor. Enquanto isso, ele tenta reconectar sozinho, com intervalos de 1 a 10 segundos.

Verifique, nesta ordem:

1. O LiveSplit está aberto e o layout atual contém o componente **LiveSplit WebSocket Server**.
2. O servidor foi iniciado: ative **Auto Start** no componente ou use *Control → Start WebSocket Server*.
3. O IP e a porta nas configurações do app são os do componente (porta padrão `15721`). Use **Testar & Salvar** para confirmar.
4. Se o LiveSplit estiver em outro computador, o firewall do Windows permite conexões de entrada na porta do componente.

## O app conecta, mas não mostra dados

O app exibe um aviso amarelo quando a conexão abre, mas nenhum estado do timer chega em cerca de 8 segundos.

Isso quase sempre significa que o endereço aponta para o servidor embutido do LiveSplit (*Control → Start TCP Server* ou *Start WebSocket Server*, normalmente na porta 16834), e não para o componente LiveSplit WebSocket Server. Instale o componente e use a porta dele. Veja o [início rápido](../README.md#início-rápido).

## A conexão funciona no computador, mas não pela internet ou por HTTPS

Navegadores bloqueiam conexões `ws://` feitas a partir de páginas abertas por `https://`. O painel de configurações avisa quando isso acontece.

Para resolver, faça uma destas opções:

- Abra o app por `http://`, por exemplo `http://localhost:3000` ou `http://<IP-do-computador>:3000`.
- Coloque o servidor atrás de um proxy com TLS e use um endereço `wss://`.

## Os tempos são diferentes dos do LiveSplit

- **Método de tempo:** o app segue o método ativo no LiveSplit. Confira se o selo `IGT` aparece no cabeçalho quando você usa Game Time.
- **Game Time durante loadings:** o servidor não avisa quando uma pausa de loading começa ou termina. O app corrige o relógio a cada 3 segundos, então pode haver uma diferença breve logo depois de um loading.
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
