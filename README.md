# LiveSplit Timer

Web-based overlay para LiveSplit com timer em tempo real, tabela de splits, gráfico de comparação e suporte multi-idioma.

## 🎯 Sobre o Projeto

Interface web leve que se conecta ao **LiveSplit Server** via WebSocket, oferecendo uma visualização moderna e responsiva para speedruns. Ideal para OBS overlays ou uso direto durante runs.

## ✨ Funcionalidades

- **Timer em Tempo Real** - Sincronizado via WebSocket com o LiveSplit
- **Tabela de Splits** - Visualização completa com deltas e cores personalizadas
- **Gráfico de Comparação** - Gráfico interativo comparando contra PB/WR
- **Controles de Run** - Start, Pause, Split, Skip, Undo, Reset
- **Multi-idioma** - PT-BR, EN-US, FR, DE, ES
- **Temas** - Múltiplos temas visuais selecionáveis
- **Previsões** - Tempo Ideal e Previsão Atual
- **Exportação** - Exportar como imagem (PNG) ou CSV
- **Configurações Persistentes** - IP/Porta personalizados, auto-conexão

## 🚀 Tecnologias

- **Vanilla JavaScript** (sem frameworks)
- **HTML5 Canvas** para gráficos
- **CSS3** com variáveis para temas
- **WebSocket API** para comunicação com LiveSplit
- **Modular** - `src/config.js`, `src/translations.js`

## 📋 Pré-requisitos

1. **LiveSplit** instalado e rodando
2. **LiveSplit Server** ativado:
   - No LiveSplit: `Extensions` → `Control` → `Start Server`
   - Porta padrão: `15721`

## 🔧 Instalação e Uso

1. Clone o repositório:
   ```bash
   git clone https://github.com/alexmtos/LiveSplit-Timer.git
   ```

2. Abra o arquivo `timer.html` no navegador (ou via servidor local)

3. Configure a conexão:
   - Abra as configurações (ícone de engrenagem)
   - Ajuste IP e Porta se necessário
   - Clique em "Testar & Salvar"

4. Inicie sua run no LiveSplit e aproveite!

## 📁 Estrutura do Projeto

```
LiveSplit Timer/
├── timer.html          # Interface principal
├── app.js              # Lógica da aplicação (5735+ linhas)
├── styles.css          # Estilos e temas
├── ws_adapter.js       # Adapter WebSocket modular
├── version.json        # Versão do projeto
├── src/
│   ├── config.js      # Configurações extraídas
│   └── translations.js # Strings i18n
├── tests/             # Testes (unitários e integração)
└── .sisyphus/         # Planejamento e notepads da IA
```

## ⚙️ Configurações

### Conexão
- **IP do LiveSplit**: Padrão `localhost`
- **Porta**: Padrão `15721`
- **Auto-conexão**: Reconecta automaticamente

### Interface
- **Temas**: Múltiplos temas disponíveis
- **Gráfico**: Altura ajustável via resizer
- **Splits**: Expansão automática ou manual
- **Idioma**: 5 idiomas suportados

## 🎮 Controles

| Botão | Função | Atalho Recomendado |
|--------|--------|---------------------|
| ▶️ Start/Split | Inicia ou faz split | Espaço |
| ⏸️ Pause | Pausa a run | Tecla P |
| ⏭️ Skip | Pula o split atual | Tecla K |
| ↩️ Undo | Desfaz último split/skip | Tecla U |
| ↺ Reset | Reseta a run | Tecla R |

*Configure no LiveSplit: `Settings` → `Hotkeys`*

## 🐛 Problemas Comuns

### Não conecta ao LiveSplit
1. Verifique se o LiveSplit está aberto
2. Confirme se o Server está ativado (Extensions → Control → Start Server)
3. Verifique se a porta 15721 não está em uso
4. Teste a conexão nas configurações

### Botão Undo desabilitado após apenas skips
- **Corrigido na v1.0.0**: Agora undo funciona para splits skipados também

## 📊 Exportação

### Imagem (PNG)
- Clique em "Exportar" → "Imagem"
- Útil para compartilhar o resultado da run

### CSV
- Clique em "Exportar" → "CSV"
- Para análise detalhada dos splits

## 🔄 Versionamento

O projeto usa versionamento semântico (SemVer) em `version.json`:
```json
{
  "version": "1.0.0",
  "releaseDate": "2026-05-01"
}
```

A versão é exibida no rodapé das configurações.

## 🧪 Testes

```bash
npm test        # Executa todos os testes
npm run test:unit    # Testes unitários
npm run test:integration  # Testes de integração
```

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 👥 Contribuição

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 🌟 Reconhecimentos

- [LiveSplit](https://github.com/LiveSplit/LiveSplit) - Timer de speedrun original
- Comunidade de speedrunning brasileira

---

**Versão atual**: 1.0.0 | **LiveSplit Server**: ws://localhost:15721

## Arquitetura consolidada (Wave 1-6)
- Objetivo: eliminar duplicações de configuração/tradução e padronizar a obtenção de dados no browser.
- Pontos únicos de verdade no browser:
  - src/public-config.js: expõe window.APP_CONFIG (WS_URL, delays, VERSION, LANG, etc.).
  - src/translations.js: consolida traduções (pt-BR, en-US) e expõe window.getTranslation(key).
  - timer.html carrega translations.js e public-config.js antes de app.js, para garantir config/global idioma disponível para a UI.
- versão: a versão da UI agora vem de APP_CONFIG.VERSION (ou FALLBACK), permitindo overrides fáceis sem version.json.
- remoção de version.json: eliminada para evitar duplicidade; a fonte única é APP_CONFIG.VERSION.
- Testes: continuidade de unit tests (translations) + novos tests de ponta a ponta com Playwright (Wave 6+).
- Observação: a atualização de código não quebra UX; é compatível com o fluxo Undo/Skip/Split.

## Como rodar (resumo rápido)
- unitários: npm run test:unit
- end-to-end (Playwright): npm run test:e2e
- se necessário, instalar navegadores: npx playwright install

## Histórico de Waves (Resumo)
- Wave 1: Introdução de config público e remoção de version.json
- Wave 2: Consolidação de traduções
- Wave 3: Centralização de configuração no browser e remoção de duplicação
- Wave 4: Consolidação de i18n com version_label (Versão/Version)
- Wave 5: Testes unitários de i18n
- Wave 6: Testes End-to-End com Playwright
