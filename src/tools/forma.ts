import type { Point, Rect } from '../layers/types';
import { novoId } from '../document/camadas';
import { areaDaForma, desenharForma, obterDefinicaoForma } from '../shapes/render';
import type { ConfiguracaoForma, IdForma } from '../shapes/tipos';
import {
  alcaDeRotacao,
  alcasDeTamanho,
  caixaDosPontos,
  distanciaEntre,
  dentroDaForma,
  geometriaDoArraste,
  geometriaPorPontos,
  girarForma,
  moverForma,
  pontosAbsolutos,
  prenderEm45,
  redimensionarForma,
  type AlcaForma,
  type GeometriaForma,
} from './geometriaForma';
import { definirFerramenta, opcaoEspessura, type EventoFerramenta, type ToolCtx } from './tool';

type FerramentaForma = 'line' | 'rectangle' | 'ellipse' | 'shape';
type Operacao = 'mover' | 'girar' | AlcaForma;
type GestoForma =
  | { tipo: 'criar'; inicio: Point; id: IdForma; previa: GeometriaForma | null }
  | { tipo: 'editar'; inicio: Point; original: GeometriaForma; operacao: Operacao }
  | { tipo: 'controle'; ponto: Point }
  | { tipo: 'vertice' };

interface PoligonoEmCurso {
  vertices: Point[];
  proximo: Point | null;
  instante: number | undefined;
}

function configurar(geometria: GeometriaForma, ctx: ToolCtx): ConfiguracaoForma {
  const { cor1, cor2, espessura, contornoForma, preenchimentoForma, parametrosForma } = ctx.opcoes;
  return {
    ...geometria,
    definicao: ctx.opcoes.definicaoForma && { ...ctx.opcoes.definicaoForma },
    cor1,
    cor2,
    espessura,
    contorno: contornoForma,
    preenchimento: preenchimentoForma,
    parametros: { ...parametrosForma },
  };
}

function desenharGuia(
  grafico: CanvasRenderingContext2D,
  pontos: readonly Point[],
  zoom: number,
  fechar: boolean,
) {
  const [inicio, ...resto] = pontos;
  grafico.save();
  grafico.beginPath();
  grafico.moveTo(inicio.x, inicio.y);
  for (const ponto of resto) grafico.lineTo(ponto.x, ponto.y);
  if (fechar) grafico.closePath();
  grafico.strokeStyle = '#ffffff';
  grafico.lineWidth = 2 / zoom;
  grafico.stroke();
  grafico.strokeStyle = '#1d6eb0';
  grafico.lineWidth = 1 / zoom;
  grafico.setLineDash([3 / zoom, 2 / zoom]);
  grafico.stroke();
  grafico.restore();
}

function desenharMarcador(
  grafico: CanvasRenderingContext2D,
  ponto: Point,
  tamanho: number,
  zoom: number,
  redondo = false,
) {
  const raio = tamanho / (2 * zoom);
  grafico.save();
  grafico.beginPath();
  if (redondo) grafico.arc(ponto.x, ponto.y, raio, 0, 2 * Math.PI);
  else grafico.rect(ponto.x - raio, ponto.y - raio, raio * 2, raio * 2);
  grafico.fillStyle = '#ffffff';
  grafico.fill();
  grafico.strokeStyle = '#1d6eb0';
  grafico.lineWidth = 1 / zoom;
  grafico.stroke();
  grafico.restore();
}

function desenharAlcas(grafico: CanvasRenderingContext2D, forma: GeometriaForma, ctx: ToolCtx) {
  const { zoom } = ctx.opcoes;
  const alcas = alcasDeTamanho(forma);
  const rotacao = alcaDeRotacao(forma, zoom, ctx.largura, ctx.altura);
  desenharGuia(
    grafico,
    [0, 2, 4, 6].map((indice) => alcas[indice].posicao),
    zoom,
    true,
  );
  desenharGuia(grafico, [rotacao.base, rotacao.posicao], zoom, false);
  for (const { posicao } of alcas) desenharMarcador(grafico, posicao, 7, zoom);
  desenharMarcador(grafico, rotacao.posicao, 10, zoom, true);
}

function operacaoNoPonto(forma: GeometriaForma, ponto: Point, ctx: ToolCtx): Operacao | null {
  const { zoom } = ctx.opcoes;
  const rotacao = alcaDeRotacao(forma, zoom, ctx.largura, ctx.altura);
  if (distanciaEntre(rotacao.posicao, ponto) <= 8 / zoom) return 'girar';
  let maisProxima: AlcaForma | null = null;
  let distanciaMinima = 7 / zoom;
  for (const alca of alcasDeTamanho(forma)) {
    const distancia = distanciaEntre(alca.posicao, ponto);
    if (distancia > distanciaMinima) continue;
    maisProxima = alca;
    distanciaMinima = distancia;
  }
  if (maisProxima) return maisProxima;
  return dentroDaForma(forma, ponto, 3 / zoom) ? 'mover' : null;
}

