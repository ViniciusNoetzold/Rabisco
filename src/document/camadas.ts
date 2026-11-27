import type { CamadaAscii } from '../estilos/camadaAscii';

/** Modos de mesclagem das camadas, com os nomes usados na interface em português. */
export const MODOS_MESCLAGEM = {
  normal: { nome: 'Normal', operacao: 'source-over' },
  multiplicar: { nome: 'Multiplicar', operacao: 'multiply' },
  tela: { nome: 'Tela', operacao: 'screen' },
  sobrepor: { nome: 'Sobrepor', operacao: 'overlay' },
  escurecer: { nome: 'Escurecer', operacao: 'darken' },
  clarear: { nome: 'Clarear', operacao: 'lighten' },
  subexposicao: { nome: 'Subexposição de cor', operacao: 'color-dodge' },
  superexposicao: { nome: 'Superexposição de cor', operacao: 'color-burn' },
  'luz-forte': { nome: 'Luz forte', operacao: 'hard-light' },
  'luz-suave': { nome: 'Luz suave', operacao: 'soft-light' },
  diferenca: { nome: 'Diferença', operacao: 'difference' },
  exclusao: { nome: 'Exclusão', operacao: 'exclusion' },
  matiz: { nome: 'Matiz', operacao: 'hue' },
  saturacao: { nome: 'Saturação', operacao: 'saturation' },
  cor: { nome: 'Cor', operacao: 'color' },
  luminosidade: { nome: 'Luminosidade', operacao: 'luminosity' },
} as const satisfies Record<string, { nome: string; operacao: GlobalCompositeOperation }>;

export type ModoMesclagem = keyof typeof MODOS_MESCLAGEM;

export function modoValido(modo: unknown): modo is ModoMesclagem {
  return typeof modo === 'string' && Object.hasOwn(MODOS_MESCLAGEM, modo);
}

/** Efeitos não destrutivos, recalculados na composição (modo "adesivo" das colagens). */
export interface EfeitosCamada {
  contorno?: { cor: string; espessura: number; posicao: 'fora' | 'dentro' };
  sombra?: { cor: string; distancia: number; angulo: number; desfoque: number; opacidade: number };
}

/** Tudo de uma camada que não são pixels: é o que o histórico e o autosave guardam. */
export interface PropriedadesCamada {
  id: string;
  name: string;
  visible: boolean;
  /** 0 a 1. */
  opacity: number;
  modo: ModoMesclagem;
  /** Bloqueia os pixels: nenhuma ferramenta pinta nesta camada. */
  locked: boolean;
  /** Pinta só onde já existe pixel (alfa preservado). */
  bloqueioTransparencia: boolean;
  /** Impede mover e transformar a camada. */
  bloqueioPosicao: boolean;
  /** Cor de etiqueta no painel, em hexadecimal. */
  etiqueta?: string;
  /** Grupo (pasta) a que a camada pertence. */
  grupo?: string;
  /** Máscara de recorte: só aparece dentro dos pixels da camada logo abaixo. */
  recorte?: boolean;
  /** Camada de fundo opaca ("Papel"): a borracha pinta com a Cor 2, como no paint clássico. */
  fundo?: boolean;
  temMascara?: boolean;
  /** Máscara ligada (Shift+clique na miniatura desliga temporariamente). */
  mascaraAtiva?: boolean;
  efeitos?: EfeitosCamada;
  ascii?: CamadaAscii;
}

export interface Grupo {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  modo: ModoMesclagem;
  recolhido: boolean;
}

/** Retrato da estrutura do documento: camadas (de baixo para cima), grupos e seleção ativa. */
export interface EstruturaDocumento {
  camadas: PropriedadesCamada[];
  grupos: Grupo[];
  ativa: string;
  editandoMascara: boolean;
}

/** Alvo de leitura e escrita: os pixels da camada ou a máscara dela. */
export interface Alvo {
  camada: string;
  mascara?: boolean;
}

/** Chave usada pelo autosave para a máscara de uma camada. */
export const SUFIXO_MASCARA = '#mascara';

export function chaveDoAlvo({ camada, mascara }: Alvo): string {
  return mascara ? `${camada}${SUFIXO_MASCARA}` : camada;
}

export function alvoDaChave(chave: string): Alvo {
  return chave.endsWith(SUFIXO_MASCARA)
    ? { camada: chave.slice(0, -SUFIXO_MASCARA.length), mascara: true }
    : { camada: chave };
}

export function propriedadesPadrao(id: string, name: string): PropriedadesCamada {
  return {
    id,
    name,
    visible: true,
    opacity: 1,
    modo: 'normal',
    locked: false,
    bloqueioTransparencia: false,
    bloqueioPosicao: false,
  };
}

let contador = 0;

/** Identificador novo e curto para camadas e grupos. */
export function novoId(prefixo: 'camada' | 'grupo'): string {
  contador = (contador + 1) % 1_000_000;
  const aleatorio = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `${prefixo}-${aleatorio}${contador.toString(36)}`;
}
