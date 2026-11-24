import { useEffect, useRef } from 'react';
import { AmostradorPincel } from '../../brushes/amostrador';
import type { MarcaPincel, TipoPincel } from '../../brushes/catalogo';
import { criarPintorPincel, opacidadeDoPincel } from '../../brushes/motor';

interface BrushStrokeSampleProps {
  tipo: TipoPincel;
  cor: string;
  espessura: number;
  largura?: number;
  altura?: number;
  pontosPorMarca?: number;
  rotulo?: string;
}

function pontosDeAmostra(largura: number, altura: number): MarcaPincel[] {
  return Array.from({ length: 22 }, (_, indice) => {
    const t = indice / 21;
    return {
      x: largura * (0.12 + 0.76 * t),
      y: altura * (0.52 + 0.19 * Math.sin(t * Math.PI * 2.8)),
    };
  });
}

/** Usa as mesmas pontas e a mesma composição de opacidade do traço no papel. */
export function BrushStrokeSample({
  tipo,
  cor,
  espessura,
  largura = 96,
  altura = 36,
  pontosPorMarca = 8,
  rotulo,
}: BrushStrokeSampleProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const contexto = canvas.current?.getContext('2d');
    if (!contexto) return;
    contexto.clearRect(0, 0, largura, altura);
    const pintor = criarPintorPincel(contexto, { tipo, cor, espessura, semente: 29 });
    const pontos = pontosDeAmostra(largura, altura);
    if (tipo === 'spray') {
      pintor.pintar(pontos.map((ponto) => ({ ...ponto, quantidade: pontosPorMarca })));
      return;
    }
    const amostrador = new AmostradorPincel(espessura);
    const marcas = pontos.flatMap((ponto) => amostrador.adicionar(ponto));
    pintor.pintar([...marcas, ...amostrador.finalizar()]);
  }, [tipo, cor, espessura, largura, altura, pontosPorMarca]);

  return (
    <canvas
      ref={canvas}
      width={largura}
      height={altura}
      className="brush-stroke-sample"
      style={{ opacity: opacidadeDoPincel(tipo) }}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    />
  );
}
