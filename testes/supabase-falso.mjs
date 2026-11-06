import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from './node_modules/@electric-sql/pglite/dist/index.js';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chave='chave-publica-caderninho-teste';
const chaveServico='chave-service-caderninho-teste';
const segredo='segredo-jwt-caderninho-falso';
const b64=x=>Buffer.from(x).toString('base64url');
const json=(res,status,obj)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(obj));};
const erro=(code,error_code,msg)=>({code,error_code,msg});

export async function criarSupabaseFalso(){
  const db=new PGlite(); let fila=Promise.resolve();
  const serial=fn=>{const atual=fila.then(fn);fila=atual.catch(()=>{});return atual;};
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text unique,created_at timestamptz default now(),senha text,nome text);
    create table auth.mfa_factors(id uuid default gen_random_uuid(),user_id uuid,status text,factor_type text default 'totp');
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  for(const file of (await readdir(path.join(raiz,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort())
    await db.exec(await readFile(path.join(raiz,'supabase/migrations',file),'utf8'));
  const contas=new Map(), sessoes=new Map(), refreshs=new Map(), preferencias=new Map(), pagamentos=new Map(), pedidos=[];
  const planosMP=new Map(), assinaturasMP=new Map(), faturasMP=new Map();
  const relogio={agora:Date.now(),avancar(ms){this.agora+=ms;}};
  let duracaoToken=3600, fora=false, contador=0, falharFechamentoPlano=false;
  function tokenPara(sessao){const agora=Math.floor(relogio.agora/1000),exp=agora+duracaoToken;
    const payload={sub:sessao.user.id,email:sessao.user.email,role:'authenticated',aal:'aal1',session_id:sessao.id,iat:agora,exp};
    const parte=`${b64(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64(JSON.stringify(payload))}`;
    return {access_token:`${parte}.${createHmac('sha256',segredo).update(parte).digest('base64url')}`,token_type:'bearer',expires_in:duracaoToken,expires_at:exp,refresh_token:sessao.refresh,user:sessao.user};}
  function novaSessao(user){const s={id:randomBytes(16).toString('hex'),user,refresh:randomBytes(32).toString('hex'),encerrada:false,usados:new Map()};sessoes.set(s.id,s);refreshs.set(s.refresh,s);return tokenPara(s);}
  function decodificar(jwt){try{const [a,b,c]=jwt.split('.');const espera=createHmac('sha256',segredo).update(`${a}.${b}`).digest();const tem=Buffer.from(c,'base64url');if(espera.length!==tem.length||!timingSafeEqual(espera,tem))return null;return JSON.parse(Buffer.from(b,'base64url'));}catch{return null;}}
  async function corpo(req){let raw='';for await(const x of req)raw+=x;try{return raw?JSON.parse(raw):{};}catch{return null;}}
  async function comClaims(claims,role,fn){return serial(async()=>{await db.query('select set_config($1,$2,false)',['request.jwt.claims',JSON.stringify(claims??{})]);await db.exec(`set role ${role}`);try{return await fn();}finally{await db.exec('reset role');}});}
  async function comService(fn){return comClaims({role:'service_role'},'service_role',fn);}
  async function sql(texto,params=[]){return (await serial(()=>db.query(texto,params))).rows;}
  function authDa(req){const jwt=(req.headers.authorization??'').replace(/^Bearer\s+/i,'');const claims=decodificar(jwt);return {jwt,claims,s:sessoes.get(claims?.session_id)};}
  function vencido(res,area){if(area==='auth')json(res,403,{code:403,error_code:'bad_jwt',msg:'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired'});else if(area==='rest')json(res,401,{code:'PGRST303',message:'JWT expired',details:null,hint:null});else json(res,401,{code:401,message:'Invalid JWT'});}
  function sessaoValida(req,res,area){const a=authDa(req);if(!a.claims){json(res,area==='functions'?401:401,area==='functions'?{message:'Invalid JWT'}:{message:'Invalid token'});return null;}if(a.claims.exp<=Math.floor(relogio.agora/1000)){vencido(res,area);return null;}if(!a.s||a.s.encerrada){if(area==='auth')json(res,403,{code:403,error_code:'session_not_found',msg:'Session from session_id claim in JWT does not exist'});else json(res,401,{message:'Invalid JWT'});return null;}return a;}

  function criarPlanoFake(row){
    const id=`falso-plano-${++contador}`;
    const plano={id,collector_id:'123456',external_reference:String(row.id),status:'active',reason:`Plano ${row.plano}`,
      init_point:`https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${id}`,
      auto_recurring:{frequency:row.plano==='anual'?12:1,frequency_type:'months',transaction_amount:Number(row.valor_inicial),currency_id:'BRL'}};
    planosMP.set(id,plano);return plano;
  }
  function pagarPlanoFake(planoId,{payerEmail='pagador@outro-dominio.test',payerId=String(910000+contador++)}={}){
    const plano=planosMP.get(String(planoId));if(!plano||plano.status==='cancelled')throw Error('plano indisponivel');
    const assinaturaId=`falso-assinatura-${++contador}`;
    const assinatura={id:assinaturaId,collector_id:plano.collector_id,external_reference:null,payer_email:null,payer_id:payerId,
      preapproval_plan_id:plano.id,status:'authorized',date_created:new Date(relogio.agora+contador).toISOString(),last_modified:new Date(relogio.agora).toISOString(),
      auto_recurring:structuredClone(plano.auto_recurring),reason:plano.reason,summarized:{charged_quantity:0}};
    assinaturasMP.set(assinaturaId,assinatura);
    const fatura=cobrarAssinaturaFake(assinaturaId,{payerEmail});
    return {assinatura,fatura};
  }
  function cobrarAssinaturaFake(assinaturaId,{payerEmail='pagador@outro-dominio.test'}={}){
    const assinatura=assinaturasMP.get(String(assinaturaId));if(!assinatura)throw Error('assinatura inexistente');
    const plano=planosMP.get(assinatura.preapproval_plan_id);const id=String(720000+ ++contador);const pagamentoId=String(820000+contador);
    const fatura={id:Number(id),preapproval_id:assinatura.id,type:'recurring',status:'processed',date_created:new Date(relogio.agora).toISOString(),
      last_modified:new Date(relogio.agora).toISOString(),transaction_amount:Number(assinatura.auto_recurring.transaction_amount),currency_id:'BRL',
      reason:assinatura.reason,external_reference:plano.external_reference,payment:{id:Number(pagamentoId),status:'approved',status_detail:'accredited'},
      retry_attempt:0,debit_date:new Date(relogio.agora).toISOString(),payment_method_id:'visa'};
    faturasMP.set(id,{...fatura,payerEmail});assinatura.summarized.charged_quantity=Number(assinatura.summarized.charged_quantity||0)+1;
    pagamentos.set(pagamentoId,{id:Number(pagamentoId),collector_id:plano.collector_id,external_reference:plano.external_reference,
      operation_type:'regular_payment',status:'approved',currency_id:'BRL',transaction_amount:fatura.transaction_amount,payer:{id:assinatura.payer_id,email:payerEmail}});
    return fatura;
  }
  async function fecharPlanoFake(planoId){
    if(falharFechamentoPlano)throw Error('bad_request');
    const plano=planosMP.get(String(planoId));if(!plano)return false;
    if([...assinaturasMP.values()].some(a=>a.preapproval_plan_id===String(planoId)&&a.status==='authorized'))throw Error('bad_request');
    plano.status='cancelled';return true;
  }
  async function sincronizarContratacaoFake(row){
    const plano=planosMP.get(String(row.mp_plano_id));if(!plano)return null;
    const achadas=[...assinaturasMP.values()].filter(a=>a.preapproval_plan_id===plano.id&&a.collector_id===plano.collector_id);
    const autorizadas=achadas.filter(a=>a.status==='authorized').sort((a,b)=>Date.parse(a.date_created)-Date.parse(b.date_created));
    const principal=achadas.find(a=>a.id===row.mp_preapproval_id)||autorizadas[0];if(!principal)return null;
    principal.external_reference=String(row.id);
    for(const assinatura of achadas){
      for(const fatura of faturasMP.values()){
        if(fatura.preapproval_id!==assinatura.id||fatura.external_reference!==String(row.id))continue;
        await comService(()=>db.query('select public.registrar_cobranca($1,$2,$3,$4,$5,$6,$7,$8)',[
          String(fatura.id),String(row.id),String(fatura.payment.id),Number(fatura.transaction_amount),'aprovada',fatura.status,fatura.payment.status,fatura.debit_date]));
      }
    }
    for(const extra of autorizadas.filter(a=>a.id!==principal.id)){extra.status='cancelled';console.error('Link de assinatura pago mais de uma vez',{contratacao_id:String(row.id),assinatura_id:extra.id});}
    const result=await comService(()=>db.query('select public.aplicar_preapproval($1,$2,$3,$4,$5) r',[
      String(row.id),String(principal.id),String(principal.status),principal.last_modified,null]));
    const aplicada=result.rows[0].r;
    if(aplicada.cancelar_no_mp)principal.status='cancelled';
    if(['cancelada','abandonada'].includes(aplicada.estado))try{await fecharPlanoFake(plano.id);}catch{}
    return aplicada;
  }

  async function tratar(req,res,caminho){
    const url=new URL(req.url,'http://localhost');const route=caminho.replace(/^\/+/,''),metodo=req.method||'GET';
    pedidos.push({metodo,caminho:route,status:0});const pedido=pedidos.at(-1);
    res.once('finish',()=>{pedido.status=res.statusCode;});
    const fim=(status,obj)=>{pedido.status=status;if(status===204){res.statusCode=204;res.end();}else json(res,status,obj);};
    if(fora)return fim(503,{message:'Service Unavailable'});
    if(![chave,chaveServico].includes(req.headers.apikey))return fim(401,{message:'Invalid API key'});
    const body=await corpo(req);
    try{
      if(route==='auth/v1/signup'&&metodo==='POST'){
        if(!body?.email||!body?.password)return fim(400,erro(400,'validation_failed','Email and password are required'));
        const existente=await sql('select id from auth.users where lower(email)=lower($1)',[body.email]);if(existente.length)return fim(422,erro(422,'user_already_exists','User already registered'));
        const id=crypto.randomUUID();const senha=scryptSync(String(body.password),'caderninho-falso',32).toString('hex');
        await sql('insert into auth.users(id,email,senha,nome) values($1,$2,$3,$4)',[id,body.email,senha,body.data?.nome??'']);
        const user={id,email:body.email,user_metadata:{nome:body.data?.nome??''},created_at:(await sql('select created_at from auth.users where id=$1',[id]))[0].created_at,email_confirmed_at:new Date(relogio.agora).toISOString(),factors:[]};
        contas.set(id,user);return fim(200,novaSessao(user));
      }
      if(route==='auth/v1/token'&&metodo==='POST'){
        if(url.searchParams.get('grant_type')==='password'){
          const rows=await sql('select id,email,senha,nome,created_at from auth.users where lower(email)=lower($1)',[body?.email]);const user=rows[0];
          const conf=scryptSync(String(body?.password??''),'caderninho-falso',32).toString('hex');if(!user||conf!==user.senha)return fim(400,erro(400,'invalid_credentials','Invalid login credentials'));
          const u={id:user.id,email:user.email,user_metadata:{nome:user.nome??''},created_at:user.created_at,email_confirmed_at:user.created_at,factors:[]};contas.set(u.id,u);return fim(200,novaSessao(u));
        }
        if(url.searchParams.get('grant_type')==='refresh_token'){
          const old=refreshs.get(body?.refresh_token);if(!old)return fim(400,erro(400,'refresh_token_not_found','Invalid Refresh Token: Refresh Token Not Found'));
          if(old.encerrada)return fim(400,erro(400,'refresh_token_not_found','Invalid Refresh Token: Refresh Token Not Found'));
          const used=old.usados.get(body.refresh_token);if(used){if(relogio.agora-used.em<10000)return fim(200,used.par);old.encerrada=true;return fim(400,erro(400,'refresh_token_already_used','Invalid Refresh Token: Already Used'));}
          const anterior=old.refresh;old.refresh=randomBytes(32).toString('hex');refreshs.set(old.refresh,old);
          const par=tokenPara(old);old.usados.set(body.refresh_token,{em:relogio.agora,par});refreshs.set(anterior,old);return fim(200,par);
        }
      }
      if(route==='auth/v1/user'&&(metodo==='GET'||metodo==='PUT')){
        const a=sessaoValida(req,res,'auth');if(!a)return;
        if(metodo==='PUT'){if(body?.data){a.s.user.user_metadata={...a.s.user.user_metadata,...body.data};a.s.user.nome=a.s.user.user_metadata.nome;await sql('update auth.users set nome=$1 where id=$2',[a.s.user.nome??'',a.s.user.id]);}if(body?.password){await sql('update auth.users set senha=$1 where id=$2',[scryptSync(String(body.password),'caderninho-falso',32).toString('hex'),a.s.user.id]);}return fim(200,a.s.user);}
        return fim(200,{...a.s.user,factors:(await sql("select id,status,factor_type from auth.mfa_factors where user_id=$1",[a.s.user.id]))});
      }
      if(route==='auth/v1/logout'&&metodo==='POST'){const a=sessaoValida(req,res,'auth');if(!a)return;a.s.encerrada=true;return fim(204);}
      if(['auth/v1/recover','auth/v1/resend'].includes(route)&&metodo==='POST')return fim(200,{});
      if(route==='rest/v1/planos'&&metodo==='GET'){
        const rows=await sql('select * from public.planos order by id');const filtradas=rows.filter(r=>[...url.searchParams].every(([k,v])=>k==='select'||k==='limit'||!v.startsWith('eq.')||String(r[k])===v.slice(3)));
        const cols=url.searchParams.get('select');return fim(200,filtradas.slice(0,Number(url.searchParams.get('limit')||100)).map(r=>cols&&cols!=='*'?Object.fromEntries(cols.split(',').map(k=>[k,r[k]])):r));
      }
      if(route==='rest/v1/contratacoes'&&metodo==='GET'){
        if(req.headers.authorization!==`Bearer ${chaveServico}`)return fim(401,{message:'Invalid service role'});
        let rows=await sql('select * from public.contratacoes');
        for(const [key,value] of url.searchParams){
          if(key==='select'||key==='limit'||key==='order')continue;
          if(key==='criado_em'&&value.startsWith('gte.'))rows=rows.filter(r=>new Date(r.criado_em)>=new Date(value.slice(4)));
          else if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));
          else if(value.startsWith('in.')){const values=value.slice(4).replace(/^\(|\)$/g,'').split(',');rows=rows.filter(r=>values.includes(String(r[key])));}
        }
        const order=url.searchParams.get('order')||'';if(order.includes('criado_em.desc'))rows.sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em));
        else if(order.includes('sincronizada_em.asc'))rows.sort((a,b)=>(a.sincronizada_em?new Date(a.sincronizada_em).getTime():-Infinity)-(b.sincronizada_em?new Date(b.sincronizada_em).getTime():-Infinity));
        const limit=Number(url.searchParams.get('limit')||50);return fim(200,rows.slice(0,limit));
      }
      if(route.startsWith('rest/v1/rpc/')&&metodo==='POST'){
        const nome=route.slice('rest/v1/rpc/'.length);const token=(req.headers.authorization??'').replace(/^Bearer\s+/i,'');const cl=token?decodificar(token):null;
        if(token&&token!==chaveServico&&!sessaoValida(req,res,'rest'))return;
        const role=token===chaveServico?'service_role':cl?'authenticated':'anon';
        const specs={
          sincronizar:{keys:['desde','mudancas','aparelho'],sql:'public.sincronizar($1,$2::jsonb,$3)'},
          minha_situacao:{keys:[],sql:'public.minha_situacao()'},
          registrar_compra:{keys:['p_payment_id','p_user','p_valor','p_aprovado','p_plano'],sql:'public.registrar_compra($1,$2,$3,$4,$5)'},
          iniciar_contratacao:{keys:['p_user','p_plano'],sql:'public.iniciar_contratacao($1,$2)'},
          gravar_checkout:{keys:['p_id','p_mp_plano_id','p_init_point'],sql:'public.gravar_checkout($1,$2,$3)'},
          fechar_contratacao:{keys:['p_id','p_estado'],sql:'public.fechar_contratacao($1,$2)'},
          aplicar_preapproval:{keys:['p_id','p_mp_id','p_status','p_ultima_mudanca','p_proxima'],sql:'public.aplicar_preapproval($1,$2,$3,$4,$5)'},
          registrar_cobranca:{keys:['p_mp_cobranca_id','p_contratacao','p_pagamento','p_valor','p_estado','p_mp_status','p_pag_status','p_debitada'],sql:'public.registrar_cobranca($1,$2,$3,$4,$5,$6,$7,$8)'},
          registrar_evento:{keys:['p_chave','p_tipo','p_acao','p_mp_id','p_ao_vivo'],sql:'public.registrar_evento($1,$2,$3,$4,$5)'},
          concluir_evento:{keys:['p_chave','p_resultado','p_detalhe'],sql:'public.concluir_evento($1,$2,$3)'},
        };
        const spec=specs[nome];if(!spec)return fim(404,{message:'function not found'});
        try{const result=await comClaims(cl??{role},role,async()=>{
          const args=spec.keys.map((k,i)=>body?.[k]??(nome==='sincronizar'&&i===0?0:nome==='sincronizar'&&i===1?[]:null));
          const out=await db.query(`select ${spec.sql} as valor`,args.map((x,i)=>nome==='sincronizar'&&i===1?JSON.stringify(x):x));return out.rows[0]?.valor;
        });return fim(200,result);
        }catch(e){const c=e.code;return fim(c==='42501'?(role==='anon'?401:403):400,{code:c||'P0001',message:e.message,details:null,hint:null});}
      }
      if(route==='functions/v1/assinatura'&&metodo==='POST'){
        const a=sessaoValida(req,res,'functions');if(!a)return;
        const situacao=async()=>comClaims({sub:a.s.user.id,role:'authenticated',aal:a.claims.aal},'authenticated',async()=> (await db.query('select public.minha_situacao() s')).rows[0].s);
        if(body?.acao==='conferir'){
          const rows=await sql("select * from public.contratacoes where user_id=$1 and estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento','abandonada')",[a.s.user.id]);
          for(const row of rows)await sincronizarContratacaoFake(row);
          const refs=new Set([`mensal:${a.s.user.id}`,`anual:${a.s.user.id}`]);
          for(const pagamento of pagamentos.values())if(refs.has(pagamento.external_reference)&&['approved','refunded','charged_back','cancelled','canceled'].includes(pagamento.status)){
            const plano=pagamento.external_reference.startsWith('mensal:')?'mensal':'anual';
            await comService(()=>db.query('select public.registrar_compra($1,$2,$3,$4,$5)',[String(pagamento.id),a.s.user.id,Number(pagamento.transaction_amount)||0,pagamento.status==='approved',plano]));
          }
          return fim(200,{situacao:await situacao()});
        }
        if(body?.acao==='cancelar'){
          let rows=await sql("select * from public.contratacoes where user_id=$1 and estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento') order by criado_em desc limit 1",[a.s.user.id]);
          let row=rows[0];if(row){await sincronizarContratacaoFake(row);row=(await sql('select * from public.contratacoes where id=$1',[row.id]))[0]??row;
            if(row.mp_preapproval_id){const sub=assinaturasMP.get(row.mp_preapproval_id);if(sub)sub.status='cancelled';try{await fecharPlanoFake(row.mp_plano_id);}catch{};
              await comService(()=>db.query('select public.aplicar_preapproval($1,$2,$3,$4,$5)',[row.id,row.mp_preapproval_id,'cancelled',new Date(relogio.agora).toISOString(),null]));
            }else{try{await fecharPlanoFake(row.mp_plano_id);}catch{};await comService(()=>db.query('select public.fechar_contratacao($1,$2)',[row.id,'abandonada']));}
          }
          return fim(200,{situacao:await situacao()});
        }
        if(body?.acao!=='criar'||!['mensal','anual'].includes(body.plano))return fim(400,{erro:'pedido'});
        for(let tent=0;tent<4;tent++){
          const acao=await comService(async()=> (await db.query('select public.iniciar_contratacao($1,$2) r',[a.s.user.id,body.plano])).rows[0].r);
          if(acao.acao==='ja_ativa')return fim(409,{erro:'ja_ativa'});
          if(acao.acao==='limite')return fim(429,{erro:'limite'});
          if(acao.acao==='plano_indisponivel')return fim(409,{erro:'plano_indisponivel'});
          if(acao.acao==='em_andamento')return fim(409,{erro:'em_andamento'});
          if(acao.acao==='reusar')return fim(200,{init_point:acao.init_point,contratacao_id:String(acao.id)});
          if(acao.acao==='substituir'){
            let velho=(await sql('select * from public.contratacoes where id=$1',[acao.id]))[0];
            if(velho){await sincronizarContratacaoFake(velho);velho=(await sql('select * from public.contratacoes where id=$1',[acao.id]))[0]??velho;
              if(velho.mp_preapproval_id){const sub=assinaturasMP.get(velho.mp_preapproval_id);if(sub)sub.status='cancelled';}
              if(velho.mp_plano_id)await fecharPlanoFake(velho.mp_plano_id);
              await comService(()=>db.query('select public.fechar_contratacao($1,$2)',[acao.id,'abandonada']));
            }continue;
          }
          if(['criar','retomar'].includes(acao.acao)){
            const plano=criarPlanoFake(acao);await comService(()=>db.query('select public.gravar_checkout($1,$2,$3)',[acao.id,plano.id,plano.init_point]));
            preferencias.set(plano.id,{userId:a.s.user.id,plano:body.plano,valor:Number(acao.valor_inicial),external_reference:String(acao.id),mp_plano_id:plano.id});
            return fim(200,{init_point:plano.init_point,contratacao_id:String(acao.id)});
          }
        }
        return fim(409,{erro:'em_andamento'});
      }
      if(route.startsWith('functions/v1/'))return fim(404,{message:'not found'});
      if(route.startsWith('rest/v1/'))return fim(404,{message:'not found'});
      return fim(404,{message:'not found'});
    }catch(e){return fim(500,{message:e.message});}
  }
  async function envelhecerConta(email,ms){await sql('update auth.users set created_at=created_at-$2::interval where lower(email)=lower($1)',[email,`${ms} milliseconds`]);}
  async function registrarAprovacao(email,plano){
    const u=(await sql('select id from auth.users where lower(email)=lower($1)',[email]))[0];if(!u)throw Error('conta não encontrada');
    const precos=await sql('select id,valor from public.planos where ativo=true');
    const preco=id=>Number(precos.find(p=>p.id===id)?.valor)||0;
    const jaMensal=(await sql("select 1 from public.compras where user_id=$1 and plano='mensal' and status='aprovada' limit 1",[u.id])).length>0;
    const valor=plano==='anual'?preco('anual'):(jaMensal?preco('mensal'):(preco('mensal_promo')||preco('mensal')));
    if(!valor)throw Error(`plano ${plano} indisponível`);
    const id=`falso-payment-${++contador}`;
    const pagamento={id,external_reference:`${plano}:${u.id}`,currency_id:'BRL',transaction_amount:valor,status:'approved'};
    await comClaims({role:'service_role'},'service_role',async()=>db.query(
      'select public.registrar_compra($1,$2,$3,true,$4)',[id,u.id,valor,plano]));
    pagamentos.set(id,pagamento);
    return id;
  }
  async function aprovarMensal(email){return registrarAprovacao(email,'mensal');}
  async function aprovarAnual(email){return registrarAprovacao(email,'anual');}
  async function estornarPagamento(id){
    const pagamento=pagamentos.get(String(id));if(!pagamento)return false;
    pagamento.status='refunded';const [,userId]=pagamento.external_reference.split(':');const plano=pagamento.external_reference.startsWith('mensal:')?'mensal':'anual';
    await comClaims({role:'service_role'},'service_role',async()=>db.query('select public.registrar_compra($1,$2,$3,false,$4)',[String(id),userId,pagamento.transaction_amount,plano]));
    return true;
  }
  return {chave,chaveServico,tratar,get duracaoToken(){return duracaoToken;},set duracaoToken(n){duracaoToken=Number(n);},relogio,
    get fora(){return fora;},set fora(x){fora=!!x;},get falharFechamentoPlano(){return falharFechamentoPlano;},set falharFechamentoPlano(x){falharFechamentoPlano=!!x;},
    envelhecerConta,aprovarMensal,aprovarAnual,estornarPagamento,pagarPlano:pagarPlanoFake,cobrarAssinatura:cobrarAssinaturaFake,
    desconfirmar(id){const u=contas.get(id);if(u)u.email_confirmed_at=null;for(const s of sessoes.values())if(s.user?.id===id)s.user.email_confirmed_at=null;},
    preferencias,pagamentos,planosMP,assinaturasMP,faturasMP,sql,pedidos,async fechar(){await db.close();}};
}
