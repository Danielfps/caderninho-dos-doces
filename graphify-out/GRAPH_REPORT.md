# Graph Report - caderninho-dos-doces  (2026-10-31)

## Corpus Check
- 11 files · ~21,823 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .webmanifest 1)

## Summary
- 186 nodes · 346 edges · 15 communities (12 shown, 3 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- planilha.test.js
- pages.yml
- index.html
- trazerPlanilha
- render
- planilha_xlsx.py
- planilha-modelo_65cae2ee.md
- calcProd
- Histórico do projeto
- hoje
- Caderninho — controle de fiado
- vPlanilha
- completar
- sw.js
- graphify.sh

## God Nodes (most connected - your core abstractions)
1. `abrir()` - 17 edges
2. `trazerPlanilha()` - 15 edges
3. `hoje()` - 14 edges
4. `saldo()` - 13 edges
5. `render()` - 13 edges
6. `baixarPlanilha()` - 12 edges
7. `vPlanilha()` - 11 edges
8. `salvar()` - 9 edges
9. `calcProd()` - 9 edges
10. `rotulosClientes()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Como é feito` --references--> `parseMoney()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Dados (não quebrar!)` --references--> `completar()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Antes de tudo: consulte o Graphify (mapa do código)` --references--> `saldo()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Dados (não quebrar!)` --references--> `desde()`  [INFERRED]
  CLAUDE.md → app/index.html
- `Como é feito` --references--> `abrir()`  [INFERRED]
  CLAUDE.md → app/index.html

## Import Cycles
- None detected.

## Communities (15 total, 3 thin omitted)

### Community 0 - "planilha.test.js"
Cohesion: 0.11
Nodes (17): {chromium,devices}, clientesApp(), COLUNA, comparar(), {execFileSync}, fs, horaApp(), irMes() (+9 more)

### Community 1 - "pages.yml"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, name, url, jobs, publicar, name (+15 more)

### Community 2 - "index.html"
Cohesion: 0.17
Nodes (18): abrir(), abrirIDB(), abrirReceita(), blocoInstalar(), carregar(), formAjuste(), formAvulso(), formCli() (+10 more)

### Community 3 - "trazerPlanilha"
Cohesion: 0.15
Nodes (19): abasDoZip(), aplicarImportacao(), baixarBlob(), baixarPlanilha(), crc32(), dataDe(), fazerZip(), folha() (+11 more)

### Community 4 - "render"
Cohesion: 0.19
Nodes (20): desde(), fechar(), ir(), linhaCli(), listaClientesHTML(), marcarBackup(), parseMoney(), pClientes() (+12 more)

### Community 5 - "planilha_xlsx.py"
Cohesion: 0.24
Nodes (5): editar(), linha(), recalcular(), valores(), vazia()

### Community 6 - "planilha-modelo_65cae2ee.md"
Cohesion: 0.18
Nodes (10): Sheet: Acertos, Sheet: Clientes, Sheet: Início, Sheet: Materiais, Sheet: Meu Mês, Sheet: Produtos, Sheet: Recebi, Sheet: Receitas (+2 more)

### Community 7 - "calcProd"
Cohesion: 0.29
Nodes (10): aplicarPlanilha(), calcProd(), contasMes(), formPlanProd(), formProd(), lerPlanProd(), meta(), pProdutos() (+2 more)

### Community 8 - "Histórico do projeto"
Cohesion: 0.20
Nodes (9): Busca e correções (30/10/2026), Como começou (conversa no Claude), Falta fazer, Graphify e teste da planilha (31/10/2026), Histórico do projeto, O que foi feito na passagem para o Claude Code (29/10/2026), Onde a gente parou, Planilha de custos ligada ao app (31/10/2026) (+1 more)

### Community 9 - "hoje"
Cohesion: 0.25
Nodes (8): chipsCliHTML(), formEditPag(), formEditVenda(), haQuanto(), hoje(), novaVenda(), prodsVendaHTML(), vVender()

### Community 10 - "Caderninho — controle de fiado"
Cohesion: 0.25
Nodes (7): Arquivos, Caderninho — controle de fiado, Instalar no celular, Já usava a versão de teste (no Claude)?, Ligar a publicação (uma vez só), O que ele faz, Testar no computador

### Community 11 - "vPlanilha"
Cohesion: 0.29
Nodes (7): pAcertos(), pMateriais(), pMes(), pRecebi(), pReceitas(), pVendas(), vPlanilha()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Caderninho — controle de fiado — contexto para o Claude Code` connect `trazerPlanilha` to `render`, `calcProd`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `trazerPlanilha()` (e.g. with `Antes de tudo: consulte o Graphify (mapa do código)` and `Planilha .xlsx (`app/planilha-modelo.xlsx`)`) actually correct?**
  _`trazerPlanilha()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `planilha.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Why does `Como é feito` connect `render` to `index.html`, `trazerPlanilha`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `pages.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._