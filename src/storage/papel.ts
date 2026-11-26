import type { EstruturaDocumento } from '../document/camadas';
import type { GuiasDocumento } from '../document/guias';
import { dimensoesValidas, dpiValido } from '../document/dimensoes';
import { database, type DocumentSnapshot } from './documents';
import { colunasELinhas, chaveDoBloco, type PosicaoBloco } from './blocos';

/** Descrição do papel salvo. Os pixels ficam na tabela de blocos. */
export interface PapelSalvo {
  id: 'current';
  nome: string;
  largura: number;
  altura: number;
  dpi: number;
  /** Uma entrada por conjunto de blocos: cada camada e cada máscara (`id#mascara`). */
  camadas: { id: string; nome: string }[];
  /** Camadas, grupos e propriedades (0.3). Sem ela, o papel tem uma camada só (0.2.1). */
  estrutura?: EstruturaDocumento;
  /** Guias e régua de desenho (0.4). */
  guias?: GuiasDocumento;
  atualizadoEm: number;
}

/** Um bloco de 256 × 256 px de uma camada: cor lisa ou imagem PNG. */
export interface BlocoSalvo extends PosicaoBloco {
  id: string;
  documento: 'current';
  camada: string;
  cor?: number;
  png?: Blob;
}

export type BlocoParaGravar = Omit<BlocoSalvo, 'id' | 'documento'>;

export type PapelRecuperado =
  | { tipo: 'blocos'; papel: PapelSalvo; blocos: BlocoSalvo[] }
  | { tipo: 'legado'; snapshot: DocumentSnapshot };

function validarPapel(papel: PapelSalvo): void {
  if (
    papel.id !== 'current' ||
    typeof papel.nome !== 'string' ||
    !dimensoesValidas(papel.largura, papel.altura) ||
    !dpiValido(papel.dpi) ||
    !Array.isArray(papel.camadas) ||
    papel.camadas.length < 1 ||
    !Number.isFinite(papel.atualizadoEm)
  ) {
    throw new Error('O trabalho salvo está incompleto ou tem dimensões inválidas.');
  }
}

function validarBloco(bloco: BlocoSalvo, papel: PapelSalvo): void {
  const { colunas, linhas } = colunasELinhas(papel.largura, papel.altura);
  const valido =
    Number.isInteger(bloco.bx) &&
    Number.isInteger(bloco.by) &&
    bloco.bx >= 0 &&
    bloco.by >= 0 &&
    bloco.bx < colunas &&
    bloco.by < linhas &&
    papel.camadas.some(({ id }) => id === bloco.camada) &&
    (typeof bloco.cor === 'number' || bloco.png instanceof Blob);
  if (!valido) throw new Error('O trabalho salvo tem um trecho corrompido.');
}

function traduzirErro(erro: unknown): Error {
  if (erro instanceof Error && erro.name === 'QuotaExceededError') {
    return new Error('O armazenamento do navegador está cheio. Salve seu desenho em PNG.');
  }
  return new Error('Não foi possível salvar neste navegador. Salve uma cópia em PNG.');
}

/**
 * Grava a descrição do papel e os blocos alterados numa única transação. Com `substituirTudo`,
 * os blocos antigos saem antes (o papel mudou de tamanho ou foi trocado).
 */
export async function gravarPapel(
  papel: PapelSalvo,
  blocos: BlocoParaGravar[],
  substituirTudo: boolean,
): Promise<void> {
  validarPapel(papel);
  const registros: BlocoSalvo[] = blocos.map((bloco) => ({
    ...bloco,
    id: chaveDoBloco('current', bloco.camada, bloco),
    documento: 'current',
  }));
  for (const bloco of registros) validarBloco(bloco, papel);
  try {
    await database.transaction('rw', database.papeis, database.blocos, async () => {
      if (substituirTudo) await database.blocos.where('documento').equals('current').delete();
      if (registros.length) await database.blocos.bulkPut(registros);
      await database.papeis.put(papel);
      // Blocos de camadas ou máscaras que não existem mais (excluídas, mescladas).
      const validos = new Set(papel.camadas.map(({ id }) => id));
      const chaves = await database.blocos.where('documento').equals('current').primaryKeys();
      const sobras = chaves.filter((chave) => !validos.has(String(chave).split(':')[1]));
      if (sobras.length) await database.blocos.bulkDelete(sobras);
    });
  } catch (erro) {
    throw traduzirErro(erro);
  }
}

/** Lê o papel salvo em blocos. Se só existir o formato da 0.2 (pixels inteiros), devolve esse. */
export async function lerPapel(): Promise<PapelRecuperado | undefined> {
  const papel = await database.papeis.get('current');
  if (papel) {
    validarPapel(papel);
    const blocos = await database.blocos.where('documento').equals('current').toArray();
    for (const bloco of blocos) validarBloco(bloco, papel);
    return { tipo: 'blocos', papel, blocos };
  }
  const snapshot = await database.documents.get('current');
  if (!snapshot) return undefined;
  return { tipo: 'legado', snapshot };
}

/** Remove o registro da 0.2 depois que ele foi convertido em blocos. */
export async function apagarLegado(): Promise<void> {
  await database.documents.delete('current');
}

export async function limparPapel(): Promise<void> {
  await database.transaction(
    'rw',
    database.papeis,
    database.blocos,
    database.documents,
    async () => {
      await database.blocos.where('documento').equals('current').delete();
      await database.papeis.delete('current');
      await database.documents.delete('current');
    },
  );
}
