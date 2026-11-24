import { describe, expect, it, vi } from 'vitest';
import { type Comando, desserializarImagem, serializarImagem } from '../../src/commands/comandos';
import { Executador } from '../../src/commands/executador';
import type { PixelBuffer, Rect } from '../../src/layers/types';

const BRANCO = [255, 255, 255, 255];
const AZUL = [48, 131, 197, 255];

function papel(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}

function lerPixel(imagem: PixelBuffer, x: number, y: number): number[] {
  const offset = (y * imagem.width + x) * 4;
  return [...imagem.data.subarray(offset, offset + 4)];
}

function escreverPixel(imagem: PixelBuffer, x: number, y: number, rgba: number[]) {
  imagem.data.set(rgba, (y * imagem.width + x) * 4);
}

function copiar(imagem: PixelBuffer): PixelBuffer {
  return { ...imagem, data: new Uint8ClampedArray(imagem.data) };
}

function documentoEmMemoria(width = 50, height = 40) {
  let cache = papel(width, height);
  let raster = copiar(cache);
  let x = 0;
  let y = 0;
  let nome = 'Papel original';
  const escreverRecorte = (alvo: PixelBuffer, recorte: PixelBuffer, left: number, top: number) => {
    for (let y = 0; y < recorte.height; y++) {
      for (let x = 0; x < recorte.width; x++) {
        escreverPixel(alvo, x + left, y + top, lerPixel(recorte, x, y));
      }
    }
  };
  const contexto = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo(proximoX: number, proximoY: number) {
      x = Math.floor(proximoX);
      y = Math.floor(proximoY);
    },
    lineTo() {},
    stroke() {
      escreverPixel(raster, x, y, AZUL);
    },
  } as unknown as CanvasRenderingContext2D;
  return {
    activeLayerId: 'camada-teste',
    activeLayer: {
      id: 'camada-teste',
      name: 'Papel',
      canvas: {} as HTMLCanvasElement,
      locked: false,
      opacity: 1,
      visible: true,
    },
    get name() {
      return nome;
    },
    set name(novoNome) {
      nome = novoNome;
    },
    get width() {
      return cache.width;
    },
    get height() {
      return cache.height;
    },
    obterDados: () => cache,
    contextoAtivo: () => contexto,
    lerPixels: vi.fn((area: Rect) => {
      const dados = papel(area.width, area.height);
      for (let y = 0; y < area.height; y++) {
        for (let x = 0; x < area.width; x++) {
          escreverPixel(dados, x, y, lerPixel(raster, area.x + x, area.y + y));
        }
      }
      return { ...dados, colorSpace: 'srgb' as const };
    }),
    registrarPixels: vi.fn((imagem: PixelBuffer, x: number, y: number) => {
      escreverRecorte(cache, imagem, x, y);
    }),
    aplicarPixels: vi.fn((imagem: PixelBuffer, x = 0, y = 0) => {
      escreverRecorte(cache, imagem, x, y);
      escreverRecorte(raster, imagem, x, y);
    }),
    substituir(novoNome: string, imagem: PixelBuffer) {
      nome = novoNome;
      cache = copiar(imagem);
      raster = copiar(imagem);
    },
  };
}

