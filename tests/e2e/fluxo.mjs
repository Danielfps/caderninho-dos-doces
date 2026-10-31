#!/usr/bin/env node
/* Teste de ponta a ponta num celular emulado (Pixel 7).
   Percorre o fluxo real: cadastrar doce → anotar venda → receber → conferir Resumo →
   cópia de segurança → recuperar → abrir sem internet → ler dados no formato antigo.
   Uso: npm run test:e2e   (ou E2E_URL=https://... para testar um endereço já publicado) */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { iniciarServidor, carregarEnv } from '../../scripts/servidor.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const norm = (s) => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
let passos = 0;
const ok = (m) => console.log(`  ✔ ${++passos}. ${m}`);

carregarEnv();
const local = !process.env.E2E_URL;
const srv = local ? await iniciarServidor({ porta: 0, silencioso: true }) : null;
const URL_APP = process.env.E2E_URL || srv.url;
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const erros = [];

async function novaPagina(extra = {}) {
  const ctx = await navegador.newContext({ ...devices['Pixel 7'], acceptDownloads: true, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text());
  });
  return { ctx, page };
}
const texto = async (page, sel) => norm(await page.locator(sel).first().innerText());
const toast = async (page) => norm(await page.locator('#toast').innerText());

try {
  console.log(`Testando ${URL_APP}`);
  const { ctx, page } = await novaPagina();
  await page.goto(URL_APP);
  await page.getByText('Bem-vinda!').waitFor();
  ok('abre na tela de boas-vindas');

  // Validação de formulário
  await page.click('[data-act="novoProduto"]');
  await page.fill('#pNome', 'Bolo de pote');
  await page.click('[data-act="salvarProd"]');
  assert.match(await toast(page), /Escreva o preço/);
  ok('não deixa salvar doce sem preço');

  await page.fill('#pPreco', '12,50');
  await page.fill('#pCusto', '4');
  await page.click('[data-act="salvarProd"]');
  assert.match(await toast(page), /Produto criado/);
  await page.click('[data-act="ir"][data-v="produtos"]');
  await page.click('[data-act="novoProduto"]');
  await page.fill('#pNome', 'Trufa <b>');
  await page.fill('#pPreco', '3');
  await page.click('[data-act="salvarProd"]');
  assert.equal(await page.locator('.prod .pn').count(), 2);
  assert.equal(await page.locator('.prod b').count(), 2, 'nome com < > não pode virar HTML'); // 2 = iniciais das fotos
  ok('cadastra dois doces (texto do usuário escapado)');

  await page.click('[data-act="ir"][data-v="vender"]');
  await page.click('[data-act="novoCli"][data-v="venda"]');
  await page.fill('#fNome', 'Maria do RH');
  await page.fill('#fTel', '(11) 98888-7777');
  await page.click('[data-act="salvarCli"]');
  await page.locator('[data-act="trocarCli"]').waitFor();
  const bolo = page.locator('.prod', { hasText: 'Bolo de pote' });
  const trufa = page.locator('.prod', { hasText: 'Trufa' });
  await bolo.locator('.qty [data-act="mais"]').click();
  await bolo.locator('.qty [data-act="mais"]').click();
  await bolo.locator('.qty [data-act="mais"]').click();
  await bolo.locator('[data-act="menos"]').click();
  await trufa.locator('.qty [data-act="mais"]').click();
  assert.equal(await texto(page, '.totalbar .big'), 'R$ 28,00');
  await page.click('[data-act="salvarVenda"]');
  assert.match(await toast(page), /Venda anotada/);
  assert.equal(await texto(page, '.hero .big'), 'R$ 28,00');
  ok('anota venda com cliente novo: 2 bolos + 1 trufa = R$ 28,00');

  const zap = await page.locator('a[href^="https://wa.me/"]').getAttribute('href');
  assert.ok(zap.startsWith('https://wa.me/5511988887777?text='), zap);
  assert.match(decodeURIComponent(zap), /Maria do RH.*R\$\s28,00/);
  ok('link "Cobrar no WhatsApp" com número e valor');

  await page.click('[data-act="pagar"]');
  await page.fill('#vPag', '10');
  await page.click('[data-act="forma"][data-v="Dinheiro"]');
  await page.click('[data-act="salvarPag"]');
  assert.match(await toast(page), /Ainda falta R\$\s18,00/);
  assert.equal(await texto(page, '.hero .big'), 'R$ 18,00');
  ok('recebe pagamento parcial (R$ 10 em dinheiro) → deve R$ 18,00');

  await page.click('[data-act="venderPara"]');
  await trufa.locator('.qty [data-act="mais"]').click();
  await page.click('[data-act="togglePagou"]');
  await page.click('[data-act="salvarVenda"]');
  assert.equal(await texto(page, '.hero .big'), 'R$ 18,00');
  assert.match(await texto(page, '.list'), /Pagou \(Na hora\)/);
  ok('venda "já pagou na hora" não muda o saldo');

  await page.click('[data-act="ir"][data-v="resumo"]');
  const cards = norm(await page.locator('main').innerText());
  assert.match(cards, /Falta receber de todo mundo R\$ 18,00/i);
  assert.match(cards, /Vendi R\$ 31,00/i);
  assert.match(cards, /Já recebi R\$ 13,00/i);
  assert.match(cards, /Meu lucro R\$ 23,00/i);
  assert.match(cards, /Maria do RH R\$ 18,00/i);
  await page.click('[data-act="periodo"][data-v="tudo"]');
  assert.match(norm(await page.locator('main').innerText()), /Meu lucro R\$ 23,00/i);
  ok('Resumo: falta 18, vendi 31, recebi 13, lucro 23 (mês e desde o começo)');

  await page.click('[data-act="config"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="baixar"]')]);
  const copiaTxt = await readFile(await dl.path(), 'utf8');
  const copia = JSON.parse(copiaTxt);
  assert.equal(copia.app, 'caderninho');
  assert.equal(copia.versao, 1);
  assert.equal(copia.dados.produtos.length, 2);
  assert.equal(copia.dados.clientes.length, 1);
  assert.equal(copia.dados.lanc.length, 4);
  assert.deepEqual(Object.keys(copia.dados).sort(), ['clientes', 'lanc', 'produtos']);
  assert.match(dl.suggestedFilename(), /^caderninho-\d{4}-\d{2}-\d{2}\.json$/);
  await page.click('[data-act="fechar"]');
  ok('cópia de segurança em arquivo no formato {app, versao:1, em, dados}');

  await page.reload();
  await page.getByText('Falta receber de todo mundo').waitFor();
  assert.match(norm(await page.locator('main').innerText()), /R\$ 18,00/);
  ok('dados continuam lá depois de recarregar (IndexedDB)');

  // Apagar um registro errado
  await page.click('[data-act="abrirCli"]');
  await page.locator('[data-act="verLanc"]', { hasText: 'Dinheiro' }).click();
  await page.click('[data-act="sim"]');
  assert.equal(await texto(page, '.hero .big'), 'R$ 28,00');
  ok('apagar o pagamento errado volta o saldo para R$ 28,00');

  // Sem internet
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length >= 7);
  await page.reload(); // garante que o sw controla a página
  await ctx.setOffline(true);
  await page.reload();
  await page.getByText('Falta receber de todo mundo').waitFor();
  assert.match(norm(await page.locator('main').innerText()), /R\$ 28,00/);
  await ctx.setOffline(false);
  ok('abre sem internet (service worker)');
  await ctx.close();

  // Recuperar a cópia num "celular novo"
  {
    const { ctx, page } = await novaPagina();
    await page.goto(URL_APP);
    await page.getByText('Bem-vinda!').waitFor();
    await page.click('[data-act="config"]');
    await page.fill('#restTxt', 'isso não é cópia');
    await page.click('[data-act="restaurarTxt"]');
    assert.match(await toast(page), /não é uma cópia/);
    await page.fill('#restTxt', copiaTxt);
    await page.click('[data-act="restaurarTxt"]');
    await page.click('[data-act="sim"]');
    assert.match(await toast(page), /Contas recuperadas/);
    assert.match(norm(await page.locator('main').innerText()), /Falta receber de todo mundo R\$ 18,00/i);
    ok('recupera a cópia colada num aparelho vazio');
    await ctx.close();
  }

  // Dados antigos guardados só no localStorage (sem ultimoBackup, sem foto/custo)
  {
    const { ctx, page } = await novaPagina();
    const antigo = { produtos: [{ id: 'p1', nome: 'Palha italiana', preco: 5, ativo: true }], clientes: [{ id: 'c1', nome: 'João' }],
      lanc: [{ id: 'l1', tipo: 'venda', clienteId: 'c1', itens: [{ produtoId: 'p1', nome: 'Palha italiana', qtd: 3, preco: 5 }], valor: 15, data: '2026-01-10', criado: '2026-01-10T10:00:00.000Z' }] };
    await ctx.addInitScript((v) => { if (!localStorage.getItem('caderninho-v1')) localStorage.setItem('caderninho-v1', v); }, JSON.stringify(antigo));
    await page.goto(URL_APP);
    await page.getByText('Falta receber de todo mundo').waitFor();
    assert.match(norm(await page.locator('main').innerText()), /João R\$ 15,00/);
    ok('lê dados no formato antigo (localStorage, campos faltando)');
    await ctx.close();
  }

  // Erro inesperado numa ação: aviso simples + diário técnico, sem travar
  {
    const { ctx, page } = await novaPagina();
    page.removeAllListeners('console');
    await page.goto(URL_APP);
    await page.getByText('Bem-vinda!').waitFor();
    await page.evaluate(() => document.querySelector('#app').insertAdjacentHTML('beforeend', '<button id="quebra" data-act="verLanc" data-id="nao-existe">x</button>'));
    await page.click('#quebra');
    assert.match(await toast(page), /Algo deu errado/);
    const diag = await page.evaluate(() => window.caderninhoDiagnostico());
    assert.ok(diag.guardados.some((e) => e.nivel === 'erro' && e.onde === 'acao'), JSON.stringify(diag));
    await page.click('[data-act="ir"][data-v="produtos"]');
    await page.getByText('Meus doces').waitFor();
    ok('erro inesperado vira aviso, fica no diário e o app continua funcionando');
    await ctx.close();
  }

  assert.deepEqual(erros, [], 'erros no console:\n' + erros.join('\n'));
  ok('nenhum erro de JavaScript no console');
  console.log(`\nTudo certo: ${passos} verificações passaram.`);
} catch (e) {
  console.error('\n✘ Falhou:', e.message);
  if (erros.length) console.error('Erros no console:\n' + erros.join('\n'));
  process.exitCode = 1;
} finally {
  await navegador.close();
  srv?.servidor.close();
}
