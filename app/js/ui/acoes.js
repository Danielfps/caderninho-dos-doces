/* Ações: todos os toques passam por um único listener que lê data-act / data-id / data-v.
   Cada ação é uma função em ACOES. Erros inesperados viram um aviso simples e vão para o diário. */
import { CONFIG } from '../config.js';
import { esc, brl, parseMoney, hoje, fmtData, uid } from '../core/formato.js';
import { saldo } from '../core/contas.js';
import { montarVenda, montarPagamento } from '../core/lancamentos.js';
import { montarCopia, lerCopia } from '../core/copia.js';
import { comprimir, lerTexto } from '../services/fotos.js';
import { pedirInstalacao } from '../services/instalar.js';
import { log } from '../services/log.js';
import { S, ui, prod, cli, novaVenda, persistir } from './estado.js';
import { $, fechar, toast, perguntar, confirmarPergunta } from './janelas.js';
import { render, ir, listaClientesHTML, chipsClientesHTML } from './telas.js';
import { rascunho, formCli, formProd, formPagar, formConfig, fotoHTML } from './formularios.js';

const agoraISO = () => new Date().toISOString();

function registrarPag(valor) {
  const c = cli(ui.cliente);
  const d = ($('#dPag') && $('#dPag').value) || hoje();
  S.lanc.push(montarPagamento({ clienteId: c.id, valor, forma: rascunho.formaPag, data: d, agoraISO: agoraISO(), novoId: uid }));
  persistir(); fechar(); render();
  const rest = saldo(S, c.id).deve;
  toast(rest > 0 ? `Pagamento anotado! ✅ Ainda falta ${brl(rest)}` : 'Pagamento anotado! ✅ Está em dia');
}

const textoCopia = () => montarCopia(S, { app: CONFIG.COPIA_APP, versao: CONFIG.COPIA_VERSAO, agoraISO: agoraISO() });
function marcarCopia() { S.ultimoBackup = Date.now(); persistir(); }

function restaurar(txt) {
  const { dados: d } = lerCopia(txt);
  if (!d) { toast('Esse texto não é uma cópia do caderninho.', true); return; }
  perguntar('Trocar pelas contas da cópia?', `A cópia tem ${d.clientes.length} clientes e ${d.produtos.length} produtos. O que está no caderninho agora será substituído.`, 'Sim, recuperar', () => {
    S.produtos = d.produtos; S.clientes = d.clientes; S.lanc = d.lanc; S.ultimoBackup = Date.now();
    persistir(); fechar(); ui.view = 'resumo'; render(); toast('Contas recuperadas! ✅');
  });
}

