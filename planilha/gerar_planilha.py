"""Gera planilha/caderninho-planilha.xlsx (custos, preços e fiado).

Uso: python3 planilha/gerar_planilha.py
Precisa só do openpyxl. O arquivo sai com as fórmulas sem resultado guardado;
Google Planilhas e Excel calculam ao abrir. Para os números aparecerem também em
visualizadores simples (ex.: abrir pelo WhatsApp), recalcule com o LibreOffice:
  soffice --headless --convert-to xlsx --outdir <pasta> planilha/caderninho-planilha.xlsx
e copie o resultado por cima. A estrutura das abas está em docs/planilha.md.
"""
import datetime as dt
import os

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "caderninho-planilha.xlsx")

# Cores do app (app/index.html, tema claro). Azul e cinzas; vermelho só para dívida
# e prejuízo, verde só para pagamento e conta em dia.
AZUL = "1D4ED8"            # --accent / --bar
AZUL_CLARO = "E8EEFC"      # --accent-soft  -> células que a pessoa preenche
CINZA = "EEF0F4"           # --surface-2    -> faixas e números mais importantes
TINTA = "15181E"           # --ink
APAGADO = "5D6573"         # --muted
LINHA = "E1E4EA"           # --line
VERDE = "15803D"           # --good
VERDE_CLARO = "E6F4EA"     # --good-soft
VERMELHO = "C2321B"        # --bad
VERMELHO_CLARO = "FCEBE7"  # --bad-soft
BRANCO = "FFFFFF"

FONTE = "Inter"  # a do app; onde não houver, o programa troca por uma parecida
DINHEIRO = '"R$" #,##0.00'
PCT = "0%"
DATA = "dd/mm/yyyy"

# Quantas linhas cada tabela aceita
N_MAT, N_REC, N_PROD, N_CLI, N_VEN, N_PAG, N_ACE = 200, 500, 100, 300, 3000, 3000, 500
L0 = 5  # primeira linha de dados das tabelas (linha 4 = cabeçalho)

fino = Side(style="thin", color=LINHA)
BORDA = Border(left=fino, right=fino, top=fino, bottom=fino)


def fill(cor):
    return PatternFill("solid", start_color=cor, end_color=cor)


def font(cor=TINTA, size=11, bold=False, italic=False):
    return Font(name=FONTE, color=cor, size=size, bold=bold, italic=italic)


def topo(ws, titulo, explica, ate_col, cor_aba):
    """Faixa azul com o nome da aba e uma frase explicando para que serve."""
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = cor_aba
    ws.column_dimensions["A"].width = 2.5
    ult = get_column_letter(ate_col)
    ws.merge_cells(f"B1:{ult}1")
    ws.merge_cells(f"B2:{ult}2")
    c = ws["B1"]
    c.value = titulo
    c.font = font(BRANCO, 20, bold=True)
    c.alignment = Alignment(vertical="center", indent=1)
    c = ws["B2"]
    c.value = explica
    c.font = font(APAGADO, 11)
    c.alignment = Alignment(vertical="center", wrap_text=True, indent=1)
    for col in range(2, ate_col + 1):
        ws.cell(1, col).fill = fill(AZUL)
        ws.cell(2, col).fill = fill(CINZA)
    ws.row_dimensions[1].height = 40
    ws.row_dimensions[2].height = 36
    ws.row_dimensions[3].height = 10


def cabecalho(ws, linha, colunas):
    """colunas: lista de (titulo, largura, eh_entrada). Entrada = azul; calculada = grafite."""
    for i, (titulo, larg, entrada) in enumerate(colunas, start=2):
        c = ws.cell(linha, i, titulo)
        c.font = font(BRANCO, 11, bold=True)
        c.fill = fill(AZUL if entrada else TINTA)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDA
        ws.column_dimensions[get_column_letter(i)].width = larg
    ws.row_dimensions[linha].height = 44


def celula(ws, ref, valor=None, entrada=False, fmt=None, bold=False, cor=TINTA, alinh=None, fundo=None, size=11):
    c = ws[ref]
    if valor is not None:
        c.value = valor
    c.font = font(cor, size, bold=bold)
    c.fill = fill(fundo or (AZUL_CLARO if entrada else BRANCO))
    c.border = BORDA
    c.alignment = Alignment(vertical="center", horizontal=alinh, wrap_text=True)
    if fmt:
        c.number_format = fmt
    return c


def destaque(ws, ref, valor=None, fmt=None, size=11, cor=AZUL, alinh=None):
    """Os números mais importantes: fundo cinza, número azul."""
    return celula(ws, ref, valor, fmt=fmt, bold=True, cor=cor, fundo=CINZA, size=size, alinh=alinh)


def grade(ws, l_ini, n, colunas_fmt):
    """Formata n linhas vazias da tabela. colunas_fmt: {letra: (entrada, formato, alinhamento)}."""
    for r in range(l_ini, l_ini + n):
        ws.row_dimensions[r].height = 21
        for col, (entrada, fmt, alinh) in colunas_fmt.items():
            celula(ws, f"{col}{r}", entrada=entrada, fmt=fmt, alinh=alinh)


def lista(ws, formula, intervalo, msg=None):
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.showErrorMessage = False  # deixa escrever algo que não está na lista sem travar
    if msg:
        dv.promptTitle, dv.prompt = msg
        dv.showInputMessage = True
    ws.add_data_validation(dv)
    dv.add(intervalo)


def secao(ws, linha, texto, ate="D"):
    ws.merge_cells(f"B{linha}:{ate}{linha}")
    c = ws[f"B{linha}"]
    c.value = texto
    c.font = font(TINTA, 14, bold=True)
    c.alignment = Alignment(vertical="center")
    ws.row_dimensions[linha].height = 28


def nome(wb, nome_, ref):
    wb.defined_names[nome_] = DefinedName(nome_, attr_text=ref)


def faixa(aba, col, n):
    return f"{aba}!${col}${L0}:${col}${L0 + n - 1}"


wb = Workbook()

# ---------------------------------------------------------------- abas (ordem de uso no dia a dia)
inicio = wb.active
inicio.title = "Início"
resumo = wb.create_sheet("Resumo")
vendas = wb.create_sheet("Vendas")
recebi = wb.create_sheet("Recebi")
acertos = wb.create_sheet("Acertos")
clientes = wb.create_sheet("Clientes")
produtos = wb.create_sheet("Produtos")
receitas = wb.create_sheet("Receitas")
materiais = wb.create_sheet("Materiais")
mes = wb.create_sheet("Meu Mês")
DIA_A_DIA, PREPARO = AZUL, APAGADO  # cor das abas

