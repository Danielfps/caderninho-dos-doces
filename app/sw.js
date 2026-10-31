/* Deixa o caderninho abrir sem internet.
   Mostra na hora o que já está guardado e, em segundo plano, busca a versão nova
   (que aparece na próxima vez que abrir). Ao mudar a lista de arquivos, troque a VERSAO. */
const VERSAO='caderninho-v4';
const ARQUIVOS=['./','./index.html','./manifest.webmanifest','./icons/favicon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./planilha-modelo.xlsx'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSAO).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSAO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const proprio=url.origin===location.origin;
  const fonte=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  if(!proprio&&!fonte)return;
  const chave=req.mode==='navigate'?new Request('./index.html'):req;
  const rede=fetch(req);
  const guardar=rede.then(r=>{
    if(!((r.ok&&!r.redirected)||r.type==='opaque'))return;
    const copia=r.clone();
    return caches.open(VERSAO).then(c=>c.put(chave,copia));
  });
  e.waitUntil(guardar.catch(()=>{}));
  e.respondWith(caches.match(chave,{ignoreSearch:proprio}).then(g=>g||rede));
});
