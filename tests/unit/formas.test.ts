import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMAS, obterForma } from '../../src/shapes/catalogo';
import {
  areaDaForma,
  caminhoDaForma,
  desenharForma,
  desenharMiniatura,
} from '../../src/shapes/render';
import { PARAMETROS_PADRAO, type ConfiguracaoForma } from '../../src/shapes/tipos';
import { lerCaminho } from '../../src/shapes/presets';
import { referenciaDaForma, referenciaDaSelecao } from '../../src/shapes/referencia';

/** Registra o caminho sem exigir um bitmap ou uma biblioteca de canvas no executor de unidade. */
class RegistroCaminho {
  operacoes: string[] = [];

  constructor(svg?: string) {
    if (svg) this.operacoes.push(svg);
  }

  moveTo(...valores: number[]) {
    this.registrar('M', valores);
  }
  lineTo(...valores: number[]) {
    this.registrar('L', valores);
  }
  quadraticCurveTo(...valores: number[]) {
    this.registrar('Q', valores);
  }
  bezierCurveTo(...valores: number[]) {
    this.registrar('C', valores);
  }
  closePath() {
    this.operacoes.push('Z');
  }
  addPath(caminho: RegistroCaminho, transformacao: MatrizDeTeste) {
    this.registrar('matriz', transformacao.valores);
    this.operacoes.push(...caminho.operacoes);
  }

  private registrar(tipo: string, valores: number[]) {
    this.operacoes.push(`${tipo} ${valores.map((valor) => Number(valor.toFixed(2))).join(' ')}`);
  }
}

class MatrizDeTeste {
  constructor(readonly valores: number[]) {}
}

beforeEach(() => {
  vi.stubGlobal('Path2D', RegistroCaminho);
  vi.stubGlobal('DOMMatrix', MatrizDeTeste);
});

afterEach(() => vi.unstubAllGlobals());

function modelo(alteracoes: Partial<ConfiguracaoForma> = {}): ConfiguracaoForma {
  return {
    id: 'rectangle',
    caixa: { x: 2, y: 2, width: 28, height: 20 },
    rotacao: 0,
    cor1: '#164f91',
    cor2: '#ffb328',
    espessura: 2,
    contorno: 'solid',
    preenchimento: 'solid',
    parametros: PARAMETROS_PADRAO,
    ...alteracoes,
  };
}

function operacoes(forma: ConfiguracaoForma): string[] {
  return (caminhoDaForma(forma) as unknown as RegistroCaminho).operacoes;
}

it('leva as formas clássicas rotacionadas para um caminho de predefinição válido', () => {
  for (const { id } of FORMAS) {
    const referencia = referenciaDaForma(modelo({ id, rotacao: Math.PI / 3 }));
    expect(referencia?.path, id).toBeTruthy();
    expect(lerCaminho(referencia?.path), id).not.toBeNull();
  }
  const estrela = referenciaDaForma(
    modelo({ id: 'estrela-n', parametros: { ...PARAMETROS_PADRAO, pontas: 7 } }),
  );
  expect(lerCaminho(estrela?.path)).toHaveLength(15);
});

it('traça a silhueta de tinta da seleção e preserva o vazado', () => {
  const data = new Uint8ClampedArray(7 * 7 * 4).fill(255);
  for (let y = 1; y <= 5; y++) {
    for (let x = 1; x <= 5; x++) {
      if (y === 1 || x === 1 || y === 5 || x === 5)
        data.fill(0, (y * 7 + x) * 4, (y * 7 + x) * 4 + 3);
    }
  }
  const area = { x: 0, y: 0, width: 7, height: 7 };
  const referencia = referenciaDaSelecao({ ...area, data }, area);
  const comandos = lerCaminho(referencia?.path);
  expect(comandos?.filter(({ tipo }) => tipo === 'Z')).toHaveLength(2);
  data.fill(255);
  expect(referenciaDaSelecao({ ...area, data }, area)).toBe(null);
});

