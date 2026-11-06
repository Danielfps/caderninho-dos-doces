// Abre o app em http://localhost:8000 ligado ao projeto de TESTE, sem alterar nenhum arquivo.
// Usa: node testes/servir-teste.mjs
// Lê as chaves de ~/.caderninho/teste.env. Nunca aponte isto para a produção.
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const env = Object.fromEntries(readFileSync(path.join(homedir(), '.caderninho', 'teste.env'), 'utf8')
  .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const REF_TESTE = 'wnpapijczziocyxfqmpr';
const url = `https://${REF_TESTE}.supabase.co`;
const chave = env.SUPABASE_ANON_TESTE;
if (!chave) throw new Error('Falta SUPABASE_ANON_TESTE no teste.env');

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xlsx': 'application/octet-stream' };
const porta = Number(process.env.PORTA ?? 8000);

createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const arquivo = path.join(raiz, caminho === '/' ? 'index.html' : caminho);
  // Sem service worker aqui: ele guardaria esta versão de teste no navegador.
  if (!arquivo.startsWith(raiz) || caminho.endsWith('sw.js') || !existsSync(arquivo)) { res.writeHead(404); return res.end(); }
  let corpo = readFileSync(arquivo);
  if (arquivo.endsWith('index.html')) {
    const texto = corpo.toString('utf8')
      .replace(/const CONTA_URL='[^']*';/, `const CONTA_URL='${url}';`)
      .replace(/const CONTA_CHAVE='[^']*';/, `const CONTA_CHAVE='${chave}';`);
    if (!texto.includes(REF_TESTE)) throw new Error('Não consegui apontar o app para o projeto de teste');
    corpo = texto;
  }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(corpo);
}).listen(porta, '127.0.0.1', () => console.log(`Caderninho de TESTE em http://localhost:${porta} (projeto ${REF_TESTE})`));