# Faixas usadas em várias fórmulas
MAT_ITEM, MAT_UNID, MAT_QTD, MAT_PRECO = (faixa("Materiais", c, N_MAT) for c in "BDEF")
REC_PROD, REC_CUSTO = faixa("Receitas", "B", N_REC), faixa("Receitas", "F", N_REC)
PROD_NOME, PROD_CUSTO, PROD_PRECO, PROD_SOBRA = (faixa("Produtos", c, N_PROD) for c in "BGLP")
CLI_NOME, CLI_DEVE = faixa("Clientes", "B", N_CLI), faixa("Clientes", "H", N_CLI)
VEN_DATA, VEN_CLI, VEN_PROD, VEN_QTD, VEN_TOTAL, VEN_CUSTO, VEN_SOBRA, VEN_NAHORA = (
    faixa("Vendas", c, N_VEN) for c in "BCDEGHIJ")
PAG_DATA, PAG_CLI, PAG_VALOR = (faixa("Recebi", c, N_PAG) for c in "BCD")
ACE_DATA, ACE_CLI, ACE_VALOR = (faixa("Acertos", c, N_ACE) for c in "BCD")

# ================================================================= MEU MÊS
topo(mes, "Meu Mês",
     "Quanto custa manter o seu negócio e quanto você precisa ganhar. Preencha uma vez e mude quando algo mudar.",
     4, PREPARO)
mes.column_dimensions["B"].width = 50
mes.column_dimensions["C"].width = 16
mes.column_dimensions["D"].width = 58

secao(mes, 4, "1. Contas fixas do mês  (o que você paga todo mês, vendendo ou não)")
cabecalho(mes, 5, [("Conta", 50, True), ("Valor por mês", 16, True), ("Observação", 58, True)])
contas = [
    ("Gás", 60, "A parte do gás usada no trabalho"),
    ("Luz", 50, "Só a parte do trabalho (geladeira, forno, freezer), se der para separar"),
    ("Água", 20, ""),
    ("Internet e celular", 40, ""),
    ("MEI (DAS)", 82, "Se for MEI, o boleto do mês"),
    ("Transporte e entregas", 100, "Combustível, ônibus, motoboy"),
    ("Manutenção de equipamentos", 30, "Guarde um pouco por mês para quando algo quebrar"),
    ("Material de limpeza", 25, ""),
    ("Divulgação", 0, "Cardápio, anúncio, cartão"),
    ("Mensalidade da maquininha", 0, ""),
    ("Aluguel ou ponto (a parte que usa)", 0, ""),
]
for i in range(15):
    r = 6 + i
    nome_c, valor, obs = contas[i] if i < len(contas) else (None, None, None)
    celula(mes, f"B{r}", nome_c, entrada=True)
    celula(mes, f"C{r}", valor, entrada=True, fmt=DINHEIRO)
    celula(mes, f"D{r}", obs, entrada=True, cor=APAGADO)
destaque(mes, "B21", "Total das contas fixas", cor=TINTA)
destaque(mes, "C21", "=SUM(C6:C20)", fmt=DINHEIRO)
celula(mes, "D21", "A planilha soma sozinha.", cor=APAGADO, fundo=CINZA)

secao(mes, 23, "2. Você")
celula(mes, "B24", "Quanto preciso para viver por mês (meu salário)", bold=True)
celula(mes, "C24", 1500, entrada=True, fmt=DINHEIRO)
celula(mes, "D24", "O que você quer tirar para você, todo mês, para pagar as suas contas de casa.", cor=APAGADO)

secao(mes, 26, "3. Seu tempo")
celula(mes, "B27", "Dias que trabalho no mês", bold=True)
celula(mes, "C27", 22, entrada=True, alinh="center")
celula(mes, "D27", "Contando os dias de comprar, preparar e entregar.", cor=APAGADO)
celula(mes, "B28", "Horas por dia", bold=True)
celula(mes, "C28", 5, entrada=True, alinh="center")
celula(mes, "D28", "Preparando, comprando, atendendo, entregando e cobrando.", cor=APAGADO)
celula(mes, "B29", "Horas no mês")
celula(mes, "C29", "=C27*C28", alinh="center")
celula(mes, "D29", "", cor=APAGADO)
destaque(mes, "B30", "Quanto vale a minha hora", cor=TINTA)
destaque(mes, "C30", "=IF(C29>0,(C21+C24)/C29,0)", fmt=DINHEIRO)
celula(mes, "D30", "Contas fixas + seu salário, divididos pelas horas. Entra no preço do que você prepara.",
       cor=APAGADO, fundo=CINZA)

secao(mes, 32, "4. Porcentagens")
celula(mes, "B33", "Taxas sobre a venda", bold=True)
celula(mes, "C33", 0.03, entrada=True, fmt=PCT, alinh="center")
celula(mes, "D33", "Maquininha, app de entrega. Se só uma parte paga no cartão, use uma média.", cor=APAGADO)
celula(mes, "B34", "Perdas", bold=True)
celula(mes, "C34", 0.05, entrada=True, fmt=PCT, alinh="center")
celula(mes, "D34", "O que estraga, quebra, vence ou vira brinde.", cor=APAGADO)
celula(mes, "B35", "Lucro que eu quero", bold=True)
celula(mes, "C35", 0.15, entrada=True, fmt=PCT, alinh="center")
celula(mes, "D35", "Além do seu salário: para guardar, comprar equipamento e crescer.", cor=APAGADO)

secao(mes, 37, "Resultado")
destaque(mes, "B38", "Preciso ganhar por mês (contas + meu salário)", cor=TINTA)
destaque(mes, "C38", "=C21+C24", fmt=DINHEIRO)
celula(mes, "D38", "", fundo=CINZA)
destaque(mes, "B39", "Para isso, preciso vender por mês mais ou menos", cor=TINTA)
destaque(mes, "C39", "=MetaVendas", fmt=DINHEIRO)
celula(mes, "D39", "Depende dos seus preços. Veja os detalhes no Resumo.", cor=APAGADO, fundo=CINZA)
for r in list(range(6, 22)) + [24, 27, 28, 29, 30, 33, 34, 35, 38, 39]:
    mes.row_dimensions[r].height = 24

nome(wb, "ContasFixas", "'Meu Mês'!$C$21")
nome(wb, "Salario", "'Meu Mês'!$C$24")
nome(wb, "ValorHora", "'Meu Mês'!$C$30")
nome(wb, "Taxas", "'Meu Mês'!$C$33")
nome(wb, "Perdas", "'Meu Mês'!$C$34")
nome(wb, "LucroDesejado", "'Meu Mês'!$C$35")

