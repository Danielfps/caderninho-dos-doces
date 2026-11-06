# Arquitetura da assinatura recorrente

Fonte da verdade do desenho. Decisões do arquiteto (Claude). Quem implementar e achar um problema avisa antes de mudar o desenho.

## Regras que não podem ser quebradas

1. O app só informa `plano`. Preço, moeda, frequência, e-mail, id da conta e status vêm do servidor.
2. Acesso pago nasce só de **cobrança aprovada** registrada em `cobrancas`. Nunca de `authorized` sozinho, da volta ao app ou de parâmetro de URL.
3. No máximo uma contratação viva por conta, garantido por índice único no banco.
4. Token, segredo de webhook, chave `service_role`, e-mail e dados de cartão nunca aparecem em log nem na resposta ao app.
5. Webhook sem assinatura válida não processa nada. Com assinatura válida, o estado é relido do Mercado Pago.
6. Tudo é idempotente: repetir aviso, conferência ou toque não muda o resultado.
7. `compras` antigas continuam valendo. Nenhum dado é apagado.
8. Telas em português simples, sem jargão e sem travessão.

## Fluxo

1. App: `POST functions/v1/assinatura` com `{acao:"criar", plano}`.
2. Servidor: confere sessão e e-mail confirmado, e chama `iniciar_contratacao()`, que decide sob trava por conta.
3. Servidor: `POST /preapproval` com `status: "pending"`, `payer_email` da conta, `external_reference` igual ao id da contratação, `auto_recurring` montado no banco e `back_url`.
4. Servidor grava `mp_preapproval_id` e `init_point`, e devolve `{init_point, contratacao_id}`.
5. App confere o domínio, marca `caderninho-pagando` e abre o `init_point`.
6. Mercado Pago volta ao `back_url`. App mostra "Estamos confirmando sua assinatura." e chama `conferir` com intervalos crescentes, até 90 segundos.
7. Webhook e `conferir` chamam `sincronizarContratacao()`, que lê o Mercado Pago, grava cobranças e aplica o estado.
8. `minha_situacao()` devolve plano, estado, validade, próxima cobrança e histórico.

## Corpo do `POST /preapproval`

```json
{
  "reason": "Caderninho de Fiado: 1º mês R$ 14,90, depois R$ 19,90/mês",
  "external_reference": "<id da contratacao>",
  "payer_email": "<e-mail do Supabase Auth>",
  "auto_recurring": { "frequency": 1, "frequency_type": "months", "transaction_amount": 14.90, "currency_id": "BRL" },
  "back_url": "<primeiro endereço https de APP_URLS>",
  "status": "pending"
}
```

Anual: `frequency: 12`, valor de `planos.anual`, sem promoção. Sem `start_date`: a 1ª cobrança acontece ao concluir o checkout. A API não documenta idempotência em `/preapproval`, então a proteção é nossa: mesma tentativa, mesmo `external_reference`, e busca antes de recriar.

## Banco (`202611060001_assinatura_recorrente.sql`)

Só acrescenta. RLS ligado e sem acesso direto de `anon` e `authenticated` nas tabelas novas. `planos` mantém a leitura pública atual.

**`planos`:** novas colunas `meses int`, `moeda text default 'BRL'`, `descricao text`. `mensal` e `mensal_promo` = 1 mês, `anual` = 12.

**`contratacoes`:** uma linha por tentativa, que vira a assinatura.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | vai no `external_reference` |
| `user_id` | uuid fk `auth.users` on delete set null | histórico financeiro sobrevive à conta |
| `plano` | text | `mensal` ou `anual` |
| `valor_inicial`, `valor_recorrente` | numeric(10,2) | preço gravado na contratação |
| `moeda` | text | `BRL` |
| `estado` | text | ver máquina de estados |
| `mp_preapproval_id` | text unique | |
| `mp_status`, `mp_atualizado_em` | text, timestamptz | último estado lido e `last_modified` |
| `init_point` | text | link da tentativa |
| `proxima_cobranca`, `autorizada_em`, `cancelada_em`, `sincronizada_em` | timestamptz | |
| `expira_em` | timestamptz | `criado_em` + 24 h |
| `criado_em`, `atualizado_em` | timestamptz | |

Índice único parcial em `user_id` onde `estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento')`.

**`cobrancas`:** uma linha por fatura do Mercado Pago. `mp_cobranca_id` pk, `contratacao_id`, `user_id`, `mp_pagamento_id`, `valor`, `estado` (`pendente`, `aprovada`, `recusada`, `estornada`), `mp_status`, `mp_pagamento_status`, `debitada_em`, `valido_de`, `valido_ate`, `criado_em`, `atualizado_em`.

