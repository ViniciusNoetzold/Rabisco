import type { PixelBuffer, Point, Rect } from '../layers/types';
import { lerCaminho, validarCaminho, type ComandoCaminho, type EstiloFormaSalvo } from './presets';
import { obterDefinicaoForma } from './render';
import type { ConfiguracaoForma, TracadorForma } from './tipos';

function serializar(comandos: readonly ComandoCaminho[]): string {
  return comandos
    .map(({ tipo, valores }) => tipo + valores.map((n) => Number(n.toFixed(4))).join(' '))
    .join(' ');
}

/** Projeta os eixos do arco sobre uma nova caixa, mantendo a elipse. */
function transformarArco(
  [raioX, raioY, angulo, longo, sentido]: number[],
  vetor: (x: number, y: number) => Point,
  fim: Point,
): number[] {
  if (!raioX || !raioY) return [0, 0, 0, longo, sentido, fim.x, fim.y];
  const a = (angulo * Math.PI) / 180;
  const u = vetor(raioX * Math.cos(a), raioX * Math.sin(a));
  const v = vetor(-raioY * Math.sin(a), raioY * Math.cos(a));
  const xx = u.x ** 2 + v.x ** 2;
  const yy = u.y ** 2 + v.y ** 2;
  const xy = u.x * u.y + v.x * v.y;
  const maior = Math.sqrt((xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2);
  const menor = Math.abs(u.x * v.y - u.y * v.x) / maior;
  return [maior, menor, (Math.atan2(2 * xy, xx - yy) * 90) / Math.PI, longo, sentido, fim.x, fim.y];
}

function girarCaminho(comandos: ComandoCaminho[], forma: ConfiguracaoForma): ComandoCaminho[] {
  const { width, height } = forma.caixa;
  const cos = Math.cos(forma.rotacao);
  const sin = Math.sin(forma.rotacao);
  const largura = Math.abs(width * cos) + Math.abs(height * sin);
  const altura = Math.abs(width * sin) + Math.abs(height * cos);
  function vetor(x: number, y: number): Point {
    return {
      x: (x * width * cos - y * height * sin) / largura,
      y: (x * width * sin + y * height * cos) / altura,
    };
  }
  function par(x: number, y: number): Point {
    const p = vetor(x - 0.5, y - 0.5);
    return { x: p.x + 0.5, y: p.y + 0.5 };
  }
  let atual = [0, 0];
  let inicio = atual;
  return comandos.map(({ tipo, valores }) => {
    if (tipo === 'Z') {
      atual = inicio;
      return { tipo, valores };
    }
    if (tipo === 'H') valores = [valores[0], atual[1]];
    if (tipo === 'V') valores = [atual[0], valores[0]];
    atual = valores.slice(-2);
    if (tipo === 'M') inicio = atual;
    if (tipo === 'A')
      return { tipo, valores: transformarArco(valores, vetor, par(atual[0], atual[1])) };

    const pares: number[] = [];
    for (let i = 0; i < valores.length; i += 2) {
      const { x, y } = par(valores[i], valores[i + 1]);
      pares.push(x, y);
    }
    return { tipo: tipo === 'H' || tipo === 'V' ? 'L' : tipo, valores: pares };
  });
}

/** Registra os mesmos segmentos que o renderizador usa no canvas. */
export function referenciaDaForma(forma: ConfiguracaoForma) {
  const { path, nome, fechada } = obterDefinicaoForma(forma);
  let svg = path;
  if (typeof path === 'function') {
    const comandos: ComandoCaminho[] = [];
    const tracador: TracadorForma = {
      moveTo: (...valores) => comandos.push({ tipo: 'M', valores }),
      lineTo: (...valores) => comandos.push({ tipo: 'L', valores }),
      quadraticCurveTo: (...valores) => comandos.push({ tipo: 'Q', valores }),
      bezierCurveTo: (...valores) => comandos.push({ tipo: 'C', valores }),
      closePath: () => comandos.push({ tipo: 'Z', valores: [] }),
    };
    path(tracador, 1, 1, forma.parametros, forma.pontos, forma.aberta);
    svg = serializar(comandos);
  }
  const comandos = lerCaminho(svg);
  if (!comandos) return null;
  const caminho = forma.rotacao ? serializar(girarCaminho(comandos, forma)) : svg;
  if (!validarCaminho(caminho)) return null;
  const { cor1, cor2, espessura, contorno, preenchimento } = forma;
  const estilo: EstiloFormaSalvo = { cor1, cor2, espessura, contorno, preenchimento };
  return { nome, path: caminho, fechada: fechada && !forma.aberta, estilo };
}

function corEm(pixels: PixelBuffer, x: number, y: number): number {
  const i = (y * pixels.width + x) * 4;
  const { data } = pixels;
  if (data[i + 3] < 32) return -1;
  // Agrupa variações pequenas para manter o papel fora da silhueta.
  return ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
}

function mascara(pixels: PixelBuffer, area: Rect, largura: number, altura: number): Uint8Array {
  const cores = new Int16Array(largura * altura);
  const borda = new Map<number, number>();
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const cor = corEm(
        pixels,
        area.x + Math.floor(((x + 0.5) * area.width) / largura),
        area.y + Math.floor(((y + 0.5) * area.height) / altura),
      );
      cores[y * largura + x] = cor;
      if (x === 0 || y === 0 || x === largura - 1 || y === altura - 1)
        borda.set(cor, (borda.get(cor) ?? 0) + 1);
    }
  }
  const [dominante, ocorrencias] = [...borda].sort((a, b) => b[1] - a[1])[0];
  const uniforme = cores.every((cor) => cor === dominante);
  const fundo = dominante === 0xfff || !uniforme ? dominante : -1;
  const removerFundo = ocorrencias / Math.max(1, 2 * (largura + altura) - 4) >= 0.45;
  return Uint8Array.from(cores, (cor) => Number(cor >= 0 && (!removerFundo || cor !== fundo)));
}

