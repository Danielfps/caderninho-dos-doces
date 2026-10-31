/* Estado do app em memória: as contas (S) e o que está na tela (ui). */
import { hoje } from '../core/formato.js';
import { salvar } from '../services/armazenamento.js';
import { toast } from './janelas.js';

/** As contas. Mesmo formato do que é guardado no aparelho (ver ARCHITECTURE.md). */
export const S = { produtos: [], clientes: [], lanc: [], ultimoBackup: null };

export function novaVenda(cid) { return { clienteId: cid || null, itens: {}, data: hoje(), pagou: false, buscaCli: '' }; }

/** O que está na tela agora. */
export const ui = { view: 'resumo', cliente: null, periodo: 'mes', busca: '', venda: novaVenda() };

export const prod = (id) => S.produtos.find((p) => p.id === id);
export const cli = (id) => S.clientes.find((c) => c.id === id);

/** Junta o que veio do aparelho com os valores padrão (dados antigos podem não ter todos os campos). */
export function aplicarDados(v) { if (v) Object.assign(S, v); }

/** Guarda as contas e avisa se não deu. */
export async function persistir() {
  const ok = await salvar(S);
  if (!ok) toast('Não consegui guardar no celular. Faça uma cópia de segurança agora.', true);
  return ok;
}
