/* Regras de negócio: as contas do caderninho. Funções puras sobre os dados. */
import { r2 } from './formato.js';

/** Saldo de um cliente: sempre calculado (vendas − pagamentos), nunca guardado. */
export function saldo(dados, clienteId) {
  let v = 0, p = 0;
  for (const l of dados.lanc) {
    if (l.clienteId !== clienteId) continue;
    if (l.tipo === 'venda') v += l.valor; else p += l.valor;
  }
  return { vendido: r2(v), pago: r2(p), deve: r2(v - p) };
}

/** Números do Resumo. `mes` = "AAAA-MM" para filtrar, ou null para "desde o começo".
    "Falta receber" é sempre de todo o período. */
export function resumo(dados, mes) {
  let vend = 0, rec = 0, custo = 0;
  for (const l of dados.lanc) {
    if (mes && !String(l.data).startsWith(mes)) continue;
    if (l.tipo === 'venda') { vend += l.valor; custo += l.custo || 0; } else rec += l.valor;
  }
  let falta = 0, devendo = 0;
  for (const c of dados.clientes) {
    const d = saldo(dados, c.id).deve;
    if (d > 0) { falta += d; devendo++; }
  }
  return { vend: r2(vend), rec: r2(rec), lucro: r2(vend - custo), falta: r2(falta), devendo };
}

/** Quem está devendo, do maior para o menor valor. */
export function devedores(dados) {
  return dados.clientes.map((c) => ({ c, d: saldo(dados, c.id).deve })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d);
}

/** Histórico do cliente, do mais novo para o mais antigo. */
export function historico(dados, clienteId) {
  return dados.lanc.filter((l) => l.clienteId === clienteId).sort((a, b) => (b.data + b.criado).localeCompare(a.data + a.criado));
}

/** Algum doce à venda sem custo (lucro fica impreciso)? */
export const faltaCusto = (dados) => dados.produtos.some((p) => p.ativo && !(p.custo > 0));

/** Já foi vendido alguma vez? (doce vendido não pode ser apagado, só arquivado) */
export const produtoJaVendido = (dados, produtoId) =>
  dados.lanc.some((l) => l.tipo === 'venda' && l.itens.some((i) => i.produtoId === produtoId));

/** Precisa lembrar de fazer cópia de segurança? */
export const precisaCopia = (dados, agoraMs, dias) =>
  dados.lanc.length > 0 && (!dados.ultimoBackup || agoraMs - dados.ultimoBackup > dias * 864e5);
