import type { Rect } from '../layers/types';
import { MODOS_MESCLAGEM, type EfeitosCamada, type Grupo } from './camadas';
import type { Layer, RabiscoDocument } from './model';

type Contexto = CanvasRenderingContext2D;
type Camada = Layer<HTMLCanvasElement>;

/** Um item da pilha: camada solta, ou grupo com as camadas dele (sempre contíguas). */
type No = { tipo: 'camada'; camada: Camada } | { tipo: 'grupo'; grupo: Grupo; camadas: Camada[] };

/** Quanto um efeito alcança além dos pixels da camada (para recompor uma área sem cortar). */
export function alcanceDosEfeitos(efeitos?: EfeitosCamada): number {
  if (!efeitos) return 0;
  const contorno = efeitos.contorno?.posicao === 'fora' ? efeitos.contorno.espessura : 0;
  const sombra = efeitos.sombra ? efeitos.sombra.distancia + efeitos.sombra.desfoque * 2 : 0;
  return Math.ceil(Math.max(contorno, sombra));
}

function superficie(largura: number, altura: number): Contexto {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, largura);
  canvas.height = Math.max(1, altura);
  return canvas.getContext('2d', { willReadFrequently: true })!;
}

function montarNos(doc: RabiscoDocument): No[] {
  const nos: No[] = [];
  const grupos = new Map(doc.grupos.map((grupo) => [grupo.id, grupo]));
  for (const camada of doc.layers) {
    const grupo = camada.grupo ? grupos.get(camada.grupo) : undefined;
    const ultimo = nos.at(-1);
    if (grupo && ultimo?.tipo === 'grupo' && ultimo.grupo.id === grupo.id)
      ultimo.camadas.push(camada);
    else if (grupo) nos.push({ tipo: 'grupo', grupo, camadas: [camada] });
    else nos.push({ tipo: 'camada', camada });
  }
  return nos;
}

