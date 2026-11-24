import { vi } from 'vitest';
import type { Alvo, EstruturaDocumento } from '../../src/document/camadas';
import type { RabiscoDocument } from '../../src/document/model';
import type { PixelBuffer, Rect } from '../../src/layers/types';

export function papelBranco(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}

function copiar(imagem: PixelBuffer): PixelBuffer {
  return { width: imagem.width, height: imagem.height, data: new Uint8ClampedArray(imagem.data) };
}

/**
 * Documento de uma camada em memória, sem canvas (os testes unitários rodam no Node).
 * `contexto` recebe o raster atual e devolve o contexto 2D falso que as ferramentas usam.
 */
export function documentoFalso(
  inicial: PixelBuffer,
  contexto: (raster: () => PixelBuffer) => Partial<CanvasRenderingContext2D> = () => ({}),
) {
  let raster = copiar(inicial);
  let nome = 'Papel original';
  const camada = {
    id: 'camada-teste',
    name: 'Papel',
    canvas: {} as HTMLCanvasElement,
    visible: true,
    opacity: 1,
    modo: 'normal' as const,
    locked: false,
    bloqueioTransparencia: false,
    bloqueioPosicao: false,
    fundo: true,
  };
  const alvo: Alvo = { camada: camada.id, mascara: false };
  const ctx = {
    save() {},
    restore() {},
    clearRect() {},
    ...contexto(() => raster),
  } as unknown as CanvasRenderingContext2D;
  const ler = (area: Rect) => {
    const dados = papelBranco(area.width, area.height);
    for (let y = 0; y < area.height; y++) {
      const inicio = ((area.y + y) * raster.width + area.x) * 4;
      dados.data.set(raster.data.subarray(inicio, inicio + area.width * 4), y * area.width * 4);
    }
    return { ...dados, colorSpace: 'srgb' as const } as ImageData;
  };
  const doc = {
    dpi: 96,
    activeLayerId: camada.id,
    activeLayer: camada,
    layers: [camada],
    grupos: [],
    editandoMascara: false,
    get name() {
      return nome;
    },
    set name(novo: string) {
      nome = novo;
    },
    get width() {
      return raster.width;
    },
    get height() {
      return raster.height;
    },
    get raster() {
      return raster;
    },
    camada: (id: string) => (id === camada.id ? camada : undefined),
    alvoAtivo: () => alvo,
    existe: (outro: Alvo) => outro.camada === camada.id && !outro.mascara,
    contexto: () => ctx,
    contextoAtivo: () => ctx,
    lerPixels: vi.fn((area: Rect = { x: 0, y: 0, width: raster.width, height: raster.height }) =>
      ler(area),
    ),
    copiarPixels: vi.fn(() => ler({ x: 0, y: 0, width: raster.width, height: raster.height })),
    aplicarPixels: vi.fn((imagem: PixelBuffer, x = 0, y = 0) => {
      for (let linha = 0; linha < imagem.height; linha++) {
        const origem = linha * imagem.width * 4;
        raster.data.set(
          imagem.data.subarray(origem, origem + imagem.width * 4),
          ((y + linha) * raster.width + x) * 4,
        );
      }
    }),
    substituir(novoNome: string, imagem: PixelBuffer) {
      nome = novoNome;
      raster = copiar(imagem);
    },
    preencherPapel(largura: number, altura: number) {
      raster = papelBranco(largura, altura);
    },
    redimensionarDocumento(largura: number, altura: number) {
      raster = {
        width: largura,
        height: altura,
        data: new Uint8ClampedArray(largura * altura * 4),
      };
    },
    estrutura: (): EstruturaDocumento => ({
      camadas: [
        {
          id: camada.id,
          name: camada.name,
          visible: true,
          opacity: 1,
          modo: 'normal',
          locked: false,
          bloqueioTransparencia: false,
          bloqueioPosicao: false,
          fundo: true,
        },
      ],
      grupos: [],
      ativa: camada.id,
      editandoMascara: false,
    }),
    aplicarEstrutura() {},
  };
  return doc as typeof doc & RabiscoDocument;
}