**`eventos_pagamento`:** registro dos avisos. `id` bigint, `chave` unique (`tipo:data.id:x-request-id`), `tipo`, `acao`, `mp_id`, `ao_vivo`, `recebido_em`, `repeticoes`, `resultado` (`recebido`, `ok`, `ignorado`, `erro`), `detalhe` curto e sem dados pessoais.

**`assinaturas`:** recebe `comment on table` como legado. Não entra no cálculo.

### Funções (todas `security definer`, `search_path=''`, exigem `service_role`)

- `iniciar_contratacao(p_user, p_plano) returns jsonb`, com `pg_advisory_xact_lock` por conta. Lê preços de `planos`, decide a promoção e devolve `acao`:
  - `plano_indisponivel`: plano desligado.
  - `limite`: 10 tentativas em 1 hora.
  - `ja_ativa`: existe contratação `ativa` ou `aguardando_pagamento`.
  - `substituir` (com `id` e `mp_preapproval_id`): existe `falha_pagamento`, `pausada`, ou `checkout_pendente` vencida ou com plano ou preço diferente. O servidor cancela no Mercado Pago, chama `fechar_contratacao` e chama `iniciar_contratacao` de novo. Sem cancelamento confirmado não nasce outra.
  - `reusar` (com `id` e `init_point`): `checkout_pendente` válida, com mesmo plano e mesmo preço.
  - `em_andamento`: `checkout_pendente` sem `init_point` criada há menos de 20 s.
  - `retomar` (com os dados da tentativa): `checkout_pendente` sem `init_point` há 20 s ou mais. O servidor busca por `external_reference` antes de criar de novo.
  - `criar` (com os dados da nova tentativa).
- `gravar_checkout(p_id, p_mp_id, p_init_point, p_mp_status)`.
- `fechar_contratacao(p_id, p_estado)`: aceita só `abandonada` e `cancelada`.
- `aplicar_preapproval(p_id, p_mp_id, p_status, p_ultima_mudanca, p_proxima)`: aplica a máquina de estados e devolve o estado final, mais `duplicada` e `cancelar_no_mp`.
- `registrar_cobranca(p_id, p_contratacao, p_pagamento, p_valor, p_estado, p_mp_status, p_pag_status, p_debitada)`: idempotente.
- `registrar_evento(...)` e `concluir_evento(...)`.
- `minha_situacao()`: reescrita (ver abaixo), para `authenticated`.

## Máquina de estados

Estados internos ficam em `contratacoes.estado`. `FREE` e `EXPIRED` não são linha: saem do cálculo da conta.

| Interno | Referência da missão | Quando | Acesso pago |
|---|---|---|---|
| sem contratação viva e sem validade | `FREE` | | só teste grátis |
| `checkout_pendente` | `CHECKOUT_PENDING` | tentativa criada, MP `pending` | não |
| `aguardando_pagamento` | `PENDING` | MP `authorized`, sem cobrança aprovada | não |
| `ativa` | `ACTIVE` | MP `authorized`, última cobrança aprovada | até `pago_ate` + 3 dias |
| `falha_pagamento` | `PAYMENT_FAILED` | MP `authorized`, última cobrança recusada | até `pago_ate` + 3 dias |
| `pausada` | `PAUSED` | MP `paused` | até `pago_ate` |
| `cancelada` | `CANCELED` | MP `cancelled` ou `canceled` | até `pago_ate` |
| `encerrada` | | MP `finished` ou `expired` | até `pago_ate` |
| `abandonada` | | tentativa substituída ou vencida | não |
| sem contratação viva, `pago_ate` no passado | `EXPIRED` | | não |

Transições:

- `checkout_pendente` → `aguardando_pagamento` (MP `authorized`) → `ativa` (cobrança aprovada).
- `checkout_pendente` → `ativa` direto, se a leitura já trouxer `authorized` e cobrança aprovada.
- `checkout_pendente` → `abandonada` (substituída ou vencida).
- `ativa` ↔ `falha_pagamento`, conforme a última cobrança.
- `ativa`, `falha_pagamento`, `aguardando_pagamento` ↔ `pausada`.
- Qualquer estado vivo → `cancelada` ou `encerrada`. Essas duas são finais: nada as tira de lá.
- `abandonada` + MP `authorized`: a pessoa concluiu um link antigo. Se não houver outra contratação paga, ela volta a valer e uma `checkout_pendente` aberta é fechada. Se houver outra `ativa`, a mais nova é cancelada no Mercado Pago e o caso fica no log.
- Leitura com `last_modified` mais antigo que `mp_atualizado_em` não muda o estado (aviso fora de ordem).

## Validade de cada cobrança aprovada

