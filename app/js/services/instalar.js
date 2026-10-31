/* Infraestrutura: instalar como app (tela inicial) e funcionar sem internet. */
import { log } from './log.js';

let pedido = null;

export const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** O navegador ofereceu o botão "Instalar"? */
export const podeInstalar = () => !!pedido;

/** `aoMudar()` é chamado quando o botão Instalar aparece; `aoInstalar()` quando o app foi instalado. */
export function iniciarInstalar({ aoMudar, aoInstalar }) {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; aoMudar(); });
  window.addEventListener('appinstalled', () => { pedido = null; aoInstalar(); });
}

/** Mostra a pergunta de instalação do navegador. `antes()` roda depois de consumir o pedido. */
export async function pedirInstalacao(antes) {
  const p = pedido;
  if (!p) return;
  pedido = null;
  antes?.();
  try { await p.prompt(); } catch (e) { log.aviso('instalar', 'pedido de instalação falhou', e); }
}

/** Registra o service worker (funciona sem internet depois da primeira vez). */
export function registrarOffline() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => log.aviso('offline', 'service worker não registrou', e));
  }
}
