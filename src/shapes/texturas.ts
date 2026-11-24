import type { MarcaPincel } from '../brushes/catalogo';
import { criarAleatorioPincel, criarPintorPincel } from '../brushes/motor';

type Textura = 'giz' | 'aquarela';
type Grafico = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Superficie = HTMLCanvasElement | OffscreenCanvas;

const tamanhoTextura = 64;
const maximoTexturas = 24;
const cache = new Map<string, Superficie>();

function criarSuperficie(lado: number): Superficie {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(lado, lado);
  const tela = document.createElement('canvas');
  tela.width = tela.height = lado;
  return tela;
}

/** A mesma granulação do pincel, pronta para preencher caminhos de qualquer tamanho. */
function prepararTextura(tipo: Textura, cor: string): Superficie {
  const espessura = tipo === 'giz' ? 6 : 13;
  const intervalo = tipo === 'giz' ? 4 : 7;
  const folga = espessura;
  const bruto = criarSuperficie(tamanhoTextura + folga * 2);
  const ctx = bruto.getContext('2d') as Grafico;
  const aleatorio = criarAleatorioPincel(0x132b4);
  const marcas: MarcaPincel[] = [];

  ctx.globalAlpha = tipo === 'giz' ? 0.14 : 0.11;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, bruto.width, bruto.height);
  ctx.globalAlpha = 1;

  for (let y = 0; y < bruto.height; y += intervalo) {
    for (let x = 0; x < bruto.width; x += intervalo) {
      marcas.push({ x: x + aleatorio() * intervalo, y: y + aleatorio() * intervalo });
    }
  }
  criarPintorPincel(ctx, { tipo, cor, espessura, semente: 0x9a4b9 }).pintar(marcas);

  // Refilamos a margem para que nenhuma borda do padrão tenha menos pigmento.
  const quadro = criarSuperficie(tamanhoTextura);
  const grafico = quadro.getContext('2d') as Grafico;
  grafico.drawImage(bruto, -folga, -folga);
  bruto.width = bruto.height = 1;
  return quadro;
}

export function padraoDeTextura(ctx: Grafico, tipo: Textura, cor: string): CanvasPattern | string {
  const chave = `${tipo}:${cor}`;
  let superficie = cache.get(chave);
  if (!superficie) {
    superficie = prepararTextura(tipo, cor);
    cache.set(chave, superficie);
    if (cache.size > maximoTexturas) {
      const maisAntiga = cache.keys().next();
      if (!maisAntiga.done) cache.delete(maisAntiga.value);
    }
  }
  return ctx.createPattern(superficie, 'repeat') ?? cor;
}
