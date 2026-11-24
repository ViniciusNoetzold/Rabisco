import type { Point } from '../layers/types';
import { lerCaminho, type ComandoCaminho } from './presets';

export type BaseForma = 'poligono' | 'estrela' | 'retangulo' | 'seta' | 'balao';

export interface ParametrosEditorForma {
  lados: number;
  pontas: number;
  raioInterno: number;
  canto: number;
  rotacao: number;
  haste: number;
  pontaSeta: number;
  cauda: number;
}

export const PARAMETROS_EDITOR: ParametrosEditorForma = {
  lados: 6,
  pontas: 5,
  raioInterno: 45,
  canto: 18,
  rotacao: 0,
  haste: 45,
  pontaSeta: 38,
  cauda: 32,
};

type Segmento = { tipo: 'Q'; controle: Point } | { tipo: 'A'; arco: number[] };

export interface NoForma {
  ponto: Point;
  entrada?: Point;
  saida?: Point;
  segmento?: Segmento;
}

export interface ContornoEditor {
  nos: NoForma[];
  fechado: boolean;
}

export interface EnderecoNo {
  contorno: number;
  no: number;
}

const xy = (ponto: Point) => [ponto.x, ponto.y];
const arredondar = (n: number) => Number(n.toFixed(5));

function serializar(comandos: ComandoCaminho[]): string {
  return comandos
    .map(({ tipo, valores }) => [tipo, ...valores.map(arredondar)].join(' '))
    .join(' ');
}

function verticesRadiais(total: number, raioInterno: number | null): ComandoCaminho[] {
  const vertices = raioInterno === null ? total : total * 2;
  const caminho = Array.from({ length: vertices }, (_, indice): ComandoCaminho => {
    const raio = raioInterno !== null && indice % 2 ? raioInterno / 2 : 0.5;
    const angulo = (indice * Math.PI * 2) / vertices - Math.PI / 2;
    return {
      tipo: indice === 0 ? 'M' : 'L',
      valores: [0.5 + raio * Math.cos(angulo), 0.5 + raio * Math.sin(angulo)],
    };
  });
  caminho.push({ tipo: 'Z', valores: [] });
  return caminho;
}

function caixaArredondada(raio: number, cauda?: number): ComandoCaminho[] {
  const topo = 0.12;
  const base = cauda === undefined ? 0.88 : 0.74;
  const r = Math.min((base - topo) / 2, raio);
  const caminho: ComandoCaminho[] = [
    { tipo: 'M', valores: [r, topo] },
    { tipo: 'L', valores: [1 - r, topo] },
    { tipo: 'Q', valores: [1, topo, 1, topo + r] },
    { tipo: 'L', valores: [1, base - r] },
    { tipo: 'Q', valores: [1, base, 1 - r, base] },
  ];
  if (cauda !== undefined) {
    caminho.push(
      { tipo: 'L', valores: [cauda + 0.105, base] },
      { tipo: 'L', valores: [cauda - 0.065, 0.99] },
      { tipo: 'L', valores: [cauda - 0.085, base] },
    );
  }
  caminho.push(
    { tipo: 'L', valores: [r, base] },
    { tipo: 'Q', valores: [0, base, 0, base - r] },
    { tipo: 'L', valores: [0, topo + r] },
    { tipo: 'Q', valores: [0, topo, r, topo] },
    { tipo: 'Z', valores: [] },
  );
  return caminho;
}

function seta(haste: number, ponta: number): ComandoCaminho[] {
  const encaixe = 1 - ponta;
  return [
    { tipo: 'M', valores: [0, 0.5 - haste / 2] },
    { tipo: 'L', valores: [encaixe, 0.5 - haste / 2] },
    { tipo: 'L', valores: [encaixe, 0] },
    { tipo: 'L', valores: [1, 0.5] },
    { tipo: 'L', valores: [encaixe, 1] },
    { tipo: 'L', valores: [encaixe, 0.5 + haste / 2] },
    { tipo: 'L', valores: [0, 0.5 + haste / 2] },
    { tipo: 'Z', valores: [] },
  ];
}

export function caminhoParametrico(base: BaseForma, p: ParametrosEditorForma): string {
  const caminho = {
    poligono: () => verticesRadiais(p.lados, null),
    estrela: () => verticesRadiais(p.pontas, p.raioInterno / 100),
    retangulo: () => caixaArredondada(p.canto / 100),
    seta: () => seta(p.haste / 100, p.pontaSeta / 100),
    balao: () => caixaArredondada(p.canto / 200, p.cauda / 100),
  }[base]();
  if (!p.rotacao) return serializar(caminho);

  const angulo = (p.rotacao * Math.PI) / 180;
  const seno = Math.sin(angulo);
  const cosseno = Math.cos(angulo);
  let amplitude = 0.5;
  for (const comando of caminho) {
    for (let i = 0; i < comando.valores.length; i += 2) {
      const x = comando.valores[i] - 0.5;
      const y = comando.valores[i + 1] - 0.5;
      const novoX = x * cosseno - y * seno;
      const novoY = x * seno + y * cosseno;
      comando.valores[i] = novoX;
      comando.valores[i + 1] = novoY;
      amplitude = Math.max(amplitude, Math.abs(novoX), Math.abs(novoY));
    }
  }
  return serializar(
    caminho.map(({ tipo, valores }) => ({
      tipo,
      valores: valores.map((v) => 0.5 + v / (2 * amplitude)),
    })),
  );
}

