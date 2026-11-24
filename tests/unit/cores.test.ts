import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { hslParaRgb, rgbParaHsl } from '../../src/app/components/ColorEditor';
import {
  gravarCorPersonalizada,
  listarCoresPersonalizadas,
  normalizarCorHex,
  VAGAS_DE_COR,
} from '../../src/storage/cores';
import { database, loadDocument, type DocumentSnapshot } from '../../src/storage/documents';
import { listarFormas } from '../../src/storage/formas';
import type { FormaPropria } from '../../src/shapes/presets';

describe('conversão de cores', () => {
  it('normaliza a escrita completa ou abreviada e rejeita valores com transparência', () => {
    expect(normalizarCorHex(' #AbC ')).toBe('#aabbcc');
    expect(normalizarCorHex('F0257B')).toBe('#f0257b');
    expect(normalizarCorHex('#F0257B99')).toBeNull();
    expect(normalizarCorHex('red')).toBeNull();
  });

  it('preserva os canais inteiros ao converter RGB para HSL e de volta', () => {
    const valores = [0, 2, 31, 63, 127, 128, 191, 242, 254, 255];
    const cores = valores.flatMap((r) => valores.flatMap((g) => valores.map((b) => ({ r, g, b }))));
    expect(cores.map((rgb) => hslParaRgb(rgbParaHsl(rgb)))).toEqual(cores);
    expect(rgbParaHsl({ r: 127, g: 127, b: 127 }, 213).h).toBe(213);
    expect(hslParaRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe('paleta personalizada', () => {
  afterEach(async () => {
    await database.table('cores').clear();
    await database.documents.clear();
    await database.formas.clear();
  });

  it('adiciona a paleta ao banco v2 mantendo o documento e as formas próprias', async () => {
    await database.delete();
    const anterior = new Dexie(database.name);
    anterior.version(1).stores({ documents: 'id' });
    anterior.version(2).stores({ documents: 'id', formas: 'id' });
    const documento: DocumentSnapshot = {
      id: 'current',
      name: 'Rascunho',
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([10, 20, 30, 255]),
      updatedAt: 99,
    };
    const forma: FormaPropria = {
      id: 'um-triangulo',
      nome: 'Triângulo',
      pasta: 'Minhas formas',
      path: 'M0 0 L1 1 L0 1 Z',
      fechada: true,
      favorita: false,
      ordem: 0,
    };
    await anterior.table('documents').put(documento);
    await anterior.table('formas').put(forma);
    anterior.close();

    await database.open();
    expect(await loadDocument()).toEqual(documento);
    expect(await listarFormas()).toEqual([forma]);
    expect(await listarCoresPersonalizadas()).toEqual(Array(VAGAS_DE_COR).fill(null));
  });

  it('restaura as 16 vagas em ordem de posição e sobrescreve somente a vaga escolhida', async () => {
    await gravarCorPersonalizada(15, '#F50');
    await gravarCorPersonalizada(0, '#123456');
    await gravarCorPersonalizada(15, '#336699');
    await expect(gravarCorPersonalizada(16, '#fff')).rejects.toThrow('vaga');
    await expect(gravarCorPersonalizada(1, 'verde')).rejects.toThrow('cor');
    database.close();
    await database.open();
    expect(await listarCoresPersonalizadas()).toEqual([
      '#123456',
      ...Array(14).fill(null),
      '#336699',
    ]);
  });
});
