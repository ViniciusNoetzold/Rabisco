import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComandoCamada } from '../../src/commands/comandos';
import { Executador } from '../../src/commands/executador';
import {
  ajusteSeguro,
  comporAjuste,
  exportacaoComAjusteAchatado,
} from '../../src/document/ajustes';
import { propriedadesPadrao } from '../../src/document/camadas';
import { comporDocumento } from '../../src/document/compositor';
import { RabiscoDocument } from '../../src/document/model';
import type { CamadaAscii } from '../../src/estilos/camadaAscii';
import { exportarCamadas, importarCamadas } from '../../src/io/camadas';

const BRILHO = { filtro: 'brilho-contraste', parametros: { brilho: -50, contraste: 0 } } as const;
const TEXTO: CamadaAscii = {
  arte: { colunas: 2, linhas: ['eq'], inverter: false },
  area: { x: 0, y: 0, width: 2, height: 1 },
};
const NOVA: ComandoCamada = {
  tipo: 'NovaCamadaAjuste',
  id: 'ajuste-1',
  nome: 'Brilho e contraste',
  ajuste: BRILHO,
};

function faixa(...pixels: number[][]) {
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

function instalarCanvas() {
  const telas: ReturnType<typeof criar>[] = [];
  function criar() {
    const contexto = {
      globalCompositeOperation: 'source-over',
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      clip: vi.fn(),
      rect: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(255),
      })),
    };
    const tela = {
      width: 2,
      height: 1,
      getContext: vi.fn(() => contexto),
      toBlob: (receber: (blob: Blob) => void) => receber(new Blob(['png'], { type: 'image/png' })),
    };
    return { contexto, tela: tela as unknown as HTMLCanvasElement };
  }
  vi.stubGlobal('document', {
    createElement: () => {
      const nova = criar();
      telas.push(nova);
      return nova.tela;
    },
  });
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal('createImageBitmap', async () => ({ width: 2, height: 1, close() {} }));
  return { telas, criar };
}

afterEach(() => vi.unstubAllGlobals());

