/* Cópia de segurança: montar e ler. Formato (contrato):
   { app:'caderninho', versao:1, em:ISO, dados:{ produtos, clientes, lanc } } */

/** Texto da cópia de segurança. */
export function montarCopia(dados, { app, versao, agoraISO }) {
  return JSON.stringify({ app, versao, em: agoraISO, dados: { produtos: dados.produtos, clientes: dados.clientes, lanc: dados.lanc } });
}

/** Lê um texto de cópia. Devolve { dados } ou { erro } (nunca lança exceção).
    Aceita qualquer versão que tenha as três listas — mantém compatibilidade com cópias antigas. */
export function lerCopia(txt) {
  let o;
  try { o = JSON.parse(txt); } catch { return { erro: 'invalida' }; }
  const d = o && o.dados;
  if (!d || !Array.isArray(d.produtos) || !Array.isArray(d.clientes) || !Array.isArray(d.lanc)) return { erro: 'invalida' };
  return { dados: { produtos: d.produtos, clientes: d.clientes, lanc: d.lanc } };
}
