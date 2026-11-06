# Roteiro do teste de ponta a ponta

Tudo aqui usa o projeto de teste e dinheiro de teste. Nada é cobrado de verdade. Nunca use cartão real.

## Preparar (o Claude faz)

```sh
node testes/servir-teste.mjs
```

O app abre em `http://localhost:8000`, ligado ao projeto de teste. As contas prontas estão em `~/.caderninho/teste.env`: `CONTA1_EMAIL`, `CONTA1_SENHA`, `CONTA2_EMAIL`, `CONTA2_SENHA`.

Cartão de teste: `5480 8328 0103 3311`, validade `11/30`, código `123`, CPF `12345678909`. O nome no cartão decide o resultado: `APRO` aprova, `OTHE` recusa.

## Roteiro

| # | Faça | Deve acontecer |
|---|---|---|
| 1 | Entre com a conta 1, toque em Assinar, escolha Mensal e **Assinar agora** | Sem campo de e-mail. Botão mostra "Preparando checkout..." e abre o Mercado Pago |
| 2 | Pague sem conta, com cartão `APRO` e um e-mail qualquer | Mercado Pago mostra pagamento aprovado |
| 3 | Volte ao app em `http://localhost:8000` | "Estamos confirmando sua assinatura." e depois plano ativo. A volta do Mercado Pago cai no site publicado: é esperado neste teste, volte para a aba do `localhost` |
| 4 | Abra Minha conta | Plano mensal, ativa, próxima cobrança com R$ 19,90 |
| 5 | O Claude confere o webhook | Evento em `eventos_pagamento` com resultado `ok` |
| 6 | Toque em Cancelar assinatura | Aviso com a data, cancelada no Mercado Pago, acesso segue até a data |
| 7 | Entre com a conta 2, abra o checkout e feche sem pagar | Conta segue sem plano pago |
| 8 | Conta 2: assine com cartão `OTHE` | Recusa, acesso não libera, dá para tentar de novo |
| 9 | Conta 2: assine o Anual com `APRO` | Plano anual ativo, R$ 149,90 |

Anote qualquer diferença com um print.