describe('camadas de ajuste', () => {
  it('preenche padrões, limita números e recusa filtros que dependem de vizinhança', () => {
    expect(ajusteSeguro({ filtro: 'desfoque-gaussiano', parametros: { raio: 2 } })).toBeUndefined();
    expect(
      ajusteSeguro({
        filtro: 'brilho-contraste',
        parametros: { brilho: 500, contraste: null, excesso: 'ignorado' },
      }),
    ).toEqual({ filtro: 'brilho-contraste', parametros: { brilho: 100, contraste: 0 } });
    expect(
      ajusteSeguro({ filtro: 'curvas', parametros: { pontos: [{ x: 128, y: 168 }] } }),
    ).toEqual({
      filtro: 'curvas',
      parametros: {
        pontos: [
          { x: 0, y: 0 },
          { x: 128, y: 168 },
          { x: 255, y: 255 },
        ],
      },
    });
  });

  it('pondera a alteração pela máscara e opacidade sem perder o alfa de baixo', () => {
    const base = faixa([255, 0, 0, 128], [255, 0, 0, 255], [31, 63, 127, 0]);
    const mascara = faixa([255, 255, 255, 255], [0, 0, 0, 255], [255, 255, 255, 255]);
    const ajuste = ajusteSeguro({ filtro: 'preto-e-branco' })!;
    expect(comporAjuste(base, ajuste, 0, mascara)).toBe(base);
    expect(comporAjuste(base, ajuste, 0.5, mascara)).toEqual(
      faixa([166, 38, 38, 128], [255, 0, 0, 255], [31, 63, 127, 0]),
    );
    expect(base).toEqual(faixa([255, 0, 0, 128], [255, 0, 0, 255], [31, 63, 127, 0]));
  });

  it('cria e edita por comandos JSON reversíveis sem ler ou modificar o raster de baixo', () => {
    instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 2, 1);
    const editor = new Executador(doc);
    const ler = vi.spyOn(doc, 'lerPixels');
    expect(editor.executar(JSON.parse(JSON.stringify(NOVA)))).toBe(true);
    expect(doc.layers).toHaveLength(2);
    expect(doc.activeLayer.canvas.width).toBe(1);
    expect(doc.activeLayer.ajuste).toEqual(BRILHO);
    expect(doc.existe({ camada: 'ajuste-1' })).toBe(false);
    expect(
      editor.executar({
        tipo: 'EditarCamadaAjuste',
        id: 'ajuste-1',
        ajuste: { filtro: 'preto-e-branco', parametros: {} },
      }),
    ).toBe(true);
    expect(doc.activeLayer.ajuste?.filtro).toBe('preto-e-branco');
    expect(editor.desfazer()).toBe(true);
    expect(doc.activeLayer.ajuste).toEqual(BRILHO);
    expect(editor.desfazer()).toBe(true);
    expect(doc.layers).toHaveLength(1);
    expect(editor.refazer()).toBe(true);
    expect(doc.activeLayer.ajuste).toEqual(BRILHO);
    expect(ler).not.toHaveBeenCalled();
  });

  it('recompõe apenas o retângulo sujo em coordenadas absolutas na tela', () => {
    const { criar } = instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 20, 20);
    new Executador(doc).executar(NOVA);
    const { tela, contexto } = criar();
    tela.width = doc.width;
    tela.height = doc.height;
    comporDocumento(doc, tela, { x: 5, y: 7, width: 2, height: 3 });
    expect(contexto.getImageData).toHaveBeenCalledExactlyOnceWith(5, 7, 2, 3);
    expect(contexto.putImageData).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ width: 2, height: 3 }),
      5,
      7,
    );
  });

  it('compõe ajustes de grupo no canvas interno em coordenadas locais', () => {
    const { telas, criar } = instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 20, 20);
    const executor = new Executador(doc);
    executor.executar(NOVA);
    executor.executar({
      tipo: 'AgruparCamadas',
      ids: doc.layers.map(({ id }) => id),
      grupoId: 'grupo-1',
      nome: 'Grupo testado',
    });
    const { tela, contexto } = criar();
    tela.width = doc.width;
    tela.height = doc.height;
    comporDocumento(doc, tela, { x: 5, y: 7, width: 2, height: 3 });
    expect(contexto.getImageData).not.toHaveBeenCalled();
    expect(telas.at(-1)?.contexto.getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 2, 3);
  });

  it('recorta uma camada acima do ajuste pelo alfa da composição já ajustada', () => {
    const { criar } = instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 2, 1);
    const executor = new Executador(doc);
    executor.executar(NOVA);
    const estrutura = doc.estrutura();
    estrutura.camadas.push({ ...propriedadesPadrao('recortada', 'Recortada'), recorte: true });
    doc.aplicarEstrutura(estrutura);

    const base = faixa([200, 180, 160, 255], [0, 0, 0, 0]);
    const { tela, contexto } = criar();
    contexto.getImageData.mockReturnValueOnce(base);
    const modos: string[] = [];
    contexto.drawImage.mockImplementation(() => {
      modos.push(contexto.globalCompositeOperation);
    });
    comporDocumento(doc, tela);

    expect(contexto.putImageData).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(comporAjuste(base, BRILHO, 1)),
      0,
      0,
    );
    expect(modos).toEqual(['source-over', 'source-atop']);
    expect(contexto.putImageData.mock.invocationCallOrder[0]).toBeLessThan(
      contexto.drawImage.mock.invocationCallOrder[1],
    );
  });

  it('salva ajustes e ASCII no manifest v3 e exige PNG apenas para a camada de texto', async () => {
    instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 2, 1);
    new Executador(doc).executar(NOVA);
    const estrutura = doc.estrutura();
    estrutura.camadas.push({ ...propriedadesPadrao('ascii-1', 'ASCII editável'), ascii: TEXTO });
    doc.aplicarEstrutura(estrutura);
    const blob = await exportarCamadas(doc, 'rabisco');
    const arquivos = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(JSON.parse(strFromU8(arquivos['manifest.json']))).toMatchObject({ versao: 3 });
    expect(arquivos['camadas/ajuste-1.png']).toBeUndefined();
    expect(arquivos['camadas/ascii-1.png']).toBeDefined();
    const reaberto = await importarCamadas(new File([blob], 'teste.rabisco'));
    expect(reaberto.estrutura.camadas[1].ajuste).toEqual(BRILHO);
    expect(reaberto.estrutura.camadas[2].ascii).toEqual(TEXTO);
    expect(reaberto.pixels.size).toBe(2);
  });

  it('lê os dados da camada ASCII de um arquivo v2', async () => {
    instalarCanvas();
    const camada = { ...propriedadesPadrao('papel', 'Texto ASCII'), ascii: TEXTO };
    const manifest = {
      formato: 'rabisco',
      versao: 2,
      largura: 2,
      altura: 1,
      estrutura: { camadas: [camada], ativa: 'papel' },
    };
    const dados = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'camadas/papel.png': strToU8('png'),
    });
    const reaberto = await importarCamadas(new File([dados as BlobPart], 'v2.rabisco'));
    expect(reaberto.estrutura.camadas).toEqual([camada]);
    expect(reaberto.pixels.has('papel')).toBe(true);
  });

  it('emite uma camada achatada no ORA com ajuste e sinaliza PSD para o mesmo tratamento', async () => {
    instalarCanvas();
    const doc = new RabiscoDocument('Papel de teste', 2, 1);
    expect(exportacaoComAjusteAchatado('ora', doc.layers)).toBe(false);
    new Executador(doc).executar(NOVA);
    expect(exportacaoComAjusteAchatado('psd', doc.layers)).toBe(true);
    expect(exportacaoComAjusteAchatado('rabisco', doc.layers)).toBe(false);
    const blob = await exportarCamadas(doc, 'ora');
    const arquivos = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(strFromU8(arquivos['stack.xml'])).toContain('<layer name="Imagem achatada"');
    expect(Object.keys(arquivos).filter((path) => path.startsWith('data/'))).toEqual([
      'data/imagem-achatada.png',
    ]);
  });
});
