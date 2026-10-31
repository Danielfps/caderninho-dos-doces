/* Ponto de partida do app: liga monitoramento, janelas, ações e carrega as contas. */
import { iniciarMonitoramento, log } from './services/log.js';
import { carregar, pedirArmazenamentoPersistente } from './services/armazenamento.js';
import { iniciarInstalar, registrarOffline } from './services/instalar.js';
import { ui, aplicarDados } from './ui/estado.js';
import { iniciarJanelas, janelaAberta, toast } from './ui/janelas.js';
import { iniciarAcoes } from './ui/acoes.js';
import { render } from './ui/telas.js';

iniciarMonitoramento();
iniciarJanelas();
iniciarAcoes();
iniciarInstalar({
  aoMudar: () => { if (ui.view === 'resumo' && !janelaAberta()) render(); },
  aoInstalar: () => { render(); toast('Pronto! O caderninho está na sua tela inicial ✅'); },
});

(async () => {
  pedirArmazenamentoPersistente();
  try { aplicarDados(await carregar()); }
  catch (e) { log.erro('inicio', 'falha ao carregar as contas', e); }
  render();
})();

registrarOffline();
