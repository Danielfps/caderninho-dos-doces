import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saldo, resumo, devedores, historico, faltaCusto, produtoJaVendido, precisaCopia } from '../../app/js/core/contas.js';

const dados = () => ({
  produtos: [{ id: 'p1', nome: 'Bolo', preco: 12.5, custo: 4, ativo: true }, { id: 'p2', nome: 'Trufa', preco: 3, custo: 0, ativo: false }],
  clientes: [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bia' }, { id: 'c', nome: 'Cris' }],
  lanc: [
    { id: '1', tipo: 'venda', clienteId: 'a', itens: [{ produtoId: 'p1', qtd: 2 }], valor: 25, custo: 8, data: '2026-10-02', criado: '2026-10-02T10:00:00Z' },
    { id: '2', tipo: 'pag', clienteId: 'a', valor: 10, forma: 'Pix', data: '2026-10-03', criado: '2026-10-03T10:00:00Z' },
    { id: '3', tipo: 'venda', clienteId: 'b', itens: [{ produtoId: 'p2', qtd: 1 }], valor: 3, data: '2026-09-30', criado: '2026-09-30T10:00:00Z' }, // dado antigo sem custo
    { id: '4', tipo: 'pag', clienteId: 'c', valor: 5, forma: 'Dinheiro', data: '2026-10-04', criado: '2026-10-04T10:00:00Z' },
  ],
  ultimoBackup: null,
});

test('saldo = vendas − pagamentos', () => {
  const d = dados();
  assert.deepEqual(saldo(d, 'a'), { vendido: 25, pago: 10, deve: 15 });
  assert.deepEqual(saldo(d, 'c'), { vendido: 0, pago: 5, deve: -5 }); // crédito
  assert.deepEqual(saldo(d, 'x'), { vendido: 0, pago: 0, deve: 0 });
});

test('resumo do mês e desde o começo', () => {
  const d = dados();
  assert.deepEqual(resumo(d, '2026-10'), { vend: 25, rec: 15, lucro: 17, falta: 18, devendo: 2 });
  assert.deepEqual(resumo(d, null), { vend: 28, rec: 15, lucro: 20, falta: 18, devendo: 2 });
  assert.equal(resumo(d, '2025-01').vend, 0);
  assert.equal(resumo(d, '2025-01').falta, 18, '"falta receber" é sempre de todo o período');
});

test('resumo de caderninho vazio', () => {
  assert.deepEqual(resumo({ produtos: [], clientes: [], lanc: [] }, null), { vend: 0, rec: 0, lucro: 0, falta: 0, devendo: 0 });
});

test('devedores em ordem do maior valor', () => {
  assert.deepEqual(devedores(dados()).map((x) => [x.c.id, x.d]), [['a', 15], ['b', 3]]);
});

test('histórico do mais novo para o mais antigo', () => {
  assert.deepEqual(historico(dados(), 'a').map((l) => l.id), ['2', '1']);
});

test('faltaCusto só olha doces à venda', () => {
  const d = dados();
  assert.equal(faltaCusto(d), false);
  d.produtos[0].custo = 0;
  assert.equal(faltaCusto(d), true);
});

test('produtoJaVendido', () => {
  assert.equal(produtoJaVendido(dados(), 'p1'), true);
  assert.equal(produtoJaVendido(dados(), 'p9'), false);
});

test('precisaCopia depois de 7 dias', () => {
  const d = dados(), dia = 864e5, agora = 100 * dia;
  assert.equal(precisaCopia(d, agora, 7), true);
  d.ultimoBackup = agora - 6 * dia;
  assert.equal(precisaCopia(d, agora, 7), false);
  d.ultimoBackup = agora - 8 * dia;
  assert.equal(precisaCopia(d, agora, 7), true);
  assert.equal(precisaCopia({ lanc: [] }, agora, 7), false);
});
