# Caderninho — controle de fiado — contexto para o Claude Code

App de celular (PWA) para quem vende fiado anotar quem comprou, quanto deve e quem pagou.
Nasceu como "Caderninho dos Doces" (só para quem vende bolo de pote) e em 30/10/2026 virou um caderninho
de fiado para qualquer negócio. O histórico de como chegamos aqui está em `docs/historico.md`.

## Quem usa

- Qualquer pessoa que vende para pagar depois: cantina de escola ou de empresa, quem vende doces e salgados
  para colegas, lojinha, bar, revendedora… Pode ter 3 clientes ou 300, 2 produtos ou nenhum cadastrado.
- Não é técnica. Usa só no celular, com o polegar.
- Toda a interface é em **português do Brasil, simples e sem jargão** ("Quem está devendo", "Recebi",
  "Cópia de segurança"). Nada de "sincronizar", "exportar JSON", "registro", etc. nas telas.
- Texto neutro: nada que suponha o ramo (doce, lanche…) nem o gênero de quem usa ("Boas-vindas", não "Bem-vinda").
- Visual de organizador profissional e minimalista: azul (`--accent`), cinzas neutros, cartões com borda fina.
  Vermelho só para dívida, verde só para pagamento.

## Como é feito

- **Sem build e sem dependências.** Tudo está em `app/index.html` (HTML + CSS + JS puro, num único IIFE).
  Só carrega a fonte Inter do Google Fonts.
- Telas: `resumo`, `clientes`, `cliente`, `vender`, `produtos`. Cada uma é uma função `vX()` que devolve HTML;
  `render()` redesenha. Formulários abrem numa "janela de baixo" (`abrir()` / `fechar()`).
- Todos os cliques passam por um único listener que lê `data-act` / `data-id` / `data-v`.
- Buscas usam `norm()` (sem acento e sem maiúscula: "joao" acha "João").
- Sempre passar texto do usuário por `esc()` antes de pôr no HTML. Dinheiro: `brl()` para mostrar,
  `parseMoney()` para ler o que foi digitado ("12,50"), `r2()` para arredondar centavos.
- Botões grandes (mín. 48–58px), letra 18px, tema claro e escuro.

## Dados (não quebrar!)

Ficam só no aparelho: IndexedDB `caderninho` → store `kv` → chave `caderninho-v1`
(se falhar, `localStorage['caderninho-v1']`). Formato:

```js
{ produtos: [{id, nome, preco, custo, foto /* dataURL jpeg 480px */, ativo}],
  clientes: [{id, nome, tel, obs /* turma, setor, responsável… (opcional) */}],
  lanc: [ {id, tipo:'venda', clienteId, itens:[{produtoId /* null = valor digitado */, nome, qtd, preco, custo}], valor, custo, data:'AAAA-MM-DD', criado},
          {id, tipo:'pag',   clienteId, valor, forma /* Pix|Dinheiro|Cartão|Na hora */, data, criado},
          {id, tipo:'ajuste', clienteId, valor /* com sinal: − diminui a dívida, + aumenta */, motivo /* presente|erro */, data, criado} ],
  ajustes: {negocio /* nome do negócio, opcional */},
  ultimoBackup: timestamp|null }
```

- `obs` e `ajustes` chegaram em 30/10/2026: dados e cópias de antes não têm. `completar()` preenche o padrão
  ao abrir e ao recuperar uma cópia; no código, sempre tratar `c.obs` como possivelmente vazio.
- "Digitar um valor" vira um item com `produtoId:null`, `qtd:1` e `custo:0`.
- "Em aberto desde" (`desde()`) é calculado: os pagamentos quitam primeiro as compras mais antigas.
- `ajuste` (31/10/2026) vem de "Mudar o valor que deve" (presente, desconto ou acerto). Entra no saldo com o
  próprio sinal e no "Vendi" do Resumo (não é dinheiro recebido). Sempre testar `tipo` pelo nome:
  nem tudo que não é `venda` é pagamento.
- Tocar numa venda ou num pagamento do histórico abre a correção (`formEditVenda` / `formEditPag`).
  A venda "já pagou na hora" tem um `pag` com `forma:'Na hora'` e `criado` = `criado` da venda + `'1'`
  (`pagNaHora()`): corrigir ou apagar a venda corrige ou apaga esse pagamento junto.

- O saldo de cada cliente é sempre calculado (vendas + ajustes − pagamentos); nunca é guardado.
- A venda guarda nome/preço/custo do produto **daquele dia**, para mudar o preço depois não alterar o passado.
- Cópia de segurança: `{app:'caderninho', versao:1, em, dados:{produtos, clientes, lanc, ajustes}}`
  (`ajustes` só nas cópias novas; ao recuperar uma cópia sem ele, o nome do negócio atual fica).
  Qualquer mudança de formato precisa continuar lendo dados e cópias antigas.

## Publicação

- `.github/workflows/pages.yml` publica a pasta `app/` no GitHub Pages a cada push no ramo principal
  (ou manualmente em Actions → "Publicar o app"). Endereço: https://danielfps.github.io/caderninho-dos-doces/
- `app/sw.js` guarda os arquivos para funcionar offline e busca a versão nova em segundo plano
  (aparece na próxima abertura). Ao adicionar ou renomear arquivos do app, atualize a lista `ARQUIVOS`
  e troque `VERSAO` em `app/sw.js`.

## Testar

`cd app && python3 -m http.server 8000`. Playwright + Chromium já vêm instalados no ambiente do Claude Code:
dá para testar o fluxo (cadastrar produto → anotar venda, com produto e valor digitado → receber pagamento →
conferir Resumo) num celular
emulado (`devices['Pixel 7']`).
