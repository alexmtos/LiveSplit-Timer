# LiveSplit Timer (Next.js Version)

Overlay web moderno para LiveSplit construído com Next.js, TypeScript e Tailwind CSS.

## 🚀 Como Iniciar

### Pré-requisitos
- Node.js 18.17 ou superior
- LiveSplit rodando com o **LiveSplit Server** ativado (porta padrão: 15721)

### Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```

### Execução em Desenvolvimento

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

### Build para Produção

Para gerar uma build otimizada:

```bash
npm run build
npm start
```

## ✨ Funcionalidades Migradas
- **App Router & TS**: Estrutura moderna e tipos seguros.
- **Tailwind CSS**: Estilização responsiva e temas dinâmicos.
- **WebSocket**: Conexão em tempo real com o LiveSplit.
- **Gráfico de Comparação**: Implementação customizada via Canvas.
- **World Record**: Busca automática de recordes mundiais via API do speedrun.com.
- **I18n**: Suporte para 5 idiomas (PT-BR, EN-US, FR, DE, ES).
- **Exportação**: Suporte para salvar splits em PNG ou CSV.

## ⚙️ Configuração
Acesse o ícone de engrenagem no canto superior direito para ajustar:
- IP/Porta do servidor.
- Temas visuais.
- Visibilidade de componentes.
- Idioma.
