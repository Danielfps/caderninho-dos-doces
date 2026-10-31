#!/usr/bin/env node
/* Servidor local de desenvolvimento — sem dependências.
   Serve a pasta app/ exatamente como o GitHub Pages serve em produção.
   Configuração: variáveis de ambiente ou arquivo .env (veja .env.example). */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lê um .env simples (CHAVE=valor) sem sobrescrever o que já veio do ambiente. */
export function carregarEnv(arquivo = join(RAIZ, '.env')) {
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || linha.trim().startsWith('#')) continue;
    const valor = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

/** Cria (e liga) o servidor. Devolve { servidor, url }. */
export function iniciarServidor({ porta, host, pasta, silencioso } = {}) {
  carregarEnv();
  const raizApp = resolve(RAIZ, pasta ?? process.env.APP_DIR ?? 'app');
  const p = Number(porta ?? process.env.PORT ?? 8000);
  const h = host ?? process.env.HOST ?? '127.0.0.1';
  const logar = !silencioso && process.env.LOG_REQUESTS !== '0';

  const servidor = createServer(async (req, res) => {
    const inicio = Date.now();
    let status = 200;
    try {
      const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let arq = normalize(join(raizApp, caminho));
      if (arq !== raizApp && !arq.startsWith(raizApp + sep)) { status = 403; res.writeHead(403).end('Proibido'); return; }
      if (existsSync(arq) && (await stat(arq)).isDirectory()) arq = join(arq, 'index.html');
      const corpo = await readFile(arq);
      res.writeHead(200, {
        'Content-Type': TIPOS[extname(arq).toLowerCase()] ?? 'application/octet-stream',
        // Em desenvolvimento, nunca deixar o navegador guardar versão velha (o sw.js cuida do offline).
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : corpo);
    } catch (e) {
      status = e.code === 'ENOENT' ? 404 : 500;
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(status === 404 ? 'Não encontrado' : 'Erro no servidor');
      if (status === 500) console.error('[servidor] erro:', e);
    } finally {
      if (logar) console.log(`[servidor] ${req.method} ${req.url} → ${status} (${Date.now() - inicio}ms)`);
    }
  });

  return new Promise((ok, falha) => {
    servidor.once('error', falha);
    servidor.listen(p, h, () => {
      const { port } = servidor.address();
      ok({ servidor, url: `http://${h === '0.0.0.0' ? 'localhost' : h}:${port}/` });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciarServidor()
    .then(({ url }) => console.log(`\n🧁 Caderninho rodando em ${url}\n   (Ctrl+C para parar)\n`))
    .catch((e) => {
      console.error(e.code === 'EADDRINUSE' ? `A porta já está em uso. Troque PORT no .env.` : e);
      process.exit(1);
    });
}
