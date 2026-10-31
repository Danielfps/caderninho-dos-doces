import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalCarrinho, montarVenda, montarPagamento } from '../../app/js/core/lancamentos.js';

const produtos = [{ id: 'p1', nome: 'Bolo', preco: 12.5, custo: 4 }, { id: 'p2', nome: 'Trufa', preco: 3.1 }];
let n = 0;
const novoId = () => 'id' + ++n;

test('totalCarrinho ignora produto que não existe mais', () => {
  assert.deepEqual(totalCarrinho(produtos, { p1: 2, p2: 1, sumiu: 5 }), { total: 28.1, qtd: 3 });
  assert.deepEqual(totalCarrinho(produtos, {}), { total: 0, qtd: 0 });
});

test('montarVenda guarda nome/preço/custo daquele dia', () => {
  n = 0;
  const [v, ...resto] = montarVenda({ produtos, clienteId: 'a', itens: { p1: 2, p2: 3 }, data: '2026-10-31', pagouNaHora: false, agoraISO: 'T', novoId, formaNaHora: 'Na hora' });
  assert.equal(resto.length, 0);
  assert.deepEqual(v, {
    id: 'id1', tipo: 'venda', clienteId: 'a', data: '2026-10-31', criado: 'T', valor: 34.3, custo: 8,
    itens: [{ produtoId: 'p1', nome: 'Bolo', qtd: 2, preco: 12.5, custo: 4 }, { produtoId: 'p2', nome: 'Trufa', qtd: 3, preco: 3.1, custo: 0 }],
  });
  produtos[0].preco = 99; // mudar preço depois não altera o lançamento
  assert.equal(v.itens[0].preco, 12.5);
  produtos[0].preco = 12.5;
});

test('montarVenda com "já pagou na hora" cria o pagamento junto', () => {
  const l = montarVenda({ produtos, clienteId: 'a', itens: { p1: 1 }, data: '2026-10-31', pagouNaHora: true, agoraISO: 'T', novoId, formaNaHora: 'Na hora' });
  assert.equal(l.length, 2);
  assert.deepEqual({ ...l[1], id: 0 }, { id: 0, tipo: 'pag', clienteId: 'a', valor: 12.5, forma: 'Na hora', data: '2026-10-31', criado: 'T1' });
});

test('montarVenda sem cliente ou sem itens não cria nada', () => {
  assert.deepEqual(montarVenda({ produtos, clienteId: null, itens: { p1: 1 }, data: 'd', agoraISO: 'T', novoId }), []);
  assert.deepEqual(montarVenda({ produtos, clienteId: 'a', itens: { p1: 0, x: 2 }, data: 'd', agoraISO: 'T', novoId }), []);
});

test('montarPagamento arredonda', () => {
  assert.deepEqual(montarPagamento({ clienteId: 'a', valor: 10.005, forma: 'Pix', data: 'd', agoraISO: 'T', novoId: () => 'x' }),
    { id: 'x', tipo: 'pag', clienteId: 'a', valor: 10.01, forma: 'Pix', data: 'd', criado: 'T' });
});