# ================================================================= MATERIAIS
topo(materiais, "Materiais",
     "Tudo que você compra para preparar o que vende: ingredientes, embalagens, materiais. "
     "Quilo vira gramas (1 kg = 1000 g) e litro vira ml (1 L = 1000 ml).",
     10, PREPARO)
cabecalho(materiais, 4, [
    ("O que é", 32, True), ("Tipo", 14, True), ("Medida\n(g, ml ou un)", 12, True),
    ("Quanto vem no pacote", 14, True), ("Quanto paguei", 14, True),
    ("Sai por", 13, False), ("", 11, False), ("Onde comprei", 18, True), ("Atualizado em", 14, True),
])
materiais.merge_cells("G4:H4")
grade(materiais, L0, N_MAT, {
    "B": (True, None, None), "C": (True, None, "center"), "D": (True, None, "center"),
    "E": (True, "General", "center"), "F": (True, DINHEIRO, None), "G": (False, DINHEIRO, None),
    "H": (False, None, None), "I": (True, None, None), "J": (True, DATA, "center"),
})
hoje = dt.date(2026, 10, 30)
itens = [
    ("Leite condensado", "Ingrediente", "g", 395, 6.49, "Mercado"),
    ("Creme de leite", "Ingrediente", "g", 200, 3.29, "Mercado"),
    ("Chocolate em pó 50%", "Ingrediente", "g", 200, 9.90, "Mercado"),
    ("Chocolate granulado", "Ingrediente", "g", 500, 14.90, "Atacado"),
    ("Manteiga", "Ingrediente", "g", 200, 9.90, "Mercado"),
    ("Açúcar refinado", "Ingrediente", "g", 1000, 4.79, "Mercado"),
    ("Farinha de trigo", "Ingrediente", "g", 1000, 5.49, "Mercado"),
    ("Ovos", "Ingrediente", "un", 30, 19.90, "Feira"),
    ("Leite", "Ingrediente", "ml", 1000, 5.29, "Mercado"),
    ("Óleo", "Ingrediente", "ml", 900, 7.99, "Mercado"),
    ("Fermento em pó", "Ingrediente", "g", 100, 3.99, "Mercado"),
    ("Peito de frango", "Ingrediente", "g", 1000, 21.90, "Açougue"),
    ("Requeijão cremoso", "Ingrediente", "g", 400, 10.90, "Mercado"),
    ("Cebola", "Ingrediente", "g", 1000, 5.99, "Feira"),
    ("Sal", "Ingrediente", "g", 1000, 2.99, "Mercado"),
    ("Farinha de rosca", "Ingrediente", "g", 500, 6.90, "Mercado"),
    ("Pote 250 ml com tampa", "Embalagem", "un", 50, 39.90, "Loja de embalagem"),
    ("Colher descartável", "Embalagem", "un", 50, 7.90, "Loja de embalagem"),
    ("Etiqueta com o nome do negócio", "Embalagem", "un", 100, 15.00, "Gráfica"),
    ("Forminha nº 4", "Embalagem", "un", 100, 5.90, "Atacado"),
    ("Caixa para salgado", "Embalagem", "un", 10, 12.90, "Loja de embalagem"),
]
for i, (n_, tipo, un, qtd, preco, onde) in enumerate(itens):
    r = L0 + i
    materiais[f"B{r}"], materiais[f"C{r}"], materiais[f"D{r}"] = n_, tipo, un
    materiais[f"E{r}"], materiais[f"F{r}"], materiais[f"I{r}"], materiais[f"J{r}"] = qtd, preco, onde, hoje
for r in range(L0, L0 + N_MAT):
    materiais[f"G{r}"] = f'=IF(OR(B{r}="",E{r}="",F{r}="",N(E{r})=0),"",IF(OR(D{r}="g",D{r}="ml"),F{r}/E{r}*1000,F{r}/E{r}))'
    materiais[f"H{r}"] = f'=IF(G{r}="","",IF(D{r}="g","o quilo",IF(D{r}="ml","o litro","a unidade")))'
    materiais[f"H{r}"].font = font(APAGADO)
lista(materiais, '"Ingrediente,Embalagem,Material,Outro"', f"C{L0}:C{L0 + N_MAT - 1}")
lista(materiais, '"g,ml,un"', f"D{L0}:D{L0 + N_MAT - 1}",
      ("Medida", "g = gramas, ml = mililitros, un = unidades (ovos, potes, peças)"))
materiais.freeze_panes = "C5"

# ================================================================= RECEITAS
topo(receitas, "Receitas",
     "Só para o que você prepara: o que vai em cada produto e quanto vai, com as embalagens. "
     "Linhas do mesmo produto ficam juntas.",
     7, PREPARO)
cabecalho(receitas, 4, [
    ("Produto", 30, True), ("O que vai", 30, True), ("Quanto vai", 12, True),
    ("Medida", 10, False), ("Custo", 14, False), ("Observação", 30, True),
])
grade(receitas, L0, N_REC, {
    "B": (True, None, None), "C": (True, None, None), "D": (True, "General", "center"),
    "E": (False, None, "center"), "F": (False, DINHEIRO, None), "G": (True, None, None),
})
receitas_ex = {
    "Bolo de pote": [
        ("Farinha de trigo", 240, "massa"), ("Açúcar refinado", 300, "massa"),
        ("Chocolate em pó 50%", 100, "massa e recheio"), ("Ovos", 4, "massa"), ("Leite", 240, "massa"),
        ("Óleo", 120, "massa"), ("Fermento em pó", 15, "massa"), ("Leite condensado", 790, "recheio (2 latas)"),
        ("Creme de leite", 200, "recheio"), ("Manteiga", 30, "recheio"), ("Chocolate granulado", 50, "cobertura"),
        ("Pote 250 ml com tampa", 12, ""), ("Colher descartável", 12, ""), ("Etiqueta com o nome do negócio", 12, ""),
    ],
    "Coxinha de frango": [
        ("Peito de frango", 800, "recheio"), ("Requeijão cremoso", 200, "recheio"), ("Cebola", 100, "recheio"),
        ("Farinha de trigo", 500, "massa"), ("Leite", 500, "massa"), ("Manteiga", 30, "massa"),
        ("Sal", 15, ""), ("Ovos", 2, "empanar"), ("Farinha de rosca", 300, "empanar"),
        ("Óleo", 450, "fritura"), ("Caixa para salgado", 2, ""),
    ],
    "Brigadeiro": [
        ("Leite condensado", 395, ""), ("Chocolate em pó 50%", 40, ""), ("Manteiga", 20, ""),
        ("Chocolate granulado", 80, ""), ("Forminha nº 4", 30, ""),
    ],
}
r = L0
for prod, linhas in receitas_ex.items():
    for item, qtd, obs in linhas:
        receitas[f"B{r}"], receitas[f"C{r}"], receitas[f"D{r}"] = prod, item, qtd
        if obs:
            receitas[f"G{r}"] = obs
        r += 1
