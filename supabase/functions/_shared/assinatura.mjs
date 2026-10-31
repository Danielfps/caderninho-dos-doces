export function mapearStatusMercadoPago(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "authorized": return "ativa";
    case "paused": return "pausada";
    case "cancelled":
    case "canceled": return "cancelada";
    case "pending": return "pendente";
    default: return null;
  }
}

export function calcularLiberadoAte({ testeAte, assinatura, validoAte }) {
  const datas = [testeAte];
  if (validoAte && assinatura === "ativa") {
    datas.push(new Date(new Date(validoAte).getTime() + 3 * 86400000));
  } else if (validoAte && (assinatura === "pausada" || assinatura === "cancelada" || assinatura === "pendente")) {
    datas.push(new Date(validoAte));
  }
  return new Date(Math.max(...datas.map((d) => new Date(d).getTime()))).toISOString();
}

export function criarManifestoWebhook({ id, requestId, ts }) {
  const idAssinado = /^[a-z0-9]+$/i.test(String(id)) ? String(id).toLowerCase() : String(id);
  return `id:${idAssinado};request-id:${requestId};ts:${ts};`;
}

export function isUuid(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor ?? ""));
}

export function validadeNaoEncurtada(status, anterior, nova) {
  if (status === "pendente") return anterior ?? null;
  if (!nova) return anterior ?? null;
  if ((status === "pausada" || status === "cancelada") && anterior) {
    return new Date(anterior) > new Date(nova) ? anterior : nova;
  }
  return nova;
}

const autorizada = (p) => String(p?.status ?? "").toLowerCase() === "authorized";
const criadaEm = (p) => Date.parse(p?.date_created ?? "") || 0;

/* Entre as assinaturas autorizadas da mesma conta, fica a MAIS ANTIGA (a primeira paga); as outras são duplicadas.
   A regra é a mesma em todo lugar (conferir e webhook), então dois avisos ao mesmo tempo nunca cancelam as duas. */
export function separarDuplicadas(lista) {
  const autorizadas = [...(lista ?? [])].filter((p) => p && p.id && autorizada(p))
    .sort((a, b) => criadaEm(a) - criadaEm(b) || String(a.id).localeCompare(String(b.id)));
  return { manter: autorizadas[0] ?? null, duplicadas: autorizadas.slice(1) };
}

/* Qual assinatura vale para a conta: a autorizada que fica (separarDuplicadas); sem nenhuma autorizada, a mais recente.
   Quem abre o pagamento duas vezes e paga pelo primeiro link continua sendo reconhecido. */
export function escolherPreapproval(lista) {
  const { manter } = separarDuplicadas(lista);
  if (manter) return manter;
  const quando = (p) => Date.parse(p?.last_modified ?? p?.date_created ?? "") || 0;
  return [...(lista ?? [])].filter((p) => p && p.id).sort((a, b) => quando(b) - quando(a))[0] ?? null;
}
