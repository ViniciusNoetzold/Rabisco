// ag-psd é grande: só carrega quando um PSD é salvo ou aberto.
import type { BlendMode, Layer as CamadaPsd, Psd } from 'ag-psd';
import { guiasSeguras, SEM_GUIAS, type GuiasDocumento } from '../document/guias';
import { normalizarCamadaAscii } from '../estilos/camadaAscii';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { ajusteSeguro, exportacaoComAjusteAchatado } from '../document/ajustes';
import {
  chaveDoAlvo,
  modoValido,
  propriedadesPadrao,
  type EstruturaDocumento,
  type Grupo,
  type ModoMesclagem,
  type PropriedadesCamada,
} from '../document/camadas';
import { comporDocumento, desenharCamadaSobre } from '../document/compositor';
import { DPI_PADRAO, dimensoesValidas, dpiValido } from '../document/dimensoes';
import { identificarArquivoDeCamadas } from './formatosImagem';
import type { Layer, RabiscoDocument } from '../document/model';

/** Formatos que guardam camadas (ou as camadas separadas). */
export type FormatoCamadas = 'rabisco' | 'ora' | 'psd' | 'camadas-png';

export const EXTENSOES_CAMADAS: Record<FormatoCamadas, string> = {
  rabisco: 'rabisco',
  ora: 'ora',
  psd: 'psd',
  'camadas-png': 'zip',
};

const MIMES_CAMADAS: Record<FormatoCamadas, string> = {
  rabisco: 'application/x-rabisco',
  ora: 'image/openraster',
  psd: 'image/vnd.adobe.photoshop',
  'camadas-png': 'application/zip',
};

/** Documento lido de um arquivo, pronto para substituir o atual. */
export interface DocumentoComCamadas {
  nome: string;
  largura: number;
  altura: number;
  dpi: number;
  estrutura: EstruturaDocumento;
  /** Pixels por chave de alvo (`id` ou `id#mascara`), já no tamanho do papel. */
  pixels: Map<string, HTMLCanvasElement>;
  /** Partes do arquivo que o Rabisco não reproduz (para avisar). */
  avisos: string[];
  /** Guias e régua de desenho (só o .rabisco v2 guarda). */
  guias?: GuiasDocumento;
}

const LIMITE_ARQUIVO = 512 * 1024 * 1024;
const LIMITE_CAMADAS = 200;
const ID_SEGURO = /^[A-Za-z0-9_-]{1,64}$/;
/** v1: camadas. v2: guias e régua. v3: camadas de ajuste. */
export const VERSAO_RABISCO = 3;

// ---- Utilidades -----------------------------------------------------------------------------

function novoCanvas(largura: number, altura: number) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

async function bytesPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolver, rejeitar) =>
    canvas.toBlob(
      (resultado) =>
        resultado ? resolver(resultado) : rejeitar(new Error('Não foi possível gerar o PNG.')),
      'image/png',
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

async function canvasDePng(bytes: Uint8Array, nome: string): Promise<HTMLCanvasElement> {
  let imagem: ImageBitmap;
  try {
    imagem = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }));
  } catch {
    throw new Error(`A imagem "${nome}" do arquivo está danificada.`);
  }
  const canvas = novoCanvas(imagem.width, imagem.height);
  canvas.getContext('2d')!.drawImage(imagem, 0, 0);
  imagem.close();
  return canvas;
}

/** Camada como aparece: máscara e efeitos aplicados aos pixels (para formatos sem eles). */
function camadaAplicada(camada: Layer<HTMLCanvasElement>, largura: number, altura: number) {
  const canvas = novoCanvas(largura, altura);
  desenharCamadaSobre(canvas.getContext('2d', { willReadFrequently: true })!, {
    ...camada,
    opacity: 1,
    modo: 'normal',
  });
  return canvas;
}