for r in range(L0, L0 + N_REC):
    m = f"MATCH(C{r},{MAT_ITEM},0)"
    receitas[f"E{r}"] = f'=IF(C{r}="","",IFERROR(INDEX({MAT_UNID},{m}),"?"))'
    receitas[f"F{r}"] = (f'=IF(OR(C{r}="",D{r}=""),"",'
                         f'IFERROR(D{r}*INDEX({MAT_PRECO},{m})/INDEX({MAT_QTD},{m}),"Cadastre em Materiais"))')
lista(receitas, f"={PROD_NOME}", f"B{L0}:B{L0 + N_REC - 1}",
      ("Produto", "Escolha da lista. Para um produto novo, cadastre antes na aba Produtos."))
lista(receitas, f"={MAT_ITEM}", f"C{L0}:C{L0 + N_REC - 1}",
      ("O que vai", "Escolha da lista. Se não estiver, cadastre na aba Materiais."))
receitas.conditional_formatting.add(
    f"F{L0}:F{L0 + N_REC - 1}",
    FormulaRule(formula=[f'ISTEXT(F{L0})*(F{L0}<>"")'], font=Font(color=VERMELHO, bold=True), fill=fill(VERMELHO_CLARO)))
receitas.freeze_panes = "C5"

# ================================================================= PRODUTOS
topo(produtos, "Produtos e preços",
     "Quanto custa cada unidade e quanto cobrar. Se você prepara, preencha rendimento e tempo e monte a receita; "
     "se compra pronto para revender, preencha só quanto paga por unidade.",
     15, PREPARO)
cabecalho(produtos, 4, [
    ("Produto", 28, True), ("A receita rende\n(unidades)", 13, True), ("Tempo para fazer a receita (horas)", 14, True),
    ("Se compra pronto: quanto paga por unidade", 15, True),
    ("Materiais da receita", 14, False), ("Custo por unidade\n(materiais e perdas)", 16, False),
    ("Seu tempo e contas por unidade", 15, False), ("Custo completo por unidade", 15, False),
    ("Preço mínimo\n(sem prejuízo)", 14, False), ("Preço sugerido", 14, False), ("Preço que eu cobro", 14, True),
    ("Lucro por unidade", 14, False), ("Margem de lucro", 12, False), ("Como está", 24, False),
])
grade(produtos, L0, N_PROD, {
    "B": (True, None, None), "C": (True, "General", "center"), "D": (True, "General", "center"),
    "E": (True, DINHEIRO, None), "F": (False, DINHEIRO, None), "G": (False, DINHEIRO, None),
    "H": (False, DINHEIRO, None), "I": (False, DINHEIRO, None), "J": (False, DINHEIRO, None),
    "K": (False, DINHEIRO, None), "L": (True, DINHEIRO, None), "M": (False, DINHEIRO, None),
    "N": (False, PCT, "center"), "O": (False, None, "center"),
})
for col in "IK":
    for r in range(L0, L0 + N_PROD):
        produtos[f"{col}{r}"].font = font(TINTA, bold=True)
# (nome, rende, horas, compra pronto, preço que cobra)
prods_ex = [("Bolo de pote", 12, 3, None, 12), ("Coxinha de frango", 20, 3, None, 5),
            ("Brigadeiro", 30, 1.5, None, 2.5), ("Refrigerante lata", None, None, 3.2, 6)]
for i, (n_, rende, horas, compra, preco) in enumerate(prods_ex):
    r = L0 + i
    produtos[f"B{r}"], produtos[f"C{r}"], produtos[f"D{r}"] = n_, rende, horas
    produtos[f"E{r}"], produtos[f"L{r}"] = compra, preco
for r in range(L0, L0 + N_PROD):
    pronto = f"N(E{r})>0"
    produtos[f"F{r}"] = f'=IF(B{r}="","",SUMIFS({REC_CUSTO},{REC_PROD},B{r}))'
    # Comprado pronto: o que paga por unidade. Preparado: materiais da receita ÷ rendimento. Os dois com perdas.
    produtos[f"G{r}"] = (f'=IF(B{r}="","",IF({pronto},E{r}*(1+Perdas),'
                         f'IF(AND(N(C{r})>0,N(F{r})>0),F{r}*(1+Perdas)/C{r},"")))')
    # Só o que é preparado leva o tempo; quem revende cobre contas e salário pela meta do Resumo
    produtos[f"H{r}"] = f'=IF(G{r}="","",IF({pronto},0,N(D{r})*ValorHora/C{r}))'
    produtos[f"I{r}"] = f'=IF(G{r}="","",G{r}+H{r})'
    produtos[f"J{r}"] = f'=IF(I{r}="","",I{r}/(1-Taxas))'
    sug = f"I{r}/(1-Taxas-LucroDesejado)"
    # Arredonda para cima: de 10 em 10 centavos até R$ 3, depois de 50 em 50
    produtos[f"K{r}"] = (f'=IF(I{r}="","",IF(Taxas+LucroDesejado>=1,"",'
                         f'IF({sug}<3,CEILING({sug},0.1),CEILING({sug},0.5))))')
    produtos[f"M{r}"] = f'=IF(OR(I{r}="",N(L{r})=0),"",L{r}-I{r}-L{r}*Taxas)'
    produtos[f"N{r}"] = f'=IF(M{r}="","",M{r}/L{r})'
    produtos[f"O{r}"] = (f'=IF(B{r}="","",IF(AND(N(E{r})=0,N(F{r})=0),"Falta a receita ou o custo",'
                         f'IF(G{r}="","Falta o rendimento",IF(N(L{r})=0,"Falta o seu preço",'
                         f'IF(L{r}<G{r}/(1-Taxas),"Prejuízo",IF(L{r}<J{r}-0.005,"Não paga o seu tempo",'
                         f'IF(L{r}<K{r}-0.005,"Abaixo do sugerido","Preço bom")))))))')
    # Coluna escondida: de cada R$ 1 vendido, quanto sobra para contas e salário (usada na meta do Resumo)
    produtos[f"P{r}"] = f'=IF(OR(G{r}="",N(L{r})=0),"",(L{r}-G{r})/L{r}-Taxas)'
produtos.column_dimensions["P"].hidden = True
faixa_o = f"O{L0}:O{L0 + N_PROD - 1}"
for texto, cor_f, cor_t in [("Preço bom", AZUL_CLARO, AZUL), ("Prejuízo", VERMELHO_CLARO, VERMELHO),
                            ("Não paga o seu tempo", CINZA, TINTA), ("Abaixo do sugerido", CINZA, TINTA)]:
    produtos.conditional_formatting.add(
        faixa_o, FormulaRule(formula=[f'O{L0}="{texto}"'], fill=fill(cor_f), font=Font(color=cor_t, bold=True)))
