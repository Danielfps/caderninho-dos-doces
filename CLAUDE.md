# Caderninho dos Doces — contexto para o Claude Code

App de celular (PWA) para uma pessoa que vende doces caseiros anotar fiado: quem pegou, quanto deve,
quem pagou. O histórico de como chegamos aqui está em `docs/historico.md`.

## Quem usa

- Pessoa que vende doces (bolo de pote, palha italiana, trufa…) para colegas e conhecidos, e cobra depois.
- Não é técnica. Usa só no celular, com o polegar.
- Toda a interface é em **português do Brasil, simples e sem jargão** ("Quem está me devendo", "Recebi",
  "Cópia de segurança"). Nada de "sincronizar", "exportar JSON", "registro", etc. nas telas.

## Como é feito

- **Sem build e sem dependências.** Tudo está em `app/index.html` (HTML + CSS + JS puro, num único IIFE).
  Só carrega as fontes Baloo 2 e Nunito Sans do Google Fonts. A conta fala com o Supabase só com `fetch`.
- Telas: `resumo`, `clientes`, `cliente`, `vender`, `produtos`. Cada uma é uma função `vX()` que devolve HTML;
  `render()` redesenha. Formulários abrem numa "janela de baixo" (`abrir()` / `fechar()`).
- No alto, em todas as telas: bonequinho (`data-act="conta"`, "Minha conta") e engrenagem (`config`,
  "Configurações": conta, cópia de segurança, instalar e "Como usar o caderninho").
- Todos os cliques passam por um único listener que lê `data-act` / `data-id` / `data-v`.
- Sempre passar texto do usuário por `esc()` antes de pôr no HTML. Dinheiro: `brl()` para mostrar,
  `parseMoney()` para ler o que foi digitado ("12,50"), `r2()` para arredondar centavos.
- Botões grandes (mín. 48–58px), letra 18px, tema claro e escuro.

## Dados (não quebrar!)

Ficam só no aparelho: IndexedDB `caderninho` → store `kv` → chave `caderninho-v1`
(se falhar, `localStorage['caderninho-v1']`). Formato:

```js
{ produtos: [{id, nome, preco, custo, foto /* dataURL jpeg 480px */, ativo}],
  clientes: [{id, nome, tel}],
  lanc: [ {id, tipo:'venda', clienteId, itens:[{produtoId, nome, qtd, preco, custo}], valor, custo, data:'AAAA-MM-DD', criado},
          {id, tipo:'pag',   clienteId, valor, forma /* Pix|Dinheiro|Cartão|Na hora */, data, criado} ],
  ultimoBackup: timestamp|null }
```

- O saldo de cada cliente é sempre calculado (vendas − pagamentos); nunca é guardado.
- A venda guarda nome/preço/custo do produto **daquele dia**, para mudar o preço depois não alterar o passado.
- Cópia de segurança: `{app:'caderninho', versao:1, em, dados:{produtos, clientes, lanc}}`.
  Qualquer mudança de formato precisa continuar lendo dados e cópias antigas.

## Conta (login)

- "Minha conta" usa o **Supabase Auth** (detalhes e passo a passo em `docs/conta.md`): criar conta com nome,
  e-mail e senha, confirmar o e-mail, entrar, esqueci minha senha, mudar nome/senha e proteção em 2 etapas
  (código de aplicativo, TOTP). Tudo no bloco "minha conta" de `app/index.html`; cliques `conta*` vão para `acaoConta()`.
- `CONTA_URL` / `CONTA_CHAVE` (chave **pública**, nunca a `service_role`). Vazios = app funciona igual, conta diz "Em breve".
- A conta guarda só nome/e-mail/senha. Os dados do caderninho **não** vão para o Supabase.
  A entrada fica em `localStorage['caderninho-conta']`, separada dos dados.
- Para testar sem Supabase de verdade: preencha os dois com valores falsos numa cópia e intercepte
  `https://<falso>.supabase.co/auth/v1/**` com `context.route()` do Playwright.

## Publicação

- `.github/workflows/pages.yml` publica a pasta `app/` no GitHub Pages a cada push no ramo principal
  (ou manualmente em Actions → "Publicar o app"). Endereço: https://danielfps.github.io/caderninho-dos-doces/
- `app/sw.js` guarda os arquivos para funcionar offline e busca a versão nova em segundo plano
  (aparece na próxima abertura). Ao adicionar ou renomear arquivos do app, atualize a lista `ARQUIVOS`
  e troque `VERSAO` em `app/sw.js`.

## Testar

`cd app && python3 -m http.server 8000`. Playwright + Chromium já vêm instalados no ambiente do Claude Code:
dá para testar o fluxo (cadastrar doce → anotar venda → receber pagamento → conferir Resumo) num celular
emulado (`devices['Pixel 7']`).
