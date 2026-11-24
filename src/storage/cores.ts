import { database } from './documents';

export const VAGAS_DE_COR = 16;

export interface CorPersonalizada {
  slot: number;
  cor: string;
}

/** Aceita o hexadecimal completo ou abreviado e guarda sempre seis dígitos. */
export function normalizarCorHex(valor: string): string | null {
  const digitos = valor.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(digitos)) return `#${digitos}`;
  if (/^[0-9a-f]{3}$/.test(digitos))
    return `#${[...digitos].map((digito) => digito.repeat(2)).join('')}`;
  return null;
}

function slotValido(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < VAGAS_DE_COR;
}

export async function listarCoresPersonalizadas(): Promise<(string | null)[]> {
  const registros = await database.table<CorPersonalizada, number>('cores').toArray();
  const cores: (string | null)[] = Array.from({ length: VAGAS_DE_COR }, () => null);
  for (const { slot, cor } of registros) {
    if (slotValido(slot) && typeof cor === 'string') cores[slot] = normalizarCorHex(cor);
  }
  return cores;
}

export async function gravarCorPersonalizada(slot: number, cor: string): Promise<void> {
  const hex = normalizarCorHex(cor);
  if (!slotValido(slot) || !hex) throw new Error('Escolha uma vaga e uma cor válida.');
  await database.table<CorPersonalizada, number>('cores').put({ slot, cor: hex });
}
