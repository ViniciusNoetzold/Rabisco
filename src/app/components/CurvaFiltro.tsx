import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { tabelaCurvas, type PontoCurva } from '../../filtros/cores';

const EXTREMO = 255;
const MAXIMO_DE_PONTOS = 32;

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, Math.round(valor)));
}

export function CurvaFiltro({
  nome,
  pontos,
  alterar,
}: {
  nome: string;
  pontos: readonly PontoCurva[];
  alterar(pontos: PontoCurva[]): void;
}) {
  const grafico = useRef<HTMLCanvasElement>(null);
  const arraste = useRef<{ indice: number; ponteiro: number } | null>(null);
  const [selecionado, definirSelecionado] = useState(pontos.length - 1);
  const ponto = pontos[selecionado];
  const fixo = selecionado === 0 || selecionado === pontos.length - 1;
  const intervalo = Math.min(selecionado, pontos.length - 2);
  const podeAdicionar =
    pontos.length < MAXIMO_DE_PONTOS && pontos[intervalo + 1].x - pontos[intervalo].x > 1;

  useLayoutEffect(() => {
    const contexto = grafico.current?.getContext('2d');
    if (!contexto) return;
    contexto.clearRect(0, 0, 256, 256);
    contexto.strokeStyle = '#c5d7e8';
    contexto.lineWidth = 1;
    contexto.beginPath();
    for (let linha = 64; linha < 256; linha += 64) {
      contexto.moveTo(linha + 0.5, 0);
      contexto.lineTo(linha + 0.5, 256);
      contexto.moveTo(0, linha + 0.5);
      contexto.lineTo(256, linha + 0.5);
    }
    contexto.stroke();
    contexto.strokeStyle = '#2e6eab';
    contexto.lineWidth = 2;
    contexto.beginPath();
    tabelaCurvas(pontos).forEach((saida, entrada) => {
      if (entrada === 0) contexto.moveTo(entrada, EXTREMO - saida);
      else contexto.lineTo(entrada, EXTREMO - saida);
    });
    contexto.stroke();
  }, [pontos]);

  function coordenadas(evento: PointerEvent<HTMLDivElement>): PontoCurva {
    const { left, top, width, height } = evento.currentTarget.getBoundingClientRect();
    return {
      x: limitar(((evento.clientX - left) / width) * EXTREMO, 0, EXTREMO),
      y: limitar((1 - (evento.clientY - top) / height) * EXTREMO, 0, EXTREMO),
    };
  }

  function mover(indice: number, { x, y }: PontoCurva) {
    const atual = pontos[indice];
    if (!atual) return;
    const anterior = pontos[indice - 1];
    const proximo = pontos[indice + 1];
    const entrada = anterior && proximo ? limitar(x, anterior.x + 1, proximo.x - 1) : atual.x;
    const saida = limitar(y, 0, EXTREMO);
    if (entrada !== atual.x || saida !== atual.y)
      alterar(pontos.map((p, i) => (i === indice ? { x: entrada, y: saida } : p)));
  }

  function iniciar(evento: PointerEvent<HTMLDivElement>) {
    if (evento.button !== 0 || !evento.isPrimary) return;
    const escolhido = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-ponto]');
    const nova = coordenadas(evento);
    let indice = escolhido
      ? Number(escolhido.dataset.ponto)
      : pontos.findIndex((p) => p.x === nova.x);
    if (indice < 0) {
      if (pontos.length >= MAXIMO_DE_PONTOS) return;
      indice = pontos.findIndex((p) => p.x > nova.x);
      const novos = [...pontos];
      novos.splice(indice, 0, nova);
      alterar(novos);
    }
    definirSelecionado(indice);
    arraste.current = { indice, ponteiro: evento.pointerId };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function excluir() {
    if (fixo) return;
    alterar(pontos.filter((_, i) => i !== selecionado));
    definirSelecionado(selecionado - 1);
  }

  function adicionar() {
    const x = Math.round((pontos[intervalo].x + pontos[intervalo + 1].x) / 2);
    const novos = [...pontos];
    novos.splice(intervalo + 1, 0, { x, y: tabelaCurvas(pontos)[x] });
    alterar(novos);
    definirSelecionado(intervalo + 1);
  }

  return (
    <div className="curva-filtro" role="group" aria-label={nome}>
      <div
        className="curva-filtro-grafico"
        onPointerDown={iniciar}
        onPointerMove={(evento) => {
          if (arraste.current?.ponteiro === evento.pointerId)
            mover(arraste.current.indice, coordenadas(evento));
        }}
        onLostPointerCapture={() => (arraste.current = null)}
      >
        <canvas ref={grafico} width={256} height={256} aria-hidden="true" />
        {pontos.map(({ x, y }, i) => (
          <button
            key={i}
            type="button"
            className="curva-filtro-ponto"
            data-ponto={i}
            style={{ left: `${(x / EXTREMO) * 100}%`, top: `${(1 - y / EXTREMO) * 100}%` }}
            aria-label={`Ponto ${i + 1}`}
            aria-pressed={i === selecionado}
            onClick={() => definirSelecionado(i)}
            onKeyDown={(evento) => {
              const deslocamentos: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowDown: [0, -1],
                ArrowUp: [0, 1],
              };
              const passo = deslocamentos[evento.key];
              if (!passo) return;
              evento.preventDefault();
              definirSelecionado(i);
              const escala = evento.shiftKey ? 10 : 1;
              mover(i, { x: x + passo[0] * escala, y: y + passo[1] * escala });
            }}
          />
        ))}
      </div>
      <div className="curva-filtro-coordenadas">
        <label>
          Entrada
          <input
            type="number"
            min={0}
            max={EXTREMO}
            value={ponto.x}
            disabled={fixo}
            onChange={(evento) => {
              if (Number.isFinite(evento.target.valueAsNumber))
                mover(selecionado, { ...ponto, x: evento.target.valueAsNumber });
            }}
          />
        </label>
        <label>
          Saída
          <input
            type="number"
            min={0}
            max={EXTREMO}
            value={ponto.y}
            onChange={(evento) => {
              if (Number.isFinite(evento.target.valueAsNumber))
                mover(selecionado, { ...ponto, y: evento.target.valueAsNumber });
            }}
          />
        </label>
      </div>
      <div className="filtro-acoes">
        <button type="button" disabled={!podeAdicionar} onClick={adicionar}>
          Adicionar ponto
        </button>
        <button type="button" disabled={fixo} onClick={excluir}>
          Remover ponto
        </button>
      </div>
    </div>
  );
}
