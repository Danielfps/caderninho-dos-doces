/* Teste de ponta a ponta: a mesma conta em dois celulares, modo avião, servidor fora do ar, relógio errado,
   troca de conta, planilha que traz o histórico de volta e os planos novos.
   O app roda com fetch de verdade contra um Supabase de mentira (testes/supabase-falso.mjs, que usa as migrações
   de verdade no PGlite). Rodar: node testes/sincronizar.e2e.mjs  (tem que dar 0 falha) */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarSupabaseFalso } from './supabase-falso.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium, devices, expect } = await import('@playwright/test');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizApp = path.resolve(aqui, '..', 'app');
const pastaPrints = path.join(aqui, 'prints');
mkdirSync(pastaPrints, { recursive: true });
expect.configure({ timeout: 15000 });

const marca = Date.now().toString(36);
const conta1 = { nome: 'Ana Vendedora', email: `ana-${marca}@caderninho.local`, senha: 'SenhaBoa123' };
const conta2 = { nome: 'Bia Outra', email: `bia-${marca}@caderninho.local`, senha: 'SenhaBoa456' };
const conta3 = { nome: 'Cida Celular Novo', email: `cida-${marca}@caderninho.local`, senha: 'SenhaBoa789' };
let falhas = 0;
const errosPagina = [];

const falso = await criarSupabaseFalso();
let base = '';
const servidor = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    let caminho = decodeURIComponent(u.pathname);
    if (caminho.startsWith('/supa/')) return await falso.tratar(req, res, caminho.slice('/supa/'.length));
    if (caminho === '/' || caminho === '/index.html') {
      const html = readFileSync(path.join(raizApp, 'index.html'), 'utf8')
        .replace(/const CONTA_URL='[^']*';/, "const CONTA_URL='';").replace(/const CONTA_CHAVE='[^']*';/, "const CONTA_CHAVE='';") // o app no repositório aponta para o servidor de verdade; aqui ele fala só com o de mentira
        .replace("const CONTA_URL='';", `const CONTA_URL='${base}supa';`)
        .replace("const CONTA_CHAVE='';", `const CONTA_CHAVE='${falso.chave}';`);
      if (!html.includes(`${base}supa`)) throw new Error('não achei CONTA_URL vazio no app');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html);
      return;
    }
    const arquivo = path.resolve(raizApp, `.${caminho}`);
    if (!arquivo.startsWith(raizApp) || !existsSync(arquivo) || !statSync(arquivo).isFile()) { res.writeHead(404).end('não achei'); return; }
    const tipo = { '.js': 'text/javascript', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(arquivo)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
    createReadStream(arquivo).pipe(res);
  } catch (e) {
    console.error('erro no servidor de teste', e);
    if (!res.headersSent) res.writeHead(500).end(String(e));
  }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
base = `http://127.0.0.1:${servidor.address().port}/`;

async function passo(nome, acao) {
  try { await acao(); console.log(`OK      ${nome}`); }
  catch (erro) { falhas++; console.error(`FALHOU  ${nome}\n        ${erro?.stack ?? erro}`); }
}
const navegador = await chromium.launch({ headless: true });
async function celular(nome, extra = {}) {
  const contexto = await navegador.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', acceptDownloads: true, ...extra });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => errosPagina.push(`${nome}: ${e.message}`));
  pagina.nome = nome;
  return { contexto, pagina };
}
const print = (p, nome) => p.screenshot({ path: path.join(pastaPrints, `sync-${nome}.png`), fullPage: true });
const liberado = (p) => expect(p.locator('body')).not.toHaveClass(/\btrancado\b/);
const portao = (p, estado) => expect(p.locator('#app #portao')).toHaveAttribute('data-estado', estado);
const sincronizarJa = (p) => p.evaluate(() => window.dispatchEvent(new Event('online')));

