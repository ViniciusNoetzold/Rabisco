import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PixelBuffer, Rect } from '../../src/layers/types';
import { AutosaveBlocos, type EstadoAutosave } from '../../src/storage/autosave';
import {
  areaDoBloco,
  blocosDaArea,
  BlocosSujos,
  corUniforme,
  rgbaDaCor,
} from '../../src/storage/blocos';
import { database, saveDocument } from '../../src/storage/documents';
import { apagarLegado, gravarPapel, lerPapel, limparPapel } from '../../src/storage/papel';

function papel(largura: number, altura: number, rgba = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: largura, height: altura, data };
}

function recortar(imagem: PixelBuffer, area: Rect): PixelBuffer {
  const data = new Uint8ClampedArray(area.width * area.height * 4);
  for (let y = 0; y < area.height; y++) {
    const inicio = ((area.y + y) * imagem.width + area.x) * 4;
    data.set(imagem.data.subarray(inicio, inicio + area.width * 4), y * area.width * 4);
  }
  return { width: area.width, height: area.height, data };
}

afterEach(async () => {
  vi.useRealTimers();
  await limparPapel();
});

describe('grade de blocos', () => {
  it('lista só os blocos tocados por uma área, cortando nas bordas do papel', () => {
    expect(blocosDaArea({ x: 250, y: 10, width: 20, height: 5 }, 1000, 600)).toEqual([
      { bx: 0, by: 0 },
      { bx: 1, by: 0 },
    ]);
    expect(blocosDaArea({ x: 990, y: 590, width: 50, height: 50 }, 1000, 600)).toEqual([
      { bx: 3, by: 2 },
    ]);
    expect(blocosDaArea({ x: 2000, y: 0, width: 10, height: 10 }, 1000, 600)).toEqual([]);
    expect(areaDoBloco({ bx: 3, by: 2 }, 1000, 600)).toEqual({
      x: 768,
      y: 512,
      width: 232,
      height: 88,
    });
  });

  it('reconhece blocos de uma cor só e devolve a cor RGBA', () => {
    const liso = papel(4, 4, [10, 20, 30, 128]);
    const cor = corUniforme(liso.data);
    expect(cor).not.toBeNull();
    expect(rgbaDaCor(cor!)).toEqual([10, 20, 30, 128]);
    liso.data[5] = 99;
    expect(corUniforme(liso.data)).toBeNull();
  });

  it('acumula blocos sem repetir e troca tudo quando o papel inteiro mudou', () => {
    const sujos = new BlocosSujos();
    sujos.marcar({ x: 0, y: 0, width: 10, height: 10 }, 600, 600);
    sujos.marcar({ x: 5, y: 5, width: 10, height: 10 }, 600, 600);
    expect(sujos.retirar(600, 600)).toEqual({ tudo: false, blocos: [{ bx: 0, by: 0 }] });
    expect(sujos.vazio).toBe(true);
    sujos.marcar(null, 600, 600);
    const { tudo, blocos } = sujos.retirar(600, 600);
    expect(tudo).toBe(true);
    expect(blocos).toHaveLength(9);
  });
});

describe('papel salvo em blocos', () => {
  it('grava a descrição e os blocos numa transação e recupera os dois', async () => {
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const descricao = {
      id: 'current' as const,
      nome: 'Rabisco',
      largura: 300,
      altura: 200,
      dpi: 96,
      camadas: [{ id: 'camada-1', nome: 'Papel' }],
      atualizadoEm: 1,
    };
    await gravarPapel(
      descricao,
      [
        { camada: 'camada-1', bx: 0, by: 0, cor: 7 },
        { camada: 'camada-1', bx: 1, by: 0, png },
      ],
      true,
    );
    const lido = await lerPapel();
    expect(lido?.tipo).toBe('blocos');
    if (lido?.tipo !== 'blocos') return;
    expect(lido.papel).toEqual(descricao);
    expect(lido.blocos.map(({ bx, by, cor }) => [bx, by, cor])).toEqual([
      [0, 0, 7],
      [1, 0, undefined],
    ]);

    // Papel menor: substituir tudo apaga os blocos que ficaram fora.
    await gravarPapel(
      { ...descricao, largura: 100 },
      [{ camada: 'camada-1', bx: 0, by: 0, cor: 9 }],
      true,
    );
    const menor = await lerPapel();
    expect(menor?.tipo === 'blocos' && menor.blocos.map(({ bx, cor }) => [bx, cor])).toEqual([
      [0, 9],
    ]);
  });

  it('recusa blocos fora da grade sem alterar o que já estava salvo', async () => {
    const descricao = {
      id: 'current' as const,
      nome: 'Rabisco',
      largura: 256,
      altura: 256,
      dpi: 96,
      camadas: [{ id: 'camada-1', nome: 'Papel' }],
      atualizadoEm: 1,
    };
    await gravarPapel(descricao, [{ camada: 'camada-1', bx: 0, by: 0, cor: 1 }], true);
    await expect(
      gravarPapel(descricao, [{ camada: 'camada-1', bx: 1, by: 0, cor: 2 }], false),
    ).rejects.toThrow('corrompido');
    const lido = await lerPapel();
    expect(lido?.tipo === 'blocos' && lido.blocos).toHaveLength(1);
  });

  it('encontra o registro da versão 0.2 e o apaga depois da conversão', async () => {
    await saveDocument({
      id: 'current',
      name: 'Antigo',
      width: 2,
      height: 1,
      pixels: new Uint8ClampedArray(8).fill(255),
      updatedAt: 1,
    });
    const lido = await lerPapel();
    expect(lido?.tipo).toBe('legado');
    await apagarLegado();
    expect(await database.documents.get('current')).toBeUndefined();
  });
});