function miniatura(origem: HTMLCanvasElement, lado = 256) {
  const escala = Math.min(1, lado / origem.width, lado / origem.height);
  const canvas = novoCanvas(
    Math.max(1, Math.round(origem.width * escala)),
    Math.max(1, Math.round(origem.height * escala)),
  );
  const contexto = canvas.getContext('2d')!;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(origem, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function composto(doc: RabiscoDocument) {
  const canvas = novoCanvas(doc.width, doc.height);
  comporDocumento(doc, canvas);
  return canvas;
}

function camadaAchatada(canvas: HTMLCanvasElement): Layer<HTMLCanvasElement> {
  return { ...propriedadesPadrao('imagem-achatada', 'Imagem achatada'), canvas };
}

/** Descompacta com limites: tamanho total, quantidade de entradas e nomes de caminho seguros. */
function descompactar(bytes: Uint8Array): Record<string, Uint8Array> {
  let total = 0;
  let entradas = 0;
  try {
    return unzipSync(bytes, {
      filter: (arquivo) => {
        entradas++;
        total += arquivo.originalSize;
        if (entradas > LIMITE_CAMADAS * 2 + 20 || total > LIMITE_ARQUIVO)
          throw new Error('O arquivo é grande demais para abrir neste editor.');
        if (
          arquivo.name.includes('..') ||
          arquivo.name.startsWith('/') ||
          arquivo.name.includes('\\')
        )
          throw new Error('O arquivo tem caminhos inválidos e não foi aberto.');
        return true;
      },
    });
  } catch (erro) {
    if (erro instanceof Error && /grande demais|caminhos inválidos/.test(erro.message)) throw erro;
    throw new Error('O arquivo está danificado ou não é um ZIP válido.');
  }
}

function texto(valor: unknown, padrao: string, maximo = 120) {
  return typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, maximo) : padrao;
}

function numeroEntre(valor: unknown, minimo: number, maximo: number, padrao: number) {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? Math.min(maximo, Math.max(minimo, valor))
    : padrao;
}

function cor(valor: unknown, padrao: string) {
  return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor) ? valor : padrao;
}

