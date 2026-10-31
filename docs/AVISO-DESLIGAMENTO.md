# Aviso: o computador foi desligado no fim do trabalho (31/10/2026)

O Daniel pediu para desligar o computador quando a tarefa terminasse. Antes disso, tudo foi enviado ao GitHub.

## O que ficou pronto

- **Ramo:** `claude/fiado-conta-assinatura` (saiu do ramo do Caderninho de Fiado, `claude/app-fiado-redesign-kbzp6b`).
  Não foi para o ramo principal, então o endereço do GitHub Pages continua com a versão antiga.
- **Conta obrigatória** ao abrir o app (nome, e-mail e senha), **3 dias grátis** e depois **assinatura mensal pelo
  Mercado Pago** (preço provisório R$ 9,90).
- **Modo de teste** (enquanto `CONTA_URL` e `CONTA_CHAVE` estiverem vazios): botão 🧪 no alto para passar os dias,
  acabar o teste grátis, pagar de mentira e cancelar. Nada é cobrado.
- **Visualizador para testar:** https://claude.ai/artifact/SdJVLsgi1uMTTwbmFGfpnc (também como quadro
  "Visualizador Fiado" no canvas do Maestri; pede login no Claude uma vez).
- **Servidor** pronto, mas ainda não ligado: pasta `supabase/`. Passo a passo em `docs/conta.md` e `docs/assinatura.md`.

## Testes que passaram antes de desligar

- `node testes/conta.test.mjs`: teste de ponta a ponta do app no modo de teste (Pixel 7).
- `node --test testes/assinatura.test.mjs`: regras do servidor.

## Falta (decisão ou conta do Daniel)

1. Decidir o preço da assinatura.
2. Criar o projeto no Supabase e a integração no Mercado Pago, e seguir os guias.
3. Testar com usuários e cartões de teste do Mercado Pago.
4. Só então juntar o ramo no principal para publicar.