produtos.conditional_formatting.add(
    f"M{L0}:N{L0 + N_PROD - 1}", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=VERMELHO, bold=True)))
produtos.freeze_panes = "C5"

# ================================================================= CLIENTES
topo(clientes, "Clientes",
     "Quem compra de você. O quanto cada pessoa pegou, pagou e ainda deve aparece sozinho, "
     "pelas abas Vendas, Recebi e Acertos.",
     10, DIA_A_DIA)
cabecalho(clientes, 4, [
    ("Nome", 26, True), ("WhatsApp", 17, True), ("Observação\n(turma, setor, responsável)", 24, True),
    ("Já pegou", 13, False), ("Já pagou", 13, False), ("Descontos e acertos", 13, False),
    ("Está devendo", 14, False), ("Última compra", 13, False), ("Situação", 16, False),
])
grade(clientes, L0, N_CLI, {
    "B": (True, None, None), "C": (True, "@", None), "D": (True, None, None), "E": (False, DINHEIRO, None),
    "F": (False, DINHEIRO, None), "G": (False, DINHEIRO, None), "H": (False, DINHEIRO, None),
    "I": (False, DATA, "center"), "J": (False, None, "center"),
})
for i, (n_, tel, obs) in enumerate([("Ana", "(11) 90000-0001", "RH"),
                                    ("Bruno", "(11) 90000-0002", "Portaria"),
                                    ("Carla", "(11) 90000-0003", "3º ano B"),
                                    ("Lúcia", "(11) 90000-0004", "Responsável pelo Pedro, 5º ano"),
                                    ("João", "(11) 90000-0005", "Vizinho")]):
    clientes[f"B{L0 + i}"], clientes[f"C{L0 + i}"], clientes[f"D{L0 + i}"] = n_, tel, obs
for r in range(L0, L0 + N_CLI):
    clientes[f"E{r}"] = f'=IF(B{r}="","",SUMIFS({VEN_TOTAL},{VEN_CLI},B{r}))'
    clientes[f"F{r}"] = (f'=IF(B{r}="","",SUMIFS({PAG_VALOR},{PAG_CLI},B{r})'
                         f'+SUMIFS({VEN_TOTAL},{VEN_CLI},B{r},{VEN_NAHORA},"Sim"))')
    clientes[f"G{r}"] = f'=IF(B{r}="","",SUMIFS({ACE_VALOR},{ACE_CLI},B{r}))'
    clientes[f"H{r}"] = f'=IF(B{r}="","",E{r}+G{r}-F{r})'
    clientes[f"I{r}"] = f'=IF(B{r}="","",IF(COUNTIF({VEN_CLI},B{r})=0,"",_xlfn.MAXIFS({VEN_DATA},{VEN_CLI},B{r})))'
    clientes[f"J{r}"] = (f'=IF(B{r}="","",IF(H{r}>0.005,"Deve",IF(H{r}<-0.005,"Tem crédito",'
                         f'IF(E{r}>0,"Em dia","Ainda não comprou"))))')
    clientes[f"H{r}"].font = font(TINTA, bold=True)
faixa_j = f"J{L0}:J{L0 + N_CLI - 1}"
clientes.conditional_formatting.add(
    faixa_j, FormulaRule(formula=[f'J{L0}="Deve"'], fill=fill(VERMELHO_CLARO), font=Font(color=VERMELHO, bold=True)))
clientes.conditional_formatting.add(
    faixa_j, FormulaRule(formula=[f'J{L0}="Em dia"'], fill=fill(VERDE_CLARO), font=Font(color=VERDE, bold=True)))
clientes.conditional_formatting.add(
    f"H{L0}:H{L0 + N_CLI - 1}", CellIsRule(operator="greaterThan", formula=["0.005"], font=Font(color=VERMELHO, bold=True)))
clientes.freeze_panes = "C5"

# ================================================================= VENDAS
topo(vendas, "Vendas",
     "Quem pegou o quê, uma linha por produto. Preço em branco usa o da aba Produtos. "
     "Sem produto cadastrado? Escreva o que foi e o valor, como no caderno.",
     10, DIA_A_DIA)
cabecalho(vendas, 4, [
    ("Data", 13, True), ("Cliente", 22, True), ("Produto (ou o que foi)", 26, True), ("Quantas", 10, True),
    ("Preço da unidade", 13, True), ("Total", 13, False), ("Custo", 13, False),
    ("Sobrou", 13, False), ("Pagou na hora?", 11, True),
])
grade(vendas, L0, N_VEN, {
    "B": (True, DATA, "center"), "C": (True, None, None), "D": (True, None, None), "E": (True, "General", "center"),
    "F": (True, DINHEIRO, None), "G": (False, DINHEIRO, None), "H": (False, DINHEIRO, None),
    "I": (False, DINHEIRO, None), "J": (True, None, "center"),
})
vendas_ex = [
    (dt.date(2026, 10, 2), "Ana", "Bolo de pote", 2, 12, ""),
    (dt.date(2026, 10, 2), "Bruno", "Brigadeiro", 6, 2.5, "Sim"),
    (dt.date(2026, 10, 6), "Carla", "Refrigerante lata", 1, 6, ""),
    (dt.date(2026, 10, 6), "Carla", "Coxinha de frango", 2, 5, ""),
    (dt.date(2026, 10, 9), "Lúcia", "Coxinha de frango", 10, 5, ""),
    (dt.date(2026, 10, 9), "Lúcia", "Brigadeiro", 10, 2.5, ""),
    (dt.date(2026, 10, 14), "Ana", "Lanche", 1, 7.5, ""),
    (dt.date(2026, 10, 16), "João", "Bolo de pote", 1, 12, "Sim"),
    (dt.date(2026, 10, 21), "Carla", "Bolo de pote", 2, 12, ""),
    (dt.date(2026, 10, 23), "Bruno", "Refrigerante lata", 2, 6, ""),
    (dt.date(2026, 10, 28), "Ana", "Brigadeiro", 4, 2.5, ""),
]
for i, (d, c, p, q, pr, nh) in enumerate(vendas_ex):
    r = L0 + i
    vendas[f"B{r}"], vendas[f"C{r}"], vendas[f"D{r}"], vendas[f"E{r}"], vendas[f"F{r}"] = d, c, p, q, pr
    if nh:
        vendas[f"J{r}"] = nh
