# Graph Report - caderninho-dos-doces  (2026-10-30)

## Corpus Check
- 8 files · ~6,650 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .webmanifest 1)

## Summary
- 82 nodes · 125 edges · 12 communities (10 shown, 2 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- pages.yml
- publicar
- registrarPag
- index.html
- Caderninho dos Doces — contexto para o Claude Code
- 🧁 Caderninho dos Doces
- render
- Histórico do projeto
- saldo
- hoje
- sw.js
- graphify.sh

## God Nodes (most connected - your core abstractions)
1. `render()` - 11 edges
2. `saldo()` - 8 edges
3. `registrarPag()` - 8 edges
4. `abrir()` - 7 edges
5. `restaurar()` - 7 edges
6. `Caderninho dos Doces — contexto para o Claude Code` - 7 edges
7. `hoje()` - 6 edges
8. `salvar()` - 6 edges
9. `Como é feito` - 6 edges
10. `🧁 Caderninho dos Doces` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Como é feito` --references--> `parseMoney()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Graphify (mapa do código) — regras` --references--> `saldo()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Como é feito` --references--> `resumo()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Como é feito` --references--> `render()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Graphify (mapa do código) — regras` --references--> `render()`  [INFERRED]
  CLAUDE.md → app/index.html

## Import Cycles
- None detected.

## Communities (12 total, 2 thin omitted)

### Community 0 - "pages.yml"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, jobs, name, on, push, workflow_dispatch (+4 more)

### Community 1 - "publicar"
Cohesion: 0.18
Nodes (11): name, url, publicar, environment, if, runs-on, steps, id (+3 more)

### Community 2 - "registrarPag"
Cohesion: 0.33
Nodes (9): abrirIDB(), carregar(), fechar(), marcarBackup(), registrarPag(), restaurar(), salvar(), toast() (+1 more)

### Community 3 - "index.html"
Cohesion: 0.43
Nodes (6): abrir(), blocoInstalar(), formCli(), formConfig(), formProd(), perguntar()

### Community 4 - "Caderninho dos Doces — contexto para o Claude Code"
Cohesion: 0.25
Nodes (7): parseMoney(), Caderninho dos Doces — contexto para o Claude Code, Como é feito, Dados (não quebrar!), Publicação, Quem usa, Testar

### Community 5 - "🧁 Caderninho dos Doces"
Cohesion: 0.25
Nodes (7): Arquivos, 🧁 Caderninho dos Doces, Instalar no celular, Já usava a versão de teste (no Claude)?, Ligar a publicação (uma vez só), O que ele faz, Testar no computador

### Community 6 - "render"
Cohesion: 0.40
Nodes (6): cardProd(), ir(), render(), vCliente(), vClientes(), vProdutos()

### Community 7 - "Histórico do projeto"
Cohesion: 0.33
Nodes (5): Como começou (conversa no Claude), Falta fazer, Histórico do projeto, O que foi feito na passagem para o Claude Code (29/10/2026), Onde a gente parou

### Community 8 - "saldo"
Cohesion: 0.50
Nodes (5): linhaCli(), listaClientesHTML(), resumo(), saldo(), vResumo()

### Community 9 - "hoje"
Cohesion: 0.50
Nodes (4): formPagar(), hoje(), novaVenda(), vVender()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Caderninho dos Doces — contexto para o Claude Code` connect `Caderninho dos Doces — contexto para o Claude Code` to `registrarPag`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `render()` (e.g. with `Como é feito` and `Graphify (mapa do código) — regras`) actually correct?**
  _`render()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Why does `publicar` connect `publicar` to `pages.yml`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `jobs` connect `pages.yml` to `publicar`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._