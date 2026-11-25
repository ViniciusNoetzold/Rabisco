import { database } from './documents';

/** Um arquivo aberto ou salvo há pouco, guardado neste navegador para reabrir com um clique. */
export interface ArquivoRecente {
  id?: number;
  nome: string;
  /** Nome com extensão, para reabrir com o mesmo tipo. */
  arquivo: string;
  abertoEm: number;
  /** Miniatura pequena (data URL PNG). */
  miniatura: string;
  dados: Blob;
}

const MAXIMO = 10;
/** Arquivos maiores não entram na lista, para não encher o armazenamento do navegador. */
const TAMANHO_MAXIMO = 64 * 1024 * 1024;

export async function adicionarRecente(recente: Omit<ArquivoRecente, 'id'>): Promise<void> {
  if (recente.dados.size > TAMANHO_MAXIMO) return;
  await database.transaction('rw', database.recentes, async () => {
    // O mesmo arquivo vai para o topo em vez de repetir.
    await database.recentes.where('arquivo').equals(recente.arquivo).delete();
    await database.recentes.add(recente);
    const todos = await database.recentes.orderBy('abertoEm').reverse().primaryKeys();
    if (todos.length > MAXIMO) await database.recentes.bulkDelete(todos.slice(MAXIMO));
  });
}

export async function listarRecentes(): Promise<ArquivoRecente[]> {
  return database.recentes.orderBy('abertoEm').reverse().limit(MAXIMO).toArray();
}

export async function lerRecente(id: number): Promise<File | null> {
  const recente = await database.recentes.get(id);
  return recente ? new File([recente.dados], recente.arquivo, { type: recente.dados.type }) : null;
}

export async function limparRecentes(): Promise<void> {
  await database.recentes.clear();
}
