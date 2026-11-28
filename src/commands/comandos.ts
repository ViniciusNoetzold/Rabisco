import { validarDimensoes } from '../document/dimensoes';
import type { ConfigGradiente } from '../tools/gradiente';
import type { MascaraSelecao } from '../document/selecao';
import type { EixoGuia } from '../document/guias';
import type { ArteAscii } from '../estilos/ascii';
import type { CamadaAscii } from '../estilos/camadaAscii';
import type { FormatoImagem } from '../io/imagens';
import type { ConfiguracaoTexto } from '../tools/texto';
import type { ConfiguracaoPincel, MarcaPincel } from '../brushes/catalogo';
import type { ConfigSimetria } from '../brushes/simetria';
import type { PixelBuffer, Point, Rect } from '../layers/types';
import type { ConfiguracaoForma } from '../shapes/tipos';
import type { EfeitosCamada, Grupo, PropriedadesCamada } from '../document/camadas';
import type { AjusteCamada } from '../document/ajustes';
import type { IdFiltro, ParametrosFiltro } from '../filtros/registro';

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
  /** Lápis de 1 px alinhado à grade, sem antisserrilhado. */
  pixelArt?: boolean;
  /** Cor que a borracha de cor pode trocar, em vez de pintar todo o traço. */
  substituirCor?: string;
  toleranciaSubstituicao?: number;
  /** Borracha em camada transparente: apaga para transparência em vez de pintar a Cor 2. */
  transparente?: boolean;
}

export interface ComandoTraco extends EstiloTraco {
  tipo: 'TracarPincel';
  pontos: Point[];
  /** Pontos de UM eixo; o executor pinta as outras cópias. */
  simetria?: ConfigSimetria;
}