/** Interpreta segmentos absolutos e guarda os controles originais ao abrir uma forma. */
export function contornosDoCaminho(path: string): ContornoEditor[] {
  const contornos: ContornoEditor[] = [];
  let atual: ContornoEditor | undefined;
  for (const { tipo, valores } of lerCaminho(path) ?? []) {
    const ultimo = atual?.nos.at(-1);
    if (tipo === 'M') {
      atual = { nos: [{ ponto: { x: valores[0], y: valores[1] } }], fechado: false };
      contornos.push(atual);
      continue;
    }
    if (!atual || !ultimo) continue;
    if (tipo === 'Z') {
      const primeiro = atual.nos[0];
      if (
        atual.nos.length > 1 &&
        primeiro.ponto.x === ultimo.ponto.x &&
        primeiro.ponto.y === ultimo.ponto.y
      ) {
        primeiro.entrada = ultimo.entrada;
        primeiro.segmento = ultimo.segmento;
        atual.nos.pop();
      }
      atual.fechado = true;
      continue;
    }
    const no: NoForma = { ponto: { x: valores.at(-2)!, y: valores.at(-1)! } };
    if (tipo === 'H') no.ponto = { x: valores[0], y: ultimo.ponto.y };
    if (tipo === 'V') no.ponto = { x: ultimo.ponto.x, y: valores[0] };
    if (tipo === 'C') {
      ultimo.saida = { x: valores[0], y: valores[1] };
      no.entrada = { x: valores[2], y: valores[3] };
    }
    if (tipo === 'Q') no.segmento = { tipo: 'Q', controle: { x: valores[0], y: valores[1] } };
    if (tipo === 'A') no.segmento = { tipo: 'A', arco: valores.slice(0, 5) };
    atual.nos.push(no);
  }
  return contornos;
}

function ligar(anterior: NoForma, proximo: NoForma): ComandoCaminho {
  const fim = xy(proximo.ponto);
  const { segmento, entrada } = proximo;
  if (segmento?.tipo === 'Q') return { tipo: 'Q', valores: [...xy(segmento.controle), ...fim] };
  if (segmento?.tipo === 'A') return { tipo: 'A', valores: [...segmento.arco, ...fim] };
  if (anterior.saida || entrada) {
    return {
      tipo: 'C',
      valores: [...xy(anterior.saida ?? anterior.ponto), ...xy(entrada ?? proximo.ponto), ...fim],
    };
  }
  return { tipo: 'L', valores: fim };
}

export function caminhoDosContornos(contornos: ContornoEditor[]): string {
  const caminho: ComandoCaminho[] = [];
  for (const { nos, fechado } of contornos) {
    if (!nos.length) continue;
    caminho.push({ tipo: 'M', valores: xy(nos[0].ponto) });
    for (let i = 1; i < nos.length; i++) caminho.push(ligar(nos[i - 1], nos[i]));
    const ultimo = nos.at(-1);
    if (fechado && ultimo) {
      if (ultimo.saida || nos[0].entrada || nos[0].segmento) caminho.push(ligar(ultimo, nos[0]));
      caminho.push({ tipo: 'Z', valores: [] });
    }
  }
  return serializar(caminho);
}

export function moverNo(no: NoForma, ponto: Point): void {
  const dx = ponto.x - no.ponto.x;
  const dy = ponto.y - no.ponto.y;
  const arrastar = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  no.ponto = ponto;
  if (no.entrada) no.entrada = arrastar(no.entrada);
  if (no.saida) no.saida = arrastar(no.saida);
  if (no.segmento?.tipo === 'Q') no.segmento.controle = arrastar(no.segmento.controle);
}

export function curvarNo(contorno: ContornoEditor, indice: number, controle: Point): void {
  const no = contorno.nos[indice];
  no.saida = controle;
  no.entrada = { x: 2 * no.ponto.x - controle.x, y: 2 * no.ponto.y - controle.y };
  delete no.segmento;
  const proximo = contorno.nos[indice + 1] ?? (contorno.fechado ? contorno.nos[0] : undefined);
  if (proximo) delete proximo.segmento;
}

export function espelharContornos(contornos: ContornoEditor[], eixo: 'x' | 'y'): ContornoEditor[] {
  function espelhar(p: Point): Point {
    return { ...p, [eixo]: 1 - p[eixo] };
  }
  return contornos.map(({ fechado, nos }) => ({
    fechado,
    nos: nos.map(({ ponto, entrada, saida, segmento }) => {
      const no: NoForma = { ponto: espelhar(ponto) };
      if (entrada) no.entrada = espelhar(entrada);
      if (saida) no.saida = espelhar(saida);
      if (segmento?.tipo === 'Q')
        no.segmento = { tipo: 'Q', controle: espelhar(segmento.controle) };
      if (segmento?.tipo === 'A') {
        const [rx, ry, angulo, maior, sentido] = segmento.arco;
        no.segmento = { tipo: 'A', arco: [rx, ry, -angulo, maior, 1 - sentido] };
      }
      return no;
    }),
  }));
}
