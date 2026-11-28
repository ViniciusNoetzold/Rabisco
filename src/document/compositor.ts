import type { Rect } from '../layers/types';
import { comporAjuste, type AjusteCamada } from './ajustes';
import {
  MODOS_MESCLAGEM,
  propriedadesPadrao,
  type Alvo,
  type EfeitosCamada,
  type Grupo,
} from './camadas';
import { comoImageData, type Layer, type RabiscoDocument } from './model';

type Contexto = CanvasRenderingContext2D;
type Camada = Layer<HTMLCanvasElement>;
type DocumentoComposicao = Pick<
  RabiscoDocument,
  'width' | 'height' | 'layers' | 'grupos' | 'activeLayerId' | 'activeLayer'
>;

/** Trecho que substitui temporariamente os pixels de uma camada ou da máscara dela. */
export interface PreviaComposicao {
  alvo: Alvo;
  area: Rect;
  canvas: HTMLCanvasElement;
}

export interface PreviaAjuste {
  ajuste: AjusteCamada;
  id?: string;
  acimaDe?: string;
}

/** Um item da pilha: camada solta, ou grupo com as camadas dele (sempre contíguas). */
type No = { tipo: 'camada'; camada: Camada } | { tipo: 'grupo'; grupo: Grupo; camadas: Camada[] };

/** Quanto um efeito alcança além dos pixels da camada (para recompor uma área sem cortar). */
export function alcanceDosEfeitos(efeitos?: EfeitosCamada): number {
  if (!efeitos) return 0;
  const contorno = efeitos.contorno?.posicao === 'fora' ? efeitos.contorno.espessura : 0;
  const sombra = efeitos.sombra ? efeitos.sombra.distancia + efeitos.sombra.desfoque * 2 : 0;
  return Math.ceil(Math.max(contorno, sombra));
}

function margemDosEfeitos(doc: Pick<RabiscoDocument, 'layers'>): number {
  return Math.max(0, ...doc.layers.map((camada) => alcanceDosEfeitos(camada.efeitos)));
}

/** Um filtro pode alterar a sombra ou o contorno da camada além do trecho filtrado. */
export function areaDaPreviaFiltro(doc: Pick<RabiscoDocument, 'layers'>, area: Rect): Rect {
  const margem = margemDosEfeitos(doc);
  return {
    x: area.x - margem,
    y: area.y - margem,
    width: area.width + 2 * margem,
    height: area.height + 2 * margem,
  };
}

function superficie(largura: number, altura: number): Contexto {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, largura);
  canvas.height = Math.max(1, altura);
  return canvas.getContext('2d', { willReadFrequently: true })!;
}

function camadasComPrevia(doc: DocumentoComposicao, previa?: PreviaAjuste): Camada[] {
  if (!previa) return doc.layers;
  if (previa.id)
    return doc.layers.map((camada) =>
      camada.id === previa.id && camada.ajuste ? { ...camada, ajuste: previa.ajuste } : camada,
    );
  const camadas = [...doc.layers];
  const posicao = camadas.findIndex(
    (camada) => camada.id === (previa.acimaDe ?? doc.activeLayerId),
  );
  camadas.splice(posicao + 1, 0, {
    ...propriedadesPadrao('\u0000ajuste', ''),
    // Uma camada de ajuste não lê o canvas. A prévia só reaproveita a referência.
    canvas: doc.activeLayer.canvas,
    ajuste: previa.ajuste,
    grupo: camadas[posicao]?.grupo,
  });
  return camadas;
}

function montarNos(doc: DocumentoComposicao, previa?: PreviaAjuste): No[] {
  const nos: No[] = [];
  const grupos = new Map(doc.grupos.map((grupo) => [grupo.id, grupo]));
  for (const camada of camadasComPrevia(doc, previa)) {
    const grupo = camada.grupo ? grupos.get(camada.grupo) : undefined;
    const ultimo = nos.at(-1);
    if (grupo && ultimo?.tipo === 'grupo' && ultimo.grupo.id === grupo.id)
      ultimo.camadas.push(camada);
    else if (grupo) nos.push({ tipo: 'grupo', grupo, camadas: [camada] });
    else nos.push({ tipo: 'camada', camada });
  }
  return nos;
}