export function definirForma(id: FerramentaForma, nome: string, icone: string, atalho?: string) {
  return definirFerramenta({ id, nome, icone, atalho, opcoes: [opcaoEspessura] }, () => {
    let pendente: GeometriaForma | null = null;
    let curva: Point[] | null = null;
    let poligono: PoligonoEmCurso | null = null;
    let gesto: GestoForma | null = null;
    /** Formas inteligentes: cor, espessura e pincel do traço que virou forma. */
    let estiloFixo: Partial<ConfiguracaoForma> | null = null;

    function descartar() {
      pendente = curva = poligono = gesto = null;
      estiloFixo = null;
    }

    function configurarAqui(geometria: GeometriaForma, ctx: ToolCtx): ConfiguracaoForma {
      const base = configurar(geometria, ctx);
      return estiloFixo ? { ...base, ...estiloFixo } : base;
    }

    function temPendente() {
      return Boolean(pendente || curva || poligono || gesto);
    }

    function pontosDaCurva(): Point[] {
      if (!curva) return [];
      return gesto?.tipo === 'controle' ? [...curva, gesto.ponto] : curva;
    }

    function geometriaAtual(): GeometriaForma | null {
      if (gesto?.tipo === 'criar') return gesto.previa;
      if (curva) return geometriaPorPontos('curve', pontosDaCurva());
      return pendente;
    }

    function obterFormaPendente(ctx: ToolCtx) {
      const geometria =
        poligono && poligono.vertices.length >= 3
          ? geometriaPorPontos('polygon', poligono.vertices)
          : geometriaAtual();
      return geometria ? configurarAqui(geometria, ctx) : null;
    }

    function confirmar(ctx: ToolCtx) {
      const configuracao = obterFormaPendente(ctx);
      descartar();
      if (!configuracao) return;
      if (!ctx.opcoes.formasEmNovaCamada) {
        ctx.executar({ tipo: 'AplicarForma', configuracao });
        return;
      }
      // Um item só no histórico: a camada nova e a forma dentro dela.
      ctx.executar({
        tipo: 'Lote',
        rotulo: obterDefinicaoForma(configuracao).nome,
        comandos: [
          {
            tipo: 'NovaCamada',
            id: novoId('camada'),
            nome: `Forma: ${obterDefinicaoForma(configuracao).nome}`,
          },
          { tipo: 'AplicarForma', configuracao },
        ],
      });
    }

    function proximoVertice(evento: EventoFerramenta): Point {
      const ultimo = poligono?.vertices.at(-1);
      return evento.shift && ultimo ? prenderEm45(ultimo, evento.ponto) : evento.ponto;
    }

    function adicionarVertice(ctx: ToolCtx, evento: EventoFerramenta) {
      if (!poligono) poligono = { vertices: [], proximo: null, instante: undefined };
      const { vertices, instante } = poligono;
      const ultimo = vertices.at(-1);
      const raio = 8 / ctx.opcoes.zoom;
      const pertoDoUltimo = ultimo !== undefined && distanciaEntre(ultimo, evento.ponto) <= raio;
      const cliqueRapido =
        evento.instante !== undefined &&
        instante !== undefined &&
        evento.instante - instante <= 500 &&
        evento.instante >= instante;
      const cliqueDuplo = pertoDoUltimo && ((evento.cliques ?? 0) >= 2 || cliqueRapido);
      const fechouNoInicio =
        vertices.length >= 3 && distanciaEntre(vertices[0], evento.ponto) <= raio;
      if (vertices.length >= 3 && (fechouNoInicio || cliqueDuplo)) {
        pendente = geometriaPorPontos('polygon', vertices);
        poligono = null;
        return;
      }
      const ponto = proximoVertice(evento);
      if (!ultimo || distanciaEntre(ultimo, ponto) > 0.5 / ctx.opcoes.zoom) vertices.push(ponto);
      poligono.instante = evento.instante;
      poligono.proximo = null;
    }

    function atualizarGesto(ctx: ToolCtx, evento: EventoFerramenta) {
      if (!gesto) return;
      const { ponto, shift } = evento;
      switch (gesto.tipo) {
        case 'criar': {
          const dist = distanciaEntre(gesto.inicio, ponto);
          gesto.previa =
            dist < 0.75 / ctx.opcoes.zoom
              ? null
              : geometriaDoArraste(gesto.id, gesto.inicio, ponto, shift);
          return;
        }
        case 'editar': {
          const { original, inicio, operacao } = gesto;
          if (operacao === 'mover') pendente = moverForma(original, inicio, ponto);
          else if (operacao === 'girar') {
            if (distanciaEntre(inicio, ponto) > 0.01)
              pendente = girarForma(original, inicio, ponto, shift);
          } else pendente = redimensionarForma(original, operacao, inicio, ponto, shift);
          return;
        }
        case 'controle':
          gesto.ponto = ponto;
          return;
        case 'vertice':
          if (poligono) poligono.proximo = proximoVertice(evento);
      }
    }

    function guiaDoPoligono() {
      if (!poligono) return [];
      const { vertices, proximo } = poligono;
      return proximo ? [...vertices, proximo] : vertices;
    }

    return {
      cursor: () => 'crosshair',
      temPendente,
      obterFormaPendente,
      descartarPendente: descartar,
      commitPendente: confirmar,
      adotarForma(geometria, estilo) {
        descartar();
        pendente = geometria;
        estiloFixo = estilo;
      },
      tocaNaForma(ctx, ponto) {
        return Boolean(pendente && operacaoNoPonto(pendente, ponto, ctx));
      },
      onPointerDown(ctx, evento) {
        const { ponto } = evento;
        if (curva) {
          gesto = { tipo: 'controle', ponto };
          return;
        }
        if (pendente) {
          const operacao = operacaoNoPonto(pendente, ponto, ctx);
          if (operacao) {
            gesto = { tipo: 'editar', inicio: ponto, original: pendente, operacao };
            return;
          }
          confirmar(ctx);
        }
        ctx.selecionar(null);
        const forma = id === 'shape' ? ctx.opcoes.forma : id;
        gesto =
          forma === 'polygon'
            ? { tipo: 'vertice' }
            : { tipo: 'criar', id: forma, inicio: ponto, previa: null };
      },
      onPointerMove: atualizarGesto,
      onPointerUp(ctx, evento) {
        atualizarGesto(ctx, evento);
        const concluido = gesto;
        gesto = null;
        if (!concluido) return;
        if (concluido.tipo === 'criar' && concluido.previa) {
          if (concluido.id === 'curve') curva = pontosAbsolutos(concluido.previa);
          else pendente = concluido.previa;
        }
        if (concluido.tipo === 'controle' && curva) {
          curva.push(concluido.ponto);
          if (curva.length === 4) {
            pendente = geometriaPorPontos('curve', curva);
            curva = null;
          }
        }
        if (concluido.tipo === 'vertice') adicionarVertice(ctx, evento);
      },
      onHover(_ctx, evento) {
        if (!poligono) return false;
        poligono.proximo = proximoVertice(evento);
        return true;
      },
      onKeyDown(ctx, evento) {
        if (!temPendente()) return false;
        if (evento.key === 'Escape') {
          descartar();
          return true;
        }
        if (evento.key !== 'Enter') return false;
        if (!poligono || poligono.vertices.length >= 3) confirmar(ctx);
        return true;
      },
      onCancel() {
        if (gesto?.tipo === 'editar') pendente = gesto.original;
        if (poligono) poligono.proximo = null;
        gesto = null;
      },
      limitesOverlay(ctx): Rect | null {
        const pontos = guiaDoPoligono();
        const geometria = geometriaAtual();
        const area = pontos.length
          ? caixaDosPontos(pontos)
          : geometria
            ? areaDaForma(configurarAqui(geometria, ctx))
            : null;
        if (!area) return null;
        const margem = 40 / ctx.opcoes.zoom;
        return {
          x: area.x - margem,
          y: area.y - margem,
          width: area.width + 2 * margem,
          height: area.height + 2 * margem,
        };
      },
      overlay(ctx, grafico) {
        const { zoom } = ctx.opcoes;
        if (poligono) {
          const pontos = guiaDoPoligono();
          if (pontos.length > 1) desenharGuia(grafico, pontos, zoom, false);
          for (const ponto of poligono.vertices) desenharMarcador(grafico, ponto, 5, zoom, true);
          return;
        }
        const geometria = geometriaAtual();
        if (!geometria) return;
        desenharForma(grafico, configurarAqui(geometria, ctx));
        if (pendente) desenharAlcas(grafico, pendente, ctx);
        else if (curva) {
          const [inicio, fim, primeiro, segundo] = pontosDaCurva();
          if (primeiro) desenharGuia(grafico, [inicio, primeiro], zoom, false);
          if (segundo) desenharGuia(grafico, [fim, segundo], zoom, false);
          for (const ponto of pontosDaCurva()) desenharMarcador(grafico, ponto, 5, zoom, true);
        }
      },
    };
  });
}
