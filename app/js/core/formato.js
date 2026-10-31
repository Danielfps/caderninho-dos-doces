/* Funções puras de texto, dinheiro e datas. Sem DOM, sem armazenamento. */

/** Escapa texto do usuário antes de pôr no HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mostra dinheiro: 12.5 → "R$ 12,50". */
export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Arredonda para centavos. */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Lê dinheiro digitado ("12,50", "R$ 1.234,56", "3.5"). Devolve NaN se não der. */
export function parseMoney(s) {
  s = String(s || '').trim().replace(/R\$|\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? r2(n) : NaN;
}

/** Dinheiro para campo de formulário: 12.5 → "12,50". */
export const moneyStr = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');

/** Data de hoje (horário do aparelho) no formato AAAA-MM-DD. */
export function hoje(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** "2026-10-31" → "31/10/2026". */
export const fmtData = (s) => (s ? s.split('-').reverse().join('/') : '');

/** Identificador curto e único o bastante para um aparelho. */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Primeira letra do nome, já escapada, para o "avatar". */
export const inicial = (n) => esc((String(n || '?').trim()[0] || '?').toUpperCase());

/** Ordena por nome do jeito brasileiro. */
export const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Filtra pessoas pelo pedaço do nome digitado. */
export function filtrarPorNome(lista, busca) {
  const b = String(busca || '').trim().toLowerCase();
  return lista.filter((x) => !b || x.nome.toLowerCase().includes(b)).sort(porNome);
}
