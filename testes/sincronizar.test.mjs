import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from './node_modules/@electric-sql/pglite/dist/index.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usuarios = {
  ana: '11111111-1111-4111-8111-111111111111',
  bia: '22222222-2222-4222-8222-222222222222',
};

async function criarBanco() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,created_at timestamptz default now());
    create table auth.mfa_factors(id uuid default gen_random_uuid(),user_id uuid,status text,factor_type text default 'totp');
    create or replace function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [usuarios.ana,'ana@example.test',usuarios.bia,'bia@example.test']);
  const files = (await readdir(path.join(raiz,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort();
  for (const file of files) await db.exec(await readFile(path.join(raiz,'supabase/migrations',file),'utf8'));
  return db;
}
async function como(db, user, fn, { aal='aal1', role='authenticated' }={}) {
  await db.query('select set_config($1,$2,false)', ['request.jwt.claims', JSON.stringify({sub:user,role,aal})]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function rpc(db, user, desde=0, mudancas=[], opts={}) {
  return como(db,user,async()=> (await db.query('select public.sincronizar($1,$2::jsonb,$3) as r',[desde,JSON.stringify(mudancas),'teste'])).rows[0].r,opts);
}

test('migrações reais: dois aparelhos, lápide, repetição e isolamento por conta', async t => {
  const db=await criarBanco(); t.after(()=>db.close());
  const item={c:'clientes',id:'abc',d:{nome:'Ana'}};
  const subiu=await rpc(db,usuarios.ana,0,[item]);
  assert.equal(subiu.rev,1); assert.equal(subiu.mudancas[0].d.nome,'Ana');
  const outro=await rpc(db,usuarios.ana,0,[]);
  assert.deepEqual(outro.mudancas,subiu.mudancas);
  const tomb=await rpc(db,usuarios.ana,1,[{c:'clientes',id:'abc',x:true}]);
  assert.equal(tomb.rev,2); assert.equal(tomb.mudancas[0].x,true); assert.equal(tomb.mudancas[0].d,null);
  const repetido=await rpc(db,usuarios.ana,2,[{c:'produtos',id:'p',d:{nome:'velho'}},{c:'produtos',id:'p',d:{nome:'novo'}}]);
  assert.equal(repetido.rev,3); assert.equal(repetido.mudancas.length,1); assert.equal(repetido.mudancas[0].d.nome,'novo');
  assert.deepEqual((await rpc(db,usuarios.bia)).mudancas,[]);
  await assert.rejects(()=>como(db,usuarios.ana,()=>db.query('select * from public.registros')),/permission denied/);
  await assert.rejects(()=>como(db,null,()=>db.query('select public.sincronizar()')),/sem_login/);
  await assert.rejects(()=>como(db,usuarios.ana,()=>db.query('select public.sincronizar()'),{role:'anon'}),/permission denied/);
});

test('migrações reais: validações, limites de tamanho e MFA', async t => {
  const db=await criarBanco(); t.after(()=>db.close());
  await assert.rejects(()=>rpc(db,usuarios.ana,0,Array.from({length:501},(_,i)=>({c:'clientes',id:String(i),d:{}}))),/mudancas_invalidas/);
  await assert.rejects(()=>rpc(db,usuarios.ana,0,[{c:'errada',id:'x',d:{}}]),/mudancas_invalidas/);
  await assert.rejects(()=>rpc(db,usuarios.ana,0,[{c:'clientes',id:'',d:{}}]),/mudancas_invalidas/);
  await assert.rejects(()=>rpc(db,usuarios.ana,0,[{c:'clientes',id:'x',d:{texto:'x'.repeat(1048580)}}]),/registro_grande/);
  await db.query("insert into auth.mfa_factors(user_id,status) values ($1,'verified')",[usuarios.ana]);
  await assert.rejects(()=>rpc(db,usuarios.ana),/insufficient_aal/);
  const ok=await rpc(db,usuarios.ana,0,[],{aal:'aal2'}); assert.equal(ok.rev,0);
  const situacao=await como(db,usuarios.ana,()=>db.query('select public.minha_situacao() as s'),{aal:'aal2'});
  assert.equal(situacao.rows[0].s.preco,19.9);
});

test('migrações reais: páginas respeitam revisão e cursor sem perda nem repetição', async t => {
  const db=await criarBanco(); t.after(()=>db.close());
  // Três revisões cheias: cada pedido admite até 500 alterações.
  for(let lote=0;lote<3;lote++) {
    const arr=Array.from({length:500},(_,i)=>({c:'clientes',id:`${lote}-${i}`,d:{nome:`${lote}-${i}`}}));
    await rpc(db,usuarios.ana,0,arr);
  }
  let cursor=0, recebidos=[];
  for(let pagina=0;pagina<5;pagina++) {
    const resposta=await rpc(db,usuarios.ana,cursor,[]);
    recebidos.push(...resposta.mudancas.map(x=>x.id));
    if(!resposta.mais) { assert.equal(resposta.rev,3); break; }
    assert.ok(resposta.rev>cursor); cursor=resposta.rev;
  }
  assert.equal(recebidos.length,1500); assert.equal(new Set(recebidos).size,1500);
});

test('migrações reais: compras únicas mensais e anuais, teste grátis, soma, idempotência e estorno', async t => {
  const db=await criarBanco(); t.after(()=>db.close());
  const su=()=>como(db,usuarios.ana,()=>db.query('select public.minha_situacao() as s'));
  let situacao=(await su()).rows[0].s;
  assert.equal(situacao.preco_promo,14.9); assert.equal(situacao.preco,19.9); assert.equal(situacao.preco_anual,149.9);
  assert.equal(situacao.pago_ate,null); assert.equal(situacao.plano,null); assert.equal(situacao.liberado_ate,situacao.teste_ate);
  assert.equal(situacao.assinatura,null); assert.equal('valido_ate' in situacao,false); assert.equal('anual_ate' in situacao,false);
  const comprar=(id,plano='mensal',valor=plano==='mensal'?14.9:149.9,ok=true,user=usuarios.ana)=>
    como(db,user,()=>db.query('select public.registrar_compra($1,$2,$3,$4,$5) as r',[id,user,valor,ok,plano]),{role:'service_role'});
  await assert.rejects(()=>como(db,usuarios.ana,()=>db.query('select public.registrar_compra($1,$2,$3,$4,$5)',['negado',usuarios.ana,14.9,true,'mensal']),{role:'authenticated'}),/permission denied/);
  await assert.rejects(()=>comprar('plano-invalido','semanal',3),/parametros_invalidos/);

  const primeira=(await comprar('pay-m1')).rows[0].r;
  assert.equal(primeira.plano,'mensal');
  assert.equal(new Date(primeira.valido_ate).getTime()-new Date(primeira.valido_de).getTime(),30*86400000);
  assert.equal(new Date(primeira.valido_de).getTime(),new Date(situacao.teste_ate).getTime());
  const repetida=(await comprar('pay-m1')).rows[0].r;
  assert.equal(repetida.valido_ate,primeira.valido_ate);
  situacao=(await su()).rows[0].s;
  assert.equal(situacao.pago_ate,primeira.valido_ate); assert.equal(situacao.plano,'mensal'); assert.equal(situacao.preco_promo,null);
  await comprar('pay-m1','mensal',14.9,false);
  situacao=(await su()).rows[0].s;
  assert.equal(situacao.pago_ate,null); assert.equal(situacao.plano,null); assert.equal(situacao.preco_promo,14.9);
  assert.equal(situacao.liberado_ate,situacao.teste_ate);

  const mensal=(await comprar('pay-m2')).rows[0].r;
  const anual=(await comprar('pay-a1','anual')).rows[0].r;
  assert.equal(new Date(mensal.valido_de).getTime(),new Date(situacao.teste_ate).getTime());
  assert.equal(new Date(mensal.valido_ate).getTime()-new Date(mensal.valido_de).getTime(),30*86400000);
  assert.equal(new Date(anual.valido_de).getTime(),new Date(mensal.valido_ate).getTime());
  assert.equal(new Date(anual.valido_ate).getTime()-new Date(anual.valido_de).getTime(),365*86400000);
  situacao=(await su()).rows[0].s;
  assert.equal(situacao.pago_ate,anual.valido_ate); assert.equal(situacao.plano,'anual'); assert.equal(situacao.preco_promo,null);
  await comprar('pay-a1','anual',149.9,false);
  situacao=(await su()).rows[0].s;
  assert.equal(situacao.pago_ate,mensal.valido_ate); assert.equal(situacao.plano,'mensal'); assert.equal(situacao.preco_promo,null);
  await comprar('pay-m2','mensal',14.9,false);
  situacao=(await su()).rows[0].s;
  assert.equal(situacao.pago_ate,null); assert.equal(situacao.plano,null); assert.equal(situacao.preco_promo,14.9);

  const antiga=(await comprar('pay-old','mensal',14.9,true,usuarios.bia)).rows[0].r;
  await db.query('update public.compras set valido_de=now()-interval \'40 days\',valido_ate=now()-interval \'10 days\' where mp_payment_id=$1',[antiga.mp_payment_id]);
  await db.query('insert into public.assinaturas(user_id,status,valido_ate) values($1,$2,now()+interval \'90 days\')',[usuarios.ana,'ativa']);
  const semCompraAtual=await como(db,usuarios.bia,()=>db.query('select public.minha_situacao() s'));
  assert.equal(semCompraAtual.rows[0].s.plano,'mensal');
  assert.ok(new Date(semCompraAtual.rows[0].s.pago_ate)<new Date(semCompraAtual.rows[0].s.agora));
  situacao=(await su()).rows[0].s; assert.equal(situacao.pago_ate,null); assert.equal(situacao.liberado_ate,situacao.teste_ate);
  await db.query("update public.planos set ativo=false where id='mensal_promo'");
  situacao=(await su()).rows[0].s; assert.equal(situacao.preco_promo,null);
  const comprasAna=await como(db,usuarios.ana,()=>db.query('select count(*)::int n from public.compras'));
  const comprasBia=await como(db,usuarios.bia,()=>db.query('select count(*)::int n from public.compras'));
  assert.equal(comprasAna.rows[0].n,3); assert.equal(comprasBia.rows[0].n,1);
});