/** Recria as propriedades só com campos conhecidos e valores válidos (nada vem cru do arquivo). */
function propriedadesSeguras(
  bruto: unknown,
  indice: number,
  grupos: Set<string>,
  aceitaAjustes: boolean,
): PropriedadesCamada {
  const dados = (typeof bruto === 'object' && bruto ? bruto : {}) as Record<string, unknown>;
  const id =
    typeof dados.id === 'string' && ID_SEGURO.test(dados.id) ? dados.id : `camada-${indice + 1}`;
  const propriedades: PropriedadesCamada = {
    ...propriedadesPadrao(id, texto(dados.name, `Camada ${indice + 1}`)),
    visible: dados.visible !== false,
    opacity: numeroEntre(dados.opacity, 0, 1, 1),
    modo: modoValido(dados.modo) ? dados.modo : 'normal',
    locked: dados.locked === true,
    bloqueioTransparencia: dados.bloqueioTransparencia === true,
    bloqueioPosicao: dados.bloqueioPosicao === true,
  };
  if (typeof dados.etiqueta === 'string' && /^#[0-9a-f]{6}$/i.test(dados.etiqueta))
    propriedades.etiqueta = dados.etiqueta;
  if (typeof dados.grupo === 'string' && grupos.has(dados.grupo)) propriedades.grupo = dados.grupo;
  if (dados.recorte === true) propriedades.recorte = true;
  if (dados.fundo === true) propriedades.fundo = true;
  const ajuste = aceitaAjustes ? ajusteSeguro(dados.ajuste) : undefined;
  if (!ajuste) {
    const ascii = normalizarCamadaAscii(dados.ascii);
    if (ascii) propriedades.ascii = ascii;
  }
  if (dados.temMascara === true) {
    propriedades.temMascara = true;
    propriedades.mascaraAtiva = dados.mascaraAtiva !== false;
  }
  const efeitos = (
    typeof dados.efeitos === 'object' && dados.efeitos ? dados.efeitos : {}
  ) as Record<string, Record<string, unknown> | undefined>;
  const contorno = efeitos.contorno;
  const sombra = efeitos.sombra;
  if (ajuste) {
    propriedades.ajuste = ajuste;
    propriedades.modo = 'normal';
    delete propriedades.fundo;
  } else if (contorno || sombra) {
    propriedades.efeitos = {};
    if (contorno)
      propriedades.efeitos.contorno = {
        cor: cor(contorno.cor, '#ffffff'),
        espessura: numeroEntre(contorno.espessura, 1, 60, 6),
        posicao: contorno.posicao === 'dentro' ? 'dentro' : 'fora',
      };
    if (sombra)
      propriedades.efeitos.sombra = {
        cor: cor(sombra.cor, '#000000'),
        distancia: numeroEntre(sombra.distancia, 0, 200, 6),
        angulo: numeroEntre(sombra.angulo, -360, 360, 45),
        desfoque: numeroEntre(sombra.desfoque, 0, 100, 6),
        opacidade: numeroEntre(sombra.opacidade, 0, 1, 0.35),
      };
  }
  return propriedades;
}

function gruposSeguros(bruto: unknown): Grupo[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.slice(0, LIMITE_CAMADAS).flatMap((item, i) => {
    const dados = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>;
    if (typeof dados.id !== 'string' || !ID_SEGURO.test(dados.id)) return [];
    return [
      {
        id: dados.id,
        name: texto(dados.name, `Grupo ${i + 1}`),
        visible: dados.visible !== false,
        opacity: numeroEntre(dados.opacity, 0, 1, 1),
        modo: modoValido(dados.modo) ? dados.modo : 'normal',
        recolhido: dados.recolhido === true,
      },
    ];
  });
}

/** Junta a estrutura e confere que os ids são únicos e a ativa existe. */
function estruturaSegura(
  camadas: PropriedadesCamada[],
  grupos: Grupo[],
  ativa: unknown,
): EstruturaDocumento {
  if (!camadas.length) throw new Error('O arquivo não tem nenhuma camada.');
  if (camadas.length > LIMITE_CAMADAS)
    throw new Error(`O arquivo tem mais de ${LIMITE_CAMADAS} camadas.`);
  const vistos = new Set<string>();
  for (const [i, camada] of camadas.entries()) {
    while (vistos.has(camada.id)) camada.id = `${camada.id.slice(0, 50)}-${i}`;
    vistos.add(camada.id);
  }
  const usados = new Set(camadas.map((camada) => camada.grupo).filter(Boolean));
  return {
    camadas,
    grupos: grupos.filter((grupo) => usados.has(grupo.id)),
    ativa: typeof ativa === 'string' && vistos.has(ativa) ? ativa : camadas[camadas.length - 1].id,
    editandoMascara: false,
  };
}

function nomeSemExtensao(nome: string) {
  return (
    nome
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 120) || 'Sem título'
  );
}

// ---- Exportar ---------------------------------------------------------------------------------

/** Gera o arquivo do formato pedido a partir do documento atual. */
export async function exportarCamadas(
  doc: RabiscoDocument,
  formato: FormatoCamadas,
  guias: GuiasDocumento = SEM_GUIAS,
): Promise<Blob> {
  const achatar = exportacaoComAjusteAchatado(formato, doc.layers);
  const dados =
    formato === 'rabisco'
      ? await exportarRabisco(doc, guias)
      : formato === 'ora'
        ? await exportarOra(doc, achatar)
        : formato === 'psd'
          ? await exportarPsd(doc, achatar)
          : await exportarCamadasPng(doc, achatar);
  return new Blob([dados as BlobPart], { type: MIMES_CAMADAS[formato] });
}

async function exportarRabisco(doc: RabiscoDocument, guias: GuiasDocumento): Promise<Uint8Array> {
  const estrutura = doc.estrutura();
  estrutura.editandoMascara = false;
  const arquivos: Zippable = {
    'manifest.json': strToU8(
      JSON.stringify(
        {
          formato: 'rabisco',
          versao: VERSAO_RABISCO,
          criadoCom: 'Rabisco 0.5',
          nome: doc.name,
          largura: doc.width,
          altura: doc.height,
          dpi: doc.dpi,
          guias,
          estrutura,
        },
        null,
        2,
      ),
    ),
  };
  for (const camada of doc.layers) {
    if (!camada.ajuste)
      arquivos[`camadas/${camada.id}.png`] = [await bytesPng(camada.canvas), { level: 0 }];
    if (camada.mascara)
      arquivos[`mascaras/${camada.id}.png`] = [await bytesPng(camada.mascara), { level: 0 }];
  }
  const previa = composto(doc);
  arquivos['preview.png'] = [await bytesPng(previa), { level: 0 }];
  arquivos['thumbnail.png'] = [await bytesPng(miniatura(previa)), { level: 0 }];
  return zipSync(arquivos);
}

