/* Diário técnico: registra avisos e erros no console e guarda os últimos no aparelho
   (chave separada das contas), para diagnosticar problemas sem internet nem servidor.
   No navegador, digite caderninhoDiagnostico() no console para ver. */
import { CONFIG } from '../config.js';

const NIVEIS = { info: 'info', aviso: 'warn', erro: 'error' };
let memoria = [];

function guardar(entrada) {
  memoria.push(entrada);
  if (memoria.length > CONFIG.LOG_MAX) memoria = memoria.slice(-CONFIG.LOG_MAX);
  if (entrada.nivel === 'info') return; // só avisos e erros ficam guardados no aparelho
  try {
    const antigos = JSON.parse(localStorage.getItem(CONFIG.CHAVE_LOG) || '[]');
    antigos.push(entrada);
    localStorage.setItem(CONFIG.CHAVE_LOG, JSON.stringify(antigos.slice(-CONFIG.LOG_MAX)));
  } catch { /* sem espaço ou bloqueado: fica só na memória */ }
}

function registrar(nivel, onde, msg, detalhe) {
  const entrada = { em: new Date().toISOString(), nivel, onde, msg: String(msg) };
  if (detalhe !== undefined) entrada.detalhe = detalhe instanceof Error ? `${detalhe.name}: ${detalhe.message}` : String(detalhe);
  guardar(entrada);
  console[NIVEIS[nivel]](`[caderninho:${onde}] ${msg}`, detalhe ?? '');
}

export const log = {
  info: (onde, msg, d) => registrar('info', onde, msg, d),
  aviso: (onde, msg, d) => registrar('aviso', onde, msg, d),
  erro: (onde, msg, d) => registrar('erro', onde, msg, d),
  /** Entradas guardadas (aparelho) + desta sessão. */
  ler() {
    let guardados = [];
    try { guardados = JSON.parse(localStorage.getItem(CONFIG.CHAVE_LOG) || '[]'); } catch {}
    return { guardados, sessao: memoria.slice() };
  },
};

/** Captura erros não tratados e expõe o diagnóstico no console. */
export function iniciarMonitoramento() {
  window.addEventListener('error', (e) => log.erro('global', e.message || 'erro', e.error || `${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => log.erro('global', 'promessa rejeitada', e.reason));
  window.caderninhoDiagnostico = () => log.ler();
}
