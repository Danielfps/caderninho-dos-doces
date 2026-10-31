# Histórico do projeto

## Como começou (conversa no Claude)

A ideia nasceu numa conversa no Claude: um **caderninho digital** para quem vende doces e anota fiado
— trocar o caderno de papel por um app simples no celular. Dessa conversa saiu a primeira versão do app,
feita como página do Claude (artefato "Caderninho dos Doces"), com tudo o que está hoje em `app/index.html`:

- Cadastro de doces com foto (tirada na hora ou da galeria), preço de venda e custo para fazer.
- Anotar venda em 3 passos: quem pegou → o que pegou (toca no doce para somar) → quando.
  Opção "já pagou na hora".
- Ficha de cada cliente: quanto deve, quanto já pegou e pagou, histórico, e botão
  **Cobrar no WhatsApp** com a mensagem pronta.
- Receber pagamento: tudo ou só uma parte, por Pix, dinheiro ou cartão.
- Resumo: falta receber de todo mundo, vendi, já recebi e meu lucro (no mês ou desde o começo),
  e a lista de quem está devendo.
- Dados guardados só no celular, com **cópia de segurança** (arquivo ou texto para colar no WhatsApp)
  e aviso quando faz mais de 7 dias sem cópia.
- Visual rosa e chocolate, letras e botões grandes, tema escuro automático.

## Onde a gente parou

O próximo passo combinado era **colocar o app no GitHub**, para ele ter um endereço próprio e poder ser
**instalado no celular como um aplicativo de verdade** (ícone na tela inicial, abrir sem internet),
em vez de depender da página do Claude.

## O que foi feito na passagem para o Claude Code (29/10/2026)

- O app foi trazido do artefato para `app/index.html`, sem mudar as contas nem o formato dos dados.
- Virou um app instalável (PWA): `manifest.webmanifest`, ícone de cupcake (`app/icons/`) e `sw.js`
  para funcionar sem internet.
- Botão **Instalar** no Resumo e na engrenagem (Android), e instruções para iPhone.
- "Salvar cópia em arquivo" passou a baixar o arquivo direto no celular (antes dependia do Claude).
- Publicação automática no GitHub Pages (`.github/workflows/pages.yml`).
- Testado num celular emulado: cadastrar doce, anotar venda, pagamento parcial, resumo,
  cópia de segurança e abrir sem internet.

## Renovação: de doces para qualquer fiado (30/10/2026)

O app deixou de ser só para quem vende bolo de pote. Muita gente depende de fiado — cantinas de escola
(onde se anota o nome de cada aluno), cantinas de empresa, quem vende doces e salgados, lojinhas — e o
caderninho passou a servir para todos eles, ajudando a ter um controle muito melhor do que está para receber.

- **Nome e cara novos:** "Caderninho — controle de fiado". Saiu o rosa e o cupcake; entrou um visual de
  organizador profissional e minimalista (azul, cinzas, fonte Inter, cartões com borda fina), com tema escuro.
  Ícone novo: caderno com um "pago".
- **Textos neutros:** "produto" em vez de "doce", "Boas-vindas", mensagem de cobrança que serve para qualquer
  negócio e para qualquer pessoa que use.
- **Nome do negócio** (engrenagem → Ajustes): aparece no topo e assina a mensagem de cobrança no WhatsApp.
- **Digitar um valor:** dá para anotar uma venda sem ter produtos cadastrados ("Lanche — R$ 7,50"),
  como no caderno de papel.
- **Observação no cliente** (turma, setor, responsável) — aparece nas listas e entra na busca.
- **Feito para muita gente e muitos produtos:** produtos em lista com busca; ao escolher a pessoa, com muitos
  clientes aparecem só os que compraram por último e a busca acha o resto; buscas ignoram acento.
- **Desde quando deve:** cada pessoa devendo mostra "desde 12/10", e a ficha mostra "em aberto há 18 dias".
- **Total sempre à vista** na hora de anotar a venda, com o botão Salvar.
- Os dados continuam no mesmo lugar e no mesmo formato (só ganharam campos opcionais): quem já usava não perde nada,
  e cópias de segurança antigas continuam sendo recuperadas.

