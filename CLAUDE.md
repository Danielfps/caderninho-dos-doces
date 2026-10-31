# Caderninho — controle de fiado — contexto para o Claude Code

App de celular (PWA) para quem vende fiado anotar quem comprou, quanto deve e quem pagou.
Nasceu como "Caderninho dos Doces" (só para quem vende bolo de pote) e em 30/10/2026 virou um caderninho
de fiado para qualquer negócio. O histórico de como chegamos aqui está em `docs/historico.md`.

## Antes de tudo: consulte o Graphify (mapa do código)

Regra combinada com a dona do projeto: **em qualquer pergunta ou tarefa, consulte o Graphify primeiro** e diga de
onde veio a resposta (arquivo:linha). O mapa fica em `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html` e,
em `converted/`, a planilha `.xlsx` em texto) e é montado por `scripts/graphify.sh`.

1. Se não houver `graphify-out/graph.json` ou o comando `graphify`, rode `scripts/graphify.sh` (instala
   `graphifyy==0.9.97` se faltar e refaz o mapa em ~15 s).
2. Pergunte ao mapa **antes** de grep ou de abrir arquivos:
   - `graphify explain "<função ou conceito>"`: o que é, onde está (arquivo:linha) e com quem se liga;
   - `graphify query "<pergunta>"`: busca pelas palavras; funciona melhor com nomes do código, que estão em
     português (`registrarPag`, `saldo`, `calcProd`, `trazerPlanilha`…);
   - `graphify affected "X"` / `graphify path "A" "B"`: o que é afetado ao mexer em X / como duas partes se ligam;
   - `graphify-out/GRAPH_REPORT.md`: visão geral (funções centrais, grupos).
3. Só então leia o código, e só as linhas que o mapa apontou.
   O mapa só tem as funções declaradas com `function`; as curtas escritas com `=>` (`r2`, `r4`, `brl`, `esc`, `norm`,
   `prod`, `cli`, `PL`…) não aparecem: para elas, procure no código direto.
4. Depois de qualquer mudança no projeto, antes do commit: rode `scripts/graphify.sh` e inclua `graphify-out/` no
   mesmo commit (`graphify-out/cache/` fica fora, pelo `.gitignore`), e atualize este `CLAUDE.md` se a mudança
   alterou algo descrito aqui.

Os ganchos em `.claude/settings.json` fazem parte disso sozinhos: refazem o mapa no começo de cada sessão e depois de
cada edição feita com Edit/Write, e lembram de consultar o mapa antes de buscas e leituras. Edições feitas pelo
terminal (sed, python) não disparam o gancho: aí rode o script à mão.

## Quem usa

- Qualquer pessoa que vende para pagar depois: cantina de escola ou de empresa, quem vende doces e salgados
  para colegas, lojinha, bar, revendedora… Pode ter 3 clientes ou 300, 2 produtos ou nenhum cadastrado.
- Não é técnica. Usa só no celular, com o polegar.
- Toda a interface é em **português do Brasil, simples e sem jargão** ("Quem está devendo", "Recebi",
  "Cópia de segurança"). Nada de "sincronizar", "exportar JSON", "registro", etc. nas telas.
- Texto neutro: nada que suponha o ramo (doce, lanche…) nem o gênero de quem usa ("Boas-vindas", não "Bem-vinda").
- Visual de organizador profissional e minimalista: azul (`--accent`), cinzas neutros, cartões com borda fina.
  Vermelho só para dívida (e preço com prejuízo), verde só para pagamento (e preço bom); `--warn` para avisos.

## Como é feito

- **Sem build e sem dependências.** Tudo está em `app/index.html` (HTML + CSS + JS puro, num único IIFE).
  Só carrega a fonte Inter do Google Fonts.
- Telas: `resumo`, `clientes`, `cliente`, `vender`, `produtos` e `planilha` (aberta pelo botão "Consultar planilha"
  do Resumo, sem aba no rodapé; as abas dela ficam em `ui.aba`). Cada uma é uma função `vX()` que devolve HTML;
  `render()` redesenha. Formulários abrem numa "janela de baixo" (`abrir()` / `fechar()`).
- Todos os cliques passam por um único listener que lê `data-act` / `data-id` / `data-v`.
- Buscas usam `norm()` (sem acento e sem maiúscula: "joao" acha "João").
- Sempre passar texto do usuário por `esc()` antes de pôr no HTML. Dinheiro: `brl()` para mostrar,
  `parseMoney()` para ler o que foi digitado ("12,50"), `r2()` para arredondar centavos. Custo é estimativa:
  `p.custo` fica sem arredondar e o custo de cada venda com 4 casas (`r4()`), para bater com a planilha.
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
  planilha: {contas:[{id, nome, valor, obs}], salario, dias, horasDia, taxas, perdas, lucro /* 0.03 = 3% */,
             materiais:[{id, nome, tipo, medida /* g|ml|un */, qtd, preco, onde, data}],
             receitas:[{id, produtoId, materialId, qtd, obs}],
             importados:[/* linhas da planilha .xlsx já trazidas, para não trazer duas vezes */]},
  ultimoBackup: timestamp|null }