describe('comandos serializáveis', () => {
  it('preserva os parâmetros e todos os canais RGBA ao gravar e reler o JSON', () => {
    const imagem = papel(70, 61);
    for (let i = 0; i < imagem.data.length; i++) imagem.data[i] = i % 251;
    const comando: Comando = { tipo: 'ColarImagem', x: 0, y: 8, imagem: serializarImagem(imagem) };
    const restaurado = JSON.parse(JSON.stringify(comando)) as typeof comando;
    expect(restaurado).toEqual(comando);
    expect(desserializarImagem(restaurado.imagem)).toEqual(imagem);
    expect(() => desserializarImagem({ ...restaurado.imagem, largura: 4097 })).toThrow('dimensões');
    expect(() => desserializarImagem({ ...restaurado.imagem, rgba: 'cAAA' })).toThrow(
      'pixels inválidos',
    );
  });

  it('executa um traço em um único item com leitura e restauração restritas à área', () => {
    const doc = documentoEmMemoria();
    const editor = new Executador(doc);
    const comando: Comando = {
      tipo: 'TracarPincel',
      ferramenta: 'brush',
      cor: '#3083c5',
      espessura: 4,
      pontos: [
        { x: 10, y: 12 },
        { x: 12, y: 14 },
      ],
    };
    expect(editor.executar(JSON.parse(JSON.stringify(comando)))).toBe(true);
    const area = { x: 7, y: 9, width: 8, height: 8 };
    expect(editor.ultimaAlteracao).toEqual(area);
    expect(doc.lerPixels).toHaveBeenCalledExactlyOnceWith(area);
    expect(editor.historico.entries).toEqual([{ label: 'Pincelada' }]);
    expect(editor.historico.memoryBytes).toBe(8 * area.width * area.height);
    expect(lerPixel(doc.obterDados(), 10, 12)).toEqual(AZUL);
    expect(editor.desfazer()).toBe(true);
    expect(lerPixel(doc.obterDados(), 10, 12)).toEqual(BRANCO);
    expect(editor.refazer()).toBe(true);
    expect(lerPixel(doc.obterDados(), 10, 12)).toEqual(AZUL);
    expect(doc.lerPixels).toHaveBeenCalledTimes(1);
    for (const [recorte, x, y] of doc.aplicarPixels.mock.calls) {
      expect({ x, y, width: recorte.width, height: recorte.height }).toEqual(area);
    }
  });

  it('guarda o comando original e os dados do recorte com a identificação da camada', () => {
    const doc = documentoEmMemoria();
    const editor = new Executador(doc);
    const comando: Comando = { tipo: 'ApagarSelecao', area: { x: 6, y: 7, width: 2, height: 3 } };
    expect(editor.executar(comando)).toBe(true);
    comando.area.x = 2;
    const entrada = editor.historico.desfazer();
    expect(entrada).toMatchObject({
      camada: 'camada-teste',
      comando: { tipo: 'ApagarSelecao', area: { x: 6, y: 7, width: 2, height: 3 } },
      rect: { x: 6, y: 7, width: 2, height: 3 },
      before: papel(2, 3),
      after: { width: 2, height: 3, data: new Uint8ClampedArray(24) },
    });
  });

  it('guarda apenas a região realmente alterada pelo balde e mantém os pixels vizinhos', () => {
    const doc = documentoEmMemoria();
    const azul = papel(1, 2);
    escreverPixel(azul, 0, 0, AZUL);
    escreverPixel(azul, 0, 1, AZUL);
    doc.aplicarPixels(azul, 5, 8);
    const editor = new Executador(doc);
    expect(
      editor.executar({ tipo: 'Preencher', ponto: { x: 5, y: 8 }, cor: '#00ff00', tolerancia: 12 }),
    ).toBe(true);
    expect(editor.ultimaAlteracao).toEqual({ x: 5, y: 8, width: 1, height: 2 });
    expect(editor.historico.memoryBytes).toBe(16);
    expect(doc.lerPixels).not.toHaveBeenCalled();
    expect(lerPixel(doc.obterDados(), 5, 9)).toEqual([0, 255, 0, 255]);
    expect(lerPixel(doc.obterDados(), 6, 9)).toEqual(BRANCO);
    expect(editor.desfazer()).toBe(true);
    expect(lerPixel(doc.obterDados(), 5, 8)).toEqual(AZUL);
  });

  it('desfaz e refaz uma troca de imagem restaurando os pixels e as dimensões', () => {
    const doc = documentoEmMemoria();
    const editor = new Executador(doc);
    const imagem = papel(1, 1);
    escreverPixel(imagem, 0, 0, AZUL);
    expect(
      editor.executar({ tipo: 'AbrirImagem', nome: 'Logo', imagem: serializarImagem(imagem) }),
    ).toBe(true);
    expect(editor.ultimaAlteracao).toBeNull();
    expect(editor.historico.entries).toEqual([{ label: 'Abrir PNG' }]);
    expect([doc.name, doc.width, doc.height]).toEqual(['Logo', 1, 1]);
    expect(editor.desfazer()).toBe(true);
    expect([doc.name, doc.width, doc.height]).toEqual(['Logo', 50, 40]);
    expect(editor.refazer()).toBe(true);
    expect([doc.name, doc.width, doc.height]).toEqual(['Logo', 1, 1]);
    expect(lerPixel(doc.obterDados(), 0, 0)).toEqual(AZUL);
  });

  it('atualiza o nome de uma imagem idêntica sem adicionar histórico de pixels', () => {
    const doc = documentoEmMemoria();
    const editor = new Executador(doc);
    const imagem = serializarImagem(doc.obterDados());
    expect(editor.executar({ tipo: 'AbrirImagem', nome: 'Papel renomeado', imagem })).toBe(true);
    expect(doc.name).toBe('Papel renomeado');
    expect(editor.historico.entries).toEqual([]);
    expect(editor.executar({ tipo: 'AbrirImagem', nome: 'Papel renomeado', imagem })).toBe(false);
  });
});
