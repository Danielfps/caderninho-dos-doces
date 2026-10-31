/* Janela de baixo (formulários), avisos rápidos e perguntas de confirmação. */
import { CONFIG } from '../config.js';

export const $ = (s) => document.querySelector(s);

export function abrir(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
  const f = $('#sheetBody [autofocus]');
  if (f) setTimeout(() => f.focus(), 50);
}
export function fechar() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }
export const janelaAberta = () => !$('#sheet').hidden;

let tt;
/** Aviso rápido na parte de baixo. `erro` = vermelho e fica mais tempo. */
export function toast(m, erro) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.toggle('erro', !!erro);
  t.hidden = false;
  clearTimeout(tt);
  tt = setTimeout(() => (t.hidden = true), erro ? CONFIG.AVISO_ERRO_MS : CONFIG.AVISO_MS);
}

let confirmar = null;
/** Pergunta "tem certeza?". `titulo` e `texto` já devem vir escapados. */
export function perguntar(titulo, texto, botao, acao) {
  confirmar = acao;
  abrir(`<h1>${titulo}</h1><p class="muted" style="margin:0">${texto}</p><button class="btn danger" data-act="sim">${botao}</button><button class="btn ghost" data-act="fechar">Não, voltar</button>`);
}
/** Executa a ação confirmada (botão "Sim"). */
export function confirmarPergunta() { if (confirmar) { const f = confirmar; confirmar = null; f(); } }

/** Fecha ao tocar fora da janela. */
export function iniciarJanelas() { $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') fechar(); }); }
