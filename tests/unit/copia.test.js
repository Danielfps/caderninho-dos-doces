import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarCopia, lerCopia } from '../../app/js/core/copia.js';

const dados = { produtos: [{ id: 'p' }], clientes: [{ id: 'c' }], lanc: [{ id: 'l' }], ultimoBackup: 123 };

test('montarCopia segue o formato combinado', () => {
  const o = JSON.parse(montarCopia(dados, { app: 'caderninho', versao: 1, agoraISO: '2026-10-31T00:00:00.000Z' }));
  assert.deepEqual(o, { app: 'caderninho', versao: 1, em: '2026-10-31T00:00:00.000Z', dados: { produtos: [{ id: 'p' }], clientes: [{ id: 'c' }], lanc: [{ id: 'l' }] } });
});

test('ida e volta', () => {
  const { dados: d } = lerCopia(montarCopia(dados, { app: 'caderninho', versao: 1, agoraISO: 'x' }));
  assert.deepEqual(d, { produtos: dados.produtos, clientes: dados.clientes, lanc: dados.lanc });
});

test('lê cópia antiga de exemplo (fixture)', () => {
  const txt = readFileSync(new URL('../fixtures/copia-v1.json', import.meta.url), 'utf8');
  const { dados: d, erro } = lerCopia(txt);
  assert.equal(erro, undefined);
  assert.equal(d.clientes.length, 2);
  assert.equal(d.lanc.length, 3);
});

test('recusa o que não é cópia', () => {
  for (const t of ['', 'oi', '{}', '[]', 'null', '{"dados":{}}', '{"dados":{"produtos":[],"clientes":[]}}', '{"dados":{"produtos":{},"clientes":[],"lanc":[]}}']) {
    assert.deepEqual(lerCopia(t), { erro: 'invalida' }, t);
  }
});