/** Pixels da camada na janela, já recortados pela máscara (luminância vira transparência). */
function camadaComMascara(camada: Camada, janela: Rect): Contexto {
  const ctx = superficie(janela.width, janela.height);
  ctx.drawImage(camada.canvas, -janela.x, -janela.y);
  if (camada.mascara && camada.mascaraAtiva !== false) {
    const mascara = camada.mascara
      .getContext('2d', { willReadFrequently: true })!
      .getImageData(janela.x, janela.y, janela.width, janela.height);
    const { data } = mascara;
    for (let i = 0; i < data.length; i += 4) {
      // Luminância (Rec. 601) da máscara vira o alfa: branco revela, preto esconde.
      data[i + 3] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    const alfa = superficie(janela.width, janela.height);
    alfa.putImageData(mascara, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(alfa.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  return ctx;
}

/** Silhueta da imagem pintada de uma cor. */
function silhueta(origem: HTMLCanvasElement, cor: string): Contexto {
  const ctx = superficie(origem.width, origem.height);
  ctx.drawImage(origem, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, origem.width, origem.height);
  return ctx;
}

/** Contorno por dilatação: a silhueta é carimbada em volta, em anéis até a espessura pedida. */
function dilatar(origem: HTMLCanvasElement, espessura: number): Contexto {
  const ctx = superficie(origem.width, origem.height);
  const passos = Math.max(8, Math.ceil(espessura * 2.5));
  for (
    let raio = 1;
    raio <= espessura;
    raio = Math.min(espessura, raio + Math.max(1, espessura / 4))
  ) {
    for (let i = 0; i < passos; i++) {
      const angulo = (i / passos) * Math.PI * 2;
      ctx.drawImage(origem, Math.cos(angulo) * raio, Math.sin(angulo) * raio);
    }
    if (raio === espessura) break;
  }
  return ctx;
}

/** Aplica contorno e sombra por baixo/por cima dos pixels da camada, dentro da janela. */
function comEfeitos(pixels: Contexto, efeitos: EfeitosCamada): Contexto {
  const { width, height } = pixels.canvas;
  const resultado = superficie(width, height);
  const { contorno, sombra } = efeitos;
  if (sombra) {
    const angulo = (sombra.angulo * Math.PI) / 180;
    resultado.save();
    resultado.globalAlpha = sombra.opacidade;
    resultado.filter = sombra.desfoque > 0 ? `blur(${sombra.desfoque}px)` : 'none';
    resultado.drawImage(
      silhueta(pixels.canvas, sombra.cor).canvas,
      Math.cos(angulo) * sombra.distancia,
      Math.sin(angulo) * sombra.distancia,
    );
    resultado.restore();
  }
  if (contorno?.posicao === 'fora' && contorno.espessura > 0) {
    resultado.drawImage(
      dilatar(silhueta(pixels.canvas, contorno.cor).canvas, contorno.espessura).canvas,
      0,
      0,
    );
  }
  resultado.drawImage(pixels.canvas, 0, 0);
  if (contorno?.posicao === 'dentro' && contorno.espessura > 0) {
    // O lado de fora, dilatado para dentro da camada, vira a borda interna.
    const fora = superficie(width, height);
    fora.fillStyle = contorno.cor;
    fora.fillRect(0, 0, width, height);
    fora.globalCompositeOperation = 'destination-out';
    fora.drawImage(pixels.canvas, 0, 0);
    const borda = dilatar(fora.canvas, contorno.espessura);
    borda.globalCompositeOperation = 'destination-in';
    borda.drawImage(pixels.canvas, 0, 0);
    resultado.drawImage(borda.canvas, 0, 0);
  }
  return resultado;
}

function precisaDeSuperficie(camada: Camada, recortadas: Camada[]): boolean {
  return Boolean(
    (camada.mascara && camada.mascaraAtiva !== false) ||
      recortadas.length ||
      camada.efeitos?.contorno ||
      camada.efeitos?.sombra,
  );
}

/** Desenha uma camada (com as camadas de recorte que dependem dela) em `destino`. */
function desenharCamada(destino: Contexto, camada: Camada, recortadas: Camada[], janela: Rect) {
  destino.save();
  destino.globalAlpha = camada.opacity;
  destino.globalCompositeOperation = MODOS_MESCLAGEM[camada.modo]?.operacao ?? 'source-over';
  if (!precisaDeSuperficie(camada, recortadas)) {
    destino.drawImage(
      camada.canvas,
      janela.x,
      janela.y,
      janela.width,
      janela.height,
      0,
      0,
      janela.width,
      janela.height,
    );
    destino.restore();
    return;
  }
  let pixels = camadaComMascara(camada, janela);
  for (const acima of recortadas) {
    if (!acima.visible || acima.opacity <= 0) continue;
    // A camada de recorte só aparece onde a base tem pixels.
    pixels.globalAlpha = acima.opacity;
    pixels.globalCompositeOperation = 'source-atop';
    pixels.drawImage(camadaComMascara(acima, janela).canvas, 0, 0);
  }
  pixels.globalAlpha = 1;
  pixels.globalCompositeOperation = 'source-over';
  if (camada.efeitos?.contorno || camada.efeitos?.sombra)
    pixels = comEfeitos(pixels, camada.efeitos);
  destino.drawImage(pixels.canvas, 0, 0);
  destino.restore();
}

function desenharLista(destino: Contexto, camadas: Camada[], janela: Rect) {
  for (let i = 0; i < camadas.length; i++) {
    const camada = camadas[i];
    const recortadas: Camada[] = [];
    while (camadas[i + 1]?.recorte) recortadas.push(camadas[++i]);
    if (!camada.visible || camada.opacity <= 0) continue;
    desenharCamada(destino, camada, recortadas, janela);
  }
}

/**
 * Compõe as camadas visíveis de baixo para cima no canvas da tela. Com `area`, só esse trecho
 * é refeito; a janela de trabalho cresce o bastante para sombras e contornos não serem cortados.
 */
export function comporDocumento(doc: RabiscoDocument, tela: HTMLCanvasElement, area?: Rect): void {
  const tamanhoMudou = tela.width !== doc.width || tela.height !== doc.height;
  if (tamanhoMudou) {
    tela.width = doc.width;
    tela.height = doc.height;
  }
  const trecho =
    tamanhoMudou || !area ? { x: 0, y: 0, width: doc.width, height: doc.height } : area;
  const esquerda = Math.max(0, Math.floor(trecho.x));
  const topo = Math.max(0, Math.floor(trecho.y));
  const largura = Math.min(doc.width, Math.ceil(trecho.x + trecho.width)) - esquerda;
  const altura = Math.min(doc.height, Math.ceil(trecho.y + trecho.height)) - topo;
  if (largura <= 0 || altura <= 0) return;

  const margem = Math.max(0, ...doc.layers.map((camada) => alcanceDosEfeitos(camada.efeitos)));
  const janela = {
    x: Math.max(0, esquerda - margem),
    y: Math.max(0, topo - margem),
    width: 0,
    height: 0,
  };
  janela.width = Math.min(doc.width, esquerda + largura + margem) - janela.x;
  janela.height = Math.min(doc.height, topo + altura + margem) - janela.y;

  const contexto = tela.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('Não foi possível mostrar a área de desenho.');
  // Desenha direto na tela, recortado ao trecho: a janela maior só serve para os efeitos.
  contexto.save();
  contexto.beginPath();
  contexto.rect(esquerda, topo, largura, altura);
  contexto.clip();
  contexto.clearRect(esquerda, topo, largura, altura);
  contexto.translate(janela.x, janela.y);
  // Camadas soltas consecutivas vão juntas: uma camada de recorte depende da que está abaixo.
  let soltas: Camada[] = [];
  const descarregar = () => {
    if (soltas.length) desenharLista(contexto, soltas, janela);
    soltas = [];
  };
  for (const no of montarNos(doc)) {
    if (no.tipo === 'camada') {
      soltas.push(no.camada);
      continue;
    }
    descarregar();
    const { grupo, camadas } = no;
    if (!grupo.visible || grupo.opacity <= 0) continue;
    const interno = superficie(janela.width, janela.height);
    desenharLista(interno, camadas, janela);
    contexto.save();
    contexto.globalAlpha = grupo.opacity;
    contexto.globalCompositeOperation = MODOS_MESCLAGEM[grupo.modo]?.operacao ?? 'source-over';
    contexto.drawImage(interno.canvas, 0, 0);
    contexto.restore();
  }
  descarregar();
  contexto.restore();
}

/**
 * Desenha uma camada (com máscara e efeitos) por cima de outro canvas, como ela aparece na
 * composição. Usado para mesclar camadas.
 */
export function desenharCamadaSobre(destino: Contexto, camada: Camada, recortadas: Camada[] = []) {
  const janela = { x: 0, y: 0, width: camada.canvas.width, height: camada.canvas.height };
  desenharCamada(destino, camada, recortadas, janela);
}