/** Traça as fronteiras da máscara e mantém ilhas e buracos como subcaminhos. */
function contornos(tinta: Uint8Array, largura: number, altura: number): ComandoCaminho[] {
  const passo = largura + 1;
  const arestas = new Map<number, number[]>();
  const pintar = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < largura && y < altura && tinta[y * largura + x];
  function adicionar(de: number, ate: number) {
    const saidas = arestas.get(de);
    if (saidas) saidas.push(ate);
    else arestas.set(de, [ate]);
  }
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (!pintar(x, y)) continue;
      const p = y * passo + x;
      if (!pintar(x, y - 1)) adicionar(p, p + 1);
      if (!pintar(x + 1, y)) adicionar(p + 1, p + 1 + passo);
      if (!pintar(x, y + 1)) adicionar(p + 1 + passo, p + passo);
      if (!pintar(x - 1, y)) adicionar(p + passo, p);
    }
  }
  const comandos: ComandoCaminho[] = [];
  for (const inicio of arestas.keys()) {
    while (arestas.has(inicio)) {
      const vertices: number[] = [];
      let atual = inicio;
      do {
        vertices.push(atual);
        const saidas = arestas.get(atual)!;
        const proximo = saidas.pop()!;
        if (!saidas.length) arestas.delete(atual);
        atual = proximo;
      } while (atual !== inicio);
      let primeiro = true;
      for (const [i, ponto] of vertices.entries()) {
        const anterior = vertices.at(i - 1)!;
        const proximo = vertices[(i + 1) % vertices.length];
        if (ponto - anterior === proximo - ponto) continue;
        comandos.push({
          tipo: primeiro ? 'M' : 'L',
          valores: [(ponto % passo) / largura, Math.floor(ponto / passo) / altura],
        });
        primeiro = false;
      }
      comandos.push({ tipo: 'Z', valores: [] });
    }
  }
  return comandos;
}

export function referenciaDaSelecao(pixels: PixelBuffer, area: Rect) {
  for (const limite of [48, 24, 12, 6]) {
    const largura = Math.min(limite, area.width);
    const altura = Math.min(limite, area.height);
    const path = serializar(contornos(mascara(pixels, area, largura, altura), largura, altura));
    if (validarCaminho(path)) return { nome: 'Forma da seleção', path, fechada: true };
  }
  return null;
}
