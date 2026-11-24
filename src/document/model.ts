import type { PixelBuffer, Rect } from '../layers/types';
import { DPI_PADRAO, validarDimensoes } from './dimensoes';

type CanvasDaCamada = OffscreenCanvas | HTMLCanvasElement;

export interface Layer<Superficie extends CanvasDaCamada = CanvasDaCamada> {
  id: string;
  name: string;
  canvas: Superficie;
  visible: boolean;
  opacity: number;
  locked: boolean;
}

function validarPixels(imagem: PixelBuffer): void {
  validarDimensoes(imagem.width, imagem.height);
  if (imagem.data.length !== imagem.width * imagem.height * 4) {
    throw new Error('Os pixels da imagem não correspondem às dimensões.');
  }
}

export function comoImageData(imagem: PixelBuffer): ImageData {
  const { data, width, height } = imagem;
  const dados =
    data.buffer instanceof ArrayBuffer
      ? new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)
      : new Uint8ClampedArray(data);
  return new ImageData(dados, width, height);
}

/** O papel mantém os pixels da camada editável e oferece uma cópia em memória para leitura. */
export class RabiscoDocument {
  readonly id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (parte) =>
    parte.toString(16).padStart(8, '0'),
  ).join('');
  name: string;
  dpi = DPI_PADRAO;
  readonly layers: Layer<HTMLCanvasElement>[];
  activeLayerId: string;
  private pixels: PixelBuffer;

  constructor(nome = 'Sem título', largura = 1024, altura = 640) {
    validarDimensoes(largura, altura);
    this.name = nome;
    this.activeLayerId = 'camada-1';
    this.layers = [
      {
        id: this.activeLayerId,
        name: 'Papel',
        canvas: document.createElement('canvas'),
        visible: true,
        opacity: 1,
        locked: false,
      },
    ];
    const dados = new Uint8ClampedArray(largura * altura * 4).fill(255);
    this.pixels = { width: largura, height: altura, data: dados };
    this.redesenharCamada();
  }

  get width(): number {
    return this.pixels.width;
  }

  get height(): number {
    return this.pixels.height;
  }

  get activeLayer(): Layer<HTMLCanvasElement> {
    const camada = this.layers.find(({ id }) => id === this.activeLayerId);
    if (!camada) throw new Error('A camada ativa não está no documento.');
    return camada;
  }

  contextoAtivo(): CanvasRenderingContext2D {
    const contexto = this.activeLayer.canvas.getContext('2d', { willReadFrequently: true });
    if (!contexto) throw new Error('Não foi possível iniciar a área de desenho.');
    return contexto;
  }

  lerPixels(area: Rect = { x: 0, y: 0, width: this.width, height: this.height }): ImageData {
    return this.contextoAtivo().getImageData(area.x, area.y, area.width, area.height);
  }

  /** Visão dos bytes atuais, apenas para leitura. Copie se precisar retê-los após uma edição. */
  obterDados(): PixelBuffer {
    return this.pixels;
  }

  aplicarPixels(imagem: PixelBuffer, x = 0, y = 0): void {
    validarPixels(imagem);
    const esquerda = Math.trunc(x);
    const topo = Math.trunc(y);
    this.contextoAtivo().putImageData(comoImageData(imagem), esquerda, topo);
    this.registrarPixels(imagem, esquerda, topo);
  }

  /** Sincroniza só a área que o comando acabou de pintar diretamente na camada. */
  registrarPixels(imagem: PixelBuffer, x: number, y: number): void {
    const esquerda = Math.max(0, x);
    const direita = Math.min(this.width, x + imagem.width);
    if (direita <= esquerda) return;
    const larguraEmBytes = (direita - esquerda) * 4;
    const inferior = Math.min(this.height, y + imagem.height);
    for (let linha = Math.max(0, y); linha < inferior; linha++) {
      const origem = ((linha - y) * imagem.width + esquerda - x) * 4;
      const destino = (linha * this.width + esquerda) * 4;
      this.pixels.data.set(imagem.data.subarray(origem, origem + larguraEmBytes), destino);
    }
  }

  substituir(nome: string, imagem: PixelBuffer): void {
    validarPixels(imagem);
    const { width, height, data } = imagem;
    this.pixels = { width, height, data: new Uint8ClampedArray(data) };
    this.name = nome;
    this.redesenharCamada();
  }

  private redesenharCamada(): void {
    const { canvas } = this.activeLayer;
    if (canvas.width !== this.width) canvas.width = this.width;
    if (canvas.height !== this.height) canvas.height = this.height;
    this.contextoAtivo().putImageData(comoImageData(this.pixels), 0, 0);
  }
}