export interface ComandoPincel {
  tipo: 'Pincelar';
  configuracao: ConfiguracaoPincel;
  marcas: MarcaPincel[];
  /** Marcas de UM eixo; o executor pinta as outras cópias. */
  simetria?: ConfigSimetria;
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

export interface ComandoAplicarFiltro {
  tipo: 'AplicarFiltro';
  filtro: IdFiltro;
  parametros: ParametrosFiltro;
  semente: number;
  area?: Rect;
  mascara?: MascaraSelecao;
}

export type ComandoGuia =
  | { tipo: 'AdicionarGuia'; eixo: EixoGuia; valor: number }
  | { tipo: 'MoverGuia'; eixo: EixoGuia; origem: number; destino: number }
  | { tipo: 'RemoverGuia'; eixo: EixoGuia; valor: number }
  | { tipo: 'LimparGuias' };

export type Comando =
  | ComandoTraco
  | ComandoPincel
  | ComandoForma
  | { tipo: 'AplicarForma'; configuracao: ConfiguracaoForma; simetria?: ConfigSimetria }
  | { tipo: 'AplicarTexto'; configuracao: ConfiguracaoTexto }
  | ComandoAplicarFiltro
  | ComandoGuia
  | ({ tipo: 'Gradiente' } & ConfigGradiente)
  | {
      /** Dedo: arrasta os pixels pelos pontos (força 0–1). */
      tipo: 'Borrar';
      pontos: Point[];
      espessura: number;
      forca: number;
      simetria?: ConfigSimetria;
      area?: Rect;
      mascara?: MascaraSelecao;
    }
  | {
      tipo: 'Preencher';
      ponto: Point;
      cor: string;
      tolerancia: number;
      global?: boolean;
      /** Decide a área pelo que se vê (todas as camadas), mas pinta só na ativa. */
      amostrarTudo?: boolean;
    }
  | { tipo: 'ApagarSelecao'; area: Rect; mascara?: MascaraSelecao }
  | {
      tipo: 'MoverSelecao';
      origem: Rect;
      destino: Rect;
      mascara?: MascaraSelecao;
      duplicar?: boolean;
      corTransparente?: string;
    }
  | {
      tipo: 'ColarImagem';
      x: number;
      y: number;
      imagem: ImagemSerializada;
      corTransparente?: string;
      tamanho?: { largura: number; altura: number };
      papel?: { largura: number; altura: number; fundo: string };
    }
  | { tipo: 'CortarPapel'; area: Rect; mascara?: MascaraSelecao }
  | {
      tipo: 'AbrirImagem';
      nome: string;
      imagem: ImagemSerializada;
      dpi?: number;
      formato?: FormatoImagem;
    }
  | { tipo: 'NovoDocumento'; nome: string; largura: number; altura: number }
  | { tipo: 'RedimensionarPapel'; largura: number; altura: number; fundo: string; dpi?: number }
  | ({ tipo: 'RedimensionarInclinar'; area?: Rect } & OpcoesTransformacao)
  | { tipo: 'Girar'; graus: 90 | -90 | 180; area?: Rect }
  | { tipo: 'Inverter'; eixo: 'horizontal' | 'vertical'; area?: Rect }
  | ComandoCamada
  /** Vários comandos como um único item no histórico (ex.: nova camada + texto). */
  | { tipo: 'Lote'; rotulo: string; comandos: Comando[] };

type AlteracaoCamada = Partial<Omit<PropriedadesCamada, 'id' | 'temMascara' | 'ajuste'>> & {
  efeitos?: EfeitosCamada;
};

/** Comandos de estrutura: os identificadores vêm prontos para o comando poder ser repetido. */
export type ComandoCamada =
  | { tipo: 'NovaCamadaAjuste'; id: string; nome: string; ajuste: AjusteCamada; acimaDe?: string }
  | { tipo: 'EditarCamadaAjuste'; id: string; ajuste: AjusteCamada }
  | {
      tipo: 'NovaCamada';
      id: string;
      nome: string;
      /** Fica logo acima desta camada (padrão: a ativa). */
      acimaDe?: string;
      propriedades?: AlteracaoCamada;
      /** Pixels iniciais (importar como camada, colar como nova camada). */
      imagem?: ImagemSerializada;
      /** Conteúdo ASCII inicial, com a área no papel. */
      ascii?: CamadaAscii;
      rasterizarAscii?: boolean;
      x?: number;
      y?: number;
    }
  | { tipo: 'EditarCamadaAscii'; id: string; arte: ArteAscii }
  | { tipo: 'DuplicarCamada'; id: string; novoId: string }
  | { tipo: 'ExcluirCamada'; id: string }
  | { tipo: 'AlterarCamada'; id: string; propriedades: AlteracaoCamada }
  | { tipo: 'MoverCamada'; id: string; posicao: number; grupo?: string | null }
  | { tipo: 'MesclarAbaixo'; id: string }
  | { tipo: 'DeslocarCamada'; id: string; dx: number; dy: number }
  /** Matriz afim [a, b, c, d, e, f] aplicada aos pixels e à máscara da camada. */
  | {
      tipo: 'TransformarCamada';
      id: string;
      matriz: [number, number, number, number, number, number];
    }
  /** Leva a área `origem` da camada para o quadrilátero `cantos` (SE, SD, ID, IE). */
  | { tipo: 'DistorcerCamada'; id: string; origem: Rect; cantos: [Point, Point, Point, Point] }
  | { tipo: 'MesclarVisiveis'; novoId: string }
  | { tipo: 'AchatarImagem' }
  | { tipo: 'AgruparCamadas'; ids: string[]; grupoId: string; nome: string }
  | { tipo: 'Desagrupar'; grupoId: string }
  | { tipo: 'AlterarGrupo'; id: string; propriedades: Partial<Omit<Grupo, 'id'>> }
  | { tipo: 'AdicionarMascara'; id: string; area?: Rect; mascara?: MascaraSelecao }
  | { tipo: 'AplicarMascara'; id: string }
  | { tipo: 'ExcluirMascara'; id: string };

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
