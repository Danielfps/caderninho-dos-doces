/* Regras de negócio: como uma venda ou um pagamento vira lançamento. */
import { r2 } from './formato.js';

/** Soma do carrinho com os preços atuais. `itens` = { produtoId: quantidade }. */
export function totalCarrinho(produtos, itens) {
  let total = 0, qtd = 0;
  for (const [id, q] of Object.entries(itens)) {
    const p = produtos.find((x) => x.id === id);
    if (p && q > 0) { total += p.preco * q; qtd += q; }
  }
  return { total, qtd };
}

/** Monta os lançamentos de uma venda. Guarda nome/preço/custo DAQUELE DIA,
    para mudar o preço depois não alterar o passado.
    Devolve [] se faltar cliente ou itens; [venda] ou [venda, pagamentoNaHora]. */
export function montarVenda({ produtos, clienteId, itens, data, pagouNaHora, agoraISO, novoId, formaNaHora }) {
  const linhas = [];
  let total = 0, custo = 0;
  for (const [pid, q] of Object.entries(itens)) {
    const p = produtos.find((x) => x.id === pid);
    if (!p || q <= 0) continue;
    linhas.push({ produtoId: p.id, nome: p.nome, qtd: q, preco: p.preco, custo: p.custo || 0 });
    total += p.preco * q;
    custo += (p.custo || 0) * q;
  }
  if (!clienteId || !linhas.length) return [];
  const out = [{ id: novoId(), tipo: 'venda', clienteId, itens: linhas, valor: r2(total), custo: r2(custo), data, criado: agoraISO }];
  // O "1" no fim faz o pagamento ficar logo acima da venda no histórico (mesmo dia e hora).
  if (pagouNaHora) out.push({ id: novoId(), tipo: 'pag', clienteId, valor: r2(total), forma: formaNaHora, data, criado: agoraISO + '1' });
  return out;
}

/** Monta um lançamento de pagamento. */
export const montarPagamento = ({ clienteId, valor, forma, data, agoraISO, novoId }) =>
  ({ id: novoId(), tipo: 'pag', clienteId, valor: r2(valor), forma, data, criado: agoraISO });