## Busca e correções (30/10/2026)

- A busca de clientes aparece em "Anotar venda" e em "Clientes" assim que existe o primeiro cliente
  (antes só a partir de 7 e de 5).
- **Corrigir venda e pagamento:** tocar numa linha do histórico abre para corrigir quantidades, valor digitado,
  valor do pagamento, forma e dia (antes só dava para apagar).
- **Mudar o valor que deve:** na página do cliente, para dar de presente, dar desconto ou acertar a conta.
  Fica anotado no histórico ("Desconto de presente" ou "Correção do valor") e dá para desfazer apagando a linha.

## Planilha de custos ligada ao app (31/10/2026)

Numa outra conversa foi feita a planilha "Caderninho — controle de fiado" (custos, preços e fiado, 10 abas).
Ela agora faz parte do app (`app/planilha-modelo.xlsx`):

- Botão **Consultar planilha** no Resumo (sem mexer no rodapé). Abre as mesmas abas: Resumo, Vendas, Recebi,
  Acertos, Clientes, Produtos, Receitas, Materiais e Meu Mês, com as mesmas contas.
- As duas conversam: vendas, pagamentos, acertos e clientes anotados no app aparecem na planilha; o custo que a
  planilha calcula (receita ou compra pronta, com as perdas) vai para o produto no app.
- **Baixar planilha** gera o arquivo do Excel preenchido com tudo do app. **Trazer planilha editada** lê o arquivo
  mexido no Excel ou no Google Planilhas: o que for novo entra no app, sem repetir o que já veio dele.
- Conferido no LibreOffice: as contas da planilha baixada batem com as do app.

## Graphify e teste da planilha (31/10/2026)

- O Graphify (mapa do código) tinha sido montado numa outra conversa, no ramo `claude/awesome-turing-m4exga`, ainda
  com o app antigo. Foi trazido para este ramo e o mapa refeito com o app de fiado e a planilha. Regra: toda pergunta
  ou tarefa começa consultando o mapa (veja o `CLAUDE.md`).
- Teste da planilha (`testes/planilha.test.js`), 46 conferências: a planilha original trazida para o app, mudanças de
  custos pelo app e mudanças no Excel dão as mesmas contas no app e no LibreOffice.
- O teste achou diferenças de centavos (o app arredondava o custo de cada venda e a planilha não). Agora o custo
  fica com 4 casas e os números batem.
- Na lista de produtos da planilha, "Custo" virou "Custo completo" (com o seu tempo), para não confundir com o custo
  do produto no app (só materiais e perdas).

## Conta obrigatória, 3 dias grátis e assinatura (31/10/2026)

- Decisão do Daniel: o Caderninho dos Doces foi só um teste; daqui para a frente tudo é feito no Caderninho de Fiado.
- A conta (nome, e-mail e senha, com Supabase) veio do Doces e agora é **obrigatória** ao abrir o app.
- Cada conta usa **3 dias grátis**. Depois aparece a tela "Seu teste grátis acabou" com a **assinatura mensal pelo
  Mercado Pago** (preço provisório R$ 9,90). As contas da pessoa ficam guardadas no celular e voltam ao assinar.
- Enquanto o Supabase e o Mercado Pago não forem ligados, o app abre no **modo de teste** (botão 🧪), para testar
  tudo sem cobrar: passar os dias, acabar o teste grátis, pagar de mentira, cancelar.
- Feito em equipe: Claude (app e orquestração), Esquadro/Codex (servidor, teste de ponta a ponta e revisão),
  Pluma/Gemini (guia da conta).

## Falta fazer

- [x] Deixar o repositório público e ligar o GitHub Pages (29/10/2026).
- [ ] Abrir o endereço no celular e instalar.
- [ ] Se já tinha contas na versão de teste, passar para o app novo pela cópia de segurança.
- [ ] Decidir o preço da assinatura (hoje R$ 9,90 provisório).
- [ ] Ligar Supabase e Mercado Pago (`docs/conta.md` e `docs/assinatura.md`) e testar com usuários de teste do Mercado Pago.
