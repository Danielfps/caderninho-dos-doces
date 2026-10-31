# Histórico de mudanças

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em
[SemVer](https://semver.org/lang/pt-BR/). A versão do app fica em `package.json`; a do cache offline em
`app/sw.js` (`VERSAO`).

## [1.1.0] — 31/10/2026 · Estrutura profissional e ambiente local

Nada muda para quem usa: as telas, as contas e o formato dos dados são os mesmos.

### Mudado
- `app/index.html` dividido em `css/estilo.css` e módulos JavaScript em `js/` (`core/`, `services/`, `ui/`),
  sem build e sem dependências.
- Configuração central em `js/config.js`.
- Ações dos botões numa tabela (`ACOES`) em vez de um `switch` gigante.
- Service worker `caderninho-v2`: guarda os módulos, o CSS e também os ícones maskable.
- Publicação (`pages.yml`) só acontece se o verificador e os testes de unidade passarem.

### Adicionado
- Tratamento de erros: falha inesperada num toque mostra "Algo deu errado. Tente de novo." e fica no diário.
- Diário técnico (`localStorage['caderninho-log']`, últimos 50 avisos/erros) e `caderninhoDiagnostico()` no console.
- Mensagem de erro ao escolher um arquivo de cópia que não abre.
- Servidor local sem dependências (`npm start`) com `.env`.
- `npm run verificar`, 26 testes de unidade (`npm test`) e teste de ponta a ponta no Pixel 7 emulado (`npm run test:e2e`).
- Workflow `testes.yml`, `package.json`/`package-lock.json`, `.gitignore`, `.env.example`, `.editorconfig`.
- README, ARCHITECTURE, MIGRATION, CONTRIBUTING e este CHANGELOG.

### Atenção
- Abrir `app/index.html` direto do arquivo (`file://`) não funciona mais; use `npm start`.

## [1.0.0] — 29/10/2026 · App instalável no GitHub Pages
- App trazido do artefato do Claude para `app/index.html`, sem mudar contas nem formato de dados.
- PWA: `manifest.webmanifest`, ícone de cupcake, `sw.js` para funcionar sem internet, botão Instalar.
- "Salvar cópia em arquivo" baixa direto no celular.
- Publicação automática no GitHub Pages.
