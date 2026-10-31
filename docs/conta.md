# Minha conta — como ligar

A tela "Minha conta" (o bonequinho no alto, ao lado da engrenagem) usa o **Supabase Auth**: ele guarda
as contas, manda os e-mails de confirmação e de "esqueci minha senha" e cuida da proteção em 2 etapas.
O app fala com ele direto pelo navegador (só `fetch`, sem biblioteca), então continua sem build.

Enquanto o projeto do Supabase não estiver ligado, o app funciona igual e "Minha conta" mostra "Em breve".

## O que a conta guarda

- Nome (em `user_metadata.nome`), e-mail e senha (a senha fica só no Supabase, com hash).
- Se a pessoa ligar: o aplicativo de códigos da proteção em 2 etapas (TOTP — Google Authenticator,
  Microsoft Authenticator etc.).
- **As vendas, clientes e doces continuam só no celular.** Nada disso vai para o Supabase.
- No celular, a entrada na conta fica em `localStorage['caderninho-conta']`, separada dos dados do caderninho.

## Passo a passo (uma vez só)

1. **Criar o projeto** em <https://supabase.com> → *New project*. Plano grátis serve.
   Região: *South America (São Paulo)*. Guarde a senha do banco num lugar seguro (o app não usa).
2. **Pegar o endereço e a chave pública**: *Project Settings → API Keys* (ou *Data API*).
   - `Project URL` → algo como `https://abcdefghij.supabase.co`
   - a chave **pública**: `anon` / `publishable` (começa com `eyJ…` ou `sb_publishable_…`).
   - ⚠️ **Nunca** use a chave `service_role` / `secret` no app. Ela dá acesso total.
3. **Colocar no app**: em `app/index.html`, procure `CONTA_URL` e `CONTA_CHAVE` e preencha.
   (Ou mande os dois para o Claude Code fazer isso.) A chave pública pode ficar no código: é feita para isso.
4. **Endereços de volta** — *Authentication → URL Configuration*:
   - Site URL: `https://danielfps.github.io/caderninho-dos-doces/`
   - Redirect URLs: `https://danielfps.github.io/caderninho-dos-doces/**`
     (para testar no computador, adicione também `http://localhost:8000/**`)
5. **Cadastro por e-mail** — *Authentication → Sign In / Providers → Email*:
   - Email ligado e **Confirm email** ligado (é o que valida o e-mail da pessoa).
   - *Minimum password length*: 8 (o app já pede 8).
6. **Proteção em 2 etapas** — *Authentication → Multi-Factor*: deixe **TOTP** ligado (já vem ligado).
7. **Mandar e-mails de verdade (obrigatório antes de abrir para clientes)** — o e-mail que vem pronto no
   Supabase só manda para quem é da equipe do projeto e tem limite de poucos e-mails por hora.
   Em *Authentication → Emails → SMTP Settings*, ligue um serviço de e-mail (Resend, Brevo, Amazon SES…;
   os dois primeiros têm plano grátis). Remetente sugerido: `Caderninho dos Doces <nao-responda@seu-dominio>`.
8. **E-mails em português** — *Authentication → Emails → Templates*. Sugestões abaixo.

### Modelo "Confirm signup"

Assunto: `Confirme seu e-mail no Caderninho dos Doces`

```html
<h2>Falta só um passinho 🍰</h2>
<p>Oi, {{ .Data.nome }}! Toque no botão abaixo para confirmar seu e-mail e terminar de criar sua conta no Caderninho dos Doces.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d6456f;color:#fff;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:bold">Confirmar meu e-mail</a></p>
<p>Se não foi você que criou a conta, é só ignorar este e-mail.</p>
```

### Modelo "Reset Password"

Assunto: `Criar uma senha nova no Caderninho dos Doces`

```html
<h2>Vamos criar uma senha nova</h2>
<p>Toque no botão abaixo para escolher uma senha nova para o Caderninho dos Doces.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#d6456f;color:#fff;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:bold">Criar senha nova</a></p>
<p>Se não foi você que pediu, é só ignorar este e-mail. Sua senha continua a mesma.</p>
```

## Como funciona por dentro

- Chamadas usadas (todas em `/auth/v1/`): `signup`, `token?grant_type=password`,
  `token?grant_type=refresh_token`, `user` (GET/PUT), `recover`, `resend`, `logout?scope=local`,
  `factors` (criar/apagar), `factors/{id}/challenge` e `factors/{id}/verify`.
- O link do e-mail volta para o app com a entrada no `#` do endereço (`#access_token=…&type=signup` ou
  `type=recovery`); o app guarda, limpa o endereço e abre "Minha conta" ou "Crie uma senha nova".
  Link vencido volta com `#error_code=otp_expired` e o app explica.
- Com a proteção em 2 etapas ligada, depois da senha o app pede o código de 6 números antes de considerar a
  pessoa dentro da conta (a entrada só vale quando o token tem `aal2`).
- Erros do Supabase viram frases simples em `ERROS` (`app/index.html`).
- No iPhone, o app instalado na tela de início e o Safari não dividem os dados. Se a pessoa confirmar o
  e-mail pelo Safari, depois é só abrir o app instalado e tocar em "Entrar".
- Projeto grátis do Supabase **pausa depois de 7 dias sem uso**; quando tiver clientes de verdade,
  vale o plano pago ou pelo menos ficar de olho.

## Próximo passo: pagamento

A conta é a base para o pagamento: cada pessoa tem um `id` fixo no Supabase (`auth.users`). O plano é
criar uma tabela (ex.: `assinaturas`, com `user_id`, situação e validade, protegida por RLS) e uma
Edge Function que recebe o aviso do Mercado Pago e atualiza essa tabela. O app só lê a situação da
própria pessoa.
