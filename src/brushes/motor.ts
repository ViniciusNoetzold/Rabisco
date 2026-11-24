import type { Point } from '../layers/types';
import {
  fatorDaPressao,
  pressaoDoPonto,
  type ConfiguracaoPincel,
  type DensidadeSpray,
  type MarcaPincel,
  type TipoPincel,
} from './catalogo';

type Contexto2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Aleatorio = () => number;
const VOLTA = Math.PI * 2;

export const PONTOS_POR_SEGUNDO: Readonly<Record<DensidadeSpray, number>> = {
  baixa: 240,
  media: 600,
  alta: 1320,
};

/** Cada traço tem sua sequência de textura, reaplicável a partir da semente. */
export function criarAleatorioPincel(semente: number): Aleatorio {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = Math.imul(estado ^ (estado >>> 15), estado | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 0x100000000;
  };
}

function pontoNoDisco(centro: Point, raio: number, aleatorio: Aleatorio): Point {
  const angulo = aleatorio() * VOLTA;
  const distancia = Math.sqrt(aleatorio()) * raio;
  return { x: centro.x + Math.cos(angulo) * distancia, y: centro.y + Math.sin(angulo) * distancia };
}

export function gerarPontosSpray(
  centro: Point,
  diametro: number,
  quantidade: number,
  aleatorio: Aleatorio,
): Point[] {
  const raio = diametro / 2;
  // A raiz quadrada distribui os pontos pela área, sem concentrá-los no centro.
  return Array.from({ length: quantidade }, () => pontoNoDisco(centro, raio, aleatorio));
}

/** A máscara do marcador é composta com esta opacidade uma única vez por traço. */
export function opacidadeDoPincel(tipo: TipoPincel): number {
  return tipo === 'marcador' ? 0.35 : 1;
}

export function mesclagemDoPincel(tipo: TipoPincel): 'source-over' | 'multiply' {
  return tipo === 'aquarela' ? 'multiply' : 'source-over';
}

export function margemDoPincel(configuracao: ConfiguracaoPincel): number {
  // Inclui o desvio das cerdas, das partículas e o antisserrilhamento.
  return configuracao.espessura * 0.72 + 2;
}

function oval(ctx: Contexto2D, ponto: Point, raioX: number, raioY = raioX, angulo = 0) {
  ctx.beginPath();
  ctx.ellipse(ponto.x, ponto.y, raioX, raioY, angulo, 0, VOLTA);
  ctx.fill();
}

function cera(
  ctx: Contexto2D,
  centro: Point,
  diametro: number,
  pressao: number,
  aleatorio: Aleatorio,
) {
  const raio = diametro / 2;
  const giro = aleatorio() * VOLTA;
  ctx.globalAlpha = 0.15 + pressao * 0.11;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angulo = giro + (i * VOLTA) / 10;
    const alcance = raio * (0.73 + aleatorio() * 0.25);
    const x = centro.x + Math.cos(angulo) * alcance;
    const y = centro.y + Math.sin(angulo) * alcance;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = (0.23 + aleatorio() * 0.44) * (0.64 + pressao * 0.36);
    const ponto = pontoNoDisco(centro, raio * 0.88, aleatorio);
    oval(ctx, ponto, Math.max(0.26, raio * (0.05 + aleatorio() * 0.1)));
  }
}

function lapisNatural(
  ctx: Contexto2D,
  centro: Point,
  diametro: number,
  pressao: number,
  aleatorio: Aleatorio,
) {
  const raio = diametro * 0.22;
  ctx.globalAlpha = 0.07 + pressao * 0.15;
  oval(ctx, centro, raio);
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = (0.16 + aleatorio() * 0.28) * (0.45 + pressao * 0.55);
    const ponto = pontoNoDisco(centro, raio, aleatorio);
    oval(ctx, ponto, Math.max(0.19, raio * (0.05 + aleatorio() * 0.12)));
  }
}

function aquarela(
  ctx: Contexto2D,
  centro: Point,
  diametro: number,
  pressao: number,
  cor: string,
  aleatorio: Aleatorio,
) {
  const mancha = pontoNoDisco(centro, diametro * 0.09, aleatorio);
  const raio = diametro * (0.44 + aleatorio() * 0.12);
  const pigmento = ctx.createRadialGradient(mancha.x, mancha.y, 0, mancha.x, mancha.y, raio);
  pigmento.addColorStop(0, cor);
  pigmento.addColorStop(0.28, cor);
  pigmento.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.08 + pressao * 0.09;
  ctx.fillStyle = pigmento;
  oval(ctx, mancha, raio);
}

