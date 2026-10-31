# Migração: da nuvem para o ambiente local

Data: 31/10/2026 · Ramo de trabalho: `claude/affectionate-wright-9sqht0` · Base: commit `dbf1227`

## 1. Origem do projeto

| Onde | O que tem | Situação |
|---|---|---|
| Artefato do Claude "Caderninho dos Doces" | 1ª versão do app (veja `docs/historico.md`) | Já trazido para o GitHub em 29/10/2026 (commit `d47b0a0`); não faz mais parte do sistema |
| GitHub `Danielfps/caderninho-dos-doces`, ramo principal `claude/doces-claude-code-transfer-yliita` | Código-fonte (`app/`), automação de publicação, documentação | **Fonte da migração** (commit `dbf1227`) |
| GitHub Pages `https://danielfps.github.io/caderninho-dos-doces/` | Cópia publicada da pasta `app/` do ramo principal | Mesmo conteúdo do commit `dbf1227` (o "Publicar o app" só roda no ramo principal; todas as execuções dos outros ramos foram puladas) |
| Celular de cada pessoa (IndexedDB) | **As contas de verdade** (doces, clientes, vendas, pagamentos) | **Não pode ser migrado daqui** — veja §5 |
| Outros 5 ramos no GitHub | Trabalho em andamento, nunca publicado | Fora desta migração — veja §6 |

## 2. Diagnóstico do projeto original

- **Tipo:** PWA estático, local-first. Um único `app/index.html` (~47 KB: HTML + CSS + JS num IIFE de ~350 linhas).
- **Backend / API / banco em servidor:** não existem. **Variáveis de ambiente / credenciais:** nenhuma.
- **Dependências:** nenhuma biblioteca. Fontes do Google Fonts.
- **Infraestrutura em nuvem usada:** GitHub (código + Actions) e GitHub Pages (hospedagem estática).
- **Testes automatizados:** nenhum (havia só testes manuais descritos no histórico).
- **Pontos fortes:** sem build, offline, dados privados, formato de dados documentado.
- **Pontos de risco:** tudo num arquivo; regras de conta misturadas com a tela; nenhum teste automatizado;
  erros inesperados não tratados (o toque simplesmente "não fazia nada"); `sw.js` sem guardar os ícones
  `maskable`; nada conferia se a lista de arquivos offline estava completa.

## 3. Processo

1. **Descoberta** — leitura completa de todos os arquivos, do histórico de commits, das execuções do GitHub
   Actions e de todos os ramos remotos.
2. **Linha de base** — antes de mudar qualquer coisa, foi escrito o teste de ponta a ponta
   (`tests/e2e/fluxo.mjs`) e rodado **contra o código original**: 15/15 verificações passaram. Também foi
   gravado o HTML gerado em 16 estados de tela (telas, buscas, formulários, perguntas).
3. **Cópia independente** — o trabalho foi feito numa cópia (clone) e num ramo separado. O ramo principal,
   o site publicado e os outros ramos **não foram alterados**. O original continua recuperável a qualquer
   momento pelo commit `dbf1227`.
4. **Reestruturação** — o arquivo único foi dividido em módulos (veja ARCHITECTURE.md), copiando o HTML de
   cada tela sem mudanças.
5. **Validação** — mesmo teste de ponta a ponta: 15/15 (mais um passo novo, para o tratamento de erros: 16/16). HTML dos 16 estados de tela **idêntico byte a byte**
   ao original. Capturas de tela: as mesmas diferenças aparecem entre duas execuções do próprio original
   (cursor/estado de toque), ou seja, ruído do teste e não regressão. Atualização simulada v1 → v2 num celular
   que já tinha o app: 1ª abertura mostra a versão antiga, 2ª mostra a nova, e sem internet funciona com os
   dados preservados.

## 4. Arquivos

### Transferidos sem alteração
`app/manifest.webmanifest`, `app/icons/*` (6 ícones), `docs/historico.md` (só ganhou uma entrada nova).

### Divididos / alterados
| Antes | Depois |
|---|---|
| `app/index.html` (`<style>`) | `app/css/estilo.css` (idêntico) |
| `app/index.html` (`<script>`) | `app/js/**` (16 módulos) |
| `app/index.html` | Só o esqueleto + `<link>` do CSS + `<script type="module" src="js/main.js">` |
| `app/sw.js` | `VERSAO` `caderninho-v1` → `caderninho-v2`; lista `ARQUIVOS` com os módulos, o CSS e os ícones maskable |
| `.github/workflows/pages.yml` | Job `conferir` (verificador + testes de unidade) antes de publicar |
| `README.md`, `CLAUDE.md` | Atualizados para a nova estrutura |