```

- `obs` e `ajustes` chegaram em 30/10/2026: dados e cópias de antes não têm. `completar()` preenche o padrão
  ao abrir e ao recuperar uma cópia; no código, sempre tratar `c.obs` como possivelmente vazio.
- "Digitar um valor" vira um item com `produtoId:null`, `qtd:1` e `custo:0`.
- "Em aberto desde" (`desde()`) é calculado: os pagamentos quitam primeiro as compras mais antigas.
- `ajuste` (30/10/2026) vem de "Mudar o valor que deve" (presente, desconto ou acerto). Entra no saldo com o
  próprio sinal e no "Vendi" do Resumo (não é dinheiro recebido). Sempre testar `tipo` pelo nome:
  nem tudo que não é `venda` é pagamento.
- Tocar numa venda ou num pagamento do histórico abre a correção (`formEditVenda` / `formEditPag`).
  A venda "já pagou na hora" tem um `pag` com `forma:'Na hora'` e `criado` = `criado` da venda + `'1'`
  (`pagNaHora()`): corrigir ou apagar a venda corrige ou apaga esse pagamento junto.

- Produtos ganharam (opcionais) `rende`, `horas` e `paga` (compra pronto). Quando a planilha sabe calcular
  (`calcProd()`: compra pronta ou receita + rendimento), `aplicarPlanilha()` grava em `p.custo` o custo por unidade
  com as perdas; chame-a depois de mudar qualquer coisa da planilha. Sem isso, `p.custo` é o que a pessoa digitou.
- Todas as contas da planilha estão em `calcProd()`, `contasMes()` e `meta()` e seguem as fórmulas de
  `app/planilha-modelo.xlsx` (abas Produtos e Resumo). Mudou uma, mude a outra.

## Planilha .xlsx (`app/planilha-modelo.xlsx`)

- É a planilha de custos que a pessoa fez (10 abas, fórmulas, cores). "Baixar planilha" abre esse modelo, escreve os
  dados do app só nas células de preencher (`baixarPlanilha()`), tira os resultados guardados das fórmulas e marca
  `fullCalcOnLoad`, então Excel, Google Planilhas e LibreOffice refazem as contas ao abrir. Zip e XML são lidos e
  escritos à mão (`lerZip`, `fazerZip`, `folha`), sem biblioteca.
- As abas se ligam pelo nome do cliente/produto; `rotulosClientes()` desfaz nomes repetidos.
- Vendas, Recebi e Acertos levam o id do app numa coluna escondida (K, G, G). "Trazer planilha editada"
  (`trazerPlanilha()`) só cria lançamentos para linhas sem id e guarda a assinatura delas em `planilha.importados`.
  Meu Mês, materiais, receitas, dados dos produtos e clientes vêm da planilha; o que veio do app não é alterado.
- Mudou o modelo (linhas, colunas, abas)? Confira `baixarPlanilha()` e `trazerPlanilha()`. O Meu Mês é achado pelo
  texto da coluna B (`achar()`), as listas pelas linhas fixas (5 até o fim de cada aba).
- Testar: `node testes/planilha.test.js` (veja "Testar" abaixo).

## Mais sobre os dados

- O saldo de cada cliente é sempre calculado (vendas + ajustes − pagamentos); nunca é guardado.
- A venda guarda nome/preço/custo do produto **daquele dia**, para mudar o preço depois não alterar o passado.
- Cópia de segurança: `{app:'caderninho', versao:1, em, dados:{produtos, clientes, lanc, ajustes, planilha}}`
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
conferir Resumo) num celular emulado (`devices['Pixel 7']`).

- **Planilha:** `node testes/planilha.test.js` (com o servidor acima rodando; usa LibreOffice e openpyxl, via
  `testes/planilha_xlsx.py`). Traz a planilha original para um app vazio, mexe nos custos pelo app (preço de
  material, perdas, salário, compra pronta, preço sugerido, venda, apagar material, conta nova), baixa, mexe no
  Excel e traz de volta. Em cada etapa compara tudo o que o app mostra com o que o LibreOffice calcula no arquivo.
  Rode sempre que mexer em contas, na planilha ou no modelo `.xlsx`: tem que dar 0 com problema.
