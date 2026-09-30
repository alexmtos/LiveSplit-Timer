# Referência de configurações

Esta página lista todas as opções do LiveSplit Timer, os parâmetros de URL, as páginas disponíveis e os atalhos de teclado.

## Onde as configurações ficam

| Origem | Onde fica | Vale para |
|--------|-----------|-----------|
| Painel de configurações | `localStorage` do navegador (chave `livesplit-settings`) | Todas as páginas do mesmo navegador |
| Parâmetros de URL | A própria URL | Apenas a página aberta com aquela URL; nunca são salvos |

Quando uma opção aparece nos dois lugares, o valor da URL tem prioridade. Se você alterar essa opção no painel, o valor do painel passa a valer para a página e é salvo. O painel mostra um aviso sempre que alguma opção vem da URL.

## Opções do painel

### Conexão

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| IP do LiveSplit | `localhost` | Endereço do computador com o LiveSplit. Também aceita um endereço completo, como `ws://192.168.0.10:15721` ou `wss://exemplo.com`. |
| Porta | `15721` | Porta do componente LiveSplit WebSocket Server. |
| Token | vazio | Token exigido pelo componente, quando definido nas configurações dele. |

**Testar & Salvar** abre uma conexão de teste de até 5 segundos e salva o endereço e o token mesmo se ela falhar. O resultado indica se a conexão funcionou, se o token foi recusado ou se o servidor não é o LiveSplit WebSocket Server.

Com o app conectado, a seção mostra a versão do LiveSplit, a do componente e a do protocolo, além de avisar quando o componente está em modo somente leitura.

### LiveSplit

Aparece apenas com o componente 2.x. Estas opções mudam o próprio LiveSplit, e não só o app:

| Opção | Descrição |
|-------|-----------|
| Comparação | Troca a comparação atual do LiveSplit (Personal Best, Best Segments e as demais da run). |
| Método de tempo | Alterna o LiveSplit entre Real Time e Game Time. |

As opções ficam desativadas quando o componente está em modo somente leitura.

### Tema

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| Tema | Padrão | Um dos 11 temas: `default`, `dark`, `purple`, `orange`, `retro`, `blue`, `green`, `pink`, `matrix`, `sunset`, `midnight`. |
| Modo Transparente | Desligado | Remove o fundo da página para uso no OBS. |

