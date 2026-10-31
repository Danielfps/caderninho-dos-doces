/* Infraestrutura: guardar e ler as contas no próprio aparelho.
   1º IndexedDB `caderninho` → store `kv` → chave `caderninho-v1`; se falhar, localStorage['caderninho-v1']. */
import { CONFIG } from '../config.js';
import { log } from './log.js';

function abrirIDB() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(CONFIG.IDB_NOME, CONFIG.IDB_VERSAO);
      r.onupgradeneeded = () => r.result.createObjectStore(CONFIG.IDB_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

/** Lê as contas guardadas. Devolve o objeto guardado ou null se não houver nada. */
export async function carregar() {
  try {
    const db = await abrirIDB();
    const v = await new Promise((res, rej) => {
      const q = db.transaction(CONFIG.IDB_STORE).objectStore(CONFIG.IDB_STORE).get(CONFIG.CHAVE_DADOS);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    if (v) return v;
  } catch (e) { log.aviso('armazenamento', 'IndexedDB indisponível para leitura; tentando localStorage', e); }
  try {
    const v = localStorage.getItem(CONFIG.CHAVE_DADOS);
    if (v) return JSON.parse(v);
  } catch (e) { log.erro('armazenamento', 'não consegui ler o localStorage', e); }
  return null;
}

/** Guarda as contas. Devolve true se conseguiu guardar em algum lugar. */
export async function salvar(dados) {
  const copia = JSON.parse(JSON.stringify(dados));
  try {
    const db = await abrirIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(CONFIG.IDB_STORE, 'readwrite');
      tx.objectStore(CONFIG.IDB_STORE).put(copia, CONFIG.CHAVE_DADOS);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (e) { log.aviso('armazenamento', 'IndexedDB falhou ao guardar; tentando localStorage', e); }
  try {
    localStorage.setItem(CONFIG.CHAVE_DADOS, JSON.stringify(copia));
    return true;
  } catch (e) { log.erro('armazenamento', 'não consegui guardar em lugar nenhum', e); }
  return false;
}

/** Pede ao navegador para não apagar os dados sozinho quando faltar espaço. */
export function pedirArmazenamentoPersistente() {
  try { navigator.storage?.persist?.(); } catch {}
}
