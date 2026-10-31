# 🧁 Caderninho dos Doces

Aplicativo de celular para anotar **quem pegou doce e quem já pagou**. As contas o caderninho faz sozinho:
quanto falta receber, quanto vendeu no mês, quanto já recebeu e o lucro.

**Endereço do app:** https://danielfps.github.io/caderninho-dos-doces/

> Documentação técnica: [ARCHITECTURE.md](ARCHITECTURE.md) · [MIGRATION.md](MIGRATION.md) ·
> [CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · [docs/historico.md](docs/historico.md)

---

## Para quem usa o app

### O que ele faz

- **Produtos** — cadastra cada doce com foto, preço e quanto custa para fazer.
- **Anotar venda** — escolhe a pessoa, toca nos doces que ela pegou e salva. Dá para marcar "já pagou na hora".
- **Clientes** — mostra quem está devendo e quanto; registra pagamento (Pix, dinheiro, cartão, tudo ou só uma parte).
- **Cobrar no WhatsApp** — abre o WhatsApp com a mensagem de cobrança já escrita.
- **Resumo** — falta receber, vendi, já recebi e meu lucro (no mês ou desde o começo).
- **Cópia de segurança** — salva em arquivo ou copia o texto para guardar numa conversa do WhatsApp.
- **Funciona sem internet** depois da primeira vez que abre.

As contas ficam guardadas **só no celular** de quem usa. Nada vai para a internet.

### Instalar no celular

**Android (Chrome):** abra o endereço do app. Vai aparecer um aviso "Instalar" no Resumo — é só tocar.
Se não aparecer: toque nos três pontinhos (⋮) → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone (Safari):** abra o endereço do app no **Safari** → toque no botão de compartilhar
(quadradinho com a setinha para cima) → **Adicionar à Tela de Início**.

### Trocar de celular ou levar as contas da versão de teste

1. No aparelho antigo, toque na **engrenagem** ⚙️ → **Copiar cópia** (ou **Salvar cópia em arquivo**).
2. No aparelho novo, toque na **engrenagem** ⚙️ → cole o texto em **"Ou cole aqui o texto da cópia"** →
   **Recuperar do texto colado** (ou **Escolher arquivo da cópia**).

---

## Para quem desenvolve

### Tecnologias

| Parte | O que é usado |
|---|---|
| App | HTML + CSS + JavaScript puro em **módulos ES** (`<script type="module">`). **Sem build e sem dependências.** |
| Dados | IndexedDB do navegador (com localStorage como reserva) — no aparelho de quem usa |
| Offline / instalar | Service worker (`app/sw.js`) + `manifest.webmanifest` (PWA) |
| Fontes | Google Fonts (Baloo 2, Nunito Sans) — único serviço externo carregado pelo app |
| Ferramentas de desenvolvimento | Node.js 22+ (servidor local, testes de unidade com `node:test`), Playwright (teste no celular emulado) |
| Publicação | GitHub Actions → GitHub Pages |

Não há backend, banco de dados em servidor, API própria, chaves nem senhas.

### Requisitos

- **Git**
- **Node.js 22 ou mais novo** (https://nodejs.org) — já vem com o `npm`
- Para o teste de ponta a ponta: o Chromium do Playwright (instalado pelo `npm run preparar`)

Python **não** é mais necessário (o `python3 -m http.server` antigo continua funcionando, se preferir).

### Instalação

```bash
git clone https://github.com/Danielfps/caderninho-dos-doces.git
```

```bash
cd caderninho-dos-doces
```

```bash
npm run preparar
```

`npm run preparar` = `npm install` (só o Playwright, para testes) + baixar o Chromium dos testes.
Para **só rodar o app**, nem isso é preciso: o servidor local não tem dependências.

### Configuração (opcional)

```bash
cp .env.example .env
```

Variáveis disponíveis (todas opcionais, só para o ambiente local): `PORT`, `HOST`, `APP_DIR`,
`LOG_REQUESTS`, `E2E_URL`, `CHROMIUM_PATH`. Explicação de cada uma em [.env.example](.env.example).

### Executar localmente

```bash
npm start
```

Abra http://127.0.0.1:8000 no navegador. Para simular o celular, use as ferramentas do desenvolvedor
(F12 → ícone de celular). Para abrir no seu celular pela mesma rede Wi-Fi, ponha `HOST=0.0.0.0` no `.env`
(sem HTTPS o celular não ativa o modo sem internet, mas o resto funciona).

> Abrir o `app/index.html` com dois cliques (endereço `file://`) **não funciona** desde a versão 1.1.0:
> navegadores não carregam módulos JavaScript a partir de arquivos locais. Use sempre `npm start`.

### Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Servidor local em http://127.0.0.1:8000 (mesmo conteúdo do GitHub Pages) |
| `npm run verificar` | Confere lista de arquivos do `sw.js`, imports, manifest e procura chaves vazadas |
| `npm test` | Testes de unidade das regras de negócio (contas, dinheiro, cópia de segurança) |
| `npm run test:e2e` | Fluxo completo num Pixel 7 emulado (cadastrar → vender → receber → resumo → cópia → offline) |
| `npm run test:tudo` | Os três acima, em ordem |

### Estrutura

```
caderninho-dos-doces/
├── app/                      ← o que é publicado (GitHub Pages). Nada aqui precisa de build.
│   ├── index.html            ← esqueleto da página (topo, abas, janela de baixo)
│   ├── css/estilo.css        ← visual, tema claro/escuro
│   ├── js/
│   │   ├── main.js           ← ponto de partida
│   │   ├── config.js         ← configuração central (nomes de armazenamento, limites, textos fixos)
│   │   ├── core/             ← regras de negócio puras (sem tela, testáveis no Node)
│   │   ├── services/         ← infraestrutura do navegador (armazenamento, fotos, instalar, diário)
│   │   └── ui/               ← telas, formulários, ações dos botões, estado da tela
│   ├── sw.js                 ← modo sem internet
│   ├── manifest.webmanifest  ← nome, cores e ícone para instalar
│   └── icons/
├── scripts/                  ← servidor local e verificador
├── tests/                    ← unit/ (node:test), e2e/ (Playwright), fixtures/
├── docs/historico.md         ← como o projeto começou
├── .github/workflows/        ← pages.yml (publicar) e testes.yml (testes em todo envio)
└── ARCHITECTURE.md · MIGRATION.md · CONTRIBUTING.md · CHANGELOG.md · CLAUDE.md
```

Detalhes de cada módulo em [ARCHITECTURE.md](ARCHITECTURE.md).

### Publicação

Todo envio ao ramo principal roda `.github/workflows/pages.yml`: confere o projeto
(`verificar` + testes de unidade) e, se tudo passar, publica a pasta `app/` no GitHub Pages.
Também dá para publicar à mão em **Actions → Publicar o app → Run workflow**.
Os celulares recebem a versão nova em segundo plano; ela aparece na abertura seguinte.
