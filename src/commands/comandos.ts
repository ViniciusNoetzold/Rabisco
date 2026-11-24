import { validarDimensoes } from '../document/dimensoes';
import type { ConfiguracaoPincel, MarcaPincel } from '../brushes/catalogo';
import type { PixelBuffer, Point, Rect } from '../layers/types';
import type { ConfiguracaoForma } from '../shapes/tipos';

export { validarDimensoes } from '../document/dimensoes';

export type OrientacaoImagem = 'direita' | 'esquerda' | '180' | 'horizontal' | 'vertical';

export interface OpcoesTransformacao {
  largura: number;
  altura: number;
  inclinacaoHorizontal: number;
  inclinacaoVertical: number;
}

export interface EstiloTraco {
  ferramenta: 'pencil' | 'brush' | 'eraser';
  cor: string;
  espessura: number;
}

export interface ComandoTraco extends EstiloTraco {
  tipo: 'TracarPincel';
  pontos: Point[];
}

export interface ComandoPincel {
  tipo: 'Pincelar';
  configuracao: ConfiguracaoPincel;
  marcas: MarcaPincel[];
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
  | ComandoPincel
  | ComandoForma
  | { tipo: 'AplicarForma'; configuracao: ConfiguracaoForma }
  | { tipo: 'Preencher'; ponto: Point; cor: string; tolerancia: number }
  | { tipo: 'ApagarSelecao'; area: Rect }
  | { tipo: 'MoverSelecao'; origem: Rect; destino: Rect }
  | { tipo: 'ColarImagem'; x: number; y: number; imagem: ImagemSerializada }
  | { tipo: 'CortarPapel'; area: Rect }
  | { tipo: 'AbrirImagem'; nome: string; imagem: ImagemSerializada; dpi?: number }
  | { tipo: 'NovoDocumento'; nome: string; largura: number; altura: number }
  | { tipo: 'RedimensionarPapel'; largura: number; altura: number; fundo: string; dpi?: number }
  | ({ tipo: 'RedimensionarInclinar'; area?: Rect } & OpcoesTransformacao)
  | { tipo: 'Girar'; graus: 90 | -90 | 180; area?: Rect }
  | { tipo: 'Inverter'; eixo: 'horizontal' | 'vertical'; area?: Rect };

const BlocoBase64 = Uint8Array as typeof Uint8Array & {
  fromBase64?(texto: string): Uint8Array<ArrayBuffer>;
};

export function serializarImagem(pixels: PixelBuffer): ImagemSerializada {
  const dados = new Uint8Array(
    pixels.data.buffer,
    pixels.data.byteOffset,
    pixels.data.byteLength,
  ) as Uint8Array & { toBase64?(): string };
  if (dados.toBase64) {
    return { largura: pixels.width, altura: pixels.height, rgba: dados.toBase64() };
  }
  const partes: string[] = [];
  // O bloco é múltiplo de 3, então o preenchimento base64 aparece apenas no final.
  const tamanhoBloco = 12_288;
  for (let inicio = 0; inicio < dados.length; inicio += tamanhoBloco) {
    const bloco = dados.subarray(inicio, inicio + tamanhoBloco);
    partes.push(btoa(String.fromCharCode(...bloco)));
  }
  return { largura: pixels.width, altura: pixels.height, rgba: partes.join('') };
}

export function desserializarImagem(imagem: ImagemSerializada): PixelBuffer {
  const { largura, altura, rgba } = imagem;
  validarDimensoes(largura, altura);
  const totalBytes = largura * altura * 4;
  if (rgba.length !== 4 * Math.ceil(totalBytes / 3)) {
    throw new Error('Dimensões ou dados de pixels inválidos no comando.');
  }
  const data = decodificarPixels(rgba, totalBytes);
  return { width: largura, height: altura, data };
}

function decodificarPixels(rgba: string, totalBytes: number): Uint8ClampedArray<ArrayBuffer> {
  if (BlocoBase64.fromBase64) {
    const dados = BlocoBase64.fromBase64(rgba);
    if (dados.length === totalBytes) {
      return new Uint8ClampedArray(dados.buffer, dados.byteOffset, dados.byteLength);
    }
    throw new Error('Dimensões ou dados de pixels inválidos no comando.');
  }
  // Múltiplo de 4 para não separar grupos do base64 entre blocos.
  const tamanhoBloco = 65_536;
  const dados = new Uint8ClampedArray(totalBytes);
  let destino = 0;
  for (let inicio = 0; inicio < rgba.length; inicio += tamanhoBloco) {
    const bloco = atob(rgba.slice(inicio, inicio + tamanhoBloco));
    for (let i = 0; i < bloco.length; i++) dados[destino++] = bloco.charCodeAt(i);
  }
  if (destino !== totalBytes) throw new Error('Dimensões ou dados de pixels inválidos no comando.');
  return dados;
}
