# Como os tempos são calculados

O LiveSplit Timer reproduz as regras do próprio LiveSplit para que o overlay mostre os mesmos números que a janela do LiveSplit. Esta página explica de onde vem cada valor.

## Método de tempo e comparação

O app usa as mesmas escolhas feitas no LiveSplit:

- **Método de tempo:** Real Time ou Game Time. Com Game Time, o cabeçalho mostra o selo `IGT`. Se o jogo ainda não informou o Game Time, o timer principal mostra o Real Time, como o LiveSplit faz.
- **Comparação:** Personal Best, Best Segments, Average Segments ou qualquer outra selecionada no LiveSplit. Quando não é o Personal Best, o cabeçalho mostra `vs <comparação>`. Se os splits não tiverem a comparação escolhida, o app usa o Personal Best.

> **Nota:** o servidor só envia o estado quando algo acontece (start, split, pausa) e a cada 15 segundos. Entre as mensagens, o app avança o relógio localmente. Com Game Time, as pausas de loading não geram eventos, então o app também pede o estado a cada 3 segundos durante a run.

## Delta ao lado do timer

Segue o componente *Delta* do LiveSplit:

- Antes do primeiro split, só aparece quando você passa do tempo da comparação.
- Depois disso, mostra o delta do último split. Ele é substituído pelo delta ao vivo apenas quando o ao vivo está pior.
- Com a run terminada, mostra o delta final.

A cor é verde quando você está à frente ou empatado e vermelha quando está atrás. O timer principal usa a mesma cor.

## Delta ao vivo na tabela e no gráfico

A linha do split atual e o ponto branco do gráfico seguem a regra das colunas de splits do LiveSplit. O delta ao vivo aparece quando pelo menos uma destas condições é verdadeira:

- Você está atrás da comparação.
- Você está perdendo tempo no segmento atual, em relação ao delta do split anterior.
- O segmento atual já está mais lento que o seu melhor segmento.

## Cores dos splits

| Cor | Significado |
|-----|-------------|
| Dourado | Melhor segmento (gold): mais rápido que o seu melhor tempo naquele segmento |
| Verde forte | À frente e ganhando tempo |
| Verde claro | À frente, mas perdendo tempo |
| Vermelho claro | Atrás, mas ganhando tempo |
| Vermelho forte | Atrás e perdendo tempo |

"Ganhando" e "perdendo" comparam o delta do split com o delta do split anterior. Depois de um split pulado, o gold é avaliado em relação à comparação Best Segments, que soma os segmentos envolvidos.

## Previsões

| Valor | Como é calculado |
|-------|------------------|
| Tempo Ideal | O menor tempo final ainda possível: seu ritmo atual somado aos melhores segmentos restantes. Antes da run, é o seu Sum of Best. |
| Previsão Atual | O tempo final se o resto da run seguir a comparação atual: o tempo final da comparação mais o delta atual (o do último split, ou o ao vivo quando for maior). Antes da run, é o tempo final da comparação. |

Com a run terminada, os dois mostram o tempo final. A Previsão Atual fica verde quando é igual ou melhor que o seu PB e vermelha quando é pior.

## Seções e subsplits

A tabela agrupa os splits com a mesma convenção do componente Subsplits do LiveSplit:

- Splits cujo nome começa com `-` são subsplits.
- O primeiro split sem `-` depois deles fecha a seção.
- No split que fecha a seção, o texto entre chaves dá nome à seção: `{Mundo 1}Chefe` cria a seção "Mundo 1" com o último split "Chefe". Sem chaves, a seção usa o nome do próprio split.

O cabeçalho de cada seção mostra o tempo e o delta do split que a fecha. A seção atual fica sempre expandida; as outras abrem com um clique, a menos que **Splits sempre expandidos** esteja ligado.

## Recorde mundial

Quando o arquivo de splits está associado a um jogo e categoria do speedrun.com (em *Edit Splits → Additional Info* no LiveSplit), o cabeçalho mostra o primeiro lugar do ranking:

- As variáveis de subcategoria da run filtram o ranking, como no site do speedrun.com. As demais variáveis são ignoradas.
- Runs em dupla mostram todos os jogadores, incluindo convidados.
- O resultado fica em cache por 30 minutos e só é buscado de novo quando o jogo, a categoria ou a subcategoria mudam. Em caso de erro, o app tenta de novo depois de 1 minuto.

O tempo mostrado é o tempo principal do ranking, que pode ser Real Time, Game Time ou Real Time sem loads, conforme as regras da categoria.

## Formato dos tempos

- Os tempos são truncados, nunca arredondados para cima, como no LiveSplit.
- Horas e minutos só aparecem quando são diferentes de zero: `45.23`, `1:05.00`, `1:02:03.45`.
- Deltas sempre têm sinal e usam décimos: `+5.2`, `-1:05.3`. Acima de uma hora, os décimos são omitidos: `+1:02:03`.
- Antes da largada, o timer mostra o offset inicial da run, por exemplo `-5.00` numa contagem regressiva.
