import type { Point } from '../layers/types';
import { geometriaPorPontos, type GeometriaForma } from '../tools/geometriaForma';

/** O que o traço virou, com o nome para a dica ("Virou um círculo!"). */
export interface FormaReconhecida {
  tipo:
    | 'linha'
    | 'circulo'
    | 'elipse'
    | 'quadrado'
    | 'retangulo'
    | 'triangulo'
    | 'seta'
    | 'poligono';
  nome: string;
  geometria: GeometriaForma;
}

const GRAU = Math.PI / 180;
const NOMES: Record<FormaReconhecida['tipo'], string> = {
  linha: 'uma linha',
  circulo: 'um círculo',
  elipse: 'uma elipse',
  quadrado: 'um quadrado',
  retangulo: 'um retângulo',
  triangulo: 'um triângulo',
  seta: 'uma seta',
  poligono: 'um polígono',
};

function distancia(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function comprimento(pontos: readonly Point[]) {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distancia(pontos[i - 1], pontos[i]);
  return total;
}

/** Diferença entre ângulos, em −π…π. */
function diferenca(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distância do ponto ao segmento a–b. */
function distanciaAoSegmento(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const quadrado = dx * dx + dy * dy;
  const t = quadrado
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / quadrado))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** `n` pontos igualmente espaçados ao longo do caminho. */
export function reamostrar(pontos: readonly Point[], n: number): Point[] {
  const total = comprimento(pontos);
  if (total === 0) return Array.from({ length: n }, () => ({ x: pontos[0].x, y: pontos[0].y }));
  const passo = total / (n - 1);
  const saida: Point[] = [{ x: pontos[0].x, y: pontos[0].y }];
  let acumulado = 0;
  let alvo = passo;
  for (let i = 1; i < pontos.length && saida.length < n; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    const trecho = distancia(a, b);
    while (trecho > 0 && acumulado + trecho >= alvo && saida.length < n) {
      const t = (alvo - acumulado) / trecho;
      saida.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      alvo += passo;
    }
    acumulado += trecho;
  }
  const ultimo = pontos[pontos.length - 1];
  while (saida.length < n) saida.push({ x: ultimo.x, y: ultimo.y });
  return saida;
}

/** Ramer–Douglas–Peucker: os vértices que explicam o caminho com erro até `tolerancia`. */
export function simplificar(pontos: readonly Point[], tolerancia: number): Point[] {
  if (pontos.length < 3) return [...pontos];
  const manter = new Uint8Array(pontos.length);
  manter[0] = manter[pontos.length - 1] = 1;
  const pilha: [number, number][] = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [inicio, fim] = pilha.pop()!;
    let maior = 0;
    let indice = -1;
    for (let i = inicio + 1; i < fim; i++) {
      const d = distanciaAoSegmento(pontos[i], pontos[inicio], pontos[fim]);
      if (d > maior) {
        maior = d;
        indice = i;
      }
    }
    if (indice >= 0 && maior > tolerancia) {
      manter[indice] = 1;
      pilha.push([inicio, indice], [indice, fim]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

/**
 * Cantos de um caminho fechado e reamostrado: onde a direção vira mais de 40° num trecho curto
 * (~6% do perímetro). Num círculo a virada é espalhada e nunca passa disso.
 */
function cantos(fechado: readonly Point[]): number[] {
  const n = fechado.length;
  const janela = Math.max(2, Math.round(n * 0.03));
  // Direção de chegada e de saída pela corda de `janela` passos: o tremor da mão some.
  const virada = fechado.map((p, i) => {
    const antes = fechado[(i - janela + n) % n];
    const depois = fechado[(i + janela) % n];
    return Math.abs(
      diferenca(
        Math.atan2(depois.y - p.y, depois.x - p.x),
        Math.atan2(p.y - antes.y, p.x - antes.x),
      ),
    );
  });
  const encontrados: number[] = [];
  for (let i = 0; i < n; i++) {
    if (virada[i] < 40 * GRAU) continue;
    let maximo = true;
    for (let d = -2 * janela; d <= 2 * janela && maximo; d++) {
      const j = (i + d + n) % n;
      if (virada[j] > virada[i] || (virada[j] === virada[i] && j < i && d !== 0)) maximo = false;
    }
    if (maximo) encontrados.push(i);
  }
  return encontrados;
}

/** Ângulo interno no vértice b do caminho a–b–c, em radianos. */
function anguloInterno(a: Point, b: Point, c: Point) {
  return Math.abs(diferenca(Math.atan2(a.y - b.y, a.x - b.x), Math.atan2(c.y - b.y, c.x - b.x)));
}

/** Prende ângulos pequenos (até 8°) no zero, para formas que o usuário quis retas. */
function prenderAngulo(angulo: number) {
  return Math.abs(angulo) < 8 * GRAU ? 0 : angulo;
}

function girar(p: Point, centro: Point, angulo: number): Point {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  const x = p.x - centro.x;
  const y = p.y - centro.y;
  return { x: centro.x + x * cos - y * sen, y: centro.y + x * sen + y * cos };
}

function caixaCentrada(centro: Point, largura: number, altura: number, rotacao: number) {
  return {
    caixa: { x: centro.x - largura / 2, y: centro.y - altura / 2, width: largura, height: altura },
    rotacao,
  };
}

function resultado(tipo: FormaReconhecida['tipo'], geometria: GeometriaForma): FormaReconhecida {
  return { tipo, nome: NOMES[tipo], geometria };
}

function reconhecerAberto(pontos: readonly Point[], diagonal: number): FormaReconhecida | null {
  const inicio = pontos[0];
  const fim = pontos[pontos.length - 1];
  const corda = distancia(inicio, fim);
  // Linha: o caminho fica perto da reta do começo ao fim e quase não volta para trás.
  if (corda > 0) {
    const ux = (fim.x - inicio.x) / corda;
    const uy = (fim.y - inicio.y) / corda;
    let desvio = 0;
    let recuo = 0;
    let anterior = 0;
    for (const p of reamostrar(pontos, 48)) {
      desvio = Math.max(desvio, distanciaAoSegmento(p, inicio, fim));
      const avanco = (p.x - inicio.x) * ux + (p.y - inicio.y) * uy;
      recuo += Math.max(0, anterior - avanco);
      anterior = Math.max(anterior, avanco);
    }
    if (desvio / corda < 0.07 && recuo / corda < 0.1)
      return resultado('linha', geometriaPorPontos('line', [inicio, fim]));
  }
  // Seta num traço só: cabo até a ponta, uma aba, volta à ponta, a outra aba.
  const v = simplificar(pontos, Math.max(3, diagonal * 0.06));
  if (v.length !== 5) return null;
  const [cauda, ponta, aba1, volta, aba2] = v;
  const cabo = distancia(cauda, ponta);
  const asas = [distancia(ponta, aba1), distancia(volta, aba2)];
  if (distancia(volta, ponta) > 0.35 * Math.max(...asas)) return null;
  if (asas.some((asa) => asa < 0.1 * cabo || asa > 0.7 * cabo)) return null;
  const direcao = Math.atan2(ponta.y - cauda.y, ponta.x - cauda.x);
  // Cada aba aponta para trás, de lados opostos do cabo, a 15–75° dele.
  const lados = [aba1, aba2].map((aba) =>
    diferenca(Math.atan2(aba.y - ponta.y, aba.x - ponta.x), direcao + Math.PI),
  );
  if (lados.some((lado) => Math.abs(lado) < 15 * GRAU || Math.abs(lado) > 75 * GRAU)) return null;
  if (Math.sign(lados[0]) === Math.sign(lados[1])) return null;
  const abertura = Math.max(
    ...[aba1, aba2].map((aba) => {
      const local = girar(aba, ponta, -direcao);
      return Math.abs(local.y - ponta.y);
    }),
  );
  const centro = { x: (cauda.x + ponta.x) / 2, y: (cauda.y + ponta.y) / 2 };
  return resultado('seta', {
    id: 'seta-direita',
    ...caixaCentrada(centro, cabo, Math.max(abertura * 2, cabo * 0.15), prenderAngulo(direcao)),
  });
}

function reconhecerElipse(fechado: readonly Point[]): FormaReconhecida | null {
  // Eixos principais pela covariância dos pontos (a elipse pode estar inclinada).
  const n = fechado.length;
  const media = fechado.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 });
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const p of fechado) {
    xx += (p.x - media.x) ** 2;
    yy += (p.y - media.y) ** 2;
    xy += (p.x - media.x) * (p.y - media.y);
  }
  let angulo = 0.5 * Math.atan2(2 * xy, xx - yy);
  const locais = fechado.map((p) => girar(p, media, -angulo));
  const xs = locais.map((p) => p.x);
  const ys = locais.map((p) => p.y);
  let a = (Math.max(...xs) - Math.min(...xs)) / 2;
  let b = (Math.max(...ys) - Math.min(...ys)) / 2;
  if (a < 4 || b < 4) return null;
  const centroLocal = {
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
  };
  let erro = 0;
  for (const p of locais)
    erro += Math.abs(Math.hypot((p.x - centroLocal.x) / a, (p.y - centroLocal.y) / b) - 1);
  if (erro / n > 0.09) return null;
  const centro = girar(centroLocal, media, angulo);
  if (Math.max(a, b) / Math.min(a, b) < 1.15) {
    const raio = (a + b) / 2;
    return resultado('circulo', { id: 'ellipse', ...caixaCentrada(centro, raio * 2, raio * 2, 0) });
  }
  // Uma elipse quase deitada ou quase em pé fica reta.
  angulo = prenderAngulo(diferenca(angulo, 0));
  if (Math.abs(diferenca(angulo, Math.PI / 2)) < 8 * GRAU) {
    [a, b] = [b, a];
    angulo = 0;
  }
  return resultado('elipse', { id: 'ellipse', ...caixaCentrada(centro, a * 2, b * 2, angulo) });
}

function reconhecerPoligono(
  vertices: Point[],
  fechado: readonly Point[],
  diagonal: number,
): FormaReconhecida | null {
  // O traço precisa passar perto das arestas do polígono.
  let erro = 0;
  for (const p of fechado) {
    let menor = Infinity;
    for (let i = 0; i < vertices.length; i++)
      menor = Math.min(
        menor,
        distanciaAoSegmento(p, vertices[i], vertices[(i + 1) % vertices.length]),
      );
    erro += menor;
  }
  if (erro / fechado.length > diagonal * 0.045) return null;
  const angulos = vertices.map((v, i) =>
    anguloInterno(
      vertices[(i - 1 + vertices.length) % vertices.length],
      v,
      vertices[(i + 1) % vertices.length],
    ),
  );
  if (vertices.length === 3) return resultado('triangulo', geometriaPorPontos('polygon', vertices));
  if (
    vertices.length === 4 &&
    angulos.every((angulo) => Math.abs(angulo - Math.PI / 2) < 22 * GRAU)
  ) {
    // Inclinação média das arestas (módulo 90°) e as medidas no sistema da forma.
    let soma = 0;
    for (let i = 0; i < 4; i++) {
      const p = vertices[i];
      const q = vertices[(i + 1) % 4];
      const angulo = Math.atan2(q.y - p.y, q.x - p.x);
      soma += diferenca(angulo * 4, 0) / 4;
    }
    const rotacao = prenderAngulo(soma / 4);
    const centro = {
      x: vertices.reduce((s, p) => s + p.x, 0) / 4,
      y: vertices.reduce((s, p) => s + p.y, 0) / 4,
    };
    const locais = vertices.map((p) => girar(p, centro, -rotacao));
    const xs = locais.map((p) => p.x).sort((m, n) => m - n);
    const ys = locais.map((p) => p.y).sort((m, n) => m - n);
    // Média dos dois menores e dos dois maiores: lados tortos viram lados retos.
    let largura = (xs[2] + xs[3] - xs[0] - xs[1]) / 2;
    let altura = (ys[2] + ys[3] - ys[0] - ys[1]) / 2;
    const quadrado = Math.max(largura, altura) / Math.min(largura, altura) < 1.12;
    if (quadrado) largura = altura = (largura + altura) / 2;
    return resultado(quadrado ? 'quadrado' : 'retangulo', {
      id: 'rectangle',
      ...caixaCentrada(centro, largura, altura, rotacao),
    });
  }
  if (vertices.length <= 8) return resultado('poligono', geometriaPorPontos('polygon', vertices));
  return null;
}

/**
 * Reconhece linha, círculo/elipse, retângulo/quadrado, triângulo, seta e polígono simples num
 * traço à mão. Em dúvida, devolve nulo (o traço fica como foi desenhado).
 */
export function reconhecerForma(pontos: readonly Point[]): FormaReconhecida | null {
  if (pontos.length < 4) return null;
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const largura = Math.max(...xs) - Math.min(...xs);
  const altura = Math.max(...ys) - Math.min(...ys);
  const diagonal = Math.hypot(largura, altura);
  const total = comprimento(pontos);
  if (diagonal < 12 || total < 20) return null;
  const inicio = pontos[0];
  const fim = pontos[pontos.length - 1];
  const fechado = distancia(inicio, fim) <= Math.max(10, 0.2 * Math.max(largura, altura));
  if (!fechado) return reconhecerAberto(pontos, diagonal);
  // Rabiscos dão muitas voltas: o caminho de uma forma fechada mede perto do perímetro dela.
  if (total > 4.2 * Math.max(largura, altura) + 2 * Math.min(largura, altura)) return null;
  const amostras = reamostrar([...pontos, inicio], 97).slice(0, 96);
  const indices = cantos(amostras);
  if (indices.length <= 2) return reconhecerElipse(amostras);
  if (indices.length > 8) return null;
  return reconhecerPoligono(
    indices.map((i) => amostras[i]),
    amostras,
    diagonal,
  );
}
