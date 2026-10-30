# Planilha de custos, preços e fiado

Arquivo: `planilha/caderninho-planilha.xlsx` (gerado por `planilha/gerar_planilha.py`).
Abre no Google Planilhas (Arquivo → Importar, ou subir no Drive e "Abrir com Planilhas") e no Excel.

Foi inspirada na planilha de precificação de bolo de pote da Tábata Romero (ingredientes → receita →
+25% de custos escondidos → ×3), mas troca os números "de chute" por contas da própria pessoa:
quanto custam as contas do mês, quanto ela precisa tirar para viver e quantas horas trabalha.
Serve para qualquer coisa vendida no fiado: doces, salgados, marmitas, artesanato.

## Abas

| Aba | O que tem | Quem preenche |
|---|---|---|
| Início | Como usar, ordem de preenchimento, cores e como o preço é calculado | — |
| Resumo | Falta receber, vendi/recebi/sobrou (no mês e desde o começo), se o mês pagou contas e salário, meta de vendas, por produto | só o mês (`C4`) |
| Vendas | Data, cliente, produto, quantas, preço da unidade, pagou na hora? → total, custo, sobrou | pessoa / app |
| Recebi | Data, cliente, quanto, como pagou (Pix, Dinheiro, Cartão, Na hora) | pessoa / app |
| Clientes | Nome, WhatsApp → já pegou, já pagou, está devendo, última compra, situação | pessoa / app |
| Produtos | Nome, rendimento, horas da receita, preço que cobra → custos, preço mínimo, sugerido, lucro, margem, "como está" | pessoa |
| Receitas | Produto, item, quanto vai → medida e custo (uma linha por item; embalagens entram aqui) | pessoa |
| Ingredientes | Item, tipo, medida (g/ml/un), quanto vem no pacote, quanto pagou → preço do kg/litro/unidade | pessoa |
| Meu Mês | Contas fixas, salário, dias e horas de trabalho, taxas %, perdas %, lucro % → valor da hora | pessoa |

Cores: rosinha = a pessoa preenche; branco = calculado; verde = resultado importante; laranja = atenção.
Tabelas começam na linha 5 (linha 4 é o cabeçalho). Capacidade: 200 ingredientes, 500 linhas de receita,
50 produtos, 200 clientes, 2000 vendas e 2000 pagamentos.

Nomes definidos (usados nas fórmulas): `ContasFixas`, `Salario`, `ValorHora`, `Taxas`, `Perdas`,
`LucroDesejado` (aba Meu Mês) e `MetaVendas` (Resumo).

## Como o preço é calculado (aba Produtos)

```
custo por unidade      = ingredientes e embalagem da receita × (1 + Perdas) ÷ rendimento
seu tempo e contas     = horas da receita × ValorHora ÷ rendimento
                         (ValorHora = (contas fixas + salário) ÷ horas trabalhadas no mês)
custo completo         = custo por unidade + seu tempo e contas
preço mínimo           = custo completo ÷ (1 − Taxas)
preço sugerido         = custo completo ÷ (1 − Taxas − LucroDesejado),
                         arredondado para cima de R$ 0,10 (até R$ 3) ou de R$ 0,50
lucro por unidade      = preço que cobro − custo completo − preço × Taxas
```

"Como está": Prejuízo (não cobre nem ingredientes) → Não paga o seu tempo → Abaixo do sugerido → Preço bom.

No Resumo, a meta do mês é `(contas fixas + salário) ÷ (quanto sobra de cada R$ 1 vendido)`;
esse "quanto sobra" vem das vendas do mês ou, sem vendas, da média dos produtos (coluna O escondida em Produtos).

## Ligação com o app (próximo passo)

A ideia é o app preencher e gerar esta planilha. Correspondência com os dados do app (`caderninho-v1`):

| App | Planilha |
|---|---|
| `produtos[].nome` / `preco` | Produtos: Produto / Preço que eu cobro |
| `produtos[].custo` | Produtos: Custo por unidade (ingredientes, embalagem, perdas) — coluna F |
| `clientes[].nome` / `tel` | Clientes: Nome / WhatsApp |
| `lanc` `tipo:'venda'`, cada item de `itens` | Vendas: uma linha por item (data, cliente, produto, qtd, preço) |
| `lanc` `tipo:'pag'` | Recebi: data, cliente, valor, forma |

Vendas e pagamentos ligam pelo **nome** do cliente e do produto (não por id). Ao exportar do app,
vendas "já pagou na hora" podem ir como linha em Recebi com forma "Na hora" (como o app guarda) —
nesse caso deixar "Pagou na hora?" vazio para não contar duas vezes.

## Refazer o arquivo

```sh
python3 planilha/gerar_planilha.py
```

Ver o comentário no topo do script para recalcular com o LibreOffice (assim os números aparecem
também em visualizadores que não calculam fórmulas).