const ACOES = {
  ir(b) {
    if (b.dataset.v === 'vender' && ui.view !== 'vender' && !ui.venda.clienteId && !Object.keys(ui.venda.itens).length) ui.venda = novaVenda();
    ir(b.dataset.v);
  },
  periodo(b) { ui.periodo = b.dataset.v; render(); },
  abrirCli(b, id) { ui.cliente = id; ir('cliente'); },
  novoCli(b) { rascunho.cliOrigem = b.dataset.v || null; formCli(null); },
  editCli() { formCli(cli(ui.cliente)); },
  salvarCli(b, id) {
    const nome = $('#fNome').value.trim(), tel = $('#fTel').value.trim();
    if (!nome) { toast('Escreva o nome da pessoa.', true); $('#fNome').focus(); return; }
    if (id) { const c = cli(id); c.nome = nome; c.tel = tel; persistir(); fechar(); render(); toast('Cliente atualizado ✅'); return; }
    const c = { id: uid(), nome, tel };
    S.clientes.push(c); persistir(); fechar();
    if (rascunho.cliOrigem === 'venda') { ui.venda.clienteId = c.id; render(); } else { ui.cliente = c.id; ir('cliente'); }
    toast(`${nome} adicionado(a) ✅`);
  },
  apagarCli(b, id) {
    const c = cli(id);
    perguntar(`Apagar ${esc(c.nome)}?`, 'Todas as vendas e pagamentos dessa pessoa também serão apagados. Isso não tem volta.', 'Sim, apagar', () => {
      S.clientes = S.clientes.filter((x) => x.id !== id); S.lanc = S.lanc.filter((l) => l.clienteId !== id);
      persistir(); fechar(); ir('clientes'); toast('Cliente apagado');
    });
  },
  venderPara(b, id) { ui.venda = novaVenda(id); ir('vender'); },
  escolherCli(b, id) { ui.venda.clienteId = id; render(); },
  trocarCli() { ui.venda.clienteId = null; render(); },
  mais(b, id) { ui.venda.itens[id] = (ui.venda.itens[id] || 0) + 1; render(); },
  menos(b, id) { const q = (ui.venda.itens[id] || 0) - 1; if (q > 0) ui.venda.itens[id] = q; else delete ui.venda.itens[id]; render(); },
  togglePagou() { ui.venda.pagou = !ui.venda.pagou; render(); },
  salvarVenda() {
    const v = ui.venda;
    const novos = montarVenda({ produtos: S.produtos, clienteId: v.clienteId, itens: v.itens, data: $('#dataVenda').value || hoje(),
      pagouNaHora: v.pagou, agoraISO: agoraISO(), novoId: uid, formaNaHora: CONFIG.FORMA_NA_HORA });
    if (!novos.length) return;
    S.lanc.push(...novos);
    persistir(); ui.cliente = v.clienteId; ui.venda = novaVenda(); ir('cliente'); toast('Venda anotada! ✅');
  },
  pagar() { formPagar(); },
  forma(b) {
    rascunho.formaPag = b.dataset.v;
    document.querySelectorAll('#formas .chip').forEach((x) => x.setAttribute('aria-pressed', x.dataset.v === rascunho.formaPag));
  },
  pagouTudo() { registrarPag(saldo(S, ui.cliente).deve); },
  salvarPag() {
    const v = parseMoney($('#vPag').value);
    if (!(v > 0)) { toast('Escreva quanto a pessoa pagou. Ex.: 10,00', true); $('#vPag').focus(); return; }
    registrarPag(v);
  },
  verLanc(b, id) {
    const l = S.lanc.find((x) => x.id === id);
    perguntar('Apagar este registro?', `${l.tipo === 'venda' ? 'Venda' : 'Pagamento'} de ${brl(l.valor)} do dia ${fmtData(l.data)}. Use só se anotou errado.`, 'Sim, apagar', () => {
      S.lanc = S.lanc.filter((x) => x.id !== id); persistir(); fechar(); render(); toast('Registro apagado');
    });
  },
  novoProduto() { formProd(null); },
  editProd(b, id) { formProd(prod(id)); },
  toggleAtivo(b) { b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); },
  salvarProd(b, id) {
    const nome = $('#pNome').value.trim(), preco = parseMoney($('#pPreco').value), cr = $('#pCusto').value.trim(), custo = cr ? parseMoney(cr) : 0;
    if (!nome) { toast('Escreva o nome do doce.', true); $('#pNome').focus(); return; }
    if (!(preco > 0)) { toast('Escreva o preço. Ex.: 12,00', true); $('#pPreco').focus(); return; }
    if (isNaN(custo) || custo < 0) { toast('O custo ficou estranho. Ex.: 4,50', true); $('#pCusto').focus(); return; }
    if (id) Object.assign(prod(id), { nome, preco, custo, foto: rascunho.fotoTemp, ativo: $('#pAtivo').getAttribute('aria-checked') === 'true' });
    else S.produtos.push({ id: uid(), nome, preco, custo, foto: rascunho.fotoTemp, ativo: true });
    persistir(); fechar(); render(); toast(id ? 'Produto atualizado ✅' : 'Produto criado! ✅');
  },
  apagarProd(b, id) {
    perguntar('Apagar este produto?', 'Ele some da lista de doces.', 'Sim, apagar', () => {
      S.produtos = S.produtos.filter((p) => p.id !== id); persistir(); fechar(); render(); toast('Produto apagado');
    });
  },
  sim() { confirmarPergunta(); },
  fechar() { fechar(); },
  config() { formConfig(); },
  async instalar() { await pedirInstalacao(() => { fechar(); render(); }); },
  baixar() {
    try {
      const url = URL.createObjectURL(new Blob([textoCopia()], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'caderninho-' + hoje() + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      marcarCopia(); toast('Cópia salva! ✅ Fica na pasta “Downloads”.');
    } catch (err) { log.aviso('copia', 'download falhou', err); toast('Não deu para salvar arquivo aqui. Use “Copiar cópia”.', true); }
  },
  async copiar() {
    const t = textoCopia();
    try { await navigator.clipboard.writeText(t); marcarCopia(); toast('Copiado! Cole numa conversa sua no WhatsApp ✅'); }
    catch (err) { const ta = $('#restTxt'); ta.value = t; ta.focus(); ta.select(); toast('Selecionei o texto da cópia. Toque e segure para copiar.', true); }
  },
  restaurarTxt() {
    const t = $('#restTxt').value.trim();
    if (!t) { toast('Cole o texto da cópia primeiro.', true); return; }
    restaurar(t);
  },
};

function falhou(onde, err) {
  log.erro('acao', `falha em "${onde}"`, err);
  toast('Algo deu errado. Tente de novo.', true);
}

export function iniciarAcoes() {
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act, acao = ACOES[a];
    if (!acao) { log.aviso('acao', `ação desconhecida: ${a}`); return; }
    try { await acao(b, b.dataset.id); } catch (err) { falhou(a, err); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'buscaCli') { ui.busca = t.value; $('#listaCli').innerHTML = listaClientesHTML(); }
    if (t.id === 'buscaVenda') { ui.venda.buscaCli = t.value; $('#chipsCli').innerHTML = chipsClientesHTML(ui.venda.buscaCli); }
    if (t.id === 'dataVenda') ui.venda.data = t.value;
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if ((t.id === 'fotoCam' || t.id === 'fotoGal') && t.files && t.files[0]) {
      try { rascunho.fotoTemp = await comprimir(t.files[0]); $('#fotoBox').innerHTML = fotoHTML(rascunho.fotoTemp); }
      catch (err) { log.aviso('foto', 'não abriu a foto', err); toast('Não consegui abrir essa foto. Tente outra.', true); }
    }
    if (t.id === 'restArq' && t.files && t.files[0]) {
      try { restaurar(await lerTexto(t.files[0])); }
      catch (err) { log.aviso('copia', 'não leu o arquivo', err); toast('Não consegui abrir esse arquivo.', true); }
    }
  });
}
