# Relatório da assinatura recorrente (06/11/2026)

**Situação:** pronta e testada no ambiente de teste. Não está concluída: falta um pagamento pelo app com o aviso do Mercado Pago chegando de verdade, e nada foi para produção.

## A. O que estava errado

O campo de e-mail existia por uma regra real do Mercado Pago. Na assinatura pendente, ele bloqueia quem digita outro e-mail ("Seu e-mail não corresponde ao da assinatura") e recusa e-mail que não existe lá (`User bad request`, visto com token de teste). O teste com credencial de teste e e-mail real também falhava. A saída tomada foi trocar tudo por pagamento único, que acabou com a recorrência.

## B. O que foi corrigido

Código no ramo local `claude/fiado-assinatura-recorrente`. Lista completa: `git diff antes-assinatura-recorrente..HEAD --stat`.

- Banco: `contratacoes`, `cobrancas`, `eventos_pagamento` e a nova `minha_situacao()`, numa migração que só acrescenta.
- Servidor: `assinatura` (criar, conferir, cancelar), `mp-webhook` com HMAC e o novo `mp-reconciliar`.
- App: planos com renovação, "Assinar agora", "Preparando checkout...", tela de confirmação, Minha conta com situação, próxima cobrança, histórico e cancelar.
- Termos e documentação.

## C. Como funciona agora

Escolhe o plano, toca em Assinar agora, o servidor cria um link próprio, a pessoa paga no Mercado Pago, volta, e o app confere com o servidor até confirmar. Só cobrança aprovada libera acesso. Detalhes: `docs/assinatura-arquitetura.md`.

## D. Mercado Pago

**Modelo escolhido: um plano por tentativa** (`POST /preapproval_plan`), sem e-mail. É a alternativa C sem o link compartilhado: cada tentativa tem o seu.

| Prova na conta de teste | Resultado |
|---|---|
| Assinatura pendente, sem conta, mesmo e-mail | Aprovada |
| Assinatura pendente, sem conta, outro e-mail | **Bloqueada** |
| Link do plano, sem conta | Aprovado, e identificável pelo plano e pela referência da fatura |
| Subir o valor depois da 1ª cobrança | Funcionou |
| Plano anual, 12 meses | Aceito na criação, sem pagamento feito |
| Cancelar | Funcionou. A palavra da documentação (`canceled`) é recusada: só `cancelled` passa |

**Desvio consciente:** o guia oficial recomenda não criar plano por assinante. Se o Mercado Pago limitar isso, a volta é a assinatura com o e-mail da conta.

## E. Segurança

Token e segredos só nos segredos das funções. O app manda só o plano; preço, conta e status vêm do servidor. Aviso sem assinatura válida recebe 401, e o estado é sempre relido do Mercado Pago. Tabelas novas fechadas ao público, funções de escrita só com `service_role`, logs sem e-mail nem token. `MP_COLLECTOR_ID` barra token do ambiente errado.

## F. Testes (resultados reais)

| Teste | Resultado |
|---|---|
| Servidor (`node --test`) | 12 de 12 |
| Ponta a ponta com as funções reais e Mercado Pago de mentira | 43 de 43 |
| App no navegador (`conta.test`, `sincronizar.e2e`) | 0 falha |
| Tipos (`deno check`) | 0 erro |
| Lint (`deno lint`) | 0 erro, com a regra `no-explicit-any` desligada |
| Fumaça no projeto de teste com o Mercado Pago de teste | 14 de 14 |
| App real no projeto de teste até o link do checkout | Sem campo de e-mail, sem erro de JavaScript |
| Prova do teste: reintroduzi o defeito dos dias somados | O teste pegou |

Matriz da missão: testes 1 a 3 feitos só em partes. Testes 4 a 11 cobertos com Mercado Pago de mentira. Teste 12: não há build no app e a instalação limpa não foi refeita.

Não foi feita segunda revisão depois das correções da revisão independente.

## G. Publicação

Nada publicado. Produção segue com pagamento único, funções `assinatura` v12 e `mp-webhook` v10. O app é PWA fora das lojas, então as regras de cobrança das lojas não se aplicam hoje. Se for para loja, valem Google Play Billing e Compra no App (`docs/assinatura.md`).

## H. O que depende do Daniel

1. Fazer o teste de `docs/teste-assinatura.md`.
2. Decidir a regra de devolução, inclusive quando o mesmo link for pago duas vezes.
3. Definir se o Pix faz falta: sem conta, a tela do teste mostrou cartão de crédito e boleto. Só a conta real mostra o que aparece lá.
4. Autorizar a ida à produção (lista em `docs/assinatura.md`).
5. Ligar o SMTP antes de abrir para clientes.
6. Definir o foco da semana nova.

## I. Evidências

Ids de teste: assinatura pendente paga `84339462db8b402d8844bc7e67370ae9`, assinatura pelo plano `c31f101f2dcc469d9426fa70f0933e1c`, plano `821672404bd6457d91e0f31b7855dd82`. Prints do checkout ficaram na conversa de 05/11. Prints do app: `testes/prints/`.

## Critérios da missão

| Critério | Estado |
|---|---|
| Auditoria, arquitetura documentada, modelo validado | Feito |
| E-mail fora da contratação | Feito: nem o app nem o servidor pedem. Quem paga digita o e-mail na página do Mercado Pago |
| Backend criando, URL oficial retornada | Feito no projeto de teste |
| Checkout no dispositivo e retorno ao app | **Falta**: checkout provado no navegador do PC, volta só simulada |
| Concluir a contratação pelo app | **Falta** |
| Webhook validado criptograficamente | Parcial: HMAC provado com o segredo real, aviso real ainda não chegou |
| Banco atualizado, plano só após confirmação, cancelamento | Feito com Mercado Pago de mentira, **falta** pelo app real |
| Tratamento de falhas, testes automatizados | Feito |
| Build de produção | Não se aplica: app sem build |
| Configuração de produção documentada | Feito |
| Nenhum segredo exposto | Feito e conferido |
| Política de publicação | Feito |
