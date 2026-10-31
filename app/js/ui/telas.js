/* Telas: cada vX() devolve o HTML da tela; render() redesenha a tela atual. */
import { CONFIG } from '../config.js';
import { esc, brl, hoje, fmtData, inicial, filtrarPorNome } from '../core/formato.js';
import { saldo, resumo, devedores, historico, faltaCusto, precisaCopia } from '../core/contas.js';
import { totalCarrinho } from '../core/lancamentos.js';
import { instalado, podeInstalar } from '../services/instalar.js';
import { S, ui, cli } from './estado.js';
import { $ } from './janelas.js';
import { IC } from './icones.js';

export const bannerInstalar = () => (podeInstalar() && !instalado() ? `<div class="banner"><span style="flex:1">Coloque o caderninho na tela inicial, igual a um aplicativo.</span><button data-act="instalar">Instalar</button></div>` : '');

function vResumo() {
  const mes = hoje().slice(0, 7);
  const r = resumo(S, ui.periodo === 'mes' ? mes : null);
  const nomeMes = new Date().toLocaleString('pt-BR', { month: 'long' });
  if (!S.produtos.length && !S.clientes.length) {
    return `${bannerInstalar()}<div class="empty"><h1>Bem-vinda! 🍰</h1><p class="muted" style="margin:0">Aqui você anota quem pegou doce e quem já pagou. As contas o caderninho faz sozinho.</p>
      <div class="steps"><div><i>1</i>Cadastre seus doces em “Produtos”</div><div><i>2</i>Toque em “Anotar venda” quando alguém pegar</div><div><i>3</i>Quando pagarem, toque em “Recebi pagamento”</div></div>
      <button class="btn" data-act="novoProduto">${IC.plus}Cadastrar meu primeiro doce</button></div>`;
  }
  const dev = devedores(S);
  const semCusto = faltaCusto(S);
  const lembrarCopia = precisaCopia(S, Date.now(), CONFIG.DIAS_PARA_LEMBRAR_COPIA);
  return `
  ${bannerInstalar()}
  ${lembrarCopia ? `<div class="banner"><span style="flex:1">Faz tempo que você não guarda uma cópia das suas contas.</span><button data-act="config">Guardar</button></div>` : ''}
  <section class="hero">
    <div class="lbl">Falta receber de todo mundo</div>
    <div class="big c-bad num">${brl(r.falta)}</div>
    <div class="muted small">${r.devendo ? `${r.devendo} ${r.devendo === 1 ? 'pessoa está' : 'pessoas estão'} te devendo` : 'Ninguém está te devendo. Que beleza!'}</div>
  </section>
  <div class="seg" role="group" aria-label="Período">
    <button data-act="periodo" data-v="mes" aria-pressed="${ui.periodo === 'mes'}">Em ${esc(nomeMes)}</button>
    <button data-act="periodo" data-v="tudo" aria-pressed="${ui.periodo === 'tudo'}">Desde o começo</button>
  </div>
  <div class="grid2">
    <div class="card"><div class="lbl">Vendi</div><div class="mid num">${brl(r.vend)}</div></div>
    <div class="card"><div class="lbl">Já recebi</div><div class="mid c-good num">${brl(r.rec)}</div></div>
  </div>
  <div class="card"><div class="lbl">Meu lucro</div><div class="mid c-accent num">${brl(r.lucro)}</div>
    <div class="muted small">${semCusto ? 'Para o lucro ficar certinho, coloque quanto você gasta para fazer cada doce em “Produtos”.' : 'É o que vendi menos o que gastei para fazer os doces.'}</div></div>
  <h2>Quem está me devendo</h2>
  ${dev.length ? `<div class="list">${dev.map((x) => `<button class="item" data-act="abrirCli" data-id="${x.c.id}"><span class="avatar">${inicial(x.c.nome)}</span><span class="grow name">${esc(x.c.nome)}</span><span class="val c-bad">${brl(x.d)}</span></button>`).join('')}</div>`
    : `<div class="card muted">Ninguém na lista. Todo mundo pagou certinho.</div>`}`;
}