for r in range(L0, L0 + N_VEN):
    m = f"MATCH(D{r},{PROD_NOME},0)"
    qtd = f"IF(N(E{r})=0,1,E{r})"  # sem quantidade, conta 1 (como o "digitar um valor" do app)
    vendas[f"G{r}"] = (f'=IF(OR(C{r}="",AND(D{r}="",F{r}="")),"",'
                       f'{qtd}*IF(F{r}="",IFERROR(N(INDEX({PROD_PRECO},{m})),0),F{r}))')
    vendas[f"H{r}"] = f'=IF(G{r}="","",{qtd}*IFERROR(N(INDEX({PROD_CUSTO},{m})),0))'
    vendas[f"I{r}"] = f'=IF(G{r}="","",G{r}-H{r})'
lista(vendas, f"={CLI_NOME}", f"C{L0}:C{L0 + N_VEN - 1}", ("Cliente", "Escolha da lista ou cadastre na aba Clientes."))
lista(vendas, f"={PROD_NOME}", f"D{L0}:D{L0 + N_VEN - 1}",
      ("Produto", "Escolha da lista, ou escreva o que foi e preencha o preço."))
lista(vendas, '"Sim,Não"', f"J{L0}:J{L0 + N_VEN - 1}")
vendas.freeze_panes = "B5"

# ================================================================= RECEBI
topo(recebi, "Recebi",
     "Cada vez que alguém te pagar, uma linha aqui. Pode ser tudo ou só uma parte do que a pessoa deve.",
     6, DIA_A_DIA)
cabecalho(recebi, 4, [("Data", 13, True), ("Cliente", 22, True), ("Quanto", 14, True),
                      ("Como pagou", 14, True), ("Observação", 32, True)])
grade(recebi, L0, N_PAG, {
    "B": (True, DATA, "center"), "C": (True, None, None), "D": (True, DINHEIRO, None),
    "E": (True, None, "center"), "F": (True, None, None),
})
for i, (d, c, v, f_, o) in enumerate([
        (dt.date(2026, 10, 10), "Ana", 24, "Pix", ""),
        (dt.date(2026, 10, 15), "Carla", 16, "Dinheiro", ""),
        (dt.date(2026, 10, 20), "Lúcia", 50, "Pix", "Pagou uma parte"),
        (dt.date(2026, 10, 25), "Bruno", 12, "Cartão", "")]):
    r = L0 + i
    recebi[f"B{r}"], recebi[f"C{r}"], recebi[f"D{r}"], recebi[f"E{r}"] = d, c, v, f_
    if o:
        recebi[f"F{r}"] = o
for r in range(L0, L0 + N_PAG):
    recebi[f"D{r}"].font = font(VERDE, bold=True)
lista(recebi, f"={CLI_NOME}", f"C{L0}:C{L0 + N_PAG - 1}", ("Cliente", "Escolha da lista da aba Clientes."))
lista(recebi, '"Pix,Dinheiro,Cartão,Na hora"', f"E{L0}:E{L0 + N_PAG - 1}")
recebi.freeze_panes = "B5"

# ================================================================= ACERTOS
topo(acertos, "Descontos e acertos",
     "Para mudar o valor que alguém deve: um presente, um desconto ou a correção de um erro. "
     "Com menos (−) diminui o que a pessoa deve; sem sinal, aumenta.",
     6, DIA_A_DIA)
cabecalho(acertos, 4, [("Data", 13, True), ("Cliente", 22, True), ("Valor\n(− diminui, + aumenta)", 15, True),
                       ("Motivo", 14, True), ("Observação", 32, True)])
grade(acertos, L0, N_ACE, {
    "B": (True, DATA, "center"), "C": (True, None, None), "D": (True, DINHEIRO, None),
    "E": (True, None, "center"), "F": (True, None, None),
})
acertos["B5"], acertos["C5"], acertos["D5"], acertos["E5"], acertos["F5"] = (
    dt.date(2026, 10, 20), "Lúcia", -5, "Presente", "Arredondei a conta")
lista(acertos, f"={CLI_NOME}", f"C{L0}:C{L0 + N_ACE - 1}", ("Cliente", "Escolha da lista da aba Clientes."))
lista(acertos, '"Presente,Desconto,Correção"', f"E{L0}:E{L0 + N_ACE - 1}")
acertos.freeze_panes = "B5"

# ================================================================= RESUMO
topo(resumo, "Resumo",
     "Quanto você vendeu, quanto já entrou, quem está devendo e se o mês pagou as suas contas e o seu salário.",
     5, DIA_A_DIA)
resumo["B1"] = '=IF(Negocio="","Resumo","Resumo · "&Negocio)'
for col, larg in zip("BCDE", (46, 17, 17, 50)):
    resumo.column_dimensions[col].width = larg

celula(resumo, "B4", "Mês que quero ver", bold=True, size=12)
celula(resumo, "C4", "=DATE(YEAR(TODAY()),MONTH(TODAY()),1)", entrada=True, fmt="mm/yyyy", alinh="center", bold=True, size=12)
celula(resumo, "D4", "Começa no mês de hoje. Para ver outro, escreva a data (ex.: 01/09/2026).", cor=APAGADO)
resumo.merge_cells("D4:E4")
resumo.row_dimensions[4].height = 30
no_mes = f'{VEN_DATA},">="&$C$4,{VEN_DATA},"<="&EOMONTH($C$4,0)'
pag_mes = f'{PAG_DATA},">="&$C$4,{PAG_DATA},"<="&EOMONTH($C$4,0)'
ace_mes = f'{ACE_DATA},">="&$C$4,{ACE_DATA},"<="&EOMONTH($C$4,0)'


def linha_resumo(r, rotulo, f_mes, f_tudo, explica, cor_num=TINTA, forte=False):
    fundo = CINZA if forte else None
    celula(resumo, f"B{r}", rotulo, bold=True, fundo=fundo)
    celula(resumo, f"C{r}", f_mes, fmt=DINHEIRO, bold=forte, fundo=fundo, cor=cor_num)
    celula(resumo, f"D{r}", f_tudo, fmt=DINHEIRO, bold=forte, fundo=fundo, cor=cor_num)
    celula(resumo, f"E{r}", explica, cor=APAGADO, fundo=fundo)
    resumo.row_dimensions[r].height = 26


secao(resumo, 6, "Dinheiro na rua", "E")
celula(resumo, "B7", "Falta receber de todo mundo", bold=True, fundo=VERMELHO_CLARO, cor=VERMELHO, size=13)
celula(resumo, "C7", f'=SUMIF({CLI_DEVE},">0")', fmt=DINHEIRO, bold=True, fundo=VERMELHO_CLARO, cor=VERMELHO, size=13)
celula(resumo, "D7", f'=COUNTIF({CLI_DEVE},">0.005")&" devendo"', fundo=VERMELHO_CLARO, cor=VERMELHO, bold=True)
celula(resumo, "E7", "Veja quem na aba Clientes.", cor=APAGADO, fundo=VERMELHO_CLARO)
resumo.row_dimensions[7].height = 30