function criarGraficoDeTeste() {
  const chamadas: unknown[][] = [];
  const pilha: number[] = [];
  const grafico = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    save() {
      pilha.push(grafico.globalAlpha);
    },
    restore() {
      grafico.globalAlpha = pilha.pop() ?? 1;
    },
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    stroke(caminho: RegistroCaminho) {
      chamadas.push([
        'contorno',
        grafico.strokeStyle,
        grafico.globalAlpha,
        caminho.operacoes.join(' '),
      ]);
    },
    fill(caminho: RegistroCaminho, regra: 'evenodd') {
      chamadas.push(['preenchimento', grafico.fillStyle, regra, caminho.operacoes.join(' ')]);
    },
  };
  return { grafico: grafico as unknown as CanvasRenderingContext2D, registro: grafico, chamadas };
}

describe('catálogo de formas clássicas', () => {
  it('desenha as 37 miniaturas a partir dos caminhos do catálogo', () => {
    const { grafico, chamadas } = criarGraficoDeTeste();
    const caixa = modelo().caixa;
    expect(new Set(FORMAS.map(({ id }) => id)).size).toBe(37);
    const miniaturas = FORMAS.map(({ id }) => {
      desenharMiniatura(grafico, id, caixa);
      const chamada = chamadas.pop();
      expect(chamada?.[3]).toBeTruthy();
      return [id, chamada?.[3]];
    });
    expect(Object.fromEntries(miniaturas)).toMatchSnapshot();
  });

  it('gera polígonos e estrelas paramétricas sem escapar dos limites', () => {
    const estrela = modelo({
      id: 'estrela-n',
      parametros: { ...PARAMETROS_PADRAO, pontas: 24, raioInterno: 10 },
    });
    expect(operacoes(estrela)).toHaveLength(49);
    expect(
      operacoes({ ...estrela, parametros: { ...estrela.parametros, raioInterno: 90 } }),
    ).not.toEqual(operacoes(estrela));
    expect(operacoes({ ...estrela, parametros: { ...estrela.parametros, pontas: 600 } })).toEqual(
      operacoes(estrela),
    );
    const poligono = modelo({
      id: 'poligono-regular',
      parametros: { ...PARAMETROS_PADRAO, lados: 2 },
    });
    expect(operacoes(poligono)).toHaveLength(4);
    expect(obterForma(estrela.id).params).toMatchObject({
      pontas: { min: 3, max: 24 },
      raioInterno: { min: 10, max: 90 },
    });
  });

  it('transforma a linha em curva quadrática e depois em Bézier cúbica', () => {
    const curva = modelo({
      id: 'curve',
      pontos: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ],
    });
    expect(operacoes(curva)).toEqual(['M 0 10', 'L 28 10']);
    curva.pontos!.push({ x: 0.25, y: 0 });
    expect(operacoes(curva)).toEqual(['M 0 10', 'Q 7 0 28 10']);
    curva.pontos!.push({ x: 0.75, y: 1 });
    expect(operacoes(curva)).toEqual(['M 0 10', 'C 7 0 21 20 28 10']);
  });

  it('preenche com Cor 2 e aplica a transparência do marcador ao traçar com Cor 1', () => {
    const { grafico, chamadas, registro } = criarGraficoDeTeste();
    desenharForma(grafico, modelo({ id: 'anel', contorno: 'marcador' }));
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].slice(0, 3)).toEqual(['preenchimento', '#ffb328', 'evenodd']);
    expect(chamadas[1].slice(0, 3)).toEqual(['contorno', '#164f91', 0.35]);
    expect(registro.globalAlpha).toBe(1);
    chamadas.length = 0;
    desenharForma(grafico, modelo({ id: 'line', contorno: 'dash' }));
    expect(chamadas.map((chamada) => chamada[0])).toEqual(['contorno']);
    expect(registro.setLineDash).toHaveBeenLastCalledWith([6, 3.6]);
  });

  it('inclui a rotação e controles de fora da caixa no recorte de pixels', () => {
    const forma = modelo({ caixa: { x: 10, y: 20, width: 20, height: 10 }, rotacao: Math.PI / 2 });
    const area = areaDaForma(forma);
    expect(area.x).toBeLessThanOrEqual(13);
    expect(area.y).toBeLessThanOrEqual(13);
    expect(area.x + area.width).toBeGreaterThanOrEqual(27);
    expect(area.y + area.height).toBeGreaterThanOrEqual(37);
    forma.rotacao = 0;
    forma.pontos = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: -0.5 },
    ];
    expect(areaDaForma(forma)).toEqual({ x: 8, y: 13, width: 44, height: 19 });
  });
});
