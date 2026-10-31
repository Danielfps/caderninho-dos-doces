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

## Minha conta (31/10/2026)

Primeiro passo para o sistema de pagamento: cada pessoa ter uma conta.

- Bonequinho no alto de todas as telas (ao lado da engrenagem) abre **Minha conta**: criar conta com nome,
  e-mail e senha; confirmar o e-mail pelo link; entrar; esqueci minha senha; mudar nome e senha;
  **proteção em 2 etapas** opcional com aplicativo de códigos (Google Authenticator etc.); sair.
- Feito com o Supabase Auth, chamado direto com `fetch` (sem biblioteca). Passo a passo em `docs/conta.md`.
- A engrenagem virou **Configurações**: atalho para a conta, cópia de segurança, instalar e
  "Como usar o caderninho".
- As vendas, clientes e doces continuam só no celular; a conta não mexe neles.
- Corrigido: janelas de baixo muito compridas espremiam listas até sumirem.
- Testado num celular emulado com um Supabase de mentira (todos os caminhos, inclusive erro, sem internet e
  link vencido) e o fluxo antigo de vendas.

## Falta fazer

- [x] Deixar o repositório público e ligar o GitHub Pages (29/10/2026).
- [ ] Abrir o endereço no celular e instalar.
- [ ] Se já tinha contas na versão de teste, passar para o app novo pela cópia de segurança.
- [ ] Criar o projeto no Supabase e preencher `CONTA_URL` / `CONTA_CHAVE` (veja `docs/conta.md`).
- [ ] Ligar um serviço de e-mail (SMTP) no Supabase e pôr os e-mails em português.
- [ ] Sistema de pagamento (Mercado Pago) usando a conta.
