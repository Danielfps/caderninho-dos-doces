# Assinatura do Caderninho

Assinatura com renovação automática pelo Mercado Pago, com checkout hospedado. O desenho completo, as provas e a máquina de estados estão em `docs/assinatura-arquitetura.md`. A auditoria que motivou a mudança está em `docs/auditoria-assinatura-2026-11-05.md`.

## Como funciona

1. 3 dias grátis ao criar a conta.
2. A pessoa escolhe o plano e toca em **Assinar agora**. O app manda só o plano.
3. O servidor cria um plano próprio no Mercado Pago para aquela tentativa (`POST /preapproval_plan`) e devolve o link.
4. A pessoa paga na página do Mercado Pago, com ou sem conta lá.
5. Webhook e conferência leem o Mercado Pago. Só cobrança aprovada libera acesso.

Preços: mensal R$ 14,90 no 1º mês, uma vez por conta, depois R$ 19,90; anual R$ 149,90. Ficam em `public.planos`.

## Ambientes

| | Teste | Produção |
|---|---|---|
| Projeto Supabase | `caderninho-teste` (`wnpapijczziocyxfqmpr`) | `gwgwivkqhssmuqlyjkon` |
| Conta Mercado Pago | vendedor de teste `3815332020` | conta real do Daniel |
| App | `node testes/servir-teste.mjs`, em `http://localhost:8000` | GitHub Pages |

O repositório continua ligado à produção. Todo comando no teste precisa de `--remote=wnpapijczziocyxfqmpr`.

## Segredos das funções

`supabase/.env.example` lista os nomes. Valores nunca entram no repositório.

| Segredo | Para quê |
|---|---|
| `MP_ACCESS_TOKEN` | Falar com o Mercado Pago |
| `MP_COLLECTOR_ID` | Id da conta que recebe. Barra token do ambiente errado |
| `MP_WEBHOOK_SECRET` | Conferir a assinatura do aviso |
| `APP_URLS` | Endereços aceitos. `back_url` só usa `https` |
| `RECONCILIAR_CHAVE` | Proteger `mp-reconciliar` |

## Avisos do Mercado Pago

No painel, em **Webhooks**, cadastre `https://<projeto>.supabase.co/functions/v1/mp-webhook` e marque **Planos e assinaturas** e **Pagamentos**. O segredo gerado ali vai em `MP_WEBHOOK_SECRET`.

Se um aviso não chegar, o app confere ao voltar do pagamento e ao abrir. `POST /functions/v1/mp-reconciliar` com o cabeçalho `x-reconciliar-chave` confere todas as assinaturas vivas. Agendar essa chamada é opcional.

## Para ir à produção

Cada passo depende de autorização do Daniel.

1. Fazer o teste de ponta a ponta de `docs/teste-assinatura.md`.
2. No modo de produção da aplicação, cadastrar o webhook e guardar o segredo.
3. Gravar no projeto de produção `MP_COLLECTOR_ID` (id da conta real), `MP_WEBHOOK_SECRET` (produção) e `RECONCILIAR_CHAVE`, e tirar `localhost` de `APP_URLS`.
4. `supabase db push --remote=gwgwivkqhssmuqlyjkon`. A migração só acrescenta.
5. `supabase functions deploy assinatura mp-webhook mp-reconciliar --remote=gwgwivkqhssmuqlyjkon`.
6. Publicar o app. As funções vêm antes do app porque o app atual continua funcionando com as funções novas.
7. Ligar o SMTP no Supabase (`docs/conta.md`, passo 7).
8. Fazer uma assinatura real controlada e cancelar.

Voltar atrás: tag `antes-assinatura-recorrente` para código e funções. A migração não apaga nada, então não há o que desfazer no banco.

## Lojas de aplicativos

Hoje o app é PWA por link, fora das lojas, então as regras de cobrança das lojas não se aplicam a ele. Isso muda se for empacotado:

- **Google Play:** assinatura vendida dentro do app exige o faturamento do Google Play. A política lida em 05/11/2026 não traz exceção para o Brasil. Confirmar na lista de países antes de publicar.
- **App Store:** exige Compra no App. No Brasil, a partir do iOS 26.5, há processador alternativo ou link externo, com entitlement `StoreKit External Purchases or Offers`, comissões e relatório mensal.

Fontes: [Google Play](https://support.google.com/googleplay/android-developer/answer/10281818?hl=pt-BR), [Apple](https://developer.apple.com/app-store/review/guidelines/), [Apple no Brasil](https://developer.apple.com/br/support/payment-options-on-the-app-store-in-brazil/).

## Testes

Na pasta `testes`:

```sh
node --test assinatura.test.mjs sincronizar.test.mjs supabase-falso.test.mjs mp-falso.test.mjs
node assinatura.e2e.mjs
node conta.test.mjs
node sincronizar.e2e.mjs
npx deno check ../supabase/functions/*/handler.ts ../supabase/functions/*/index.ts
```

`assinatura.e2e.mjs` roda as Edge Functions de verdade em Deno contra o Supabase de mentira (migrações reais no PGlite) e o Mercado Pago de mentira (`mp-falso.mjs`), que reproduz o comportamento provado na API.

## O que ainda não tem prova

- Webhook chegando de verdade no projeto de teste, e o formato real dos avisos de assinatura.
- Volta do checkout pelo `back_url` no celular.
- Estorno real: o caminho está pronto, mas falta ver o aviso verdadeiro.
- Renovação real e recusa de cartão em assinatura já ativa: testadas só no Mercado Pago de mentira.
- Tudo na conta real: pagar sem conta, formas de pagamento oferecidas e Pix.