function contemJanela(area: Rect, janela: Rect): boolean {
  return (
    area.x <= janela.x &&
    area.y <= janela.y &&
    area.x + area.width >= janela.x + janela.width &&
    area.y + area.height >= janela.y + janela.height
  );
}

function desenharJanela(
  ctx: Contexto,
  fonte: HTMLCanvasElement,
  janela: Rect,
  origemX = 0,
  origemY = 0,
) {
  const { x, y, width, height } = janela;
  ctx.drawImage(fonte, x - origemX, y - origemY, width, height, 0, 0, width, height);
}

function desenharComPrevia(
  contexto: Contexto,
  fonte: HTMLCanvasElement,
  janela: Rect,
  previa?: PreviaComposicao,
) {
  if (previa && contemJanela(previa.area, janela)) {
    desenharJanela(contexto, previa.canvas, janela, previa.area.x, previa.area.y);
    return;
  }
  desenharJanela(contexto, fonte, janela);
  if (!previa) return;
  const { x, y, width, height } = previa.area;
  // Os pixels transparentes da prévia também substituem os pixels do documento.
  contexto.clearRect(x - janela.x, y - janela.y, width, height);
  contexto.drawImage(previa.canvas, x - janela.x, y - janela.y);
}

function lerMascara(
  camada: Camada,
  janela: Rect,
  previa?: PreviaComposicao,
): ImageData | undefined {
  if (!camada.mascara || camada.mascaraAtiva === false) return undefined;
  if (previa?.alvo.camada === camada.id && previa.alvo.mascara) {
    const superficieMascara = superficie(janela.width, janela.height);
    desenharComPrevia(superficieMascara, camada.mascara, janela, previa);
    return superficieMascara.getImageData(0, 0, janela.width, janela.height);
  }
  return camada.mascara
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(janela.x, janela.y, janela.width, janela.height);
}

function aplicarCamadaAjuste(
  destino: Contexto,
  camada: Camada,
  janela: Rect,
  previa?: PreviaComposicao,
  origem = { x: 0, y: 0 },
) {
  if (!camada.ajuste) return;
  // Imagem e máscara usam a mesma janela, embora o destino no grupo seja local (0, 0).
  // getImageData/putImageData ignoram a transformação e o clip atuais do Canvas 2D.
  const abaixo = destino.getImageData(origem.x, origem.y, janela.width, janela.height);
  const filtrado = comporAjuste(
    abaixo,
    camada.ajuste,
    camada.opacity,
    lerMascara(camada, janela, previa),
  );
  if (filtrado !== abaixo) destino.putImageData(comoImageData(filtrado), origem.x, origem.y);
}

function desenharRecortadas(
  destino: Contexto,
  recortadas: Camada[],
  janela: Rect,
  previa?: PreviaComposicao,
  trechoDaTela?: Rect,
) {
  if (!recortadas.length) return;
  destino.save();
  for (const camada of recortadas) {
    if (!camada.visible || camada.opacity <= 0 || camada.foraDaTela) continue;
    if (camada.ajuste) {
      aplicarCamadaAjuste(destino, camada, trechoDaTela ?? janela, previa, trechoDaTela);
      continue;
    }
    // O alfa do destino delimita a camada de recorte.
    destino.globalAlpha = camada.opacity;
    destino.globalCompositeOperation = 'source-atop';
    destino.drawImage(camadaComMascara(camada, janela, previa).canvas, 0, 0);
  }
  destino.restore();
}

