/* Teste de ponta a ponta da planilha, como uma pessoa usaria: traz a planilha, mexe nos custos pelo app,
   baixa, mexe no Excel e traz de volta. Em cada etapa, os números da planilha do app são comparados com os do
   LibreOffice, que refaz todas as fórmulas do arquivo .xlsx.

   Rodar (precisa de Playwright, LibreOffice e openpyxl, que o ambiente do Claude Code já tem):
     cd app && python3 -m http.server 8000 &
     node testes/planilha.test.js
*/
const {chromium,devices}=require('playwright');
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');

const URL=process.env.URL||'http://localhost:8000/';
const MODELO=path.join(__dirname,'..','app','planilha-modelo.xlsx');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'teste-planilha-'));
const py=(...a)=>JSON.parse(execFileSync('python3',[path.join(__dirname,'planilha_xlsx.py'),...a],{encoding:'utf8',timeout:200000}));
let falhas=0,certos=0;
const ok=(c,m)=>{if(c)certos++;else falhas++;console.log((c?'  ok      ':'  FALHOU  ')+m)};
const perto=(a,b,tol=0.006)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=tol;
/* "R$ 1.234,56" → 1234.56 · "-R$ 0,50" → -0.5 · "56,3%" → 0.563 · "—" → null */
function num(s){s=String(s).replace(/ /g,' ').trim();if(!s||s==='—')return null;
  const n=parseFloat(s.replace(/[^\d,]/g,'').replace(',','.'));return (/^[-−]/.test(s)?-1:1)*(s.endsWith('%')?n/100:n)}
const COLUNA={'Custo por unidade (materiais e perdas)':'G','Seu tempo e contas por unidade':'H','Custo completo por unidade':'I',
  'Preço mínimo (sem prejuízo)':'J','Preço sugerido':'K','Lucro por unidade':'M','Margem de lucro':'N'};