Período: `interval '1 month'` para mensal, `'12 months'` para anual.

- Renovação da mesma contratação, com cobrança anterior aprovada: início no fim do período anterior. Se o intervalo passar de 15 dias, início na data da cobrança.
- Primeira cobrança da contratação: início no maior entre data da cobrança, fim do teste grátis e maior validade paga da conta. Quem assina durante o teste grátis não perde dias, e quem troca de plano soma.

`pago_ate` é o maior `valido_ate` entre `cobrancas` aprovadas e `compras` aprovadas. Estorno muda a cobrança para `estornada`, e `pago_ate` recua sozinho.

`liberado_ate` = maior entre `teste_ate` e `pago_ate`, somando 3 dias a `pago_ate` quando há contratação em `ativa` ou `falha_pagamento`.

## Promoção

R$ 14,90 só na primeira mensal da conta. Disponível enquanto não houver cobrança mensal aprovada nem `compras` mensal aprovada. Depois da 1ª cobrança aprovada, se `auto_recurring.transaction_amount` for menor que `valor_recorrente`, `PUT /preapproval/{id}` com `auto_recurring.transaction_amount`, `auto_recurring.currency_id` e novo `reason`. Falhou: registra e tenta na próxima sincronização.

## Regra de cobrança aprovada

Vale como aprovada só se: `status` da fatura `processed`, `payment.status` igual a `approved`, moeda `BRL`, valor maior ou igual ao menor entre `valor_inicial` e `valor_recorrente`, e a assinatura pertencer à contratação (`external_reference`, `collector_id`). Campos conhecidos da API, vistos em 04/11: `id`, `preapproval_id`, `type`, `status`, `transaction_amount`, `retry_attempt`, `debit_date`, `date_created`, `payment.id`, `payment.status`, `payment.status_detail`. Em assinatura, `summarized` (não `summary`).

## `sincronizarContratacao(config, contratacao)`

1. Lê `GET /preapproval/{id}`. Sem id guardado, busca `GET /preapproval/search?external_reference=<id>`.
2. Confere `external_reference`, `collector_id` e moeda. Divergiu: não aplica e registra.
3. Se não estiver `pending`, lê `GET /authorized_payments/search?preapproval_id=<id>` e chama `registrar_cobranca` para cada fatura.
4. Chama `aplicar_preapproval`. Se vier `cancelar_no_mp`, cancela no Mercado Pago.
5. Ajusta o valor da promoção se precisar.

## Função `assinatura`

- `criar`: fluxo acima. Respostas de erro: `pedido`, `sem_login`, `insufficient_aal`, `sem_email` (conta sem e-mail confirmado), `ja_ativa` (409), `em_andamento` (409), `limite` (429), `plano_indisponivel` (409), `mp_falhou` (502), `config` (500).
- `conferir`: sincroniza a contratação viva e as abandonadas das últimas 48 h, com pausa mínima de 4 s por contratação. Sem nenhuma contratação na conta, usa `consultarPagamentos` antigo. Responde `{situacao}`.
- `cancelar`: acha a contratação viva da própria conta, sem receber id do app, e faz `PUT /preapproval/{id}` com `{status}`. Depois sincroniza e responde `{situacao}`.

## Função `mp-webhook`

1. Só `POST`. Falta segredo ou `MP_COLLECTOR_ID`: 500.
2. Lê `data.id` da URL e, na falta, do corpo. Lê `type` do corpo e, na falta, da URL (`type`, `topic`).
3. Valida `x-signature` com o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 em hexadecimal, comparação em tempo constante. Parte ausente sai do manifesto, como no SDK oficial 3.6.1. Tenta o id como veio e, se diferente, em minúsculas. Sem janela de tempo: repetir um aviso só provoca nova leitura. Falhou: 401.
4. `registrar_evento`.
5. Por tópico:
   - `subscription_preapproval`: `GET /preapproval/{id}` e sincroniza.
   - `subscription_authorized_payment`: `GET /authorized_payments/{id}`, pega `preapproval_id` e sincroniza.
   - `payment`: `GET /v1/payments/{id}`. `external_reference` em uuid: sincroniza a contratação e trata estorno. `mensal:<uuid>` ou `anual:<uuid>`: caminho antigo de `compras`.
   - Outro tópico: `ignorado`, 200.
6. Recurso inexistente (404): `ignorado`, 200. Falha temporária: `erro`, 502, e o Mercado Pago reenvia.

## Função `mp-reconciliar`

