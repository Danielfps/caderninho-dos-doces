# Como contribuir

## Primeiro dia

```bash
git clone https://github.com/Danielfps/caderninho-dos-doces.git
```

```bash
cd caderninho-dos-doces && npm run preparar
```

```bash
npm run test:tudo
```

```bash
npm start
```

Leia antes: [ARCHITECTURE.md](ARCHITECTURE.md) (camadas e contrato dos dados) e [CLAUDE.md](CLAUDE.md)
(quem usa e as regras de linguagem).

## Regras que não se negociam

1. **Os dados nos celulares são sagrados.** Não renomeie a chave `caderninho-v1`, o IndexedDB `caderninho`,
   a store `kv` nem campos existentes. Campo novo = opcional, com padrão na leitura. Cópias de segurança
   antigas têm de continuar abrindo (há teste para isso: `tests/fixtures/copia-v1.json`).
2. **Sem build e sem dependências no app.** Nada de `import` de pacote em `app/`. Dependências só para
   desenvolvimento (`devDependencies`), com versão fixa.
3. **Texto do usuário sempre por `esc()`** antes de ir para o HTML. Dinheiro: `brl()` para mostrar,
   `parseMoney()` para ler, `r2()` para arredondar.
4. **Linguagem das telas:** português do Brasil, simples, sem jargão ("Recebi", "Cópia de segurança";
   nunca "sincronizar", "exportar JSON", "registro").
5. **Toque fácil:** botões de 48–58px, letra 18px, testar no tema claro e escuro.
6. **Nunca** commitar `.env`, tokens, chaves ou cópias de segurança reais (têm dados de clientes).

## Onde colocar cada coisa

| Mudança | Lugar |
|---|---|
| Conta, regra, validação de dados | `app/js/core/` (função pura) + teste em `tests/unit/` |
| Acesso a recurso do navegador (armazenamento, câmera, arquivos) | `app/js/services/` |
| Tela nova | `vNome()` em `app/js/ui/telas.js` + `TELAS` |
| Botão novo | `data-act="nome"` no HTML + `nome(b, id)` em `ACOES` (`app/js/ui/acoes.js`) |
| Formulário | `app/js/ui/formularios.js` (abre com `abrir()`) |
| Número fixo / limite / nome | `app/js/config.js` |
| Visual | `app/css/estilo.css` (use as variáveis `--accent`, `--bad`, `--good`…) |

**Arquivo novo em `app/`?** Adicione em `ARQUIVOS` e troque `VERSAO` em `app/sw.js`.
O `npm run verificar` acusa se esquecer.

## Convenções de código

- Módulos ES com caminho relativo e extensão (`./core/contas.js`).
- Nomes em português, como o resto do projeto (`saldo`, `montarVenda`, `persistir`).
- Erros: em `services/`, capture, chame `log.aviso/erro(onde, msg, erro)` e devolva um resultado
  (`true/false`, `{erro}`), sem deixar a exceção estourar na tela. Em `ui/`, mensagens para a pessoa via `toast()`.
- Indentação de 2 espaços, LF, UTF-8 (`.editorconfig`).

## Fluxo de trabalho com Git

- O ramo principal é `claude/doces-claude-code-transfer-yliita` e **todo envio para ele publica o app**.
  Nunca trabalhe direto nele: crie um ramo (`git switch -c minha-mudanca`) e abra um pull request.
- Commits pequenos, mensagem no imperativo e em português, dizendo o porquê
  (ex.: "Mostrar a busca de clientes sempre que houver alguém cadastrado").
- Antes de enviar: `npm run test:tudo`. O GitHub roda o mesmo (`testes.yml`) em todo envio.
- Ao lançar versão: atualize `CHANGELOG.md`, a `version` do `package.json` e, se mudou arquivo do app, a `VERSAO` do `sw.js`.

## Testar à mão no celular emulado

Chrome → F12 → ícone de celular → Pixel 7. Para "sem internet": aba Network → Offline.
Para limpar os dados de teste: aba Application → Storage → Clear site data.
Diagnóstico: no console, `caderninhoDiagnostico()`.