secao(resumo, 9, "Vendas", "E")
for col, t in zip("BCDE", ("", "Neste mês", "Desde o começo", "")):
    celula(resumo, f"{col}10", t, bold=True, cor=BRANCO, fundo=TINTA, alinh="center")
# Como no app: descontos e acertos entram no "Vendi" (não são dinheiro recebido)
linha_resumo(11, "Vendi", f"=SUMIFS({VEN_TOTAL},{no_mes})+SUMIFS({ACE_VALOR},{ace_mes})",
             f"=SUM({VEN_TOTAL})+SUM({ACE_VALOR})", "Tudo que as pessoas pegaram, pago ou fiado, com descontos e acertos.")
linha_resumo(12, "Já recebi", f'=SUMIFS({PAG_VALOR},{pag_mes})+SUMIFS({VEN_TOTAL},{VEN_NAHORA},"Sim",{no_mes})',
             f'=SUM({PAG_VALOR})+SUMIFS({VEN_TOTAL},{VEN_NAHORA},"Sim")', "O dinheiro que já entrou.", cor_num=VERDE)
linha_resumo(13, "Gastei com materiais e mercadoria", f"=SUMIFS({VEN_CUSTO},{no_mes})", f"=SUM({VEN_CUSTO})",
             "Pelo custo de cada produto (aba Produtos).")
linha_resumo(14, "Taxas (maquininha, app)", "=C11*Taxas", "=D11*Taxas", "Uma estimativa, pela % da aba Meu Mês.")
linha_resumo(15, "Sobrou das vendas", "=C11-C13-C14", "=D11-D13-D14",
             "O que fica para pagar as contas e o seu salário.", cor_num=AZUL, forte=True)

secao(resumo, 17, "O mês pagou as contas e o seu salário?", "E")
celula(resumo, "B18", "Contas fixas do mês", bold=True)
celula(resumo, "C18", "=ContasFixas", fmt=DINHEIRO)
celula(resumo, "D18", "", fundo=BRANCO)
celula(resumo, "E18", "Da aba Meu Mês.", cor=APAGADO)
destaque(resumo, "B19", "Ficou para mim", size=13, cor=TINTA)
destaque(resumo, "C19", "=C15-C18", fmt=DINHEIRO, size=13)
celula(resumo, "D19", "", fundo=CINZA)
celula(resumo, "E19", "Sobrou das vendas menos as contas fixas (contando o fiado que ainda vai entrar).",
       cor=APAGADO, fundo=CINZA)
celula(resumo, "B20", "Meu salário", bold=True)
celula(resumo, "C20", "=Salario", fmt=DINHEIRO)
celula(resumo, "D20", "", fundo=BRANCO)
celula(resumo, "E20", "O que você quer tirar por mês (aba Meu Mês).", cor=APAGADO)
resumo.merge_cells("B21:E21")
celula(resumo, "B21", ('=IF(C11=0,"Ainda não tem vendas neste mês.",IF(C19>=C20,'
                       '"Bateu o seu salário! E ainda sobrou "&"R$ "&FIXED(C19-C20,2)&" de lucro.",'
                       'IF(C19>0,"Faltam "&"R$ "&FIXED(C20-C19,2)&" para chegar no seu salário.",'
                       '"As vendas ainda não pagaram as contas fixas do mês.")))'),
       bold=True, size=13, cor=AZUL, fundo=AZUL_CLARO, alinh="center")
for col in "CDE":
    resumo[f"{col}21"].fill = fill(AZUL_CLARO)
    resumo[f"{col}21"].border = BORDA
for r in (18, 19, 20):
    resumo.row_dimensions[r].height = 26
resumo.row_dimensions[21].height = 34
resumo.conditional_formatting.add("C19", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=VERMELHO, bold=True)))

secao(resumo, 23, "Meta do mês", "E")
# De cada R$ 1 vendido, quanto sobra para contas e salário: do mês, ou a média dos produtos se não vendeu nada
celula(resumo, "B24", "De cada R$ 1,00 que vendo, sobra", bold=True)
celula(resumo, "C24", f'=IF(C11>0,(C11-C13)/C11-Taxas,IFERROR(AVERAGE({PROD_SOBRA}),0))', fmt=PCT, alinh="center")
celula(resumo, "D24", "", fundo=BRANCO)
celula(resumo, "E24", "Para pagar contas e salário. Quanto maior, melhor.", cor=APAGADO)
destaque(resumo, "B25", "Para pagar contas + salário, preciso vender", cor=TINTA)
destaque(resumo, "C25", '=IF(C24>0,(ContasFixas+Salario)/C24,"")', fmt=DINHEIRO)
celula(resumo, "D25", "", fundo=CINZA)
celula(resumo, "E25", "Por mês.", cor=APAGADO, fundo=CINZA)
celula(resumo, "B26", '="Para ter também "&TEXT(LucroDesejado,"0%")&" de lucro, preciso vender"', bold=True)
celula(resumo, "C26", '=IF(C24-LucroDesejado>0,(ContasFixas+Salario)/(C24-LucroDesejado),"")', fmt=DINHEIRO, bold=True)
celula(resumo, "D26", "", fundo=BRANCO)
celula(resumo, "E26", '=IF(C26="","Com os preços de hoje não dá esse lucro. Veja a aba Produtos.","Por mês.")', cor=APAGADO)
celula(resumo, "B27", "Já vendi da meta", bold=True)
celula(resumo, "C27", '=IF(N(C25)=0,"",C11/C25)', fmt=PCT, alinh="center", bold=True)
celula(resumo, "D27", '=IF(C27="","",REPT("■",MIN(10,ROUND(C27*10,0)))&REPT("□",10-MIN(10,ROUND(C27*10,0))))',
       cor=AZUL, alinh="center")
resumo["D27"].alignment = Alignment(horizontal="center", vertical="center", shrink_to_fit=True)
celula(resumo, "E27", '=IF(C27="","",IF(C11>=C25,"Meta batida!","Faltam "&"R$ "&FIXED(C25-C11,2)&" em vendas."))',
       cor=APAGADO)
for r in range(24, 28):
    resumo.row_dimensions[r].height = 26
nome(wb, "MetaVendas", "Resumo!$C$25")

secao(resumo, 29, "Por produto, neste mês", "E")
for col, t in zip("BCDE", ("Produto", "Unidades", "Vendi", "Sobrou")):
    celula(resumo, f"{col}30", t, bold=True, cor=BRANCO, fundo=TINTA, alinh="center")
