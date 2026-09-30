# Usar como controle remoto

Controle o timer do LiveSplit por um celular, tablet ou outro computador da mesma rede, pela página `/controls` ou pelos atalhos de teclado.

## Antes de começar

- O app precisa estar rodando no computador do LiveSplit (`npm start`).
- O celular ou tablet precisa estar na mesma rede local.
- Descubra o IP do computador do LiveSplit. No Windows, rode `ipconfig` e procure **Endereço IPv4**.

## Abrir o controle remoto

1. No celular, acesse `http://<IP-do-computador>:3000/controls`.
2. Toque na engrenagem, informe o mesmo IP no campo **IP do LiveSplit** e toque em **Testar & Salvar**.

A página mostra um botão grande para iniciar, dar split, continuar ou resetar. Abaixo dele ficam os botões de pausar, pular, desfazer e resetar.

> **Nota:** o endereço do LiveSplit fica salvo no navegador do celular. Para configurar sem abrir as configurações, use `http://<IP>:3000/controls?host=<IP>`.

## Evitar resets acidentais

O app protege a run de duas formas:

- **Reset em dois toques:** durante a run, o primeiro toque em **Resetar** (ou na tecla R) só arma o reset. Confirme com um segundo toque em até 3 segundos.
- **Proteção após o fim:** por 1 segundo depois do último split, o botão principal e a barra de espaço não resetam a run.

## Usar os atalhos de teclado

Com a página aberta e em foco, você pode usar:

| Tecla | Ação |
|-------|------|
| Espaço | Iniciar, dar split, continuar ou resetar depois do fim |
| P | Pausar ou continuar |
| U | Desfazer o último split |
| K | Pular o split atual |
| R | Resetar (pressione duas vezes durante a run) |

Os atalhos ignoram a tecla segurada: manter o Espaço pressionado dá um único split. Eles ficam desativados enquanto as configurações estão abertas e podem ser desligados em **Atalhos de teclado**.

> **Nota:** esses atalhos funcionam apenas com a página em foco. Os atalhos globais do próprio LiveSplit continuam funcionando normalmente e são a melhor opção durante o jogo.

## Deixar o controle só para leitura

Para exibir o timer em outra tela sem permitir comandos:

- Esconda os controles com `hide=controls` na URL e desligue os atalhos com `hotkeys=0`.
- Para bloquear comandos de qualquer cliente, ative **Read Only** nas configurações do componente LiveSplit WebSocket Server.