const ORA_MODOS: Record<ModoMesclagem, string> = {
  normal: 'svg:src-over',
  multiplicar: 'svg:multiply',
  tela: 'svg:screen',
  sobrepor: 'svg:overlay',
  escurecer: 'svg:darken',
  clarear: 'svg:lighten',
  subexposicao: 'svg:color-dodge',
  superexposicao: 'svg:color-burn',
  'luz-forte': 'svg:hard-light',
  'luz-suave': 'svg:soft-light',
  diferenca: 'svg:difference',
  exclusao: 'svg:exclusion',
  matiz: 'svg:hue',
  saturacao: 'svg:saturation',
  cor: 'svg:color',
  luminosidade: 'svg:luminosity',
};

function escaparXml(valor: string) {
  return valor.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function exportarOra(doc: RabiscoDocument, achatar: boolean): Promise<Uint8Array> {
  // O "mimetype" precisa ser o primeiro arquivo e sem compressão (especificação OpenRaster).
  const arquivos: Zippable = { mimetype: [strToU8('image/openraster'), { level: 0 }] };
  const grupos = new Map(doc.grupos.map((grupo) => [grupo.id, grupo]));
  const linhas: string[] = [];
  let grupoAberto: string | null = null;
  const achatada = achatar ? composto(doc) : undefined;
  const camadas = achatada ? [camadaAchatada(achatada)] : [...doc.layers].reverse();
  let bytesAchatados: Uint8Array | undefined;
  // ORA lista de cima para baixo. Máscaras e efeitos entram aplicados aos pixels.
  for (const camada of camadas) {
    if (camada.grupo !== grupoAberto) {
      if (grupoAberto) linhas.push('  </stack>');
      grupoAberto = camada.grupo && grupos.has(camada.grupo) ? camada.grupo : null;
      if (grupoAberto) {
        const grupo = grupos.get(grupoAberto)!;
        linhas.push(
          `  <stack name="${escaparXml(grupo.name)}" opacity="${grupo.opacity}" visibility="${grupo.visible ? 'visible' : 'hidden'}" composite-op="${ORA_MODOS[grupo.modo]}">`,
        );
      }
    }
    const arquivo = `data/${camada.id}.png`;
    const bytes = await bytesPng(achatada ?? camadaAplicada(camada, doc.width, doc.height));
    arquivos[arquivo] = [bytes, { level: 0 }];
    if (achatar) bytesAchatados = bytes;
    linhas.push(
      `${grupoAberto ? '    ' : '  '}<layer name="${escaparXml(camada.name)}" src="${arquivo}" x="0" y="0" opacity="${camada.opacity}" visibility="${camada.visible ? 'visible' : 'hidden'}" composite-op="${ORA_MODOS[camada.modo]}"/>`,
    );
  }
  if (grupoAberto) linhas.push('  </stack>');
  arquivos['stack.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<image version="0.0.5" w="${doc.width}" h="${doc.height}" xres="${doc.dpi}" yres="${doc.dpi}">\n <stack>\n${linhas.join('\n')}\n </stack>\n</image>\n`,
  );
  const previa = achatada ?? composto(doc);
  arquivos['mergedimage.png'] = [bytesAchatados ?? await bytesPng(previa), { level: 0 }];
  arquivos['Thumbnails/thumbnail.png'] = [await bytesPng(miniatura(previa)), { level: 0 }];
  return zipSync(arquivos);
}

const PSD_MODOS: Record<ModoMesclagem, BlendMode> = {
  normal: 'normal',
  multiplicar: 'multiply',
  tela: 'screen',
  sobrepor: 'overlay',
  escurecer: 'darken',
  clarear: 'lighten',
  subexposicao: 'color dodge',
  superexposicao: 'color burn',
  'luz-forte': 'hard light',
  'luz-suave': 'soft light',
  diferenca: 'difference',
  exclusao: 'exclusion',
  matiz: 'hue',
  saturacao: 'saturation',
  cor: 'color',
  luminosidade: 'luminosity',
};

async function exportarPsd(doc: RabiscoDocument, achatar: boolean): Promise<Uint8Array> {
  const { writePsd } = await import('ag-psd');
  const grupos = new Map(doc.grupos.map((grupo) => [grupo.id, grupo]));
  const raiz: CamadaPsd[] = [];
  let grupoAtual = null as { id: string; camada: CamadaPsd } | null;
  const previa = composto(doc);
  // No ag-psd a primeira camada da lista é a de baixo, como no Rabisco.
  for (const camada of achatar ? [camadaAchatada(previa)] : doc.layers) {
    const comEfeitos = Boolean(camada.efeitos?.contorno || camada.efeitos?.sombra);
    const psd: CamadaPsd = {
      name: camada.name,
      // Efeitos do Rabisco não existem no PSD: entram aplicados aos pixels (com a máscara).
      canvas: comEfeitos ? camadaAplicada(camada, doc.width, doc.height) : camada.canvas,
      left: 0,
      top: 0,
      opacity: camada.opacity,
      hidden: !camada.visible,
      blendMode: PSD_MODOS[camada.modo],
      clipping: camada.recorte === true,
    };
    if (camada.mascara && !comEfeitos)
      psd.mask = {
        canvas: camada.mascara,
        left: 0,
        top: 0,
        right: doc.width,
        bottom: doc.height,
        defaultColor: 255,
        disabled: camada.mascaraAtiva === false,
      };
    const grupo = camada.grupo ? grupos.get(camada.grupo) : undefined;
    if (grupo) {
      if (grupoAtual?.id !== grupo.id) {
        grupoAtual = {
          id: grupo.id,
          camada: {
            name: grupo.name,
            opened: !grupo.recolhido,
            hidden: !grupo.visible,
            opacity: grupo.opacity,
            blendMode: grupo.modo === 'normal' ? 'pass through' : PSD_MODOS[grupo.modo],
            children: [],
          },
        };
        raiz.push(grupoAtual.camada);
      }
      grupoAtual.camada.children!.push(psd);
    } else {
      grupoAtual = null;
      raiz.push(psd);
    }
  }
  const documento: Psd = {
    width: doc.width,
    height: doc.height,
    canvas: previa,
    children: raiz,
  };
  return new Uint8Array(writePsd(documento, { generateThumbnail: true }));
}

async function exportarCamadasPng(doc: RabiscoDocument, achatar: boolean): Promise<Uint8Array> {
  const arquivos: Zippable = {};
  const usados = new Set<string>();
  const camadas = achatar ? [camadaAchatada(composto(doc))] : [...doc.layers].reverse();
  for (const [i, camada] of camadas.entries()) {
    let nome = `${String(i + 1).padStart(2, '0')} - ${camada.name.replace(/[\\/:*?"<>|]/g, '_')}`;
    while (usados.has(nome)) nome += '_';
    usados.add(nome);
    arquivos[`${nome}.png`] = [
      await bytesPng(achatar ? camada.canvas : camadaAplicada(camada, doc.width, doc.height)),
      { level: 0 },
    ];
  }
  return zipSync(arquivos);
}

// ---- Importar ---------------------------------------------------------------------------------

export { identificarArquivoDeCamadas } from './formatosImagem';

export async function importarCamadas(arquivo: File): Promise<DocumentoComCamadas> {
  if (arquivo.size > LIMITE_ARQUIVO)
    throw new Error('O arquivo é grande demais para abrir neste editor.');
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = identificarArquivoDeCamadas(bytes);
  if (tipo === 'psd') return importarPsd(bytes, arquivo.name);
  if (tipo !== 'zip') throw new Error('Este arquivo não é .rabisco, .ora nem .psd.');
  const arquivos = descompactar(bytes);
  if (arquivos['manifest.json']) return importarRabisco(arquivos, arquivo.name);
  if (arquivos['stack.xml']) return importarOra(arquivos, arquivo.name);
  throw new Error('Este ZIP não é um arquivo .rabisco nem .ora.');
}

async function importarRabisco(
  arquivos: Record<string, Uint8Array>,
  nomeArquivo: string,
): Promise<DocumentoComCamadas> {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(strFromU8(arquivos['manifest.json']));
  } catch {
    throw new Error('O manifest.json do arquivo .rabisco está danificado.');
  }
  const { versao, largura, altura, dpi, nome, guias } = lerCabecalhoRabisco(manifest, nomeArquivo);
  const brutoEstrutura = (
    typeof manifest.estrutura === 'object' && manifest.estrutura ? manifest.estrutura : {}
  ) as Record<string, unknown>;
  const grupos = gruposSeguros(brutoEstrutura.grupos);
  const idsGrupos = new Set(grupos.map((grupo) => grupo.id));
  const camadasBrutas = Array.isArray(brutoEstrutura.camadas) ? brutoEstrutura.camadas : [];
  if (camadasBrutas.length > LIMITE_CAMADAS)
    throw new Error(`O arquivo tem mais de ${LIMITE_CAMADAS} camadas.`);
  const originais = camadasBrutas.map((bruto) =>
    typeof bruto === 'object' && bruto && typeof (bruto as { id?: unknown }).id === 'string'
      ? (bruto as { id: string }).id
      : '',
  );
  const camadas = camadasBrutas.map((bruto, i) => propriedadesSeguras(bruto, i, idsGrupos, versao >= 3));
  const estrutura = estruturaSegura(camadas, grupos, brutoEstrutura.ativa);
  if (camadas.every((camada) => camada.ajuste))
    throw new Error('O arquivo precisa ter pelo menos uma camada de desenho.');

  const pixels = new Map<string, HTMLCanvasElement>();
  for (const [i, camada] of estrutura.camadas.entries()) {
    const original = originais[i];
    if (!camada.ajuste) {
      const dados = arquivos[`camadas/${original}.png`];
      if (!dados) throw new Error(`Falta a imagem da camada "${camada.name}" no arquivo.`);
      const canvas = await canvasDePng(dados, camada.name);
      if (canvas.width !== largura || canvas.height !== altura)
        throw new Error(`A camada "${camada.name}" não tem o tamanho do papel.`);
      pixels.set(chaveDoAlvo({ camada: camada.id }), canvas);
    }
    if (camada.temMascara) {
      const mascara = arquivos[`mascaras/${original}.png`];
      if (!mascara) {
        delete camada.temMascara;
        delete camada.mascaraAtiva;
        continue;
      }
      const canvasMascara = await canvasDePng(mascara, `${camada.name} (máscara)`);
      if (canvasMascara.width !== largura || canvasMascara.height !== altura)
        throw new Error(`A máscara de "${camada.name}" não tem o tamanho do papel.`);
      pixels.set(chaveDoAlvo({ camada: camada.id, mascara: true }), canvasMascara);
    }
  }
  return { nome, largura, altura, dpi, estrutura, pixels, avisos: [], guias };
}

