import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSavedDocument,
  loadDocument,
  saveDocument,
  type DocumentSnapshot,
} from '../../src/storage/documents';

const makeSnapshot = (): DocumentSnapshot => ({
  id: 'current',
  name: 'Meu rabisco',
  width: 2,
  height: 1,
  pixels: new Uint8ClampedArray([10, 20, 30, 255, 50, 60, 70, 128]),
  updatedAt: 100,
});

afterEach(async () => {
  await clearSavedDocument();
});

describe('autossalvamento local', () => {
  it('recupera nome, dimensões e transparência sem base64', async () => {
    const snapshot = makeSnapshot();
    await saveDocument(snapshot);
    expect(await loadDocument()).toEqual(snapshot);
  });

  it('isola os pixels de alterações feitas enquanto salva ou após restaurar', async () => {
    const snapshot = makeSnapshot();
    const pendingSave = saveDocument(snapshot);
    snapshot.pixels[0] = 200;
    await pendingSave;
    const restored = await loadDocument();
    expect(restored?.pixels[0]).toBe(10);
    restored!.pixels[0] = 77;
    expect((await loadDocument())?.pixels[0]).toBe(10);
  });

  it('substitui o trabalho atual e permite removê-lo', async () => {
    await saveDocument(makeSnapshot());
    await saveDocument({ ...makeSnapshot(), name: 'Outro desenho', updatedAt: 200 });
    expect((await loadDocument())?.name).toBe('Outro desenho');
    await clearSavedDocument();
    expect(await loadDocument()).toBeUndefined();
  });

  it('rejeita dimensões e pixels incompatíveis sem sobrescrever o trabalho', async () => {
    await saveDocument(makeSnapshot());
    await expect(saveDocument({ ...makeSnapshot(), width: 4097 })).rejects.toThrow('dimensões');
    await expect(
      saveDocument({ ...makeSnapshot(), pixels: new Uint8ClampedArray(4) }),
    ).rejects.toThrow('incompleto');
    expect((await loadDocument())?.width).toBe(2);
  });
});
