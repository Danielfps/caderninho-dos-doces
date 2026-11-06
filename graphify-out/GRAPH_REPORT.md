# Graph Report - caderninho-dos-doces  (2026-11-06)

## Corpus Check
- 48 files · ~66,045 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .example 1)

## Summary
- 569 nodes · 1230 edges · 31 communities (28 shown, 3 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 85 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- contratacao.ts
- trazerPlanilha
- index.html
- Assinatura do Caderninho
- sincronizar.e2e.mjs
- abrir
- render
- pages.yml
- criarSupabaseFalso
- assinatura.e2e.mjs
- ciclo
- agora
- Arquitetura da assinatura recorrente
- supabase-falso.mjs
- planilha.test.js
- conta.test.mjs
- planilha_xlsx.py
- package.json
- Histórico do projeto
- planilha-modelo_65cae2ee.md
- Auditoria do sistema de assinatura (05/11/2026)
- guardarSessao
- Banco (`202611060001_assinatura_recorrente.sql`)
- Caderninho — controle de fiado
- comparar
- Termos de Uso e Política de Privacidade do Caderninho de Fiado
- Conta e assinatura
- Aviso: o computador foi desligado no fim do trabalho (noite de 02/11/2026)
- Roteiro de teste do Caderninho
- sw.js
- graphify.sh

## God Nodes (most connected - your core abstractions)
1. `abrir()` - 36 edges
2. `acaoConta()` - 34 edges
3. `render()` - 26 edges
4. `criarSupabaseFalso()` - 25 edges
5. `sincronizarContratacao()` - 20 edges
6. `Arquitetura da assinatura recorrente` - 20 edges
7. `toast()` - 17 edges
8. `verificarAcesso()` - 17 edges
9. `trazerPlanilha()` - 16 edges
10. `chamarMercadoPago()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `App (Claude)` --references--> `salvar()`  [INFERRED]
  docs/plano-2026-11-02.md → app/index.html
- `Servidor (Esquadro): `supabase/migrations/202611020001_sincronizar.sql`` --references--> `desde()`  [INFERRED]
  docs/plano-2026-11-02.md → app/index.html
- `Falhas previstas` --references--> `chamar()`  [INFERRED]
  docs/assinatura-arquitetura.md → app/index.html
- ``minha_situacao()`` --references--> `agora()`  [INFERRED]
  docs/assinatura-arquitetura.md → app/index.html
- `Fluxo` --references--> `sincronizarContratacao()`  [INFERRED]
  docs/assinatura-arquitetura.md → supabase/functions/_shared/contratacao.ts

## Import Cycles
- None detected.

## Communities (31 total, 3 thin omitted)

### Community 0 - "contratacao.ts"
Cohesion: 0.08
Nodes (66): tratar(), mesmaChave(), tratar(), eventoChave(), lerContratacao(), tratar(), tratarAviso(), assinaturaPartes() (+58 more)

### Community 1 - "trazerPlanilha"
Cohesion: 0.07
Nodes (45): abasDoZip(), aplicarImportacao(), aplicarPlanilha(), baixarBlob(), baixarPlanilha(), calcProd(), contasMes(), crc32() (+37 more)

### Community 2 - "index.html"
Cohesion: 0.09
Nodes (29): abrirIDB(), abrirReceita(), atualizarSyncNaTela(), bannerAssinatura(), blocoInstalar(), blocoOutroCelular(), carregar(), carregarMeta() (+21 more)

### Community 3 - "Assinatura do Caderninho"
Cohesion: 0.07
Nodes (24): Ambientes, Assinatura do Caderninho, Avisos do Mercado Pago, Como funciona, Lojas de aplicativos, O que ainda não tem prova, Para ir à produção, Segredos das funções (+16 more)

### Community 4 - "sincronizar.e2e.mjs"
Cohesion: 0.10
Nodes (19): abrirCliente(), aqui, conta1, conta2, conta3, criarConta(), deve(), entrar() (+11 more)

### Community 5 - "abrir"
Cohesion: 0.14
Nodes (26): abrir(), abrirConta(), acaoConta(), formAvulso(), formCli(), formCodigo(), formConta(), formCriar() (+18 more)

### Community 6 - "render"
Cohesion: 0.16
Nodes (24): carregarPreco(), comBotao(), completar(), conferirPagamento(), contaPronto(), depoisDoTeste(), estadoConta(), fechar() (+16 more)

### Community 7 - "pages.yml"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, name, url, jobs, publicar, name (+15 more)

### Community 8 - "criarSupabaseFalso"
Cohesion: 0.19
Nodes (23): criarSupabaseFalso(), aprovarAnual(), aprovarMensal(), authDa(), cobrarAssinaturaFake(), comClaims(), comService(), corpo() (+15 more)

### Community 9 - "assinatura.e2e.mjs"
Cohesion: 0.13
Nodes (6): deno, dir, mp, criarMpFalso(), tratar(), responder()

### Community 10 - "ciclo"
Cohesion: 0.22
Nodes (19): adotarGuardada(), aparelho(), aplicarRegistro(), canon(), chamar(), ciclo(), codigoErro(), ErroConta (+11 more)

### Community 11 - "agora"
Cohesion: 0.19
Nodes (19): agora(), atualizarAssinatura(), conta(), dados(), gravar(), iniciar(), mudar(), mudou() (+11 more)

### Community 12 - "Arquitetura da assinatura recorrente"
Cohesion: 0.11
Nodes (18): Arquitetura da assinatura recorrente, Configuração, Corpo do `POST /preapproval_plan`, Decisão final: um plano por tentativa (05/11/2026), Distribuição, Falhas previstas, Fatos provados na API (05/11/2026, conta de teste), Fluxo (+10 more)

### Community 13 - "supabase-falso.mjs"
Cohesion: 0.14
Nodes (10): env, porta, raiz, tipos, como(), raiz, rpc(), usuarios (+2 more)

### Community 14 - "planilha.test.js"
Cohesion: 0.12
Nodes (8): {chromium,devices}, COLUNA, {execFileSync}, fs, MODELO, os, path, TMP

### Community 15 - "conta.test.mjs"
Cohesion: 0.19
Nodes (11): adicionarClientePeloApp(), aqui, clicarAcaoTeste(), conferirCliente(), errosPagina, fluxo(), iniciarServidor(), passo() (+3 more)

### Community 16 - "planilha_xlsx.py"
Cohesion: 0.24
Nodes (5): editar(), linha(), recalcular(), valores(), vazia()

### Community 17 - "package.json"
Cohesion: 0.19
Nodes (12): deno, @electric-sql/pglite, @playwright/test, devDependencies, deno@^2.9.6, @electric-sql/pglite@^0.5.14, @playwright/test@^1.64.1, name (+4 more)

### Community 18 - "Histórico do projeto"
Cohesion: 0.17
Nodes (11): Busca e correções (30/10/2026), Como começou (conversa no Claude), Conta obrigatória, 3 dias grátis e assinatura (31/10/2026), Conta que não cai, vários celulares e planos novos (02/11/2026), Falta fazer, Graphify e teste da planilha (31/10/2026), Histórico do projeto, O que foi feito na passagem para o Claude Code (29/10/2026) (+3 more)

### Community 19 - "planilha-modelo_65cae2ee.md"
Cohesion: 0.18
Nodes (10): Sheet: Acertos, Sheet: Clientes, Sheet: Início, Sheet: Materiais, Sheet: Meu Mês, Sheet: Produtos, Sheet: Recebi, Sheet: Receitas (+2 more)

### Community 20 - "Auditoria do sistema de assinatura (05/11/2026)"
Cohesion: 0.20
Nodes (9): 2. Funcionamento do pagamento atual, 3. Causa dos campos e etapas extras, 4. Erros identificados, 5. Alternativas da documentação atual, 6. Arquitetura recomendada, 7. Arquivos que serão modificados, 8. Riscos e prevenção, Atualização depois dos testes práticos (05/11/2026, à noite) (+1 more)

### Community 21 - "guardarSessao"
Cohesion: 0.28
Nodes (9): atualizarPerfil(), atualizarUsuario(), guardarAcesso(), guardarSessao(), iniciais(), sessao(), token(), usuario() (+1 more)

### Community 22 - "Banco (`202611060001_assinatura_recorrente.sql`)"
Cohesion: 0.22
Nodes (8): Banco (`202611060001_assinatura_recorrente.sql`), Função `mp-webhook`, Funções (todas `security definer`, `search_path=''`, exigem `service_role`), Preparar (o Claude faz), Roteiro, Roteiro do teste de ponta a ponta, ok(), erro()

### Community 23 - "Caderninho — controle de fiado"
Cohesion: 0.25
Nodes (7): Arquivos, Caderninho — controle de fiado, Instalar no celular, Já usava a versão de teste (no Claude)?, Ligar a publicação (uma vez só), O que ele faz, Testar no computador

### Community 24 - "comparar"
Cohesion: 0.36
Nodes (8): clientesApp(), comparar(), horaApp(), irMes(), num(), perto(), produtosApp(), resumoApp()

### Community 25 - "Termos de Uso e Política de Privacidade do Caderninho de Fiado"
Cohesion: 0.29
Nodes (6): 1. O que é o aplicativo, 2. Dados guardados e onde ficam, 3. Pagamento e segurança, 4. Planos, preços e renovação automática, 5. Cancelamento, Termos de Uso e Política de Privacidade do Caderninho de Fiado

### Community 26 - "Conta e assinatura"
Cohesion: 0.47
Nodes (6): cartoesPlanos(), ofertaTxt(), passoInstalar(), telaAssinar(), vPortao(), Conta e assinatura

### Community 27 - "Aviso: o computador foi desligado no fim do trabalho (noite de 02/11/2026)"
Cohesion: 0.40
Nodes (4): Aviso: o computador foi desligado no fim do trabalho (noite de 02/11/2026), Falta (decisão ou conta do Daniel), O que ficou pronto, Testes que passaram antes de desligar (todos com 0 falha)

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Conta e assinatura` connect `Conta e assinatura` to `contratacao.ts`, `trazerPlanilha`, `index.html`, `abrir`, `render`, `agora`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `abrir()` (e.g. with `Como é feito` and `1. Arquitetura encontrada`) actually correct?**
  _`abrir()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `contratacao.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08117283950617284 - nodes in this community are weakly interconnected._
- **Why does `cancelar()` connect `contratacao.ts` to `Conta e assinatura`, `Arquitetura da assinatura recorrente`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `acaoConta()` (e.g. with `sessao()` and `Conta e assinatura`) actually correct?**
  _`acaoConta()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `trazerPlanilha` be split into smaller, more focused modules?**
  _Cohesion score 0.07400555041628122 - nodes in this community are weakly interconnected._
- **Why does `Arquitetura da assinatura recorrente` connect `Arquitetura da assinatura recorrente` to `Banco (`202611060001_assinatura_recorrente.sql`)`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._