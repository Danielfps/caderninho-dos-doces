# Graph Report - caderninho-dos-doces  (2026-10-31)

## Corpus Check
- 23 files · ~36,350 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .webmanifest 1)

## Summary
- 335 nodes · 679 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- index.html
- render
- trazerPlanilha
- servidor.ts
- planilha.test.js
- pages.yml
- conta.test.mjs
- Como ligar a assinatura
- planilha_xlsx.py
- Histórico do projeto
- planilha-modelo_65cae2ee.md
- responder
- package.json
- Caderninho — controle de fiado
- Aviso: o computador foi desligado no fim do trabalho (31/10/2026)
- Roteiro de teste do Caderninho
- sw.js
- graphify.sh

## God Nodes (most connected - your core abstractions)
1. `abrir()` - 33 edges
2. `acaoConta()` - 31 edges
3. `render()` - 23 edges
4. `trazerPlanilha()` - 16 edges
5. `hoje()` - 14 edges
6. `saldo()` - 13 edges
7. `toast()` - 13 edges
8. `verificarAcesso()` - 12 edges
9. `baixarPlanilha()` - 12 edges
10. `fechar()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Como é feito` --references--> `parseMoney()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Antes de tudo: consulte o Graphify (mapa do código)` --references--> `saldo()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Dados (não quebrar!)` --references--> `desde()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Como é feito` --references--> `abrir()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Antes de tudo: consulte o Graphify (mapa do código)` --references--> `registrarPag()`  [INFERRED]
  CLAUDE.md → app/index.html

## Import Cycles
- None detected.

## Communities (18 total, 3 thin omitted)

### Community 0 - "index.html"
Cohesion: 0.08
Nodes (50): abrir(), abrirConta(), abrirIDB(), abrirReceita(), acaoConta(), atualizarPerfil(), atualizarUsuario(), blocoInstalar() (+42 more)

### Community 1 - "render"
Cohesion: 0.09
Nodes (42): bannerAssinatura(), carregarPreco(), chipsCliHTML(), comBotao(), contaPronto(), dataDe(), depoisDoTeste(), desde() (+34 more)

### Community 2 - "trazerPlanilha"
Cohesion: 0.09
Nodes (35): abasDoZip(), aplicarImportacao(), aplicarPlanilha(), baixarBlob(), baixarPlanilha(), calcProd(), completar(), contasMes() (+27 more)

### Community 3 - "servidor.ts"
Cohesion: 0.15
Nodes (27): compararConstante(), lerAssinaturaHeader(), validarAssinatura(), autorizada(), criadaEm(), criarManifestoWebhook(), escolherPreapproval(), isUuid() (+19 more)

### Community 4 - "planilha.test.js"
Cohesion: 0.11
Nodes (17): {chromium,devices}, clientesApp(), COLUNA, comparar(), {execFileSync}, fs, horaApp(), irMes() (+9 more)

### Community 5 - "pages.yml"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, name, url, jobs, publicar, name (+15 more)

### Community 6 - "conta.test.mjs"
Cohesion: 0.14
Nodes (11): adicionarClientePeloApp(), aqui, clicarAcaoTeste(), conferirCliente(), errosPagina, fluxo(), iniciarServidor(), passo() (+3 more)

### Community 7 - "Como ligar a assinatura"
Cohesion: 0.11
Nodes (16): 1. Aplicar a migração, 2. Configurar os segredos, 3. Publicar as funções, 4. Cadastrar o Webhook no Mercado Pago, 5. Testar antes de abrir para clientes, 6. Ligar o app (e desligar o modo de teste), 7. Trocar o preço provisório, Como ligar a assinatura (+8 more)

### Community 8 - "planilha_xlsx.py"
Cohesion: 0.24
Nodes (5): editar(), linha(), recalcular(), valores(), vazia()

### Community 9 - "Histórico do projeto"
Cohesion: 0.18
Nodes (10): Busca e correções (30/10/2026), Como começou (conversa no Claude), Conta obrigatória, 3 dias grátis e assinatura (31/10/2026), Falta fazer, Graphify e teste da planilha (31/10/2026), Histórico do projeto, O que foi feito na passagem para o Claude Code (29/10/2026), Onde a gente parou (+2 more)

### Community 10 - "planilha-modelo_65cae2ee.md"
Cohesion: 0.18
Nodes (10): Sheet: Acertos, Sheet: Clientes, Sheet: Início, Sheet: Materiais, Sheet: Meu Mês, Sheet: Produtos, Sheet: Recebi, Sheet: Receitas (+2 more)

### Community 11 - "responder"
Cohesion: 0.38
Nodes (10): agora(), aprovar(), cancelar(), conta(), dados(), gravar(), mes(), mudar() (+2 more)

### Community 12 - "package.json"
Cohesion: 0.25
Nodes (8): @playwright/test, devDependencies, @playwright/test@^1.64.1, name, private, scripts, conta, type

### Community 13 - "Caderninho — controle de fiado"
Cohesion: 0.25
Nodes (7): Arquivos, Caderninho — controle de fiado, Instalar no celular, Já usava a versão de teste (no Claude)?, Ligar a publicação (uma vez só), O que ele faz, Testar no computador

### Community 14 - "Aviso: o computador foi desligado no fim do trabalho (31/10/2026)"
Cohesion: 0.40
Nodes (4): Aviso: o computador foi desligado no fim do trabalho (31/10/2026), Falta (decisão ou conta do Daniel), O que ficou pronto, Testes que passaram antes de desligar

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Conta e assinatura (31/10/2026)` connect `render` to `index.html`, `trazerPlanilha`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `acaoConta()` (e.g. with `sessao()` and `Conta e assinatura (31/10/2026)`) actually correct?**
  _`acaoConta()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `index.html` be split into smaller, more focused modules?**
  _Cohesion score 0.07909604519774012 - nodes in this community are weakly interconnected._
- **Why does `calcularLiberadoAte()` connect `render` to `servidor.ts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `render()` (e.g. with `guardarSessao()` and `Como é feito`) actually correct?**
  _`render()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `render` be split into smaller, more focused modules?**
  _Cohesion score 0.08943089430894309 - nodes in this community are weakly interconnected._
- **Why does `acaoConta()` connect `index.html` to `render`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._