async function criarConta(p, c) {
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await portao(p, 'entrar');
  await p.locator('[data-act="contaCriar"]').click();
  await p.locator('#cNome').fill(c.nome);
  await p.locator('#cEmail').fill(c.email);
  await p.locator('#cSenha').fill(c.senha);
  await p.locator('[data-act="contaSalvarCriar"]').click();
  await liberado(p);
}
async function entrar(p, c, abrir = true) {
  if (abrir) await p.goto(base, { waitUntil: 'domcontentloaded' });
  await portao(p, 'entrar');
  await p.locator('#app [data-act="contaEntrar"]').click();
  await p.locator('#eEmail').fill(c.email);
  await p.locator('#eSenha').fill(c.senha);
  await p.locator('[data-act="contaSalvarEntrar"]').click();
}
async function sair(p) {
  await p.locator('#btnConta').click();
  await p.locator('#sheet [data-act="contaSair"]').click();
  await portao(p, 'entrar');
}
async function novoCliente(p, nome) {
  await p.locator('.tabs .tab[data-v="clientes"]').click();
  await p.locator('#app [data-act="novoCli"]').click();
  await p.locator('#fNome').fill(nome);
  await p.locator('#sheet [data-act="salvarCli"]').click();
  await expect(p.locator('#app h1')).toContainText(nome);
}
async function novoProduto(p, nome, preco, custo) {
  await p.locator('.tabs .tab[data-v="produtos"]').click();
  await p.locator('#app [data-act="novoProduto"]').click();
  await p.locator('#pNome').fill(nome);
  await p.locator('#pPreco').fill(preco);
  if (custo && await p.locator('#pCusto').count()) await p.locator('#pCusto').fill(custo);
  await p.locator('#sheet [data-act="salvarProd"]').click();
  await expect(p.locator('#app')).toContainText(nome);
}
/* venda para "cliente" com produtos {nome: qtd} e/ou um valor digitado */
async function venda(p, cliente, { produtos = {}, valor, nomeValor, naHora = false } = {}) {
  await p.locator('.tabs .tab[data-v="vender"]').click();
  await p.locator('#app [data-act="escolherCli"]', { hasText: cliente }).first().click();
  for (const [nome, qtd] of Object.entries(produtos)) {
    for (let i = 0; i < qtd; i++) await p.locator('#app .pick', { hasText: nome }).locator('[data-act="mais"]').last().click();
  }
  if (valor) {
    await p.locator('#app [data-act="avulso"]').click();
    if (nomeValor) await p.locator('#avNome').fill(nomeValor);
    await p.locator('#avValor').fill(valor);
    await p.locator('#sheet [data-act="addAvulso"]').click();
  }
  if (naHora) await p.locator('#app [data-act="togglePagou"]').click();
  await p.locator('#app [data-act="salvarVenda"]').click();
  await expect(p.locator('#app h1')).toContainText(cliente);
}
async function pagamento(p, cliente, valor) {
  await abrirCliente(p, cliente);
  await p.locator('#app [data-act="pagar"]').click();
  await p.locator('#vPag').fill(valor);
  await p.locator('#sheet [data-act="salvarPag"]').click();
}
async function abrirCliente(p, cliente) {
  await p.locator('.tabs .tab[data-v="clientes"]').click();
  await p.locator('#app [data-act="abrirCli"]', { hasText: cliente }).first().click();
  await expect(p.locator('#app h1')).toContainText(cliente);
}
/* quanto o cliente deve, lido da tela dele */
async function deve(p, cliente) {
  await abrirCliente(p, cliente);
  return (await p.locator('#app .hero .big').innerText()).replace(/\s/g, ' ').trim();
}
async function esperarDeve(p, cliente, texto, tempo = 30000) {
  const fim = Date.now() + tempo; let ultimo = '';
  while (Date.now() < fim) {
    await sincronizarJa(p);
    await p.waitForTimeout(1000);
    try { ultimo = await deve(p, cliente); if (ultimo.includes(texto)) return; } catch { /* ainda não chegou */ }
  }
  throw new Error(`${p.nome}: ${cliente} devia ${texto}, mas está ${ultimo || '(não apareceu)'}`);
}
const brl = (s) => `R$ ${s}`;

const A = await celular('celular A');
const B = await celular('celular B');

