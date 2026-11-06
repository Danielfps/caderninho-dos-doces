# Auditoria do sistema de assinatura (05/11/2026)

Relatório interno feito antes de alterar o código. Retrato do ramo `claude/fiado-ligar-servidor`, commit `9bd1f1c`, igual ao `main` publicado no repositório `Danielfps/caderninho-de-fiado`. Marca de volta: tag `antes-assinatura-recorrente`. Cópia completa do repositório: `../backups/caderninho-antes-assinatura-recorrente-2026-11-05.bundle`.

## 1. Arquitetura encontrada

| Parte | O que existe |
|---|---|
| App | PWA de um arquivo só: `app/index.html` (HTML, CSS e JS puro, sem build e sem dependências), `app/sw.js`, `app/manifest.webmanifest`. Não é React, Flutter nem Expo. Não há projeto Android ou iOS |
| Navegação | Telas desenhadas por `render()` e janelas por `abrir()`. Cliques num único listener por `data-act` |
| Distribuição | GitHub Pages (`.github/workflows/pages.yml`), instalado pelo navegador. Fora das lojas, por decisão do Daniel |
| Conta | Supabase Auth via `fetch`, com proteção em 2 etapas opcional. E-mail em `auth.users` |
| Banco | Supabase Postgres, projeto `gwgwivkqhssmuqlyjkon` (us-west-2) |
| Tabelas de pagamento | `planos` (3 linhas), `compras` (pagamento único, em uso), `assinaturas` (antiga, fora do cálculo de acesso desde `f17126b`) |
| Servidor | Edge Functions `assinatura` (`verify_jwt` ligado) e `mp-webhook` (`verify_jwt` desligado) |
| Notificações | Só avisos dentro do app. Não há push |
| Testes | `testes/`: Node, Playwright e Supabase de mentira com PGlite, que roda as migrações de verdade. O servidor de mentira imita as funções em JS, então as Edge Functions em si não eram exercitadas |
| Segredos no Supabase | `MP_ACCESS_TOKEN` (real desde 05/11, 01:36 UTC), `MP_WEBHOOK_SECRET` (de 04/11, antes do token real), `APP_URLS` |

Dados de produção lidos só com consultas de leitura: 2 contas confirmadas, 0 compras, 1 linha em `assinaturas` (a assinatura de teste de 04/11, status `ativa`, R$ 14,90) e 48 registros de caderninho. A compra real de R$ 14,90 ainda não entrou no banco.

## 2. Funcionamento do pagamento atual

Hoje não existe assinatura. Desde `f17126b` o app faz pagamento único:

1. `assinatura` com `acao: criar` cria uma preferência do Checkout Pro (`POST /checkout/preferences`) sem e-mail, com `external_reference` igual a `mensal:<uuid>` ou `anual:<uuid>`.
2. O app abre o `init_point` com `location.href`.
3. `mp-webhook` recebe o aviso por `notification_url`, consulta `GET /v1/payments/{id}` e chama `registrar_compra()`.
4. Cada compra soma 30 ou 365 dias. `minha_situacao()` calcula o acesso. Nada renova sozinho.

Antes disso (commit `decfe57`) existia assinatura `POST /preapproval` com `status: pending` para o mensal e Checkout Pro para o anual. É esse o fluxo que a missão manda refazer direito.

## 3. Causa dos campos e etapas extras

O campo "E-mail da sua conta do Mercado Pago" (`pEmail`, em `decfe57:app/index.html:1131`) não veio de exigência da tela. A API pede `payer_email`, e o campo foi um remendo para dois problemas diferentes:

1. **Mistura de teste e real.** Com credencial de teste, o Mercado Pago só aceita e-mail de usuário de teste. O teste com e-mail de verdade falhou e a saída foi deixar a pessoa digitar outro e-mail.
2. **Dúvida sobre o e-mail do comprador.** A referência oficial diz que, em assinatura sem plano, "durante o processo de pagamento, validam..." (o resto do texto fica recolhido na página). Pelo início, é provável que o e-mail seja conferido no pagamento. A regra exata só se resolve no teste prático.

Na segunda etapa, o defeito foi outro: em vez de separar teste de produção e resolver o caso de e-mail diferente, a assinatura inteira foi trocada por pagamento único.

## 4. Erros identificados

| # | Erro | Onde | Consequência |
|---|---|---|---|
| 1 | O cliente mandava `email_pagador` e o servidor aceitava | `decfe57` | O e-mail da assinatura podia ser manipulado |
| 2 | `external_reference` era o id da conta | `decfe57` | Não dava para separar uma tentativa da outra |
| 3 | Duas assinaturas eram corrigidas depois (`cancelarDuplicadas`), sem impedir que nascessem | `decfe57` | Risco de cobrança dupla |
| 4 | Sem tratamento para resposta perdida ao criar a assinatura | `decfe57` | Cada novo toque podia criar outra assinatura |
| 5 | Validade vinha de `next_payment_date` do Mercado Pago, sem cobrança aprovada | `decfe57` | Assinatura autorizada com pagamento pendente podia liberar acesso |
| 6 | Webhook atual não valida `x-signature`, e `MP_WEBHOOK_SECRET` está sem uso | `mp-webhook/index.ts` | Só confere pela consulta ao Mercado Pago, abaixo do exigido |
| 7 | Um único projeto Supabase faz papel de teste e de produção | infraestrutura | Não dá para testar sem mexer em produção |
| 8 | `APP_URLS` aceita `localhost` no servidor de produção | segredo `APP_URLS` | Endereço de volta inválido em produção |
| 9 | Linha de teste `ativa` em `assinaturas` no banco de produção | banco | Inofensiva hoje, mas liberaria acesso se a tabela voltasse a contar |
| 10 | `CLAUDE.md` cita `calcularLiberadoAte()`, que não existe mais | documentação | Instrução errada |
| 11 | Sem `.env.example` | repositório | Faltava a lista das variáveis |
| 12 | Cancelar usava `cancelled`, e a documentação atual escreve `canceled` | `decfe57` | A grafia aceita precisa de prova na API |
| 13 | Não havia cancelamento pelo app | `decfe57` | Cliente dependia do Mercado Pago para cancelar |
| 14 | SMTP não configurado no Supabase | infraestrutura | Cliente real não recebe o e-mail de confirmação da conta |