/**
 * Formato, versão, tamanho, dpi, nome e guias do manifest de um .rabisco. A v1 (0.3) não tem
 * guias; uma versão mais nova que a do programa é recusada.
 */
export function lerCabecalhoRabisco(manifest: Record<string, unknown>, nomeArquivo: string) {
  if (manifest.formato !== 'rabisco') throw new Error('Este arquivo não é um .rabisco.');
  if (typeof manifest.versao !== 'number' || manifest.versao > VERSAO_RABISCO)
    throw new Error('Este .rabisco foi salvo por uma versão mais nova do Rabisco.');
  const largura = manifest.largura;
  const altura = manifest.altura;
  if (
    typeof largura !== 'number' ||
    typeof altura !== 'number' ||
    !dimensoesValidas(largura, altura)
  )
    throw new Error('O .rabisco tem dimensões inválidas.');
  const dpi =
    typeof manifest.dpi === 'number' && dpiValido(manifest.dpi) ? manifest.dpi : DPI_PADRAO;
  return {
    versao: manifest.versao,
    largura,
    altura,
    dpi,
    nome: texto(manifest.nome, nomeSemExtensao(nomeArquivo)),
    guias: manifest.versao >= 2 ? guiasSeguras(manifest.guias, largura, altura) : SEM_GUIAS,
  };
}

