# Usar no OBS

Adicione o LiveSplit Timer à sua live como fonte de navegador, com fundo transparente, e escolha se quer o overlay completo ou uma fonte para cada seção.

## Antes de começar

- Use a [versão publicada](https://alexmtos.github.io/LiveSplit-Timer/) ou rode o app no seu computador (`npm start`). Veja o [início rápido](../README.md#início-rápido).
- A versão publicada só alcança o LiveSplit do mesmo computador em que o OBS está. Se o LiveSplit rodar em outro PC, rode o app localmente.
- Use o OBS 31 ou mais recente. Versões anteriores usam um navegador interno antigo (Chromium 103) que pode não exibir o app corretamente.

## Adicionar o overlay completo

1. No LiveSplit Timer, abra as configurações pela engrenagem e ajuste tema, seções visíveis e idioma.
2. Na seção **URL para o OBS**, escolha **Overlay completo** e clique em **Copiar**.
3. No OBS, adicione uma **Fonte de navegador** e cole a URL copiada no campo **URL**.
4. Defina a largura e a altura. Um bom ponto de partida é 450 × 900.

A URL copiada já inclui o modo transparente, o modo stream, as seções escondidas e, se houver, o token do componente. Veja [parâmetros de URL](referencia.md#parâmetros-de-url) para editá-la manualmente.

> **Aviso:** quando o componente exige token, ele faz parte da URL. Não mostre a URL da fonte na live.

> **Dica:** a URL leva as configurações junto. Por isso você pode ter várias fontes de navegador com temas ou seções diferentes sem que uma altere a outra.

## Deixar o fundo transparente

Ative **Modo Transparente** nas configurações ou adicione `transparent=1` à URL. O OBS passa a mostrar a cena por trás do overlay.

Para manter um pouco do fundo do tema, ajuste **Transparência do fundo**, que aparece logo abaixo da opção, ou adicione `transparency=<0 a 100>` à URL. Em 100% o fundo some por completo. O texto tem uma sombra escura para continuar legível, e o gráfico e a tabela de splits mantêm um fundo escuro semitransparente.

## Esconder a engrenagem na live

Ative **Modo stream** nas configurações ou adicione `stream=1` à URL. A engrenagem fica invisível e só aparece quando o cursor passa sobre o timer (ou, sem o timer, sobre o canto dela). No OBS, isso acontece apenas na janela **Interagir**.

O modo stream também impede que o painel de configurações abra sozinho na live quando o LiveSplit está fechado.

## Usar uma fonte para cada seção

Cada seção do overlay tem uma página própria, que ocupa toda a área da fonte:

| Página | Conteúdo | Tamanho sugerido |
|--------|----------|------------------|
| `/header` | Jogo, categoria, PB e recorde mundial | 450 × 80 |
| `/timer` | Timer e delta atual; o texto cresce com a fonte | 450 × 120 |
| `/predictions` | Tempo ideal e previsão atual | 450 × 80 |
| `/graph` | Gráfico de comparação | 450 × 200 |
| `/splits` | Tabela de splits | 450 × 500 |

Para gerar a URL de uma página, escolha-a na lista da seção **URL para o OBS** antes de copiar.

## Alterar configurações de dentro do OBS

1. Clique com o botão direito na fonte de navegador e escolha **Interagir**.
2. Passe o cursor sobre o timer (ou, sem o timer, no canto superior direito) e clique na engrenagem.

As alterações feitas assim ficam salvas e valem para todas as fontes que não definem a mesma opção na URL.

## Próximos passos

- [Referência de configurações](referencia.md): todas as opções e parâmetros de URL.
- [Solução de problemas](solucao-de-problemas.md): o que fazer se a fonte ficar em branco ou não conectar.