`POST` com cabeçalho `x-reconciliar-chave` igual ao segredo `RECONCILIAR_CHAVE`, comparado em tempo constante. Sincroniza até 50 contratações vivas com `sincronizada_em` há mais de 6 horas ou `proxima_cobranca` vencida. `verify_jwt` desligado. Sem o segredo, responde 500. Agendamento é opcional: o app também pede conferência quando `minha_situacao().conferir` vem verdadeiro.

## `minha_situacao()`

Mantém `agora`, `teste_ate`, `pago_ate`, `plano`, `liberado_ate`, `preco`, `preco_promo`, `preco_anual`, e acrescenta:

```json
{
  "assinatura": { "id": "uuid", "estado": "ativa", "plano": "mensal", "valor": 19.90, "proxima_cobranca": "...", "desde": "...", "cancelada_em": null, "checkout_aberto": false },
  "cobrancas": [ { "data": "...", "valor": 14.90, "estado": "aprovada" } ],
  "conferir": false
}
```

`assinatura` é a contratação viva ou, sem viva, a última que não foi abandonada. `cobrancas` traz no máximo 6. `conferir` é verdadeiro quando a contratação viva não sincroniza há 24 h, ou quando `proxima_cobranca` já passou, ou quando está `aguardando_pagamento`.

## Configuração

`carregarConfig()` exige `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID` e `APP_URLS`. `mp-webhook` exige também `MP_WEBHOOK_SECRET`. `MP_API_URL` é opcional, só para testes, com padrão `https://api.mercadopago.com`.

`MP_COLLECTOR_ID` é o id da conta que recebe em cada ambiente. Toda assinatura, fatura e pagamento lidos ou criados têm o `collector_id` conferido. Divergiu em `criar`: cancela o que nasceu, responde `config` e registra. É isso que impede token de teste em produção e o contrário.

`back_url` usa só endereços `https` de `APP_URLS`. `localhost` nunca vai ao Mercado Pago.

## Falhas previstas

| # | Situação | Tratamento |
|---|---|---|
| 1 | Servidor fora do ar | App não trava: mensagem e tentar de novo. Mercado Pago reenvia o aviso |
| 2 | Aviso não chegou | `conferir` na volta e ao abrir o app, e `mp-reconciliar` |
| 3 | Aviso duplicado | `eventos_pagamento` conta a repetição. Cobrança tem chave única |
| 4 | Aviso fora de ordem | Estado sempre relido, `last_modified` e estados finais |
| 5 | Token inválido | 401 ou 403 viram `mp_falhou`, com causa no log, sem o token |
| 6 | Segredo do webhook errado | 401 e log com `x-request-id`. Conferência continua funcionando |
| 7, 8 | Token do ambiente errado | `MP_COLLECTOR_ID` |
| 9 | `back_url` inválido | Só `https` de `APP_URLS`. Mercado Pago recusando vira `mp_falhou` |
| 10 | App não reconhecido na volta | Sem deep link: volta é `https`. Sem sessão, tela "Falta só voltar ao Caderninho" |
| 11 | App fechado no checkout | Marca `caderninho-pagando`, confere ao abrir |
| 12 | Sem conexão | `chamar()` desiste em 15 s e mostra mensagem |
| 13 | Vários toques | Botão travado, trava por conta e índice único |
| 14 | Erro 400 do Mercado Pago | `mp_falhou` e causa no log, sem dados pessoais |
| 15 | Erro 401 ou 403 | Igual ao 5 |
| 16 | Erro 429 ou 500 | `mp_falhou`, tentar de novo. Em aviso, 502 para reenvio |
| 17 | Criou, mas a resposta não chegou | `retomar` busca por `external_reference` antes de criar |
| 18 | Já tem assinatura | `ja_ativa`, app mostra o plano |
| 19 | Banco não atualiza | Erro antes do 200 faz o Mercado Pago reenviar |
| 20 | Troca de aparelho | Plano vem de `minha_situacao()` |
| 21 | Cancelada no Mercado Pago | Aviso `subscription_preapproval` ou conferência |
| 22 | Preço muda com tentativa aberta | `substituir`, pois o preço não bate |
| 23 | E-mail ausente ou sem confirmar | `sem_email`, app pede para confirmar |
| 24 | App atualiza no checkout | Marca em `localStorage` sobrevive à atualização |
| 25 | Publicação diferente do local | Teste com as funções reais em Deno e no projeto de teste |

## Política de troca de plano

Cancelar e assinar de novo. A nova contratação só nasce sem outra viva, então nunca há duas recorrências. Os dias pagos somam.

## Distribuição

Hoje o app é PWA por link, fora das lojas, então as regras de cobrança das lojas não se aplicam. Se um dia for empacotado para loja, Google Play Billing e In-App Purchase passam a valer para essa versão, com as opções específicas da Apple para o Brasil. Ver `docs/assinatura.md`.
