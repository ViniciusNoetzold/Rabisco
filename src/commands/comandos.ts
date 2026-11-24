import type { PixelBuffer, Point, Rect } from '../layers/types';

export interface EstiloTraco {
  ferramenta: 'pencil' | 'brush' | 'eraser';
  cor: string;
  espessura: number;
}

export interface ComandoTraco extends EstiloTraco {
  tipo: 'TracarPincel';
  pontos: Point[];
}

export interface ComandoForma {
  tipo: 'DesenharForma';
  forma: 'line' | 'rectangle' | 'ellipse';
  inicio: Point;
  fim: Point;
  restringir: boolean;
  cor: string;
  espessura: number;
  preenchida: boolean;
}

/** RGBA em base64 preserva os pixels e permite gravar o comando como JSON. */
export interface ImagemSerializada {
  largura: number;
  altura: number;
  rgba: string;
}

export type Comando =
  | ComandoTraco
  | ComandoForma
  | { tipo: 'Preencher'; ponto: Point; cor: string; tolerancia: number }
  | { tipo: 'ApagarSelecao'; area: Rect }
  | { tipo: 'MoverSelecao'; origem: Rect; destino: Rect }
  | { tipo: 'ColarImagem'; x: number; y: number; imagem: ImagemSerializada }
  | { tipo: 'CortarPapel'; area: Rect }
  | { tipo: 'AbrirImagem'; nome: string; imagem: ImagemSerializada }
  | { tipo: 'NovoDocumento'; nome: string; largura: number; altura: number };

export function serializarImagem(pixels: PixelBuffer): ImagemSerializada {
  const partes: string[] = [];
  // O bloco é múltiplo de 3, então o preenchimento base64 aparece apenas no final.
  const tamanhoBloco = 12_288;
  for (let inicio = 0; inicio < pixels.data.length; inicio += tamanhoBloco) {
    const bloco = pixels.data.subarray(inicio, inicio + tamanhoBloco);
    partes.push(btoa(String.fromCharCode(...bloco)));
  }
  return { largura: pixels.width, altura: pixels.height, rgba: partes.join('') };
}

export function desserializarImagem(imagem: ImagemSerializada): PixelBuffer {
  const { largura, altura, rgba } = imagem;
  validarDimensoes(largura, altura);
  if (rgba.length !== 4 * Math.ceil((largura * altura * 4) / 3)) {
    throw new Error('Dimensões ou dados de pixels inválidos no comando.');
  }
  const dados = atob(rgba);
  if (dados.length !== largura * altura * 4) {
    throw new Error('Dimensões ou dados de pixels inválidos no comando.');
  }
  const data = new Uint8ClampedArray(dados.length);
  for (let i = 0; i < dados.length; i++) data[i] = dados.charCodeAt(i);
  return { width: largura, height: altura, data };
}

export function validarDimensoes(largura: number, altura: number): void {
  if (
    !Number.isInteger(largura) ||
    !Number.isInteger(altura) ||
    largura < 1 ||
    altura < 1 ||
    largura > 4096 ||
    altura > 4096 ||
    largura * altura > 16_000_000
  ) {
    throw new Error('Use dimensões de 1 a 4096 px e no máximo 16 milhões de pixels.');
  }
}