await passo('A cria a conta, cadastra produto, cliente e vendas', async () => {
  await criarConta(A.pagina, conta1);
  await novoProduto(A.pagina, 'Bolo de pote', '12,00', '4,50');
  await novoProduto(A.pagina, 'Trufa', '3,50', '1,20');
  await novoCliente(A.pagina, 'Joana Silva');
  await venda(A.pagina, 'Joana Silva', { produtos: { 'Bolo de pote': 2, Trufa: 1 } }); // 27,50
  await venda(A.pagina, 'Joana Silva', { valor: '5,00', nomeValor: 'Refrigerante' }); // 32,50
  await novoCliente(A.pagina, 'Pedro Costa');
  await venda(A.pagina, 'Pedro Costa', { produtos: { Trufa: 2 }, naHora: true }); // pagou na hora
  expect(await deve(A.pagina, 'Joana Silva')).toContain('32,50');
  await print(A.pagina, '01-A-joana');
});

await passo('A sobe tudo para a conta', async () => {
  await sincronizarJa(A.pagina);
  await expect.poll(async () => (await falso.sql("select count(*)::int as n from public.registros r join auth.users u on u.id=r.user_id where u.email=$1 and not r.apagado", [conta1.email]))[0].n, { timeout: 20000 }).toBeGreaterThanOrEqual(8);
  await A.pagina.locator('#btnConta').click();
  await expect(A.pagina.locator('#syncInfo .pill')).toHaveText('Guardado', { timeout: 15000 });
  await print(A.pagina, '02-A-guardado');
  await A.pagina.locator('#sheet [data-act="fechar"]').click();
});

await passo('B entra na mesma conta e recebe tudo', async () => {
  await entrar(B.pagina, conta1);
  await liberado(B.pagina);
  await esperarDeve(B.pagina, 'Joana Silva', '32,50');
  expect(await deve(B.pagina, 'Pedro Costa')).toMatch(/0,00/);
  await B.pagina.locator('.tabs .tab[data-v="produtos"]').click();
  await expect(B.pagina.locator('#app')).toContainText('Bolo de pote');
  await print(B.pagina, '03-B-recebeu');
});

await passo('Contas do mês padrão não duplicam no celular novo', async () => {
  const r = await falso.sql("select count(*)::int as n from public.registros r join auth.users u on u.id=r.user_id where u.email=$1 and r.colecao='contas' and not r.apagado", [conta1.email]);
  expect(r[0].n).toBe(11);
});

await passo('B anota um pagamento e A recebe', async () => {
  await pagamento(B.pagina, 'Joana Silva', '10,00');
  await esperarDeve(A.pagina, 'Joana Silva', '22,50');
});

await passo('Modo avião: A continua na conta, anota sem internet e manda quando volta', async () => {
  falso.relogio.avancar(2 * 3600e3); // para o servidor, o token do A vence enquanto ele está sem internet
  await A.contexto.setOffline(true);
  await A.pagina.evaluate(() => window.dispatchEvent(new Event('offline')));
  await A.pagina.waitForTimeout(5000);
  await venda(A.pagina, 'Pedro Costa', { valor: '7,00' });
  await A.pagina.waitForTimeout(2500);
  await liberado(A.pagina);
  await A.pagina.locator('#btnConta').click();
  await expect(A.pagina.locator('#syncInfo .pill')).toHaveText('Esperando internet', { timeout: 15000 });
  await print(A.pagina, '04-A-modo-aviao');
  await A.pagina.locator('#sheet [data-act="fechar"]').click();
  await A.contexto.setOffline(false); // a internet voltou: o app renova a entrada e manda o que ficou esperando
  await sincronizarJa(A.pagina);
  await esperarDeve(B.pagina, 'Pedro Costa', '7,00');
  await liberado(A.pagina);
});

await passo('Servidor fora do ar (503) não tira ninguém da conta', async () => {
  falso.fora = true;
  await pagamento(B.pagina, 'Pedro Costa', '7,00');
  await sincronizarJa(B.pagina);
  await B.pagina.waitForTimeout(3000);
  await B.pagina.reload({ waitUntil: 'domcontentloaded' });
  await B.pagina.waitForTimeout(2000);
  await liberado(B.pagina);
  falso.fora = false;
  await esperarDeve(A.pagina, 'Pedro Costa', '0,00');
});