function linhaCli(c) {
  const d = saldo(S, c.id).deve;
  return `<button class="item" data-act="abrirCli" data-id="${c.id}"><span class="avatar">${inicial(c.nome)}</span><span class="grow"><span class="name">${esc(c.nome)}</span><br>${d > 0 ? '<span class="pill bad">Deve</span>' : '<span class="pill good">Em dia</span>'}</span><span class="val ${d > 0 ? 'c-bad' : 'c-good'}">${brl(Math.max(d, 0))}</span></button>`;
}
export function listaClientesHTML() {
  const l = filtrarPorNome(S.clientes, ui.busca);
  if (!S.clientes.length) return `<div class="empty"><p style="margin:0" class="muted">Você ainda não tem clientes. Toque no botão acima para adicionar o primeiro.</p></div>`;
  if (!l.length) return `<div class="card muted">Ninguém com esse nome.</div>`;
  return `<div class="list">${l.map(linhaCli).join('')}</div>`;
}
function vClientes() {
  return `<h1>Clientes</h1>
  <button class="btn" data-act="novoCli">${IC.plus}Novo cliente</button>
  ${S.clientes.length > CONFIG.BUSCA_CLIENTES_ACIMA_DE ? `<input class="input" id="buscaCli" type="search" placeholder="Procurar pelo nome" value="${esc(ui.busca)}" autocomplete="off">` : ''}
  <div id="listaCli">${listaClientesHTML()}</div>`;
}

/** Link do WhatsApp com a mensagem de cobrança pronta. */
function linkCobranca(c, deve) {
  const tel = String(c.tel || '').replace(/\D/g, '');
  const msg = `Oi, ${c.nome}! Tudo bem? Passando para lembrar do seu saldo dos doces: ${brl(deve)}. Obrigada! 😊`;
  return 'https://wa.me/' + (tel ? (tel.length <= 11 ? CONFIG.DDI_PADRAO : '') + tel : '') + '?text=' + encodeURIComponent(msg);
}

function vCliente() {
  const c = cli(ui.cliente);
  if (!c) { ui.view = 'clientes'; return vClientes(); }
  const s = saldo(S, c.id);
  const hist = historico(S, c.id);
  const zap = linkCobranca(c, s.deve);
  return `<button class="back" data-act="ir" data-v="clientes">← Clientes</button>
  <div class="row" style="align-items:center"><h1 style="flex:1;overflow-wrap:anywhere">${esc(c.nome)}</h1><button class="btn ghost" style="flex:none;width:auto;min-height:48px" data-act="editCli">Editar</button></div>
  ${c.tel ? `<div class="muted" style="margin-top:-10px">${esc(c.tel)}</div>` : ''}
  <section class="hero" style="${s.deve > 0 ? '' : 'border-color:var(--good-soft)'}">
    <div class="lbl">${s.deve > 0 ? 'Está te devendo' : s.deve < 0 ? 'Pagou a mais (crédito)' : 'Está em dia'}</div>
    <div class="big num ${s.deve > 0 ? 'c-bad' : 'c-good'}">${brl(Math.abs(s.deve))}</div>
    <div class="muted small num">Pegou ${brl(s.vendido)} no total · já pagou ${brl(s.pago)}</div>
  </section>
  <div class="row"><button class="btn" data-act="venderPara" data-id="${c.id}">${IC.plus}Anotar venda</button><button class="btn good" data-act="pagar" ${s.deve > 0 ? '' : 'disabled'}>${IC.money}Recebi</button></div>
  ${s.deve > 0 ? `<a class="btn soft" href="${esc(zap)}" target="_blank" rel="noopener">${IC.zap}Cobrar no WhatsApp</a>` : ''}
  <h2>O que aconteceu</h2>
  ${hist.length ? `<div class="list">${hist.map((l) => {
    const desc = l.tipo === 'venda' ? 'Pegou ' + l.itens.map((i) => i.qtd + ' ' + esc(i.nome)).join(', ') : 'Pagou' + (l.forma ? ' (' + esc(l.forma) + ')' : '');
    return `<button class="item" data-act="verLanc" data-id="${l.id}"><span class="grow"><span class="name" style="font-weight:700">${desc}</span><br><span class="tag">${fmtData(l.data)}</span></span><span class="val ${l.tipo === 'venda' ? 'hist-v' : 'hist-p'}">${l.tipo === 'venda' ? '' : '+ '}${brl(l.valor)}</span></button>`;
  }).join('')}</div>`
    : `<div class="card muted">Nada anotado ainda.</div>`}`;
}

/** Botões com as pessoas para escolher na venda. */
export const chipsClientesHTML = (busca) =>
  filtrarPorNome(S.clientes, busca).map((x) => `<button class="chip" data-act="escolherCli" data-id="${x.id}">${esc(x.nome)}</button>`).join('') +
  '<button class="chip" data-act="novoCli" data-v="venda" style="border-style:dashed">+ Pessoa nova</button>';