## 5. Alternativas da documentação atual

Fontes: referência `create-preapproval` e `create-preapproval-plan`, páginas de assinatura com plano e sem plano, e o guia oficial do plugin do Mercado Pago (`references/guides/subscriptions.md`, atualizado em 21/08/2026).

| | A. Com plano e `card_token_id` | B. Sem plano, `status: pending` | C. Link do plano (`init_point` do plano) |
|---|---|---|---|
| Checkout hospedado | Não. O cartão é capturado na nossa tela | Sim. Cria e redireciona ao `init_point` | Sim |
| Precisa de `payer_email` | Sim | Sim | Não |
| Identifica a tentativa | Sim | Sim, `external_reference` por tentativa | Não. O link é igual para todos e o plano não tem `external_reference` de entrada documentado |
| Valor definido pelo servidor | Sim | Sim | Sim |
| Prova já feita | Nenhuma | Em 04/11: 201, `init_point`, cobrança de R$ 14,90 aprovada, `authorized` com `next_payment_date` | Nenhuma |
| Veredito | Rejeitada: exige formulário de cartão no app | **Escolhida** | Rejeitada: não liga a compra à conta com segurança. Plano por pessoa o guia oficial manda não fazer |

Checkout Pro (o atual) fica de fora para novas contratações, porque é cobrança única.

## 6. Arquitetura recomendada

Alternativa B, descrita em `docs/assinatura-arquitetura.md`. Pontos centrais:

- Cada tentativa é uma linha em `contratacoes`, e o id dela vai no `external_reference`. Índice único impede duas contratações vivas por conta.
- O servidor decide preço, frequência e e-mail. O app só manda o plano.
- Acesso nasce de cobrança aprovada em `cobrancas`, nunca de `authorized` sozinho, da volta ao app ou de parâmetro de URL.
- Webhook com HMAC. Depois de validar, o servidor lê o estado no Mercado Pago. A conferência pelo app usa o mesmo caminho e corrige divergências.
- Ambiente de teste separado: segundo projeto Supabase e token de teste, sem tocar em produção.

**Pendente de prova:** a regra do e-mail e o que acontece se a pessoa pagar com outra conta do Mercado Pago. Se o teste mostrar bloqueio, entra uma saída de exceção depois da falha, fora da tela de contratação.

## 7. Arquivos que serão modificados

- Novo: `supabase/migrations/202611060001_assinatura_recorrente.sql`, `supabase/functions/_shared/contratacao.ts`, `supabase/functions/mp-reconciliar/index.ts`, `supabase/.env.example`, `testes/mp-falso.mjs`, `testes/assinatura.e2e.mjs`, `testes/rodar-funcoes.ts`.
- Alterados: `supabase/functions/assinatura/index.ts`, `supabase/functions/mp-webhook/index.ts`, `supabase/functions/_shared/servidor.ts`, `supabase/functions/_shared/assinatura.mjs`, `supabase/functions/_shared/pagamentos.ts`, `supabase/config.toml`, `app/index.html`, `app/sw.js`, `testes/supabase-falso.mjs`, `testes/assinatura.test.mjs`, `testes/conta.test.mjs`, `docs/assinatura.md`, `docs/termos-rascunho.md`, `CLAUDE.md`.
- Sem mudança: caderninho, planilha, guardar na conta, conta e proteção em 2 etapas. Tabelas `compras` e `assinaturas` ficam intactas.

## 8. Riscos e prevenção

| Risco | Prevenção |
|---|---|
| Quebrar o pagamento que está no ar | Nada vai para produção sem autorização. Trabalho em ramo próprio, com tag e bundle de volta |
| Cobrança real em teste | Testes reais só com token de teste no projeto de teste. `MP_COLLECTOR_ID` trava cada ambiente na sua conta |
| Migração apagar dado | Migração só acrescenta. `compras` continua valendo no cálculo do acesso, e `assinaturas` fica como histórico |
| Perder o Pix | A documentação geral lista Pix em assinaturas, mas a experiência de 02/11 e 04/11 não confirmou. O app não vai prometer meio de pagamento: a escolha fica na página do Mercado Pago |
| E-mail da conta diferente do e-mail do Mercado Pago | Teste prático antes de publicar, com saída de exceção se precisar |
| Reajuste do 1º mês para R$ 19,90 falhar | `PUT` repetido a cada sincronização até o Mercado Pago confirmar. Precisa de prova em teste |
| Notificação não chegar em teste | Conferência pelo app funciona sem webhook, e a validação de HMAC tem teste automatizado |

## Atualização depois dos testes práticos (05/11/2026, à noite)

Os testes na conta de teste mudaram o veredito da seção 5.

- **B, assinatura pendente:** aprovada só com e-mail igual ao `payer_email`. Com outro e-mail, o Mercado Pago bloqueia ("Seu e-mail não corresponde ao da assinatura"). A API também recusa e-mail que não existe lá. Essa é a causa real do campo de e-mail.
- **C com um plano por tentativa:** aprovado sem conta, com qualquer e-mail, e identificável, porque cada link é único. Não é o link compartilhado que a seção 5 rejeitou.

Decisão final: plano por tentativa. Detalhes e fatos em `docs/assinatura-arquitetura.md`.