interface Cerda {
  deslocamento: number;
  adiantamento: number;
  intensidade: number;
}

function oleo(
  ctx: Contexto2D,
  centro: Point,
  diametro: number,
  pressao: number,
  cerdas: readonly Cerda[],
  distancia: number,
  angulo: number,
  espessura: number,
) {
  const tinta = (0.18 + 0.82 * Math.exp(-distancia / (90 + espessura * 5))) * (0.6 + 0.4 * pressao);
  ctx.globalAlpha = tinta * 0.45;
  oval(ctx, centro, diametro * 0.34);
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  for (const cerda of cerdas) {
    const lateral = cerda.deslocamento * diametro;
    const frente = cerda.adiantamento * diametro;
    const ponto = {
      x: centro.x + frente * cos - lateral * sin,
      y: centro.y + frente * sin + lateral * cos,
    };
    ctx.globalAlpha = tinta * cerda.intensidade;
    oval(ctx, ponto, Math.max(0.45, diametro * 0.19), Math.max(0.19, diametro * 0.043), angulo);
  }
}

/** Mantém a textura estável quando as marcas chegam em lotes durante a prévia. */
export function criarPintorPincel(ctx: Contexto2D, configuracao: ConfiguracaoPincel) {
  const { cor, tipo, semente, espessura } = configuracao;
  const aleatorio = criarAleatorioPincel(semente);
  const cerdas: Cerda[] =
    tipo === 'oleo'
      ? Array.from({ length: 11 }, (_, i) => ({
          deslocamento: (i - 5) * 0.083 + (aleatorio() - 0.5) * 0.045,
          adiantamento: (aleatorio() - 0.5) * 0.37,
          intensidade: 0.36 + aleatorio() * 0.61,
        }))
      : [];
  let anterior: Point | null = null;
  let distancia = 0;
  let angulo = 0;

  function pintarMarca(marca: MarcaPincel) {
    const pressao = pressaoDoPonto(marca);
    const diametro = Math.max(0.55, espessura * fatorDaPressao(pressao));
    switch (tipo) {
      case 'redondo':
        ctx.globalAlpha = 0.76 + pressao * 0.24;
        oval(ctx, marca, diametro / 2);
        break;
      case 'caligrafia-1':
      case 'caligrafia-2':
        ctx.globalAlpha = 0.62 + pressao * 0.38;
        oval(
          ctx,
          marca,
          diametro / 2,
          diametro * 0.16,
          tipo === 'caligrafia-1' ? Math.PI / 4 : (3 * Math.PI) / 4,
        );
        break;
      case 'spray': {
        const pontos = gerarPontosSpray(marca, diametro, marca.quantidade ?? 1, aleatorio);
        ctx.globalAlpha = 0.62 + pressao * 0.38;
        for (const ponto of pontos) ctx.fillRect(Math.floor(ponto.x), Math.floor(ponto.y), 1, 1);
        break;
      }
      case 'oleo': {
        if (anterior && (marca.x !== anterior.x || marca.y !== anterior.y)) {
          distancia += Math.hypot(marca.x - anterior.x, marca.y - anterior.y);
          angulo = Math.atan2(marca.y - anterior.y, marca.x - anterior.x);
        }
        oleo(ctx, marca, diametro, pressao, cerdas, distancia, angulo, espessura);
        anterior = marca;
        break;
      }
      case 'giz':
        cera(ctx, marca, diametro, pressao, aleatorio);
        break;
      case 'marcador':
        ctx.globalAlpha = 1;
        oval(ctx, marca, diametro * 0.52, diametro * 0.38, -Math.PI / 9);
        break;
      case 'lapis-natural':
        lapisNatural(ctx, marca, diametro, pressao, aleatorio);
        break;
      case 'aquarela':
        aquarela(ctx, marca, diametro, pressao, cor, aleatorio);
        break;
    }
  }

  return {
    pintar(marcas: readonly MarcaPincel[]) {
      if (!marcas.length) return;
      ctx.save();
      try {
        ctx.fillStyle = cor;
        for (const marca of marcas) pintarMarca(marca);
      } finally {
        ctx.restore();
      }
    },
  };
}
