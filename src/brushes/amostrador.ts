import type { Point } from '../layers/types';
import { fatorDaPressao, pressaoDoPonto, type MarcaPincel } from './catalogo';

interface PontoComPressao extends Point {
  pressure: number;
}

function interpolar(a: PontoComPressao, b: PontoComPressao, t: number): PontoComPressao {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
  };
}

function distancia(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Interpola pontos com quadráticas e preserva o espaçamento entre eventos do ponteiro. */
export class AmostradorPincel {
  private controle: PontoComPressao | null = null;
  private posicao: PontoComPressao | null = null;
  private ultimaMarca: PontoComPressao | null = null;
  private ateProximaMarca = 0;
  private fechou = false;

  constructor(private readonly espessura: number) {}

  adicionar(ponto: Point): MarcaPincel[] {
    if (this.fechou) return [];
    const pressao = pressaoDoPonto(ponto);
    const controle = this.controle;
    // Suaviza mudanças abruptas da caneta entre amostras consecutivas.
    const recebido = {
      x: ponto.x,
      y: ponto.y,
      pressure: controle ? pressao * 0.72 + controle.pressure * 0.28 : pressao,
    };
    this.controle = recebido;
    if (!controle || !this.posicao) {
      this.posicao = recebido;
      this.ultimaMarca = recebido;
      this.ateProximaMarca = this.passo(pressao);
      return [recebido];
    }

    const marcas: MarcaPincel[] = [];
    this.curva(this.posicao, controle, interpolar(controle, recebido, 0.5), marcas);
    return marcas;
  }

  finalizar(): MarcaPincel[] {
    if (this.fechou || !this.controle || !this.posicao) return [];
    this.fechou = true;
    const marcas: MarcaPincel[] = [];
    this.segmento(this.controle, marcas);
    // A última marca cobre a ponta mesmo quando a curva termina entre dois carimbos.
    if (this.ultimaMarca && distancia(this.ultimaMarca, this.controle) > 0.001) {
      marcas.push(this.controle);
    }
    return marcas;
  }

  private passo(pressao: number) {
    return Math.max(0.35, this.espessura * 0.14 * fatorDaPressao(pressao));
  }

  private curva(
    inicio: PontoComPressao,
    controle: PontoComPressao,
    fim: PontoComPressao,
    marcas: MarcaPincel[],
    nivel = 0,
  ) {
    // Subdivide só até a diferença entre o arco e a corda ficar abaixo de um subpixel.
    const erro = distancia(inicio, controle) + distancia(controle, fim) - distancia(inicio, fim);
    if (erro < 0.06 || nivel >= 12) {
      this.segmento(fim, marcas);
      return;
    }
    const esquerda = interpolar(inicio, controle, 0.5);
    const direita = interpolar(controle, fim, 0.5);
    const meio = interpolar(esquerda, direita, 0.5);
    this.curva(inicio, esquerda, meio, marcas, nivel + 1);
    this.curva(meio, direita, fim, marcas, nivel + 1);
  }

  private segmento(fim: PontoComPressao, marcas: MarcaPincel[]) {
    const inicio = this.posicao!;
    const comprimento = distancia(inicio, fim);
    this.posicao = fim;
    if (comprimento === 0) return;
    let percorrido = 0;
    while (percorrido + this.ateProximaMarca <= comprimento) {
      percorrido += this.ateProximaMarca;
      const marca = interpolar(inicio, fim, percorrido / comprimento);
      marcas.push(marca);
      this.ultimaMarca = marca;
      this.ateProximaMarca = this.passo(marca.pressure);
    }
    this.ateProximaMarca = Math.max(
      Number.EPSILON,
      this.ateProximaMarca - (comprimento - percorrido),
    );
  }
}