function vVender() {
  const v = ui.venda;
  const ativos = S.produtos.filter((p) => p.ativo);
  const c = v.clienteId && cli(v.clienteId);
  const { total, qtd: qtdT } = totalCarrinho(S.produtos, v.itens);
  let quem;
  if (c) { quem = `<div class="card" style="display:flex;align-items:center;gap:12px"><span class="avatar">${inicial(c.nome)}</span><span class="grow name" style="flex:1;font-weight:800;overflow-wrap:anywhere">${esc(c.nome)}</span><button class="btn ghost" style="width:auto;min-height:48px" data-act="trocarCli">Trocar</button></div>`; }
  else {
    quem = `${S.clientes.length > CONFIG.BUSCA_VENDA_ACIMA_DE ? `<input class="input" id="buscaVenda" type="search" placeholder="Procurar pelo nome" value="${esc(v.buscaCli)}" autocomplete="off">` : ''}
      <div class="chips" id="chipsCli">${chipsClientesHTML(v.buscaCli)}</div>`;
  }
  return `<h1>Anotar venda</h1>
  <h2>1. Quem pegou?</h2>${quem}
  <h2>2. O que pegou?</h2>
  ${ativos.length ? `<div class="prods">${ativos.map((p) => { const q = v.itens[p.id] || 0; return `<div class="prod ${q ? 'on' : ''}">
      <button data-act="mais" data-id="${p.id}" style="border:0;padding:0;background:none;text-align:left" aria-label="Adicionar ${esc(p.nome)}"><div class="ph">${p.foto ? `<img src="${p.foto}" alt="">` : `<b>${inicial(p.nome)}</b>`}</div>
      <div class="info"><span class="pn">${esc(p.nome)}</span><span class="pp">${brl(p.preco)}</span></div></button>
      <div class="qty"><button data-act="menos" data-id="${p.id}" aria-label="Tirar um">–</button><output>${q}</output><button data-act="mais" data-id="${p.id}" aria-label="Pôr mais um">+</button></div></div>`; }).join('')}</div>`
  : `<div class="empty"><p class="muted" style="margin:0">Você ainda não cadastrou nenhum doce.</p><button class="btn" data-act="novoProduto">${IC.plus}Cadastrar doce</button></div>`}
  <h2>3. Quando?</h2>
  <input class="input" type="date" id="dataVenda" value="${v.data}" max="${hoje()}">
  <button class="toggle" role="switch" aria-checked="${v.pagou}" data-act="togglePagou"><span class="sw"></span><span>Já pagou na hora</span></button>
  <div class="totalbar"><div><div class="lbl" style="color:inherit;opacity:.8">Total${qtdT ? ` · ${qtdT} ${qtdT === 1 ? 'doce' : 'doces'}` : ''}</div><div class="big num">${brl(total)}</div></div></div>
  <button class="btn" data-act="salvarVenda" ${c && qtdT ? '' : 'disabled'}>Salvar venda</button>
  ${!c || !qtdT ? `<div class="muted small" style="text-align:center;margin-top:-8px">${!c ? 'Escolha quem pegou.' : 'Toque nos doces que a pessoa pegou.'}</div>` : ''}`;
}

function cardProd(p) { return `<button class="prod ${p.ativo ? '' : 'off'}" data-act="editProd" data-id="${p.id}"><div class="ph">${p.foto ? `<img src="${p.foto}" alt="">` : `<b>${inicial(p.nome)}</b>`}</div><div class="info"><span class="pn">${esc(p.nome)}</span><span class="pp">${brl(p.preco)}</span>${p.custo > 0 ? `<span class="tag">Custo ${brl(p.custo)}</span>` : ''}</div></button>`; }
function vProdutos() {
  const at = S.produtos.filter((p) => p.ativo), ar = S.produtos.filter((p) => !p.ativo);
  return `<h1>Meus doces</h1>
  <button class="btn" data-act="novoProduto">${IC.plus}Criar produto</button>
  ${at.length ? `<div class="prods">${at.map(cardProd).join('')}</div>` : `<div class="empty"><p class="muted" style="margin:0">Cadastre aqui o bolo de pote, a palha italiana, a trufa… com foto e preço.</p></div>`}
  ${ar.length ? `<h2>Não vendo mais</h2><div class="prods">${ar.map(cardProd).join('')}</div>` : ''}`;
}

const TELAS = { resumo: vResumo, clientes: vClientes, cliente: vCliente, vender: vVender, produtos: vProdutos };

export function render() {
  const v = ui.view;
  $('#app').innerHTML = (TELAS[v] || vProdutos)();
  const tabV = v === 'cliente' ? 'clientes' : v;
  document.querySelectorAll('.tab').forEach((t) => { if (t.dataset.v === tabV) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
}
export function ir(v) { ui.view = v; render(); window.scrollTo(0, 0); }
