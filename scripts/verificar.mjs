#!/usr/bin/env node
/* Verificações rápidas de integridade (sem navegador), para rodar antes de cada envio:
   - todo arquivo do app está na lista ARQUIVOS do sw.js (senão não abre sem internet) e vice-versa;
   - todos os import entre módulos apontam para arquivos que existem;
   - o manifest é JSON válido e os ícones existem;
   - nenhum arquivo parece conter chave/token. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(RAIZ, 'app');
const problemas = [];
const ok = (m) => console.log('  ✔ ' + m);

const listar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});
const rel = (p) => relative(APP, p).split('\\').join('/');

// 1. Lista do service worker
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const lista = [...sw.match(/const ARQUIVOS=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const versao = sw.match(/const VERSAO='([^']+)'/)?.[1];
const doApp = listar(APP).map(rel).filter((f) => f !== 'sw.js');
for (const f of doApp) if (!lista.includes('./' + f)) problemas.push(`app/${f} não está em ARQUIVOS do sw.js (não vai abrir sem internet)`);
for (const f of lista) if (f !== './' && !existsSync(join(APP, f))) problemas.push(`sw.js lista ${f}, mas o arquivo não existe`);
if (!lista.includes('./')) problemas.push(`sw.js precisa listar './'`);
ok(`sw.js (${versao}) lista ${lista.length} itens; app tem ${doApp.length} arquivos`);

// 2. Imports
const modulos = doApp.filter((f) => f.endsWith('.js'));
for (const m of modulos) {
  const src = readFileSync(join(APP, m), 'utf8');
  for (const [, alvo] of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!alvo.startsWith('.')) { problemas.push(`${m}: import externo "${alvo}" (o app não tem dependências)`); continue; }
    const destino = posix.normalize(posix.join(posix.dirname(m), alvo));
    if (!existsSync(join(APP, destino))) problemas.push(`${m}: importa ${alvo}, que não existe`);
  }
}
const html = readFileSync(join(APP, 'index.html'), 'utf8');
for (const [, src] of html.matchAll(/(?:src|href)="(?!https?:|#|data:)([^"]+)"/g)) {
  if (!existsSync(join(APP, src))) problemas.push(`index.html aponta para ${src}, que não existe`);
}
ok(`${modulos.length} módulos JS com imports conferidos`);

// 3. Manifest
try {
  const man = JSON.parse(readFileSync(join(APP, 'manifest.webmanifest'), 'utf8'));
  for (const i of man.icons) if (!existsSync(join(APP, i.src))) problemas.push(`manifest: ícone ${i.src} não existe`);
  ok(`manifest válido (${man.icons.length} ícones)`);
} catch (e) { problemas.push('manifest.webmanifest inválido: ' + e.message); }

// 4. Segredos
const SUSPEITO = /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35})/;
const IGNORAR = /(^|\/)(\.git|node_modules|test-results|dist)(\/|$)/;
const textos = listar(RAIZ).filter((p) => !IGNORAR.test(relative(RAIZ, p).split('\\').join('/')) && !/\.(png|jpg|ico)$/.test(p));
for (const p of textos) if (SUSPEITO.test(readFileSync(p, 'utf8'))) problemas.push(`${relative(RAIZ, p)} parece conter uma chave/token`);
if (existsSync(join(RAIZ, '.env')) && !readFileSync(join(RAIZ, '.gitignore'), 'utf8').split(/\r?\n/).includes('.env')) problemas.push('.env existe mas não está no .gitignore');
ok(`${textos.length} arquivos procurados por chaves/tokens`);

if (problemas.length) {
  console.error('\n✘ Problemas encontrados:\n' + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('\nTudo certo.');
