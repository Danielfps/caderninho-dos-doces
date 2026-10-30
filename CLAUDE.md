# Caderninho dos Doces — contexto para o Claude Code

App de celular (PWA) para uma pessoa que vende doces caseiros anotar fiado: quem pegou, quanto deve,
quem pagou. O histórico de como chegamos aqui está em `docs/historico.md`.

## Quem usa

- Pessoa que vende doces (bolo de pote, palha italiana, trufa…) para colegas e conhecidos, e cobra depois.
- Não é técnica. Usa só no celular, com o polegar.
- Toda a interface é em **português do Brasil, simples e sem jargão** ("Quem está me devendo", "Recebi",
  "Cópia de segurança"). Nada de "sincronizar", "exportar JSON", "registro", etc. nas telas.

## Como é feito

- **Sem build e sem dependências.** Tudo está em `app/index.html` (HTML + CSS + JS puro, num único IIFE).
  Só carrega as fontes Baloo 2 e Nunito Sans do Google Fonts.
- Telas: `resumo`, `clientes`, `cliente`, `vender`, `produtos`. Cada uma é uma função `vX()` que devolve HTML;
  `render()` redesenha. Formulários abrem numa "janela de baixo" (`abrir()` / `fechar()`).
- Todos os cliques passam por um único listener que lê `data-act` / `data-id` / `data-v`.
- Sempre passar texto do usuário por `esc()` antes de pôr no HTML. Dinheiro: `brl()` para mostrar,
  `parseMoney()` para ler o que foi digitado ("12,50"), `r2()` para arredondar centavos.
- Botões grandes (mín. 48–58px), letra 18px, tema claro e escuro.

## Dados (não quebrar!)

Ficam só no aparelho: IndexedDB `caderninho` → store `kv` → chave `caderninho-v1`
(se falhar, `localStorage['caderninho-v1']`). Formato:

```js
{ produtos: [{id, nome, preco, custo, foto /* dataURL jpeg 480px */, ativo}],
  clientes: [{id, nome, tel}],
  lanc: [ {id, tipo:'venda', clienteId, itens:[{produtoId, nome, qtd, preco, custo}], valor, custo, data:'AAAA-MM-DD', criado},
          {id, tipo:'pag',   clienteId, valor, forma /* Pix|Dinheiro|Cartão|Na hora */, data, criado} ],
  ultimoBackup: timestamp|null }
```

- O saldo de cada cliente é sempre calculado (vendas − pagamentos); nunca é guardado.
- A venda guarda nome/preço/custo do produto **daquele dia**, para mudar o preço depois não alterar o passado.
- Cópia de segurança: `{app:'caderninho', versao:1, em, dados:{produtos, clientes, lanc}}`.
  Qualquer mudança de formato precisa continuar lendo dados e cópias antigas.

## Publicação

- `.github/workflows/pages.yml` publica a pasta `app/` no GitHub Pages a cada push no ramo principal
  (ou manualmente em Actions → "Publicar o app"). Endereço: https://danielfps.github.io/caderninho-dos-doces/
- `app/sw.js` guarda os arquivos para funcionar offline e busca a versão nova em segundo plano
  (aparece na próxima abertura). Ao adicionar ou renomear arquivos do app, atualize a lista `ARQUIVOS`
  e troque `VERSAO` em `app/sw.js`.

## Testar

`cd app && python3 -m http.server 8000`. Playwright + Chromium já vêm instalados no ambiente do Claude Code:
dá para testar o fluxo (cadastrar doce → anotar venda → receber pagamento → conferir Resumo) num celular
emulado (`devices['Pixel 7']`).

## Graphify (mapa do código) — regras

O projeto tem um mapa do código em `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`),
montado por `scripts/graphify.sh`. O script copia o projeto para uma pasta temporária, separa o `<script>`
de `app/index.html` (o Graphify não lê JS dentro de HTML) mantendo os números de linha, e grava o resultado
apontando para `app/index.html`. Se `graphify` não estiver instalado, o script instala (`pip install graphifyy==0.9.97`).

Ganchos em `.claude/settings.json` fazem isso sozinhos: o script roda no começo de cada sessão e depois de
cada edição de arquivo do projeto, e um lembrete aparece antes de buscas/leituras para consultar o grafo.

**Ao responder qualquer pergunta sobre o projeto:**
1. Se não houver `graphify-out/graph.json` ou o comando `graphify`, rode `scripts/graphify.sh` primeiro.
2. Consulte o grafo **antes** de grep ou de abrir arquivos:
   - `graphify explain "<função ou conceito>"` — o que é, onde está (arquivo:linha) e com quem se liga;
   - `graphify query "<pergunta>"` — busca pelas palavras da pergunta; funciona melhor com nomes do código
     (`registrarPag`, `saldo`, `render`, `restaurar`…), que estão em português abreviado;
   - `graphify path "A" "B"` e `graphify affected "X"` — como duas partes se ligam / o que é afetado ao mexer em X;
   - `graphify-out/GRAPH_REPORT.md` — visão geral (funções centrais, grupos).
3. Só depois leia o código, e só as linhas que o grafo apontou. Responda dizendo de onde veio (arquivo:linha).

**Depois de qualquer alteração no código** (antes do commit):
1. Rode `scripts/graphify.sh` para atualizar `graphify-out/` e inclua essa pasta no mesmo commit
   (`graphify-out/cache/` fica fora, pelo `.gitignore`). Diff grande em `graph.json` é esperado.
2. Atualize este `CLAUDE.md` sempre que a mudança alterar algo descrito aqui (telas, funções auxiliares,
   formato dos dados, arquivos, publicação, como testar).

