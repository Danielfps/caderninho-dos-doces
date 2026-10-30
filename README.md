# Caderninho — controle de fiado

Aplicativo de celular para quem vende **fiado** — cantina de escola ou de empresa, quem vende doces e salgados,
lojinha, bar, vendedor de porta em porta — anotar **quem comprou, quanto deve e quem já pagou**.
As contas o Caderninho faz sozinho: quanto falta receber, há quanto tempo cada um está devendo,
quanto vendeu no mês, quanto já recebeu e o lucro.

> Começou como **Caderninho dos Doces**, só para quem vende bolo de pote. Em 30/10/2026 virou um caderninho
> de fiado para qualquer negócio, com visual novo (veja `docs/historico.md`). As contas antigas continuam valendo.

**Endereço do app:** https://danielfps.github.io/caderninho-dos-doces/
(já publicado; o passo "Ligar a publicação" abaixo já foi feito)

## O que ele faz

- **Anotar venda** — escolhe a pessoa, toca no que ela levou (com busca, para quem tem muitos produtos) ou
  **digita só o valor**, sem precisar cadastrar nada. Dá para marcar "já pagou na hora".
- **Produtos** (opcional) — cadastra o que vende com preço, quanto custa e, se quiser, foto.
- **Clientes** — com observação (turma, setor, responsável…) para não confundir dois "Pedro". Mostra quem está
  devendo, quanto e desde quando; anota pagamento (Pix, dinheiro, cartão, tudo ou só uma parte).
- **Cobrar no WhatsApp** — abre o WhatsApp com a mensagem de cobrança já escrita, assinada com o nome do negócio.
- **Resumo** — falta receber, vendi, recebi e meu lucro (no mês ou desde o começo) e quem está devendo.
- **Ajustes** (engrenagem ⚙️) — nome do negócio, que aparece no topo e na cobrança.
- **Cópia de segurança** — salva em arquivo ou copia o texto para guardar numa conversa do WhatsApp.
- **Funciona sem internet** depois da primeira vez que abre.

As contas ficam guardadas **só no celular** de quem usa. Nada vai para a internet.

## Ligar a publicação (uma vez só)

O código já está aqui no GitHub e já existe uma automação (`.github/workflows/pages.yml`) que publica o app
toda vez que algo muda. Falta só ligar o GitHub Pages, que precisa ser feito por quem é dono do repositório:

1. **Deixar o repositório público.** Em contas gratuitas do GitHub, o Pages só funciona em repositório público.
   Vá em **Settings → General**, role até o fim (**Danger Zone**) → **Change visibility** → **Make public**.
   Não tem problema: aqui só tem o código do app. As vendas e os clientes ficam no celular, não aqui.
   *(Se a conta for GitHub Pro, pode pular este passo.)*
2. **Ligar o Pages.** Vá em **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions**.
3. **Publicar.** Vá na aba **Actions**, clique em **Publicar o app** → **Run workflow**.
   Em um ou dois minutos o app aparece no endereço lá de cima.

## Instalar no celular

**Android (Chrome):** abra o endereço do app. Vai aparecer um aviso "Instalar" no Resumo — é só tocar.
Se não aparecer: toque nos três pontinhos (⋮) → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone (Safari):** abra o endereço do app no **Safari** → toque no botão de compartilhar
(quadradinho com a setinha para cima) → **Adicionar à Tela de Início**.

Pronto: aparece o ícone do caderninho azul na tela, e o app abre em tela cheia, como qualquer outro aplicativo.

### Já usava a versão de teste (no Claude)?

As contas da versão de teste ficam guardadas lá, não passam sozinhas para o app novo. Para levar tudo:

1. Na versão de teste, toque na **engrenagem** ⚙️ → **Copiar cópia**.
2. No app novo, toque na **engrenagem** ⚙️ → cole o texto em **"Ou cole aqui o texto da cópia"** →
   **Recuperar do texto colado**.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `app/index.html` | O app inteiro (telas, contas e visual) |
| `app/manifest.webmanifest` | Nome, cores e ícone para instalar no celular |
| `app/sw.js` | Faz o app abrir sem internet |
| `app/icons/` | Ícones do app |
| `.github/workflows/pages.yml` | Publica a pasta `app/` no GitHub Pages |
| `CLAUDE.md` | Contexto do projeto para o Claude Code |
| `docs/historico.md` | Como o projeto começou e onde paramos |

## Testar no computador

```sh
cd app
python3 -m http.server 8000
```

E abra http://localhost:8000 no navegador.
