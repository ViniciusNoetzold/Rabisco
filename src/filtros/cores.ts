import type { PixelBuffer } from '../layers/types';

type Parametros = Readonly<Record<string, unknown>>;

export interface PontoCurva {
  x: number;
  y: number;
}

export const PONTOS_CURVA_PADRAO: PontoCurva[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

function numero(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? limitar(valor, minimo, maximo)
    : padrao;
}

/** Luminância Rec.601, usada também pela composição de máscaras. */
export function luminancia(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function mapearPixels(
  pixels: PixelBuffer,
  transformar: (data: Uint8ClampedArray, indice: number) => void,
): PixelBuffer {
  const data = new Uint8ClampedArray(pixels.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) transformar(data, i);
  }
  return { width: pixels.width, height: pixels.height, data };
}

function tabela(transformar: (valor: number) => number): Uint8ClampedArray {
  const valores = new Uint8ClampedArray(256);
  for (let valor = 0; valor < valores.length; valor++) valores[valor] = transformar(valor);
  return valores;
}

function mapearCanais(pixels: PixelBuffer, valores: Uint8ClampedArray): PixelBuffer {
  if (valores.every((valor, original) => valor === original)) return pixels;
  return mapearPixels(pixels, (data, i) => {
    data[i] = valores[data[i]];
    data[i + 1] = valores[data[i + 1]];
    data[i + 2] = valores[data[i + 2]];
  });
}

export function brilhoContraste(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const brilho = numero(parametros.brilho, 0, -100, 100) * 2.55;
  const contraste = numero(parametros.contraste, 0, -100, 100);
  const ganho = contraste === 100 ? 255 : (100 + contraste) / (100 - contraste);
  return mapearCanais(
    pixels,
    tabela((valor) => (valor - 127.5) * ganho + 127.5 + brilho),
  );
}

function canalDeMatiz(segmento: number, maximo: number, amplitude: number, deslocamento: number) {
  const posicao = (segmento + deslocamento) % 6;
  return maximo - amplitude * Math.max(0, Math.min(posicao, 4 - posicao, 1));
}

function ajustarLuminosidade(canal: number, ajuste: number): number {
  const valor = limitar(canal, 0, 255);
  return ajuste < 0 ? valor * (1 + ajuste) : valor + (255 - valor) * ajuste;
}

export function matizSaturacao(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const rotacao = numero(parametros.matiz, 0, -180, 180) / 60;
  const saturacao = numero(parametros.saturacao, 100, 0, 200) / 100;
  const luminosidade = numero(parametros.luminosidade, 0, -100, 100) / 100;
  if (rotacao === 0 && saturacao === 1 && luminosidade === 0) return pixels;

  return mapearPixels(pixels, (data, i) => {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (rotacao !== 0) {
      const maximo = Math.max(r, g, b);
      const amplitude = maximo - Math.min(r, g, b);
      if (amplitude > 0) {
        let segmento: number;
        if (maximo === r) segmento = (g - b) / amplitude;
        else if (maximo === g) segmento = 2 + (b - r) / amplitude;
        else segmento = 4 + (r - g) / amplitude;
        segmento = (segmento + rotacao + 6) % 6;
        r = canalDeMatiz(segmento, maximo, amplitude, 5);
        g = canalDeMatiz(segmento, maximo, amplitude, 3);
        b = canalDeMatiz(segmento, maximo, amplitude, 1);
      }
    }

    const cinza = luminancia(r, g, b);
    data[i] = ajustarLuminosidade(cinza + (r - cinza) * saturacao, luminosidade);
    data[i + 1] = ajustarLuminosidade(cinza + (g - cinza) * saturacao, luminosidade);
    data[i + 2] = ajustarLuminosidade(cinza + (b - cinza) * saturacao, luminosidade);
  });
}

export function niveis(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const preto = numero(parametros.preto, 0, 0, 254);
  const branco = numero(parametros.branco, 255, 1, 255);
  const gama = numero(parametros.gama, 1, 0.1, 5);
  const inicio = Math.min(preto, branco);
  const faixa = Math.max(1, Math.abs(branco - preto));
  return mapearCanais(
    pixels,
    tabela((valor) => 255 * Math.pow(limitar((valor - inicio) / faixa, 0, 1), 1 / gama)),
  );
}

function pontosValidos(valor: unknown): PontoCurva[] {
  const pontos = new Map(PONTOS_CURVA_PADRAO.map(({ x, y }) => [x, y]));
  if (Array.isArray(valor)) {
    for (const ponto of valor) {
      const x = numero(ponto?.x, NaN, 0, 255);
      const y = numero(ponto?.y, NaN, 0, 255);
      if (Number.isFinite(x) && Number.isFinite(y)) pontos.set(Math.round(x), Math.round(y));
    }
  }
  return Array.from(pontos, ([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
}

/** Interpolação cúbica com tangentes que preservam a monotonia entre pontos. */
export function tabelaCurvas(valor: unknown): Uint8ClampedArray {
  const pontos = pontosValidos(valor);
  const larguras = pontos.slice(1).map((ponto, i) => ponto.x - pontos[i].x);
  const inclinacoes = larguras.map((largura, i) => (pontos[i + 1].y - pontos[i].y) / largura);
  const tangentes = pontos.map((_, i) => {
    if (i === 0) return inclinacoes[0];
    if (i === pontos.length - 1) return inclinacoes[i - 1];
    const anterior = inclinacoes[i - 1];
    const seguinte = inclinacoes[i];
    if (anterior * seguinte <= 0) return 0;
    const pesoAnterior = 2 * larguras[i] + larguras[i - 1];
    const pesoSeguinte = larguras[i] + 2 * larguras[i - 1];
    return (pesoAnterior + pesoSeguinte) / (pesoAnterior / anterior + pesoSeguinte / seguinte);
  });

  let segmento = 0;
  return tabela((entrada) => {
    while (entrada > pontos[segmento + 1].x) segmento++;
    const a = pontos[segmento];
    const b = pontos[segmento + 1];
    const largura = larguras[segmento];
    const t = (entrada - a.x) / largura;
    const inverso = 1 - t;
    const y =
      (1 + 2 * t) * inverso ** 2 * a.y +
      t * inverso ** 2 * largura * tangentes[segmento] +
      t ** 2 * (3 - 2 * t) * b.y -
      t ** 2 * inverso * largura * tangentes[segmento + 1];
    return limitar(y, Math.min(a.y, b.y), Math.max(a.y, b.y));
  });
}

export function curvas(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  return mapearCanais(pixels, tabelaCurvas(parametros.pontos));
}

export function pretoEBranco(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const vermelho = numero(parametros.vermelho, 29.9, 0, 100) / 100;
  const verde = numero(parametros.verde, 58.7, 0, 100) / 100;
  const azul = numero(parametros.azul, 11.4, 0, 100) / 100;
  return mapearPixels(pixels, (data, i) => {
    const cinza = data[i] * vermelho + data[i + 1] * verde + data[i + 2] * azul;
    data[i] = data[i + 1] = data[i + 2] = cinza;
  });
}

export function sepia(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const intensidade = numero(parametros.intensidade, 100, 0, 100) / 100;
  if (intensidade === 0) return pixels;
  return mapearPixels(pixels, (data, i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = r + (Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b) - r) * intensidade;
    data[i + 1] = g + (Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b) - g) * intensidade;
    data[i + 2] = b + (Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b) - b) * intensidade;
  });
}

export function limiar(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const limite = numero(parametros.limite, 128, 0, 255);
  return mapearPixels(pixels, (data, i) => {
    const cor = luminancia(data[i], data[i + 1], data[i + 2]) >= limite ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = cor;
  });
}

export function posterizar(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const niveis = Math.round(numero(parametros.niveis, 4, 2, 32));
  const passo = 255 / (niveis - 1);
  return mapearCanais(
    pixels,
    tabela((valor) => Math.round(valor / passo) * passo),
  );
}
