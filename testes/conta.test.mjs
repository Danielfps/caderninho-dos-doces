import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium, devices, expect } = await import('@playwright/test');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizApp = path.resolve(aqui, '..', 'app');
const pastaPrints = path.join(aqui, 'prints');
const nomeCliente = `Cliente Persistente ${Date.now()}`;
const email = `teste-${Date.now()}@caderninho.local`;
const senha = 'SenhaTeste123';
const errosPagina = [];
let falhas = 0;
let servidor;
let navegador;
let pagina;

expect.configure({ timeout: 10000 });
mkdirSync(pastaPrints, { recursive: true });

function tipoArquivo(arquivo) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  })[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
}

function iniciarServidor() {
  servidor = createServer((req, res) => {
    let caminho;
    let pedido;
    try {
      pedido = new URL(req.url, 'http://localhost');
      caminho = decodeURIComponent(pedido.pathname);
    } catch {
      res.writeHead(400).end('Pedido inválido');
      return;
    }
    if (caminho === '/' && pedido.searchParams.get('config-parcial') === '1') {
      const original = readFileSync(path.join(raizApp, 'index.html'), 'utf8');
      const marcador = "const CONTA_URL='';";
      if (!original.includes(marcador) || !original.includes("const CONTA_CHAVE='';")) {
        res.writeHead(500).end('Configuração vazia esperada não encontrada');
        return;
      }
      const copia = original.replace(marcador, "const CONTA_URL='https://projeto-invalido.supabase.co';");
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(copia);
      return;
    }
    let arquivo = path.resolve(raizApp, `.${caminho}`);
    if (arquivo !== raizApp && !arquivo.startsWith(`${raizApp}${path.sep}`)) {
      res.writeHead(403).end('Acesso negado');
      return;
    }
    if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
    if (!existsSync(arquivo) || !statSync(arquivo).isFile()) {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': tipoArquivo(arquivo), 'Cache-Control': 'no-store' });
    createReadStream(arquivo).pipe(res);
  });
  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${servidor.address().port}/`));
  });
}

function pararServidor() {
  return new Promise((resolve) => {
    if (!servidor?.listening) return resolve();
    servidor.close(() => resolve());
  });
}

async function passo(nome, acao) {
  try {
    await acao();
    console.log(`OK      ${nome}`);
  } catch (erro) {
    falhas++;
    console.error(`FALHOU  ${nome}\n        ${erro?.stack ?? erro}`);
  }
}

async function print(nome) {
  await pagina.screenshot({ path: path.join(pastaPrints, `${nome}.png`), fullPage: true });
}

async function clicarAcaoTeste(acao) {
  let botao = pagina.locator(`[data-act="${acao}"]`);
  if (!(await botao.isVisible().catch(() => false))) {
    await pagina.locator('#btnTeste').click();
    botao = pagina.locator(`[data-act="${acao}"]`);
    await expect(botao).toBeVisible();
  }
  await botao.click();
}

async function adicionarClientePeloApp() {
  await pagina.locator('.tabs .tab[data-v="clientes"]').click();
  const seletoresNovo = [
    '[data-act="novoCli"]',
    '[data-act="addCli"]',
    '[data-act="criarCli"]',
    '[data-act="formCli"]',
  ];
  let botaoNovo;
  for (const seletor of seletoresNovo) {
    const candidato = pagina.locator(seletor).first();
    if (await candidato.isVisible().catch(() => false)) {
      botaoNovo = candidato;
      break;
    }
  }
  if (!botaoNovo) {
    botaoNovo = pagina.getByRole('button', { name: /novo cliente|adicionar cliente|cadastrar cliente/i }).first();
  }
  await expect(botaoNovo).toBeVisible();
  await botaoNovo.click();
  await expect(pagina.locator('#sheet')).toBeVisible();

  let campoNome = pagina.locator('#sheet #cliNome, #sheet #nomeCli, #sheet input[name="nome"], #sheet input[placeholder*="nome" i]').first();
  if (!(await campoNome.isVisible().catch(() => false))) campoNome = pagina.locator('#sheet input[type="text"], #sheet input:not([type])').first();
  await expect(campoNome).toBeVisible();
  await campoNome.fill(nomeCliente);

  const seletoresSalvar = [
    '#sheet [data-act="salvarCli"]',
    '#sheet [data-act="contaClienteSalvar"]',
    '#sheet [data-act="salvarCliente"]',
    '#sheet [data-act="salvar"]',
  ];
  let botaoSalvar;
  for (const seletor of seletoresSalvar) {
    const candidato = pagina.locator(seletor).first();
    if (await candidato.isVisible().catch(() => false)) {
      botaoSalvar = candidato;
      break;
    }
  }
  if (!botaoSalvar) botaoSalvar = pagina.locator('#sheet').getByRole('button', { name: /salvar|adicionar|cadastrar/i }).first();
  await expect(botaoSalvar).toBeVisible();
  await botaoSalvar.click();
  await expect(pagina.getByText(nomeCliente, { exact: false }).first()).toBeVisible();
}

async function conferirCliente() {
  await pagina.locator('.tabs .tab[data-v="clientes"]').click();
  await expect(pagina.getByText(nomeCliente, { exact: false }).first()).toBeVisible();
}

async function fluxo() {
  const url = await iniciarServidor();
  navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  pagina = await contexto.newPage();
  pagina.on('pageerror', (erro) => errosPagina.push(erro.message));

  await passo('1. App novo abre trancado em entrar', async () => {
    await pagina.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'entrar');
    await print('01-portao-entrar');
  });

  await passo('1. Criar conta e iniciar teste grátis de 3 dias', async () => {
    await pagina.locator('[data-act="contaCriar"]').click();
    await expect(pagina.locator('#sheet')).toBeVisible();
    await pagina.locator('#cNome').fill('Pessoa de Teste');
    await pagina.locator('#cEmail').fill(email);
    await pagina.locator('#cSenha').fill(senha);
    await pagina.locator('[data-act="contaSalvarCriar"]').click();
    await expect(pagina.locator('body')).not.toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveCount(0);
    const banner = pagina.locator('.banner[data-gratis]');
    await expect(banner).toContainText('Teste grátis');
    await expect(banner).toContainText('3 dias');
    await print('02-resumo-teste-gratis');
  });

  await passo('2. Cadastrar um cliente para conferir que os dados ficam salvos', async () => {
    await adicionarClientePeloApp();
    await print('03-cliente-persistente');
  });

  await passo('3. Avançar um dia e ver 2 dias de teste', async () => {
    await expect(pagina.locator('#btnTeste')).toBeVisible();
    await clicarAcaoTeste('testeDia');
    await expect(pagina.locator('.banner[data-gratis]')).toContainText('2 dias');
    await print('04-teste-2-dias');
  });

  await passo('3. Encerrar os 3 dias e mostrar o portão de assinatura', async () => {
    await clicarAcaoTeste('testeFimGratis');
    await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'assinar');
    await print('05-portao-assinar');
  });

  await passo('4. Abrir checkout de teste e aprovar o pagamento simulado', async () => {
    await pagina.locator('#app #portao [data-act="assinar"]').click();
    await expect(pagina.locator('#sheet #pEmail')).toBeVisible();
    await expect(pagina.locator('#pEmail')).toHaveValue(email);
    await print('06-assinar-email');
    await pagina.locator('#sheet [data-act="assinIr"]').click();
    await expect(pagina.locator('[data-act="testePagar"]')).toBeVisible();
    await print('07-pagamento-de-teste');
    await pagina.locator('[data-act="testePagar"]').click();
    await expect(pagina.locator('body')).not.toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveCount(0);
    await expect(pagina.locator('.banner[data-gratis]')).toHaveCount(0);
    await print('08-resumo-assinatura-ativa');
    await conferirCliente();
  });

  await passo('7. Recarregar depois do pagamento e manter acesso e dados', async () => {
    await pagina.reload();
    await expect(pagina.locator('body')).not.toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveCount(0);
    await expect(pagina.locator('.banner[data-gratis]')).toHaveCount(0);
    await conferirCliente();
    await print('09-apos-recarregar');
  });

  await passo('5. Passar um mês e continuar liberado por renovação automática', async () => {
    await clicarAcaoTeste('testeMes');
    await expect(pagina.locator('body')).not.toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveCount(0);
    await conferirCliente();
    await print('10-renovacao-automatica');
  });

  await passo('5. Cancelar, avançar um mês e exigir assinatura novamente', async () => {
    await clicarAcaoTeste('testeCancelar');
    await clicarAcaoTeste('testeMes');
    await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'assinar');
    await print('11-assinatura-cancelada');
  });

  await passo('6. Sair da conta e voltar ao portão entrar', async () => {
    await pagina.locator('#app #portao [data-act="contaSair"]').click();
    await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'entrar');
    await print('12-sessao-encerrada');
  });

  await passo('6. Senha errada mostra aviso de erro', async () => {
    await pagina.locator('#app #portao [data-act="contaEntrar"]').click();
    await expect(pagina.locator('#sheet')).toBeVisible();
    await pagina.locator('#eEmail').fill(email);
    await pagina.locator('#eSenha').fill('SenhaIncorreta');
    await pagina.locator('#sheet [data-act="contaSalvarEntrar"]').click();
    await expect(pagina.locator('#toast')).toHaveClass(/erro/);
    await print('13-erro-de-senha');
  });

  await passo('6. Entrar com a senha certa e reencontrar o portão de assinatura', async () => {
    await pagina.locator('#eEmail').fill(email);
    await pagina.locator('#eSenha').fill(senha);
    await pagina.locator('#sheet [data-act="contaSalvarEntrar"]').click();
    await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
    await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'assinar');
    await print('14-conta-reconhecida-assinatura');
  });

  await passo('Cabeçalho Minha conta abre a tela da conta', async () => {
    await pagina.locator('#btnConta').click();
    await expect(pagina.locator('#telaConta')).toBeVisible();
    await print('15-minha-conta');
  });

  await passo('Sem erros de JavaScript no navegador', async () => {
    expect(errosPagina, errosPagina.join('\n')).toEqual([]);
  });

  await contexto.close();

  const contextoConfigParcial = await navegador.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const paginaConfigParcial = await contextoConfigParcial.newPage();
  const paginaAnterior = pagina;
  pagina = paginaConfigParcial;
  try {
    await passo('Configuração parcial falha fechada e não ativa o modo de teste', async () => {
      await pagina.goto(`${url}?config-parcial=1`, { waitUntil: 'domcontentloaded' });
      await expect(pagina.locator('#btnTeste')).toBeHidden();
      await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
      await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'entrar');
      await pagina.locator('[data-act="contaCriar"]').click();
      await pagina.locator('#cNome').fill('Conta com configuração parcial');
      await pagina.locator('#cEmail').fill(`parcial-${Date.now()}@caderninho.local`);
      await pagina.locator('#cSenha').fill(senha);
      await pagina.locator('#sheet [data-act="contaSalvarCriar"]').click();
      await expect(pagina.locator('#toast')).toBeVisible();
      await expect(pagina.locator('#toast')).toHaveClass(/erro/);
      await expect(pagina.locator('body')).toHaveClass(/\btrancado\b/);
      await expect(pagina.locator('#app #portao')).toHaveAttribute('data-estado', 'entrar');
      await print('16-configuracao-parcial');
    });
  } finally {
    pagina = paginaAnterior;
    await contextoConfigParcial.close();
  }
}

try {
  await fluxo();
} catch (erro) {
  falhas++;
  console.error(`FALHOU  Inicialização do teste\n        ${erro?.stack ?? erro}`);
} finally {
  if (navegador) await navegador.close().catch(() => {});
  await pararServidor();
}

console.log(`\nResultado: ${falhas ? 'FALHOU' : 'OK'}, ${falhas} falha(s).`);
console.log(`Capturas de tela: ${pastaPrints}`);
if (falhas) process.exitCode = 1;