await passo('Relógio do celular atrasado: o servidor recusa o token e o app renova sozinho', async () => {
  const C = await celular('celular C (relógio 2 h atrasado)');
  await C.pagina.addInitScript(() => { const real = Date.now; const atraso = 2 * 3600e3; Date.now = () => real() - atraso; const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(real() - atraso); } static now() { return real() - atraso; } }; });
  await entrar(C.pagina, conta1);
  await liberado(C.pagina);
  await esperarDeve(C.pagina, 'Joana Silva', '22,50');
  falso.relogio.avancar(2 * 3600e3); // para o servidor, o token do C já venceu; para o celular, ainda vale
  await pagamento(C.pagina, 'Joana Silva', '2,50');
  await esperarDeve(A.pagina, 'Joana Silva', '20,00');
  await liberado(C.pagina);
  await C.contexto.close();
});

await passo('Outra conta no mesmo celular: nada se mistura e tudo volta ao entrar de novo', async () => {
  await sair(A.pagina);
  await A.pagina.locator('#app [data-act="contaCriar"]').click();
  await A.pagina.locator('#cNome').fill(conta2.nome);
  await A.pagina.locator('#cEmail').fill(conta2.email);
  await A.pagina.locator('#cSenha').fill(conta2.senha);
  await A.pagina.locator('[data-act="contaSalvarCriar"]').click();
  await liberado(A.pagina);
  await A.pagina.waitForTimeout(2500);
  await A.pagina.locator('.tabs .tab[data-v="clientes"]').click();
  await expect(A.pagina.locator('#app')).not.toContainText('Joana Silva');
  await novoCliente(A.pagina, 'Cliente da Bia');
  await sincronizarJa(A.pagina);
  await A.pagina.waitForTimeout(2000);
  const daAna = await falso.sql("select count(*)::int as n from public.registros r join auth.users u on u.id=r.user_id where u.email=$1 and r.dados->>'nome'='Cliente da Bia'", [conta1.email]);
  expect(daAna[0].n).toBe(0);
  await sair(A.pagina);
  await entrar(A.pagina, conta1, false);
  await liberado(A.pagina);
  await A.pagina.waitForTimeout(1500);
  await esperarDeve(A.pagina, 'Joana Silva', '20,00');
  await A.pagina.locator('.tabs .tab[data-v="clientes"]').click();
  await expect(A.pagina.locator('#app')).not.toContainText('Cliente da Bia');
});

let arquivoPlanilha = '';
await passo('Planilha: baixar no A e trazer num celular novo e vazio traz o histórico inteiro', async () => {
  await A.pagina.locator('.tabs .tab[data-v="resumo"]').click();
  await A.pagina.locator('#app [data-act="ir"][data-v="planilha"]').first().click();
  const [dl] = await Promise.all([A.pagina.waitForEvent('download'), A.pagina.locator('#app [data-act="baixarPlanilha"]').click()]);
  arquivoPlanilha = path.join(pastaPrints, 'sync-planilha.xlsx');
  await dl.saveAs(arquivoPlanilha);
  const D = await celular('celular D (novo, outra conta)');
  await criarConta(D.pagina, conta3);
  await D.pagina.locator('.tabs .tab[data-v="resumo"]').click();
  await D.pagina.locator('#app [data-act="ir"][data-v="planilha"]').first().click();
  await D.pagina.setInputFiles('#planArq', arquivoPlanilha);
  await expect(D.pagina.locator('#sheet')).toContainText('Trazer o histórico da planilha?');
  await expect(D.pagina.locator('#sheet')).toContainText('4 vendas novas');
  await print(D.pagina, '05-D-recuperar');
  await D.pagina.locator('#sheet [data-act="sim"]').click();
  expect(await deve(D.pagina, 'Joana Silva')).toContain('20,00');
  expect(await deve(D.pagina, 'Pedro Costa')).toMatch(/0,00/);
  await abrirCliente(D.pagina, 'Joana Silva');
  await expect(D.pagina.locator('#app')).toContainText('2 Bolo de pote, 1 Trufa');
  await D.contexto.close();
});