(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({...devices['Pixel 7'],serviceWorkers:'block',acceptDownloads:true});
  const p=await ctx.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  const texto=async s=>(await p.locator(s).innerText()).replace(/ /g,' ');
  const foto=n=>p.screenshot({path:path.join(TMP,n+'.png'),fullPage:true});
  const aba=async a=>{await p.click(`.abas [data-v="${a}"]`)};
  const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const nMes=s=>{const[m,a]=s.toLowerCase().split(' de ');return +a*12+MESES.indexOf(m)};
  async function irMes(nome){for(let i=0;i<36;i++){const d=nMes(nome)-nMes(await texto('.mesbar b'));if(!d)return;await p.click(`.mesbar [data-v="${d>0?1:-1}"]`)}}
  async function produtosApp(){await aba('produtos');const out={};
    for(const n of await p.locator('[data-act=planProd] .name').allInnerTexts()){const nome=n.replace(/\s*\(não vendo mais\)/,'').trim();
      await p.locator('[data-act=planProd]',{hasText:nome}).first().click();
      const kv=await p.$$eval('#sheetBody .kv',els=>els.map(e=>[e.children[0].innerText,e.children[1].innerText]));
      out[nome]={O:(await texto('#sheetBody .pill'))};for(const[k,v] of kv)if(COLUNA[k])out[nome][COLUNA[k]]=num(v);
      await p.click('#sheetBody [data-act=fechar]')}
    return out}
  async function resumoApp(){await aba('resumo');await irMes('Outubro de 2026');
    const t=Object.fromEntries(await p.$$eval('.tabela tbody tr',rs=>rs.map(r=>[r.children[0].innerText,r.children[1].innerText])));
    const kv=Object.fromEntries(await p.$$eval('.kv',els=>els.map(e=>[e.children[0].innerText,e.children[1].innerText])));
    const k=pre=>num(Object.entries(kv).find(([a])=>a.startsWith(pre))[1]);
    return{falta:num(await texto('.hero .big')),vendi:num(t['Vendi']),recebi:num(t['Já recebi']),gastei:num(t['Gastei com materiais e mercadoria']),
      taxas:num(t['Taxas (maquininha, app)']),sobrou:num(t['Sobrou das vendas']),contas:k('Contas fixas do mês'),ficou:k('Ficou para mim'),
      sobra:k('De cada R$ 1,00'),vender:k('Para pagar contas'),comLucro:k('Para ter também')}}
  async function clientesApp(){await aba('clientes');
    return Object.fromEntries(await p.$$eval('.tabela tbody tr',rs=>rs.map(r=>[r.children[0].innerText,r.children[6].innerText])).then(l=>l.map(([n,v])=>[n,num(v)])))}
  async function horaApp(){await aba('mes');const kv=Object.fromEntries(await p.$$eval('.kv',els=>els.map(e=>[e.children[0].innerText,e.children[1].innerText])));
    await aba('resumo');return num(kv['Quanto vale a minha hora'])}
  /* compara tudo o que o app mostra com o que o LibreOffice calculou no arquivo */
  async function comparar(ref,etapa){
    const pa=await produtosApp();
    for(const[nome,x] of Object.entries(ref.produtos)){const a=pa[nome];if(!a){ok(false,`${etapa}: produto ${nome} está no app`);continue}
      const dif=Object.entries(COLUNA).map(([,c])=>c).filter(c=>c==='N'?!perto(a[c],x[c],0.0006):!(x[c]===''||x[c]==null?a[c]==null:perto(a[c],x[c])));
      if(a.O!==x.O)dif.push(`situação ${a.O} × ${x.O}`);
      ok(!dif.length,`${etapa}: ${nome} — custo ${a.G?.toFixed(2)}, completo ${a.I?.toFixed(2)}, sugerido ${a.K?.toFixed(2)}, ${a.O}${dif.length?' · diferente em '+dif.join(', '):''}`)}
    const ra=await resumoApp(),dr=Object.keys(ref.resumo).filter(k=>!perto(ra[k],ref.resumo[k],k==='sobra'?0.0006:0.006));
    ok(!dr.length,`${etapa}: Resumo de outubro — vendi ${ra.vendi}, recebi ${ra.recebi}, gastei ${ra.gastei}, sobrou ${ra.sobrou}, meta ${ra.vender}${dr.length?' · diferente em '+dr.map(k=>`${k} ${ra[k]}×${ref.resumo[k]}`).join(', '):''}`);
    const ca=await clientesApp(),dc=Object.entries(ref.clientes).filter(([n,v])=>!perto(ca[n],v));
    ok(!dc.length,`${etapa}: quanto cada cliente deve (${Object.entries(ref.clientes).map(([n,v])=>`${n} ${v}`).join(', ')})${dc.length?' · diferente: '+dc.map(([n,v])=>`${n} app ${ca[n]}`).join(', '):''}`);
    const h=await horaApp();ok(perto(h,ref.valorHora),`${etapa}: valor da hora ${h} (planilha ${ref.valorHora?.toFixed(2)})`);
  }
  async function baixar(nome){await aba('resumo');const[d]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=baixarPlanilha]')]);
    const f=path.join(TMP,nome);await d.saveAs(f);return f}
  async function trazer(arq){await p.setInputFiles('#planArq',arq);await p.waitForSelector('text=Trazer a planilha para o app?');
    const t=await texto('#sheetBody');await p.click('[data-act=sim]');await p.waitForSelector('text=Planilha trazida');return t}

  console.log('\n1) Trazer a planilha original (com os exemplos) para um app vazio');
  await p.goto(URL);await p.waitForSelector('text=Boas-vindas');
  await p.click('text=Calcular custos e preços na planilha');
  const REF0=py('valores',MODELO),t1=await trazer(MODELO);
  ok(+(t1.match(/(\d+) vendas? novas?/)||[])[1]===REF0.vendas&&/4 pagamentos novos/.test(t1)&&/1 acerto novo/.test(t1)&&/5 clientes novos/.test(t1)&&/4 produtos novos/.test(t1),'mostra antes o que vai entrar: '+t1.split('\n').filter(l=>/nov[oa]/.test(l)).join(', '));
  await comparar(REF0,'original');await foto('1-produtos');

  console.log('\n2) Mexer nos custos pelo app, como a pessoa faria');
  await aba('materiais');await p.click('[data-act=editMat] >> text=Leite condensado');await p.fill('#mPreco','7,49');await p.click('[data-act=salvarMat]');
  await aba('produtos');await p.click('[data-act=planProd] >> text=Brigadeiro');
  ok((await texto('#sheetBody')).includes('R$ 0,51'),'leite condensado de 6,49 para 7,49: custo do brigadeiro sobe de R$ 0,48 para R$ 0,51');await p.click('#sheetBody [data-act=fechar]');
  await aba('mes');await p.click('[data-act=editPct]');await p.fill('#xPerdas','10');await p.click('[data-act=salvarPct]');
  await p.click('[data-act=editTempo]');await p.fill('#tSal','2000');await p.click('[data-act=salvarTempo]');
  ok((await texto('#app')).includes('R$ 21,88'),'perdas 10% e salário R$ 2.000: a hora passa a valer (407 + 2.000) ÷ 110 = R$ 21,88');
  await aba('produtos');await p.click('[data-act=planProd] >> text=Refrigerante');await p.fill('#ppPaga','3,50');await p.click('[data-act=salvarPlanProd]');
  ok((await texto('#sheetBody')).includes('R$ 3,85'),'refrigerante comprado a R$ 3,50: custo com 10% de perdas = R$ 3,85');await p.click('#sheetBody [data-act=fechar]');
  await p.click('[data-act=planProd] >> text=Coxinha');await p.click('[data-act=usarSugerido]');
  ok((await texto('#sheetBody')).includes('Agora você cobra R$ 7,00')||(await texto('#toast')).includes('R$ 7,00'),'coxinha: "Cobrar o preço sugerido" muda o preço de R$ 5,00 para R$ 7,00');await p.click('#sheetBody [data-act=fechar]');
  await p.click('.tab[data-v=vender]');await p.fill('#buscaVenda','carla');await p.click('#chipsCli [data-act=escolherCli]');
  await p.click('.pick-main >> text=Brigadeiro');await p.click('.pick-main >> text=Brigadeiro');await p.click('[data-act=salvarVenda]');
  await p.click('.tab[data-v=resumo]');await p.click('text=Consultar planilha');
  await aba('materiais');await p.click('[data-act=editMat] >> text=Forminha');await p.click('[data-act=apagarMat]');
  ok((await texto('#sheetBody')).includes('1 linha de receita'),'apagar a forminha avisa que ela sai da receita do brigadeiro');await p.click('[data-act=sim]');
  await aba('mes');await p.click('[data-act=editConta]:not([data-id])');await p.fill('#cNome','Aluguel do espaço');await p.fill('#cValor','200');await p.click('[data-act=salvarConta]');
  ok((await texto('#app')).includes('R$ 607,00')&&(await texto('#app')).includes('R$ 23,70'),'conta nova de R$ 200: contas fixas R$ 607 e a hora vale R$ 23,70');
  const pa=await produtosApp();
  ok(perto(pa['Brigadeiro'].G,12.844*1.1/30)&&pa['Brigadeiro'].K===2.1,`brigadeiro sem a forminha: custo ${pa['Brigadeiro'].G} (12,844 × 1,10 ÷ 30), sugerido R$ 2,10`);
  await aba('produtos');await p.screenshot({path:path.join(TMP,'2a-produtos.png')});
  await p.click('[data-act=planProd] >> text=Bolo de pote');await p.waitForTimeout(300);await p.screenshot({path:path.join(TMP,'2b-bolo-de-pote.png')});await p.click('#sheetBody [data-act=fechar]');
  ok(pa['Bolo de pote'].O==='Abaixo do sugerido'&&pa['Bolo de pote'].K===13,'bolo de pote: com tudo mais caro, R$ 12,00 fica abaixo do sugerido (R$ 13,00)');
  await p.click('.tab[data-v=produtos]');await p.click('[data-act=editProd] >> text=Brigadeiro');
  ok((await texto('#sheetBody')).includes('R$ 0,47')&&(await texto('#sheetBody')).includes('calculado na planilha'),'o produto no app já mostra o custo novo (R$ 0,47), vindo da planilha');
  await p.click('#sheetBody [data-act=fechar]');await p.click('.tab[data-v=resumo]');await p.click('text=Consultar planilha');
  await aba('vendas');await irMes('Outubro de 2026');const vs=await texto('.tabela');
  ok(/Lúcia\tBrigadeiro\t10\tR\$ 2,50\tR\$ 25,00\tR\$ 4,7\d/.test(vs),'venda antiga continua com o custo daquele dia (10 brigadeiros: R$ 4,77)');
  await irMes(new Date().toLocaleString('pt-BR',{month:'long',year:'numeric'}));
  ok(/Carla\tBrigadeiro\t2\tR\$ 2,50\tR\$ 5,00\tR\$ 1,07/.test(await texto('.tabela')),'venda nova usa o custo do dia em que foi feita (2 brigadeiros: R$ 1,07)');
  await foto('2-mudancas-no-app');
  const baixada=await baixar('2-baixada.xlsx');
  await comparar(py('valores',baixada),'depois das mudanças no app');

  console.log('\n3) Mexer no Excel e trazer de volta');
  const editada=path.join(TMP,'3-editada.xlsx');py('editar',baixada,editada);
  const t3=await trazer(editada);
  ok(/2 vendas novas/.test(t3)&&/1 pagamento novo/.test(t3)&&/0 acertos novos/.test(t3)&&/1 cliente novo/.test(t3)&&/0 produtos novos/.test(t3),'mostra antes o que vai entrar: '+t3.split('\n').filter(l=>/nov[oa]/.test(l)).join(', '));
  await comparar(py('valores',editada),'depois do Excel');
  await aba('clientes');const cl=await texto('.tabela');
  ok(/Carla\t[^\n]*3º ano C/.test(cl),'observação da Carla mudada no Excel chegou ao app');
  ok(/Dona Cida\t[^\n]*R\$ 0,00/.test(cl),'Dona Cida (nova, pagou na hora) aparece em dia');
  await aba('vendas');await irMes('Outubro de 2026');
  ok(/Bruno\tCoxinha de frango\t3\tR\$ 7,00\tR\$ 21,00/.test(await texto('.tabela')),'venda de coxinha escrita sem preço usou o preço do produto (R$ 7,00)');
  const t4=await trazer(editada);
  ok(/0 vendas novas/.test(t4)&&/0 pagamentos novos/.test(t4),'trazer a mesma planilha de novo não repete nada');
  const ida=await baixar('4-de-novo.xlsx');
  await comparar(py('valores',ida),'baixando de novo');
  await foto('3-depois-do-excel');

  ok(!erros.length,'nenhum erro no app'+(erros.length?': '+erros.join(' | '):''));
  console.log(`\n${certos} conferências certas, ${falhas} com problema. Arquivos e fotos em ${TMP}`);
  await b.close();process.exit(falhas?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