### Exibição

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| Mostrar cabeçalho | Ligado | Jogo, categoria, PB e recorde mundial. |
| Mostrar timer | Ligado | Timer principal e delta atual. |
| Mostrar previsões | Ligado | Tempo ideal e previsão atual. |
| Mostrar controles do timer | Ligado | Botões de iniciar, pausar, pular, desfazer e resetar. |
| Mostrar gráfico de comparação | Ligado | Gráfico do delta ao longo da run. |
| Mostrar tabela de splits | Ligado | Lista de splits, agrupada por seção. |
| Splits sempre expandidos | Desligado | Mostra os subsplits de todas as seções. Desligado, só a seção atual e as que você abrir ficam expandidas. |
| Atalhos de teclado | Ligado | Ativa os [atalhos de teclado](#atalhos-de-teclado) da página. |
| Modo stream | Desligado | Esconde a engrenagem até o cursor passar sobre ela. |

### Idioma

Português (Brasil), English (US), Français, Deutsch e Español. Na primeira visita, o app usa o idioma do navegador quando ele é suportado; caso contrário, usa português.

## Parâmetros de URL

Adicione os parâmetros depois de `?` e separe-os com `&`. Exemplo:

```text
http://localhost:3000/?host=192.168.0.10&theme=matrix&transparent=1&stream=1&hide=controls,graph
```

| Parâmetro | Valores | Efeito |
|-----------|---------|--------|
| `host` | Nome ou IP | Endereço do LiveSplit. Sem `port`, usa `15721`. |
| `port` | `1`–`65535` | Porta do LiveSplit. Sem `host`, mantém o endereço salvo. |
| `secure` | booleano | Usa `wss://` em vez de `ws://`. |
| `ws` | URL `ws://` ou `wss://` | Endereço completo; tem prioridade sobre `host` e `port`. |
| `token` | Texto | Token exigido pelo componente. |
| `theme` | ID do tema | Tema da página. |
| `lang` | `pt-BR`, `en-US`, `fr`, `de`, `es` (ou só o prefixo, como `en`) | Idioma. |
| `transparent` | booleano | Modo transparente. |
| `stream` | booleano | Modo stream. |
| `expanded` | booleano | Splits sempre expandidos. |
| `hotkeys` | booleano | Liga ou desliga os atalhos de teclado. |
| `hide` | Lista de seções | Esconde as seções listadas. |
| `show` | Lista de seções | Mostra as seções listadas. |

- **Booleanos:** `1`, `true`, `yes`, `on`, `sim` ou o parâmetro sem valor ligam a opção; `0`, `false`, `no`, `off`, `nao` desligam.
- **Seções:** `header`, `timer`, `predictions`, `controls`, `graph`, `splits` (`table` também é aceito), separadas por vírgula.
- Valores inválidos são ignorados, e a opção continua com o valor salvo.

> **Dica:** em vez de montar a URL à mão, use **URL para o OBS** no painel de configurações. Ela gera a URL com as opções atuais para a página escolhida.

## Páginas

| Caminho | Conteúdo |
|---------|----------|
| `/` | Overlay completo, com as seções visíveis nas configurações |
| `/header` | Só o cabeçalho |
| `/timer` | Só o timer; o texto acompanha o tamanho da janela |
| `/predictions` | Só as previsões |
| `/controls` | Controle remoto com botões grandes |
| `/graph` | Só o gráfico, ocupando a página inteira |
| `/splits` | Só a tabela de splits |

As páginas de uma seção ignoram as opções de exibição e sempre mostram a sua seção. `hide` e `show` só afetam a página `/`.

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| Espaço | Iniciar, dar split, continuar ou, depois do fim, resetar |
| P | Pausar ou continuar |
| U | Desfazer o último split |
| K | Pular o split atual |
| R | Resetar; durante a run, pressione duas vezes em até 3 segundos |

Os atalhos ignoram teclas seguradas e combinações com Ctrl, Alt ou Cmd, não funcionam enquanto você digita num campo e ficam desativados com o painel de configurações aberto.

## Exportação

| Formato | Conteúdo |
|---------|----------|
| Imagem (PNG) | O overlay com o fundo do tema, sem os botões. |
| CSV | Uma linha por segmento: seção, nome, tempo, tempo do segmento, tempo da comparação atual, delta e melhor segmento. Separado por `;`, em UTF-8, compatível com o Excel. |

O nome do arquivo usa o jogo e a categoria, por exemplo `Super Mario 64 - 16 Star.csv`.

## Versões do componente

O app detecta a versão do protocolo ao conectar e funciona com as duas:

| Recurso | Componente 2.x (protocolo 2) | Componente 1.x (protocolo 1) |
|---------|------------------------------|------------------------------|
| Timer, splits, previsões e recorde mundial | Sim | Sim |
| Controles e atalhos | Sim, com o motivo exibido quando o LiveSplit recusa um comando | Sim, sem retorno de erro |
| Trocar comparação e método de tempo pelo app | Sim | Não |
| Game Time durante loadings | Atualizado por eventos, no momento exato | Corrigido a cada 3 segundos |
| Ícones | Pedidos uma vez e reaproveitados | Enviados em toda atualização |
| Token e modo somente leitura | Sim | Somente leitura, sem aviso no app |

Com o componente 1.x, a seção **Conexão** do painel mostra um aviso sugerindo a atualização.

## Proteger o acesso ao LiveSplit

As configurações do componente 2.x limitam quem pode controlar o LiveSplit. Para cada uma, faça o seguinte no app:

| Configuração do componente | O que fazer no app |
|----------------------------|--------------------|
| **Accept connections from**: *This computer only* | Abra o app no mesmo computador do LiveSplit. Para usar o celular, escolha *Other devices on the network too*. |
| **Token** | Informe o mesmo token no campo **Token** do painel ou no parâmetro `token` da URL. |
| **Allowed web origins** | Inclua o endereço em que o app é aberto, por exemplo `http://localhost:3000` ou `http://192.168.0.10:3000`. |
| **Read only** | Nada. O app mostra o timer normalmente e substitui os controles por um aviso. |

> **Aviso:** a URL gerada em **URL para o OBS** inclui o token quando ele está definido. Não mostre essa URL na live nem a compartilhe.
