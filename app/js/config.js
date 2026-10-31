/* Configuração central do app. Tudo que é "número mágico" ou nome fixo mora aqui.
   ATENÇÃO: os nomes de armazenamento e o formato da cópia são contrato com os dados
   que já estão nos celulares — mudar quebra o acesso às contas antigas. */
export const CONFIG = Object.freeze({
  // Armazenamento no aparelho (NÃO MUDAR)
  CHAVE_DADOS: 'caderninho-v1',
  IDB_NOME: 'caderninho',
  IDB_VERSAO: 1,
  IDB_STORE: 'kv',

  // Cópia de segurança (NÃO MUDAR sem manter a leitura do formato antigo)
  COPIA_APP: 'caderninho',
  COPIA_VERSAO: 1,
  DIAS_PARA_LEMBRAR_COPIA: 7,

  // Fotos dos doces
  FOTO_MAX_PX: 480,
  FOTO_QUALIDADE: 0.72,

  // Pagamentos
  FORMAS_PAGAMENTO: Object.freeze(['Pix', 'Dinheiro', 'Cartão']),
  FORMA_NA_HORA: 'Na hora',

  // WhatsApp: números com até 11 dígitos recebem o código do Brasil
  DDI_PADRAO: '55',

  // Telas: a partir de quantas pessoas aparece a caixa de busca
  BUSCA_CLIENTES_ACIMA_DE: 4,
  BUSCA_VENDA_ACIMA_DE: 6,

  // Tempo dos avisos (ms)
  AVISO_MS: 2600,
  AVISO_ERRO_MS: 4500,

  // Diário técnico (só para diagnóstico; não aparece nas telas)
  CHAVE_LOG: 'caderninho-log',
  LOG_MAX: 50,
});