/** Pixels da camada na janela, já recortados pela máscara (luminância vira transparência). */
function camadaComMascara(camada: Camada, janela: Rect, previa?: PreviaComposicao): Contexto {
  const ctx = superficie(janela.width, janela.height);
  const alvo = previa?.alvo.camada === camada.id ? previa : undefined;
  desenharComPrevia(ctx, camada.canvas, janela, alvo?.alvo.mascara ? undefined : alvo);
  const mascara = lerMascara(camada, janela, previa);
  if (mascara) {
    const alfa = superficie(janela.width, janela.height);
    const { data } = mascara;
    for (let i = 0; i < data.length; i += 4) {
      // Luminância (Rec. 601) da máscara vira o alfa: branco revela, preto esconde.
      data[i + 3] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
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
function desenharCamada(
  destino: Contexto,
  camada: Camada,
  recortadas: Camada[],
  janela: Rect,
  previa?: PreviaComposicao,
) {
  destino.save();
  destino.globalAlpha = camada.opacity;
  destino.globalCompositeOperation = MODOS_MESCLAGEM[camada.modo]?.operacao ?? 'source-over';
  const previaDosPixels = previa?.alvo.camada === camada.id && !previa.alvo.mascara ? previa : null;
  if (
    !precisaDeSuperficie(camada, recortadas) &&
    (!previaDosPixels || contemJanela(previaDosPixels.area, janela))
  ) {
    if (previaDosPixels)
      desenharJanela(
        destino,
        previaDosPixels.canvas,
        janela,
        previaDosPixels.area.x,
        previaDosPixels.area.y,
      );
    else desenharJanela(destino, camada.canvas, janela);
    destino.restore();
    return;
  }
  let pixels = camadaComMascara(camada, janela, previa);
  desenharRecortadas(pixels, recortadas, janela, previa);
  if (camada.efeitos?.contorno || camada.efeitos?.sombra)
    pixels = comEfeitos(pixels, camada.efeitos);
  destino.drawImage(pixels.canvas, 0, 0);
  destino.restore();
}

function desenharLista(
  destino: Contexto,
  camadas: Camada[],
  janela: Rect,
  previa?: PreviaComposicao,
  trechoDaTela?: Rect,
) {
  for (let i = 0; i < camadas.length; i++) {
    const camada = camadas[i];
    const recortadas: Camada[] = [];
    while (camadas[i + 1]?.recorte) recortadas.push(camadas[++i]);
    if (camada.ajuste) {
      if (camada.visible && camada.opacity > 0 && !camada.foraDaTela) {
        // Ao compor direto na tela, só a área em reconstrução contém os pixels de baixo.
        aplicarCamadaAjuste(destino, camada, trechoDaTela ?? janela, previa, trechoDaTela);
      }
      // O ajuste preserva o alfa da composição de baixo, que serve de base para o recorte.
      desenharRecortadas(destino, recortadas, janela, previa, trechoDaTela);
      continue;
    }
    if (!camada.visible || camada.opacity <= 0 || camada.foraDaTela) continue;
    desenharCamada(destino, camada, recortadas, janela, previa);
  }
}

/**
 * Compõe as camadas visíveis de baixo para cima no canvas da tela. Com `area`, só esse trecho
 * é refeito; a janela de trabalho cresce o bastante para sombras e contornos não serem cortados.
 */
export function comporDocumento(
  doc: DocumentoComposicao,
  tela: HTMLCanvasElement,
  area?: Rect,
  previa?: PreviaComposicao,
  previaAjuste?: PreviaAjuste,
): void {
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

  const margem = margemDosEfeitos(doc);
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
  const trechoDaTela = { x: esquerda, y: topo, width: largura, height: altura };
  // Camadas soltas consecutivas vão juntas: uma camada de recorte depende da que está abaixo.
  let soltas: Camada[] = [];
  const descarregar = () => {
    if (soltas.length) desenharLista(contexto, soltas, janela, previa, trechoDaTela);
    soltas = [];
  };
  for (const no of montarNos(doc, previaAjuste)) {
    if (no.tipo === 'camada') {
      soltas.push(no.camada);
      continue;
    }
    descarregar();
    const { grupo, camadas } = no;
    if (!grupo.visible || grupo.opacity <= 0) continue;
    const interno = superficie(janela.width, janela.height);
    desenharLista(interno, camadas, janela, previa);
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
  if (camada.ajuste) {
    const janela = { x: 0, y: 0, width: destino.canvas.width, height: destino.canvas.height };
    aplicarCamadaAjuste(destino, camada, janela);
    return;
  }
  const janela = { x: 0, y: 0, width: camada.canvas.width, height: camada.canvas.height };
  desenharCamada(destino, camada, recortadas, janela);
}