### Criados
`package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.gitattributes`, `.editorconfig`,
`scripts/servidor.mjs`, `scripts/verificar.mjs`, `tests/unit/*.test.js` (4 arquivos, 26 testes),
`tests/e2e/fluxo.mjs`, `tests/fixtures/copia-v1.json`, `.github/workflows/testes.yml`,
`ARCHITECTURE.md`, `MIGRATION.md`, `CHANGELOG.md`, `CONTRIBUTING.md`.

### Removidos
Nenhum arquivo foi removido. (A seção "Ligar a publicação" do README saiu porque já foi feita; está
registrada em `docs/historico.md`.)

## 5. Serviços externos e o que não dá para transferir

| Recurso | Pode ser local? | Decisão |
|---|---|---|
| **Contas guardadas nos celulares** | ❌ Ficam no IndexedDB de cada aparelho; nenhum servidor tem cópia | Continua igual. Para levar ao computador: no celular, ⚙️ → **Salvar cópia em arquivo** e, no app local, ⚙️ → **Escolher arquivo da cópia**. Não versionar esse arquivo (tem nome e telefone de clientes; o `.gitignore` já bloqueia `caderninho-*.json`) |
| GitHub Pages | ✅ `npm start` serve exatamente a mesma pasta | Produção continua no Pages; o local serve para desenvolver |
| GitHub Actions | Parcial: `npm run test:tudo` roda o mesmo localmente | Mantido |
| Google Fonts | Possível, mas não foi feito | Baixar as fontes para `app/` daria privacidade e independência total, mas muda a licença/peso do app e é uma mudança de produto — fica como sugestão. Sem internet o SW já serve as fontes guardadas; sem elas, usa fontes do sistema |
| WhatsApp (`wa.me`) | ❌ (é o app de mensagens da pessoa) | Só um link; nada é enviado pelo app |

## 6. Limitações encontradas

1. **Ramos não juntados.** Existem 5 ramos com trabalho que nunca foi publicado, todos partindo do mesmo
   commit `dbf1227` e mexendo em `app/index.html`:
   - `claude/app-fiado-redesign-kbzp6b` (9 commits): transforma em "caderninho de fiado para qualquer negócio",
     planilha de custos (`.xlsx`), Graphify, testes da planilha;
   - `claude/eager-sagan-az8808` (8 commits): planilha de custos gerada em Python;
   - `claude/elegant-goldberg-63lao5` (1 commit): "Minha conta" com **Supabase Auth** (endereço e chave
     ainda vazios no código — nenhuma credencial exposta);
   - `claude/awesome-turing-m4exga` (2 commits): Graphify;
   - `claude/ecstatic-turing-0w3poe` (1 commit): uma skill do Claude Code.

   Esta migração usou **a versão em produção** (ramo principal). Como o `index.html` foi dividido em módulos,
   juntar esses ramos depois vai dar conflito em `app/index.html`: as mudanças deles terão de ser
   reaplicadas nos módulos certos (telas em `ui/telas.js`, contas em `core/`, etc.). Se algum desses ramos
   for o "projeto de verdade", o certo é refazer a modularização em cima dele — o processo e os testes daqui
   servem de roteiro.
2. **`file://` deixou de funcionar.** Módulos JS não carregam abrindo o `index.html` com dois cliques.
   Use `npm start`. (No GitHub Pages e no celular nada muda.)
3. **Janela de atualização.** Na primeira abertura depois de publicar, o celular ainda mostra a versão antiga
   (comportamento já existente). Se a pessoa abrir uma única vez online e só voltar a abrir **sem internet**
   antes de o novo service worker terminar de instalar (alguns segundos), o `index.html` novo pode tentar
   buscar módulos que ainda não estão no cache. Risco baixo; some na próxima abertura com internet.
4. **Ambiente da migração.** O trabalho foi feito num ambiente de nuvem do Claude Code, não diretamente no
   computador do dono: não havia nenhuma pasta do computador ligada à sessão. O resultado fica no GitHub,
   no ramo acima; para ter no computador, basta clonar (veja README → Instalação). O site do GitHub Pages
   não pôde ser baixado dali (a rede bloqueava `github.io`), então a comparação "publicado = commit
   `dbf1227`" foi feita pelo histórico do GitHub Actions, não baixando o site.

## 7. Como desfazer

O original está intacto no ramo principal. Para voltar só o app:

```bash
git checkout dbf1227 -- app
```