function modoDoOra(valor: string | null): ModoMesclagem {
  const encontrado = Object.entries(ORA_MODOS).find(([, op]) => op === valor);
  return (encontrado?.[0] as ModoMesclagem | undefined) ?? 'normal';
}

async function importarOra(
  arquivos: Record<string, Uint8Array>,
  nomeArquivo: string,
): Promise<DocumentoComCamadas> {
  const xml = new DOMParser().parseFromString(strFromU8(arquivos['stack.xml']), 'application/xml');
  const imagem = xml.querySelector('image');
  if (!imagem || xml.querySelector('parsererror'))
    throw new Error('O stack.xml do arquivo .ora está danificado.');
  const largura = Number(imagem.getAttribute('w'));
  const altura = Number(imagem.getAttribute('h'));
  if (!dimensoesValidas(largura, altura)) throw new Error('O .ora tem dimensões inválidas.');
  const resolucao = Number(imagem.getAttribute('xres'));
  const dpi = dpiValido(resolucao) ? resolucao : DPI_PADRAO;
  const raiz = imagem.querySelector(':scope > stack');
  if (!raiz) throw new Error('O .ora não tem camadas.');

  const camadas: PropriedadesCamada[] = [];
  const grupos: Grupo[] = [];
  const pixels = new Map<string, HTMLCanvasElement>();
  const avisos = new Set<string>();
  let contador = 0;

  // O .ora lista de cima para baixo; o Rabisco guarda de baixo para cima.
  async function lerPilha(pilha: Element, grupo?: string) {
    for (const item of [...pilha.children].reverse()) {
      if (item.tagName === 'stack') {
        if (grupo) avisos.add('Grupos dentro de grupos foram juntados num grupo só.');
        let id = grupo;
        if (!id) {
          id = `grupo-ora-${grupos.length + 1}`;
          grupos.push({
            id,
            name: texto(item.getAttribute('name'), `Grupo ${grupos.length + 1}`),
            visible: item.getAttribute('visibility') !== 'hidden',
            opacity: numeroEntre(Number(item.getAttribute('opacity') ?? 1), 0, 1, 1),
            modo: modoDoOra(item.getAttribute('composite-op')),
            recolhido: false,
          });
        }
        await lerPilha(item, id);
        continue;
      }
      if (item.tagName !== 'layer') continue;
      const src = item.getAttribute('src') ?? '';
      const dados = arquivos[src];
      if (!dados || src.includes('..')) {
        avisos.add('Algumas camadas sem imagem foram ignoradas.');
        continue;
      }
      if (camadas.length >= LIMITE_CAMADAS)
        throw new Error(`O arquivo tem mais de ${LIMITE_CAMADAS} camadas.`);
      contador++;
      const id = `camada-ora-${contador}`;
      const nome = texto(item.getAttribute('name'), `Camada ${contador}`);
      const fonte = await canvasDePng(dados, nome);
      const canvas = novoCanvas(largura, altura);
      canvas
        .getContext('2d')!
        .drawImage(fonte, Number(item.getAttribute('x')) || 0, Number(item.getAttribute('y')) || 0);
      const propriedades: PropriedadesCamada = {
        ...propriedadesPadrao(id, nome),
        visible: item.getAttribute('visibility') !== 'hidden',
        opacity: numeroEntre(Number(item.getAttribute('opacity') ?? 1), 0, 1, 1),
        modo: modoDoOra(item.getAttribute('composite-op')),
      };
      if (grupo) propriedades.grupo = grupo;
      camadas.push(propriedades);
      pixels.set(id, canvas);
    }
  }
  await lerPilha(raiz);
  return {
    nome: nomeSemExtensao(nomeArquivo),
    largura,
    altura,
    dpi,
    estrutura: estruturaSegura(camadas, grupos, undefined),
    pixels,
    avisos: [...avisos],
  };
}

