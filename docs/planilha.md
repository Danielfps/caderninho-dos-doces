# Planilha de custos, preços e fiado

Arquivo: `planilha/caderninho-planilha.xlsx` (gerado por `planilha/gerar_planilha.py`).
Abre no Google Planilhas (Arquivo → Importar, ou subir no Drive e "Abrir com Planilhas") e no Excel.

Acompanha o app **Caderninho — controle de fiado**: mesmo visual (azul `#1d4ed8`, cinzas, fonte Inter,
vermelho só para dívida e prejuízo, verde só para dinheiro que entrou), textos neutros e o mesmo jeito de
anotar vendas, pagamentos e acertos. Serve para qualquer negócio que vende para receber depois: cantina,
lanchonete, doces e salgados, lojinha, revenda.

A parte de custos foi inspirada numa planilha de precificação de bolo de pote (Tábata Romero: ingredientes →
receita → +25% de custos escondidos → ×3), mas troca os números "de chute" pelas contas da própria pessoa:
quanto custam as contas do mês, quanto ela precisa tirar para viver e quantas horas trabalha. E aceita produto
comprado pronto para revender, não só o que é preparado.

## Abas

| Aba | O que tem | Quem preenche |
|---|---|---|
| Início | Nome do negócio, como usar, ordem de preenchimento, cores e como o preço é calculado | nome do negócio (`D4`) |
| Resumo | Falta receber, vendi/recebi/sobrou (no mês e desde o começo), se o mês pagou contas e salário, meta de vendas, por produto | só o mês (`C4`) |
| Vendas | Data, cliente, produto (ou o que foi), quantas, preço da unidade, pagou na hora? → total, custo, sobrou | pessoa / app |
| Recebi | Data, cliente, quanto, como pagou (Pix, Dinheiro, Cartão, Na hora), observação | pessoa / app |
| Acertos | Descontos e acertos: data, cliente, valor com sinal (− diminui a dívida), motivo (Presente, Desconto, Correção) | pessoa / app |
| Clientes | Nome, WhatsApp, observação (turma, setor, responsável) → já pegou, já pagou, acertos, está devendo, última compra, situação | pessoa / app |
| Produtos | Nome, rendimento e horas da receita **ou** quanto paga por unidade (se compra pronto), preço que cobra → custos, preço mínimo, sugerido, lucro, margem, "como está" | pessoa |
| Receitas | Só para o que é preparado: produto, item, quanto vai → medida e custo (embalagens entram aqui) | pessoa |
| Materiais | Item, tipo, medida (g/ml/un), quanto vem no pacote, quanto pagou → preço do kg/litro/unidade | pessoa |
| Meu Mês | Contas fixas, salário, dias e horas de trabalho, taxas %, perdas %, lucro % → valor da hora | pessoa |

Cores: azul clarinho = a pessoa preenche; branco = calculado; cinza com número azul = resultado importante;
vermelho = dívida ou prejuízo; verde = dinheiro que entrou e conta em dia. Cabeçalho azul = coluna para
preencher; grafite = coluna calculada.

Tabelas começam na linha 5 (linha 4 é o cabeçalho). Capacidade: 200 materiais, 500 linhas de receita,
100 produtos, 300 clientes, 3000 vendas, 3000 pagamentos e 500 acertos.

Nomes definidos (usados nas fórmulas): `Negocio` (Início), `ContasFixas`, `Salario`, `ValorHora`, `Taxas`,
`Perdas`, `LucroDesejado` (Meu Mês) e `MetaVendas` (Resumo).

## Contas

Saldo de cada cliente, como no app: **vendas + acertos − pagamentos** (vendas "Pagou na hora? Sim" contam
como pagas). "Vendi" no Resumo inclui os acertos, como no app.

Preço (aba Produtos):

```
custo por unidade      se compra pronto: quanto paga × (1 + Perdas)
                       se prepara: materiais da receita × (1 + Perdas) ÷ rendimento
seu tempo e contas     só se prepara: horas da receita × ValorHora ÷ rendimento
                       (ValorHora = (contas fixas + salário) ÷ horas trabalhadas no mês)
custo completo         = custo por unidade + seu tempo e contas
preço mínimo           = custo completo ÷ (1 − Taxas)
preço sugerido         = custo completo ÷ (1 − Taxas − LucroDesejado),
                         arredondado para cima de R$ 0,10 (até R$ 3) ou de R$ 0,50
lucro por unidade      = preço que cobro − custo completo − preço × Taxas
```

"Como está": Prejuízo (não cobre nem o custo da unidade) → Não paga o seu tempo → Abaixo do sugerido → Preço bom.
Quem só revende cobre contas e salário pela meta do Resumo, não pelo tempo.

Meta do mês (Resumo): `(contas fixas + salário) ÷ (quanto sobra de cada R$ 1 vendido)`; esse "quanto sobra"
vem das vendas do mês ou, sem vendas, da média dos produtos (coluna P escondida em Produtos).

## Ligação com o app (próximo passo)

A ideia é o app preencher e gerar esta planilha. Correspondência com os dados do app (`caderninho-v1`):

| App | Planilha |
|---|---|
| `ajustes.negocio` | Início: Nome do negócio (`D4`) |
| `produtos[].nome` / `preco` | Produtos: Produto / Preço que eu cobro |
| `produtos[].custo` | Produtos: Custo por unidade — coluna G |
| `clientes[].nome` / `tel` / `obs` | Clientes: Nome / WhatsApp / Observação |
| `lanc` `tipo:'venda'`, cada item de `itens` | Vendas: uma linha por item (data, cliente, `nome`, `qtd`, `preco`) |
| item com `produtoId:null` ("digitar um valor") | Vendas: o `nome` digitado em Produto, `qtd` 1 e o preço |
| `lanc` `tipo:'pag'` | Recebi: data, cliente, valor, forma |
| `lanc` `tipo:'ajuste'` | Acertos: data, cliente, valor com sinal, motivo (`presente` → Presente, `erro` → Correção) |

Vendas, pagamentos e acertos ligam pelo **nome** do cliente e do produto (não por id). O app guarda a venda
"já pagou na hora" como um `pag` com forma "Na hora": ao exportar, mandar essa linha para Recebi e deixar
"Pagou na hora?" vazio, para não contar duas vezes. Ao exportar, escrever o custo da venda na coluna Custo
(H) por cima da fórmula, para guardar o custo daquele dia, como o app faz.

## Refazer o arquivo

```sh
python3 planilha/gerar_planilha.py
```

Ver o comentário no topo do script para recalcular com o LibreOffice (assim os números aparecem
também em visualizadores que não calculam fórmulas).
