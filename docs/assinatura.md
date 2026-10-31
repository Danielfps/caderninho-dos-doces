# Como ligar a assinatura

Este guia instala o servidor da assinatura mensal do Caderninho de Fiado. As vendas, os clientes e os dados do caderninho continuam no aparelho. O Supabase guarda a conta e a situação da assinatura.

O preço inicial de R$ 9,90 é provisório. Daniel ainda vai decidir o valor final.

## 1. Aplicar a migração

Na pasta do projeto, instale e configure a CLI do Supabase, vincule o projeto e aplique as migrações:

```sh
supabase login
supabase link --project-ref ID_DO_PROJETO
supabase db push
```

A migração `supabase/migrations/202610310001_assinatura.sql` cria `planos`, `assinaturas` e a função `minha_situacao()`. O preço mensal pode ser lido por qualquer pessoa, mas cada conta só pode ler a própria assinatura. O app não pode gravar assinaturas.

## 2. Configurar os segredos

No painel do Mercado Pago, crie ou abra a integração do Caderninho e copie o Access Token. Em Webhooks, gere ou copie a assinatura secreta. Nunca coloque esses valores no app, nos arquivos do repositório ou em mensagens públicas.

Cadastre os valores como segredos do projeto Supabase:

```sh
supabase secrets set MP_ACCESS_TOKEN="TOKEN_DO_MERCADO_PAGO"
supabase secrets set MP_WEBHOOK_SECRET="SEGREDO_DO_WEBHOOK"
supabase secrets set APP_URLS="https://danielfps.github.io/caderninho-dos-doces/,http://localhost:8000/"
```

O Supabase já fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` às Edge Functions. Não crie ou publique a chave `service_role` no app.

`APP_URLS` aceita uma lista separada por vírgula. Ela serve para o CORS e para validar o endereço de volta do checkout. A URL do app precisa ser exatamente uma das URLs da lista. Um endereço que não estiver nela volta para a primeira URL configurada.

## 3. Publicar as funções

```sh
supabase functions deploy assinatura
supabase functions deploy mp-webhook --no-verify-jwt
```

A função `assinatura` exige o JWT da pessoa. A função `mp-webhook` não exige JWT do Supabase porque é chamada pelo Mercado Pago. Ela valida o `x-signature` com `MP_WEBHOOK_SECRET` antes de consultar ou alterar qualquer assinatura.

## 4. Cadastrar o Webhook no Mercado Pago

No painel do Mercado Pago, abra **Suas integrações**, escolha a aplicação e vá em **Webhooks** ou **Configurar notificações**. Cadastre a URL abaixo, trocando `ID_DO_PROJETO` pelo identificador do projeto Supabase:

```text
https://ID_DO_PROJETO.supabase.co/functions/v1/mp-webhook
```

Ative os tópicos de assinaturas sem plano associado:

- `subscription_preapproval`
- `subscription_authorized_payment`

Confirme que a assinatura secreta gerada no painel corresponde a `MP_WEBHOOK_SECRET`. A função confirma a autenticidade usando o HMAC-SHA256 do manifesto com `data.id`, `x-request-id` e `ts`. O Mercado Pago pode reenviar eventos, então a função consulta o estado atual da assinatura antes de gravar. Avisos de um link antigo da mesma conta só valem se forem de pagamento autorizado (ex.: a pessoa abriu o pagamento duas vezes e pagou pelo primeiro); aviso antigo de link pendente ou cancelado não rebaixa a assinatura guardada.

## 5. Testar antes de abrir para clientes

1. Use as credenciais de teste do Mercado Pago e uma aplicação de teste. Não misture o Access Token de teste com o segredo de Webhook de produção.
2. Crie uma conta de teste no app. Os três dias de teste começam em `auth.users.created_at`, calculados pelo relógio do servidor.
3. Toque em assinar, confira se o Mercado Pago abre o checkout e conclua o fluxo usando usuários e cartões de teste fornecidos pelo Mercado Pago para o seu país e ambiente.
4. Volte ao app e use **Já paguei, conferir**. A função consulta a assinatura no Mercado Pago e atualiza a situação, mesmo que o aviso ainda não tenha chegado.
5. Confira também o histórico de entregas em Webhooks no painel do Mercado Pago e os logs das Edge Functions no Supabase.

Depois dos testes, cadastre a URL de produção no modo de produção, configure o Access Token e o segredo de Webhook de produção, publique as funções e repita um fluxo controlado. Não use cartão real para testar.

## 6. Ligar o app (e desligar o modo de teste)

Em `app/index.html`, preencha `CONTA_URL` e `CONTA_CHAVE` (veja `docs/conta.md`). Com os dois preenchidos, o modo de teste some sozinho: o botão 🧪, o painel e o pagamento de mentira só existem enquanto eles estão vazios. Rode o teste do app (`node testes/conta.test.mjs`) **antes** de preencher, porque ele usa o modo de teste.

## 7. Trocar o preço provisório

Para definir outro preço, aplique no SQL Editor do Supabase:

```sql
update public.planos
set valor = 12.90
where id = 'mensal';
```

Troque `12.90` pelo valor aprovado. A função lê o preço dessa tabela ao iniciar uma assinatura nova, portanto não é preciso mudar o app nem republicar as funções. Assinaturas já criadas no Mercado Pago mantêm o valor configurado quando foram criadas. Uma alteração de preço para assinantes atuais exige atualizar essas assinaturas pela API do Mercado Pago e deve ser planejada separadamente.

## Pontos de atenção

- O Mercado Pago exige `payer_email` ao criar uma assinatura sem plano e diz que o e-mail identifica o pagador. A documentação consultada não afirma que ele precisa ser o e-mail da conta Mercado Pago. O fluxo de assinatura também permite pagar sem conta Mercado Pago. Por isso, o campo do app é opcional: sem outro e-mail, o servidor usa o e-mail da conta do Caderninho. Se a pessoa pagar com outro e-mail, vale testar essa combinação com uma conta de teste antes de abrir para clientes. [Referência da API para criar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post), [visão geral de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview).
- **Nunca duas cobranças:** se a pessoa já tem um link pendente com o mesmo preço e e-mail, o app reaproveita esse link. Se mesmo assim ela concluir dois pagamentos, o servidor (no aviso e no "conferir") cancela no Mercado Pago a assinatura autorizada mais nova e fica com a mais antiga. O primeiro mês pago a mais precisa ser devolvido à mão pelo painel do Mercado Pago (o log da função mostra "Assinatura duplicada cancelada").
- O Mercado Pago pode demorar para entregar avisos. O botão de conferência busca o estado diretamente, mas ainda depende da disponibilidade da API do Mercado Pago.
- Assinatura ativa dá três dias de tolerância depois de `valido_ate`. Assinatura pausada, cancelada ou com um link novo pendente libera até `valido_ate`, sem retirar um período já pago. O teste grátis de três dias continua valendo como prazo mínimo de acesso.
- O valor R$ 9,90 é só um valor inicial provisório. Confirme o preço antes de divulgar o app.
- O projeto Supabase precisa continuar ativo para validar as contas, receber avisos e responder ao botão de conferência. Confira as condições do plano escolhido antes de abrir para clientes.
- O Webhook responde com erro se o Mercado Pago ou o banco falhar, para permitir nova tentativa do aviso. A assinatura HMAC é conferida antes de processar os dados. [Documentação de Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).