function modoDoPsd(modo: BlendMode | undefined): ModoMesclagem {
  const encontrado = Object.entries(PSD_MODOS).find(([, valor]) => valor === modo);
  return (encontrado?.[0] as ModoMesclagem | undefined) ?? 'normal';
}

async function importarPsd(bytes: Uint8Array, nomeArquivo: string): Promise<DocumentoComCamadas> {
  const { readPsd } = await import('ag-psd');
  let psd: Psd;
  try {
    psd = readPsd(bytes, {
      skipThumbnail: true,
      skipCompositeImageData: true,
      skipLinkedFilesData: true,
    });
  } catch {
    throw new Error('O arquivo PSD está danificado ou usa um recurso que o Rabisco não lê.');
  }
  const { width: largura, height: altura } = psd;
  if (!dimensoesValidas(largura, altura)) throw new Error('O PSD tem dimensões grandes demais.');
  const camadas: PropriedadesCamada[] = [];
  const grupos: Grupo[] = [];
  const pixels = new Map<string, HTMLCanvasElement>();
  const avisos = new Set<string>();
  let contador = 0;

  function lerFilhos(filhos: CamadaPsd[], grupo?: string) {
    for (const filho of filhos) {
      if (filho.children) {
        if (grupo) avisos.add('Grupos dentro de grupos foram juntados num grupo só.');
        let id = grupo;
        if (!id) {
          id = `grupo-psd-${grupos.length + 1}`;
          grupos.push({
            id,
            name: texto(filho.name, `Grupo ${grupos.length + 1}`),
            visible: !filho.hidden,
            opacity: numeroEntre(filho.opacity, 0, 1, 1),
            modo: filho.blendMode === 'pass through' ? 'normal' : modoDoPsd(filho.blendMode),
            recolhido: filho.opened === false,
          });
        }
        lerFilhos(filho.children, id);
        continue;
      }
      if (filho.effects) avisos.add('Efeitos de camada do Photoshop não foram importados.');
      if (filho.text) avisos.add('Textos do Photoshop viraram pixels.');
      if (!filho.canvas) {
        if (filho.adjustment) avisos.add('Camadas de ajuste do Photoshop não foram importadas.');
        continue;
      }
      if (camadas.length >= LIMITE_CAMADAS)
        throw new Error(`O arquivo tem mais de ${LIMITE_CAMADAS} camadas.`);
      contador++;
      const id = `camada-psd-${contador}`;
      const canvas = novoCanvas(largura, altura);
      canvas.getContext('2d')!.drawImage(filho.canvas, filho.left ?? 0, filho.top ?? 0);
      const propriedades: PropriedadesCamada = {
        ...propriedadesPadrao(id, texto(filho.name, `Camada ${contador}`)),
        visible: !filho.hidden,
        opacity: numeroEntre(filho.opacity, 0, 1, 1),
        modo: modoDoPsd(filho.blendMode),
      };
      if (grupo) propriedades.grupo = grupo;
      if (filho.clipping && camadas.length) propriedades.recorte = true;
      if (filho.mask?.canvas) {
        const mascara = novoCanvas(largura, altura);
        const contexto = mascara.getContext('2d')!;
        const fundo = filho.mask.defaultColor ?? 255;
        contexto.fillStyle = `rgb(${fundo}, ${fundo}, ${fundo})`;
        contexto.fillRect(0, 0, largura, altura);
        contexto.drawImage(filho.mask.canvas, filho.mask.left ?? 0, filho.mask.top ?? 0);
        propriedades.temMascara = true;
        propriedades.mascaraAtiva = !filho.mask.disabled;
        pixels.set(chaveDoAlvo({ camada: id, mascara: true }), mascara);
      }
      camadas.push(propriedades);
      pixels.set(id, canvas);
    }
  }
  lerFilhos(psd.children ?? []);
  if (!camadas.length)
    throw new Error('O PSD não tem camadas com pixels que o Rabisco consiga abrir.');
  return {
    nome: nomeSemExtensao(nomeArquivo),
    largura,
    altura,
    dpi: DPI_PADRAO,
    estrutura: estruturaSegura(camadas, grupos, undefined),
    pixels,
    avisos: [...avisos],
  };
}