describe('agendador do autosave', () => {
  function montar(largura = 600, altura = 300) {
    const imagem = papel(largura, altura);
    const gravar = vi.fn(async () => {});
    const codificar = vi.fn(async ({ data }: PixelBuffer) => new Blob([data.slice(0, 8)]));
    const estados: EstadoAutosave[] = [];
    const leituras: Rect[] = [];
    const autosave = new AutosaveBlocos({
      fonte: {
        descrever: () => ({
          nome: 'Teste',
          largura,
          altura,
          dpi: 96,
          camadas: [{ id: 'c1', nome: 'Papel' }],
        }),
        lerArea: (_camada, area) => {
          leituras.push(area);
          return recortar(imagem, area);
        },
      },
      codificar,
      gravar,
      aoMudar: (estado) => estados.push(estado),
      espera: 800,
      agora: () => 42,
    });
    return { imagem, gravar, codificar, estados, leituras, autosave };
  }

  it('espera a pausa, lê só os blocos tocados e grava cores lisas sem codificar', async () => {
    vi.useFakeTimers();
    const { imagem, gravar, codificar, estados, leituras, autosave } = montar();
    // O papel já está inteiro no banco: só os blocos tocados são regravados.
    autosave.definirTamanhoGravado(600, 300);
    imagem.data.set([0, 0, 255, 255], (10 * 600 + 300) * 4);
    autosave.marcar('c1', { x: 300, y: 10, width: 1, height: 1 });
    autosave.marcar('c1', { x: 20, y: 20, width: 4, height: 4 });
    expect(estados).toEqual(['saving', 'saving']);
    await vi.advanceTimersByTimeAsync(799);
    expect(gravar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(leituras).toEqual([
      { x: 256, y: 0, width: 256, height: 256 },
      { x: 0, y: 0, width: 256, height: 256 },
    ]);
    // O bloco com o ponto azul vira PNG; o bloco branco vira uma cor.
    expect(codificar).toHaveBeenCalledTimes(1);
    const [descricao, blocos, substituirTudo] = gravar.mock.calls[0] as unknown as [
      { largura: number; atualizadoEm: number },
      { bx: number; cor?: number; png?: Blob }[],
      boolean,
    ];
    expect(descricao).toMatchObject({ largura: 600, atualizadoEm: 42 });
    expect(substituirTudo).toBe(false);
    expect(blocos.map(({ bx, cor, png }) => [bx, typeof cor, png instanceof Blob])).toEqual([
      [1, 'undefined', true],
      [0, 'number', false],
    ]);
    expect(estados.at(-1)).toBe('saved');
  });

  it('papel que o banco ainda não tem: grava todos os blocos e troca os antigos', async () => {
    const { gravar, autosave } = montar(600, 300);
    autosave.marcar('c1', { x: 0, y: 0, width: 1, height: 1 });
    await autosave.gravarAgora();
    const [, blocos, substituirTudo] = gravar.mock.calls[0] as unknown as [
      unknown,
      unknown[],
      boolean,
    ];
    expect(blocos).toHaveLength(6);
    expect(substituirTudo).toBe(true);
  });

  it('se a gravação falha, os blocos voltam a ficar pendentes e o erro é informado', async () => {
    const { gravar, estados, autosave } = montar();
    gravar.mockRejectedValueOnce(new Error('cheio'));
    autosave.marcar('c1', { x: 0, y: 0, width: 2, height: 2 });
    await autosave.gravarAgora();
    expect(estados.at(-1)).toBe('error');
    expect(autosave.pendente).toBe(true);
    await autosave.gravarAgora();
    expect(gravar).toHaveBeenCalledTimes(2);
    expect(estados.at(-1)).toBe('saved');
  });
});
