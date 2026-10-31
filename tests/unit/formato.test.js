import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, brl, r2, parseMoney, moneyStr, hoje, fmtData, uid, inicial, filtrarPorNome } from '../../app/js/core/formato.js';

const n = (s) => s.replace(/ /g, ' ');

test('esc escapa HTML', () => {
  assert.equal(esc(`<b a="1">'&'</b>`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(12), '12');
});

test('brl mostra reais', () => {
  assert.equal(n(brl(12.5)), 'R$ 12,50');
  assert.equal(n(brl(1234.56)), 'R$ 1.234,56');
  assert.equal(n(brl('x')), 'R$ 0,00');
  assert.equal(n(brl(-3)), '-R$ 3,00');
});

test('r2 arredonda centavos', () => {
  assert.equal(r2(0.1 + 0.2), 0.3);
  assert.equal(r2(2.675 + 0.005), 2.68);
  assert.equal(r2(undefined), 0);
});

test('parseMoney entende o que a pessoa digita', () => {
  assert.equal(parseMoney('12,50'), 12.5);
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('3.5'), 3.5);
  assert.equal(parseMoney(' 10 '), 10);
  assert.equal(parseMoney('4,555'), 4.56);
  assert.ok(Number.isNaN(parseMoney('')));
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.ok(Number.isNaN(parseMoney(null)));
});

test('moneyStr para campo de formulário', () => {
  assert.equal(moneyStr(12.5), '12,50');
  assert.equal(moneyStr(0), '0,00');
});

test('datas', () => {
  assert.equal(hoje(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(hoje(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fmtData('2026-10-31'), '31/10/2026');
  assert.equal(fmtData(''), '');
});

test('uid é único', () => {
  const ids = new Set(Array.from({ length: 1000 }, uid));
  assert.equal(ids.size, 1000);
});

test('inicial', () => {
  assert.equal(inicial('  maria'), 'M');
  assert.equal(inicial(''), '?');
  assert.equal(inicial('<x'), '&lt;');
});

test('filtrarPorNome ignora maiúsculas e ordena', () => {
  const l = [{ nome: 'Zé' }, { nome: 'ana' }, { nome: 'Ângela' }, { nome: 'Bruna' }];
  assert.deepEqual(filtrarPorNome(l, '').map((x) => x.nome), ['ana', 'Ângela', 'Bruna', 'Zé']);
  assert.deepEqual(filtrarPorNome(l, ' AN ').map((x) => x.nome), ['ana']);
  // A busca diferencia acentos (comportamento original): "an" não acha "Ângela".
  assert.deepEqual(filtrarPorNome(l, 'run').map((x) => x.nome), ['Bruna']);
});
