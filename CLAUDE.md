# Caderninho dos Doces — contexto para o Claude Code

App de celular (PWA) para uma pessoa que vende doces caseiros anotar fiado: quem pegou, quanto deve,
quem pagou. O histórico de como chegamos aqui está em `docs/historico.md`.

## Quem usa

- Pessoa que vende doces (bolo de pote, palha italiana, trufa…) para colegas e conhecidos, e cobra depois.
- Não é técnica. Usa só no celular, com o polegar.
- Toda a interface é em **português do Brasil, simples e sem jargão** ("Quem está me devendo", "Recebi",
  "Cópia de segurança"). Nada de "sincronizar", "exportar JSON", "registro", etc. nas telas.

## Como é feito

- **Sem build e sem dependências no app.** HTML + CSS + JS puro em módulos ES. Só carrega as fontes
  Baloo 2 e Nunito Sans do Google Fonts. Mapa completo em `ARCHITECTURE.md`; regras em `CONTRIBUTING.md`.
  - `app/index.html` (esqueleto) · `app/css/estilo.css` · `app/js/main.js` (início) · `app/js/config.js` (configuração central)
  - `app/js/core/` regras puras (contas, dinheiro, venda, cópia) — sem DOM, testadas no Node
  - `app/js/services/` navegador (armazenamento, fotos, instalar, diário `log`)
  - `app/js/ui/` estado (`S`, `ui`), telas, formulários, janelas, ações
- Telas: `resumo`, `clientes`, `cliente`, `vender`, `produtos`. Cada uma é uma função `vX()` em `ui/telas.js`
  que devolve HTML; `render()` redesenha. Formulários abrem numa "janela de baixo" (`abrir()` / `fechar()`).
- Todos os cliques passam por um único listener (`ui/acoes.js`) que lê `data-act` / `data-id` / `data-v`
  e chama a função de mesmo nome em `ACOES`.
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

## Publicação

- `.github/workflows/pages.yml` publica a pasta `app/` no GitHub Pages a cada push no ramo principal
  (ou manualmente em Actions → "Publicar o app"). Endereço: https://danielfps.github.io/caderninho-dos-doces/
- O `pages.yml` só publica se `scripts/verificar.mjs` e os testes de unidade passarem.
- `app/sw.js` guarda os arquivos para funcionar offline e busca a versão nova em segundo plano
  (aparece na próxima abertura). Ao adicionar ou renomear arquivos do app, atualize a lista `ARQUIVOS`
  e troque `VERSAO` em `app/sw.js` (`npm run verificar` acusa se esquecer).

## Testar

- `npm start` → http://127.0.0.1:8000 (não abrir o `index.html` direto: módulos não carregam em `file://`).
- `npm run test:tudo` = `verificar` + `npm test` (unidade, `tests/unit/`) + `npm run test:e2e`
  (fluxo cadastrar doce → anotar venda → receber → Resumo → cópia → sem internet, num Pixel 7 emulado).
- No ambiente do Claude Code o Playwright + Chromium já vêm instalados: não rode `npm install`/`playwright install`.
