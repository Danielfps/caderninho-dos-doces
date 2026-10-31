/* Formulários que abrem na janela de baixo. */
import { CONFIG } from '../config.js';
import { esc, brl, moneyStr, hoje } from '../core/formato.js';
import { saldo, produtoJaVendido } from '../core/contas.js';
import { instalado, ehIphone, podeInstalar } from '../services/instalar.js';
import { S, ui, cli } from './estado.js';
import { abrir } from './janelas.js';
import { IC } from './icones.js';

/* Valores que o formulário aberto está editando (antes de salvar). */
export const rascunho = { fotoTemp: null, formaPag: 'Pix', cliOrigem: null };

export function formCli(c) {
  abrir(`<h1>${c ? 'Editar cliente' : 'Novo cliente'}</h1>
  <div class="field"><label for="fNome">Nome</label><input class="input" id="fNome" value="${esc(c?.nome)}" placeholder="Ex.: Maria do RH" autocomplete="off" ${c ? '' : 'autofocus'}></div>
  <div class="field"><label for="fTel">WhatsApp <span class="muted" style="font-weight:600">(se quiser)</span></label><input class="input" id="fTel" type="tel" inputmode="tel" value="${esc(c?.tel)}" placeholder="(11) 98888-7777"></div>
  <button class="btn" data-act="salvarCli" data-id="${c?.id || ''}">Salvar</button>
  ${c ? `<button class="btn danger" data-act="apagarCli" data-id="${c.id}">Apagar cliente</button>` : ''}
  <button class="btn ghost" data-act="fechar">Cancelar</button>`);
}

export const fotoHTML = (foto) => `<img src="${foto}" alt="Foto do produto">`;

export function formProd(p) {
  rascunho.fotoTemp = p?.foto || null;
  const vendido = p && produtoJaVendido(S, p.id);
  const fotoTemp = rascunho.fotoTemp;
  abrir(`<h1>${p ? 'Editar produto' : 'Criar produto'}</h1>
  <div class="fotobox" id="fotoBox">${fotoTemp ? fotoHTML(fotoTemp) : `<span class="muted small" style="padding:10px;text-align:center">Sem foto</span>`}</div>
  <div class="row"><label class="btn soft filebtn">${IC.cam}Tirar foto<input type="file" accept="image/*" capture="environment" id="fotoCam"></label><label class="btn soft filebtn">${IC.img}Galeria<input type="file" accept="image/*" id="fotoGal"></label></div>
  <div class="field"><label for="pNome">Nome do doce</label><input class="input" id="pNome" value="${esc(p?.nome)}" placeholder="Ex.: Bolo de pote" autocomplete="off"></div>
  <div class="field"><label for="pPreco">Preço que eu vendo</label><div class="money"><span>R$</span><input class="input" id="pPreco" inputmode="decimal" value="${p ? moneyStr(p.preco) : ''}" placeholder="0,00"></div></div>
  <div class="field"><label for="pCusto">Quanto gasto para fazer cada um <span class="muted" style="font-weight:600">(se souber)</span></label><div class="money"><span>R$</span><input class="input" id="pCusto" inputmode="decimal" value="${p && p.custo > 0 ? moneyStr(p.custo) : ''}" placeholder="0,00"></div></div>
  ${p ? `<button class="toggle" role="switch" id="pAtivo" aria-checked="${p.ativo}" data-act="toggleAtivo"><span class="sw"></span><span>Ainda estou vendendo</span></button>` : ''}
  <button class="btn" data-act="salvarProd" data-id="${p?.id || ''}">Salvar</button>
  ${p && !vendido ? `<button class="btn danger" data-act="apagarProd" data-id="${p.id}">Apagar produto</button>` : ''}
  <button class="btn ghost" data-act="fechar">Cancelar</button>`);
}

export function formPagar() {
  const c = cli(ui.cliente), s = saldo(S, c.id);
  rascunho.formaPag = CONFIG.FORMAS_PAGAMENTO[0];
  abrir(`<h1>Quanto ${esc(c.nome)} pagou?</h1>
  <div class="muted">Está devendo <b class="c-bad num">${brl(s.deve)}</b></div>
  <button class="btn good" data-act="pagouTudo">Pagou tudo (${brl(s.deve)})</button>
  <div class="field"><label for="vPag">Ou pagou só uma parte:</label><div class="money"><span>R$</span><input class="input" id="vPag" inputmode="decimal" placeholder="0,00"></div></div>
  <div class="field"><label>Como pagou?</label><div class="chips" id="formas">${CONFIG.FORMAS_PAGAMENTO.map((f) => `<button class="chip" data-act="forma" data-v="${f}" aria-pressed="${f === rascunho.formaPag}">${f}</button>`).join('')}</div></div>
  <div class="field"><label for="dPag">Dia</label><input class="input" type="date" id="dPag" value="${hoje()}" max="${hoje()}"></div>
  <button class="btn" data-act="salvarPag">Salvar pagamento</button>
  <button class="btn ghost" data-act="fechar">Cancelar</button>`);
}

function blocoInstalar() {
  if (instalado()) return '';
  const como = podeInstalar() ? `<button class="btn soft" data-act="instalar">Instalar o caderninho</button>`
    : ehIphone() ? `<p class="muted" style="margin:0">No Safari, toque no botão de compartilhar (o quadradinho com a setinha para cima) e depois em <b>“Adicionar à Tela de Início”</b>.</p>`
      : `<p class="muted" style="margin:0">No Chrome do celular, toque nos três pontinhos (⋮) no canto de cima e depois em <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b>.</p>`;
  return `<h2>Deixar com cara de app</h2><p class="muted" style="margin:0">Vai aparecer um ícone na tela do celular, igual ao de um aplicativo. Funciona até sem internet.</p>${como}`;
}

export function formConfig() {
  abrir(`<h1>Cópia de segurança</h1>
  <p class="muted" style="margin:0">Suas contas ficam guardadas só neste celular. Guarde uma cópia de vez em quando: se trocar de celular ou limpar o navegador, você recupera tudo.</p>
  <button class="btn" data-act="baixar">Salvar cópia em arquivo</button>
  <button class="btn soft" data-act="copiar">Copiar cópia (para colar no WhatsApp)</button>
  <h2>Recuperar uma cópia</h2>
  <label class="btn ghost filebtn">Escolher arquivo da cópia<input type="file" accept=".json,application/json,text/plain" id="restArq"></label>
  <div class="field"><label for="restTxt">Ou cole aqui o texto da cópia</label><textarea class="input" id="restTxt" placeholder="Cole aqui…"></textarea></div>
  <button class="btn ghost" data-act="restaurarTxt">Recuperar do texto colado</button>
  ${blocoInstalar()}
  <button class="btn ghost" data-act="fechar">Fechar</button>`);
}