for i in range(N_PROD):
    r, rp = 31 + i, L0 + i
    celula(resumo, f"B{r}", f'=IF(Produtos!B{rp}="","",Produtos!B{rp})')
    celula(resumo, f"C{r}", f'=IF(B{r}="","",SUMIFS({VEN_QTD},{VEN_PROD},B{r},{no_mes}))', fmt="General", alinh="center")
    celula(resumo, f"D{r}", f'=IF(B{r}="","",SUMIFS({VEN_TOTAL},{VEN_PROD},B{r},{no_mes}))', fmt=DINHEIRO)
    celula(resumo, f"E{r}", f'=IF(B{r}="","",SUMIFS({VEN_SOBRA},{VEN_PROD},B{r},{no_mes}))', fmt=DINHEIRO)
resumo.freeze_panes = "A5"

# ================================================================= INÍCIO
topo(inicio, "Caderninho — controle de fiado",
     "Planilha de custos, preços e fiado para qualquer negócio que vende para receber depois: "
     "cantina, lanchonete, doces e salgados, lojinha, revenda.",
     4, DIA_A_DIA)
inicio.column_dimensions["B"].width = 6
inicio.column_dimensions["C"].width = 26
inicio.column_dimensions["D"].width = 86
inicio.merge_cells("B4:C4")
celula(inicio, "B4", "Nome do negócio (se quiser)", bold=True, size=12)
celula(inicio, "D4", None, entrada=True, bold=True, size=12)
inicio.row_dimensions[4].height = 30
nome(wb, "Negocio", "'Início'!$D$4")


def passo(r, num, aba, texto):
    celula(inicio, f"B{r}", num, bold=True, cor=BRANCO, fundo=AZUL, alinh="center", size=13)
    celula(inicio, f"C{r}", aba, bold=True, cor=AZUL, size=12)
    celula(inicio, f"D{r}", texto)
    inicio.row_dimensions[r].height = 34


secao(inicio, 6, "Na primeira vez, preencha nesta ordem:")
passos = [
    ("Meu Mês", "Suas contas fixas, quanto você precisa para viver e quantas horas trabalha. "
                "A planilha calcula quanto vale a sua hora."),
    ("Materiais", "Se você prepara o que vende: tudo que compra para isso (ingredientes, embalagens), "
                  "com o tamanho do pacote e o preço."),
    ("Produtos", "O que você vende. Se prepara: quanto a receita rende e quanto tempo leva. "
                 "Se compra pronto: quanto paga por unidade."),
    ("Receitas", "Só para o que você prepara: o que vai e quanto vai. O preço sugerido aparece em Produtos."),
    ("Clientes", "Quem compra de você, com uma observação se quiser (turma, setor, responsável)."),
]
for i, (aba, txt) in enumerate(passos):
    passo(7 + i, i + 1, aba, txt)
secao(inicio, 13, "No dia a dia:")
dia_a_dia = [
    ("Vendas", "Quem pegou o quê. Sem produto cadastrado? Escreva o que foi e o valor, como no caderno."),
    ("Recebi", "Quem te pagou, quanto e como (Pix, dinheiro, cartão)."),
    ("Acertos", "Um presente, um desconto ou a correção do valor que alguém deve."),
    ("Resumo", "Quanto vendeu, quanto já recebeu, quem deve e se o mês pagou suas contas e o seu salário."),
]
for i, (aba, txt) in enumerate(dia_a_dia):
    passo(14 + i, "•", aba, txt)

secao(inicio, 19, "As cores")
for r, (cor_f, cor_t, t1, t2) in enumerate([
        (AZUL_CLARO, AZUL, "Azul clarinho", "Você preenche. Pode escrever por cima à vontade."),
        (BRANCO, TINTA, "Branco", "A planilha calcula sozinha. Não precisa mexer."),
        (CINZA, AZUL, "Cinza", "Os números mais importantes."),
        (VERMELHO_CLARO, VERMELHO, "Vermelho", "Dívida, ou um preço que dá prejuízo."),
        (VERDE_CLARO, VERDE, "Verde", "Dinheiro que entrou e conta em dia.")], start=20):
    celula(inicio, f"B{r}", "", fundo=cor_f)
    celula(inicio, f"C{r}", t1, bold=True, cor=cor_t, fundo=cor_f)
    celula(inicio, f"D{r}", t2)
    inicio.row_dimensions[r].height = 26

secao(inicio, 26, "Como a planilha chega no preço")
contas_preco = [
    ("1", "Custo da unidade", "Se prepara: materiais da receita, mais as perdas, divididos pelo rendimento. "
                              "Se compra pronto: o que paga, mais as perdas."),
    ("2", "Seu tempo e contas", "Só no que você prepara: horas da receita × quanto vale a sua hora, divididas pelo "
                                "rendimento. É isso que paga as contas fixas e o seu salário."),
    ("3", "Preço sugerido", "Custo completo, mais as taxas e o lucro que você quer. Arredondado para cima."),
    ("4", "Como está", "Compara com o preço que você cobra hoje: Preço bom, Abaixo do sugerido, "
                       "Não paga o seu tempo ou Prejuízo."),
]
for i, (n_, t1, t2) in enumerate(contas_preco):
    r = 27 + i
    celula(inicio, f"B{r}", n_, bold=True, cor=BRANCO, fundo=TINTA, alinh="center")
    celula(inicio, f"C{r}", t1, bold=True)
    celula(inicio, f"D{r}", t2)
    inicio.row_dimensions[r].height = 34

secao(inicio, 32, "Dicas")
dicas = [
    "As linhas que já vêm preenchidas são exemplos. Escreva por cima ou apague.",
    "Quilo vira gramas e litro vira ml: 1 kg = 1000 g, 1 litro = 1000 ml. Ovos, potes e peças são em unidades (un).",
    "Mudou o preço de algo que você compra? Mude só na aba Materiais (ou em Produtos, se compra pronto): "
    "custos e preços sugeridos se atualizam sozinhos.",
    "Na aba Vendas, escreva o preço que você cobrou. Assim, se mudar o preço depois, as vendas antigas não mudam.",
    "Em breve o app Caderninho vai preencher esta planilha sozinho.",
]
for i, t in enumerate(dicas):
    r = 33 + i
    celula(inicio, f"B{r}", "•", bold=True, cor=AZUL, alinh="center", size=13)
    inicio.merge_cells(f"C{r}:D{r}")
    celula(inicio, f"C{r}", t)
    inicio.row_dimensions[r].height = 30

# Impressão: cabe na largura da folha, deitada
for ws in wb.worksheets:
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

wb.save(SAIDA)
print("ok:", SAIDA)
