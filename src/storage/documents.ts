import Dexie, { type Table } from 'dexie';

export interface DocumentSnapshot {
  id: 'current';
  name: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  updatedAt: number;
}

const MAX_SIDE = 4096;
const MAX_PIXELS = 16_000_000;

class DocumentDatabase extends Dexie {
  documents!: Table<DocumentSnapshot, 'current'>;

  constructor() {
    super('rabisco-documentos');
    this.version(1).stores({ documents: 'id' });
  }
}

const database = new DocumentDatabase();

/** Impede que um registro incompleto ou corrompido seja restaurado no canvas. */
function validateSnapshot(snapshot: DocumentSnapshot): void {
  const { width, height, pixels } = snapshot;
  if (
    snapshot.id !== 'current' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_SIDE ||
    height > MAX_SIDE ||
    width * height > MAX_PIXELS ||
    !(pixels instanceof Uint8ClampedArray) ||
    pixels.length !== width * height * 4 ||
    typeof snapshot.name !== 'string' ||
    !Number.isFinite(snapshot.updatedAt)
  ) {
    throw new Error('O trabalho salvo está incompleto ou tem dimensões inválidas.');
  }
}

/** O banco recebe uma cópia: o próximo traço não pode alterar um salvamento em curso. */
export async function saveDocument(snapshot: DocumentSnapshot): Promise<void> {
  validateSnapshot(snapshot);
  const copy: DocumentSnapshot = {
    ...snapshot,
    pixels: new Uint8ClampedArray(snapshot.pixels),
  };
  try {
    await database.documents.put(copy);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('O armazenamento do navegador está cheio. Salve seu desenho em PNG.');
    }
    throw new Error('Não foi possível salvar neste navegador. Salve uma cópia em PNG.');
  }
}

export async function loadDocument(): Promise<DocumentSnapshot | undefined> {
  const snapshot = await database.documents.get('current');
  if (!snapshot) return undefined;
  validateSnapshot(snapshot);
  return { ...snapshot, pixels: new Uint8ClampedArray(snapshot.pixels) };
}

export async function clearSavedDocument(): Promise<void> {
  await database.documents.delete('current');
}