await passo('Planos: fim do teste grátis mostra mensal (14,90 → 19,90) e anual (149,90)', async () => {
  await falso.envelhecerConta(conta1.email, 4 * 864e5);
  await A.pagina.goto(base, { waitUntil: 'domcontentloaded' });
  await portao(A.pagina, 'assinar');
  await expect(A.pagina.locator('#portao')).toContainText('14,90');
  await expect(A.pagina.locator('#portao')).toContainText('19,90');
  await expect(A.pagina.locator('#portao')).toContainText('149,90');
  await expect(A.pagina.locator('#portao')).toContainText('Renova sozinho todo mês. Cancele quando quiser.');
  await expect(A.pagina.locator('#portao')).toContainText('Renova sozinho todo ano. Cancele quando quiser.');
  await expect(A.pagina.locator('#portao')).not.toContainText(/Pix|pagamento único|não renova sozinho|paga uma vez|parcelar|vale por 30 dias/i);
  await print(A.pagina, '06-A-planos');
});

let planoAnualMp = '';
await passo('Plano anual: vai ao Mercado Pago, paga e volta sem depender de preapproval_id', async () => {
  await A.pagina.route('https://www.mercadopago.com.br/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mercado Pago de mentira</h1>' }));
  await A.pagina.locator('#portao [data-act="assinPlano"][data-v="anual"]').click();
  await Promise.all([A.pagina.waitForURL(/mercadopago\.com\.br/), A.pagina.locator('#portao [data-act="assinIr"]').click()]);
  planoAnualMp = new URL(A.pagina.url()).searchParams.get('preapproval_plan_id') || '';
  expect(planoAnualMp).toBeTruthy();
  await falso.pagarPlano(planoAnualMp, { payerEmail: 'pagador-anual@exemplo.test' });
  await A.pagina.goto(`${base}?status=approved`, { waitUntil: 'domcontentloaded' });
  await expect(A.pagina.locator('#sheet h1')).toHaveText('Estamos confirmando sua assinatura.');
  await liberado(A.pagina);
  await expect(A.pagina).not.toHaveURL(/preapproval_id|status=/);
  await A.pagina.locator('#btnConta').click();
  await expect(A.pagina.locator('#sheet')).toContainText('Plano anual');
  await print(A.pagina, '07-A-anual');
  await A.pagina.locator('#sheet [data-act="fechar"]').click();
  await B.pagina.reload({ waitUntil: 'domcontentloaded' });
  await liberado(B.pagina);
  await B.pagina.locator('#btnConta').click();
  await expect(B.pagina.locator('#sheet')).toContainText('Plano anual');
  await B.pagina.locator('#sheet [data-act="fechar"]').click();
});

await passo('Plano mensal: 1º mês promocional e depois a promoção some', async () => {
  await falso.envelhecerConta(conta2.email, 4 * 864e5);
  const E = await celular('celular E');
  await entrar(E.pagina, conta2);
  await portao(E.pagina, 'assinar');
  await E.pagina.route('https://www.mercadopago.com.br/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mercado Pago de mentira</h1>' }));
  await Promise.all([E.pagina.waitForURL(/mercadopago\.com\.br/), E.pagina.locator('#portao [data-act="assinIr"]').click()]);
  const planoMensalMp = new URL(E.pagina.url()).searchParams.get('preapproval_plan_id') || '';
  expect(planoMensalMp).toBeTruthy();
  expect(planoMensalMp).not.toBe(planoAnualMp);
  await falso.pagarPlano(planoMensalMp, { payerEmail: 'pagador-mensal@exemplo.test' });
  await E.pagina.goto(`${base}?status=approved`, { waitUntil: 'domcontentloaded' });
  await expect(E.pagina.locator('#sheet h1')).toHaveText('Estamos confirmando sua assinatura.');
  await liberado(E.pagina);
  await expect(E.pagina).not.toHaveURL(/preapproval_id|status=/);
  await E.pagina.locator('#btnConta').click();
  await expect(E.pagina.locator('#sheet')).toContainText('Plano mensal');
  await print(E.pagina, '08-E-mensal');
  await E.contexto.close();
});

await passo('Sem erros de JavaScript nos celulares', async () => {
  expect(errosPagina).toEqual([]);
});

await A.contexto.close(); await B.contexto.close();
await navegador.close();
await new Promise((r) => servidor.close(r));
await falso.fechar();
console.log(`\nResultado: ${falhas ? 'FALHOU' : 'OK'}, ${falhas} falha(s).`);
console.log(`Capturas de tela: ${pastaPrints}`);
process.exit(falhas ? 1 : 0);
