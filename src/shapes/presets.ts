import type { EstiloContorno, EstiloPreenchimento } from './tipos';
import type { Point } from '../layers/types';

export const PASTA_PADRAO = 'Minhas formas';
export const MAX_NOME_FORMA = 64;
export const MAX_PASTA_FORMA = 48;
export const LIMITE_ARQUIVO_FORMAS = 1024 * 1024;
export const LIMITE_FORMAS = 100;
export const LIMITE_CAMINHO = 8192;
const LIMITE_COMANDOS = 512;

export interface EstiloFormaSalvo {
  cor1: string;
  cor2: string;
  espessura: number;
  contorno: EstiloContorno;
  preenchimento: EstiloPreenchimento;
}

export interface DadosFormaPropria {
  nome: string;
  pasta: string;
  path: string;
  fechada: boolean;
  estilo?: EstiloFormaSalvo;
}

type FormaPortatil = DadosFormaPropria & { favorita: boolean };

export interface FormaPropria extends FormaPortatil {
  id: string;
  ordem: number;
}

const ARIDADE = { M: 2, L: 2, C: 6, Q: 4, Z: 0, H: 1, V: 1, A: 7 } as const;
type TipoComando = keyof typeof ARIDADE;

export interface ComandoCaminho {
  tipo: TipoComando;
  valores: number[];
}

function pularEspacos(path: string, indice: number): number {
  while (indice < path.length && ' \t\n\r'.includes(path[indice])) indice++;
  return indice;
}

/** O SVG amplia os raios quando o arco não alcança os extremos. */
function arcoLimitado(inicio: Point, valores: number[]): boolean {
  const [rx, ry, graus, , , x, y] = valores;
  if (!rx || !ry) return true;
  const rotacao = (graus * Math.PI) / 180;
  const cos = Math.cos(rotacao);
  const sin = Math.sin(rotacao);
  const dx = (inicio.x - x) / 2;
  const dy = (inicio.y - y) / 2;
  const escala = Math.hypot((cos * dx + sin * dy) / rx, (-sin * dx + cos * dy) / ry);
  return Math.max(1, escala) * Math.max(rx, ry) <= 16;
}

/** Lê somente a sintaxe geométrica aceita pelo pacote, em coordenadas relativas à caixa. */
export function lerCaminho(path: unknown): ComandoCaminho[] | null {
  if (typeof path !== 'string' || path.length > LIMITE_CAMINHO) return null;

  const comandos: ComandoCaminho[] = [];
  const numero = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  let repeticao: TipoComando | undefined;
  let temSegmento = false;
  let indice = pularEspacos(path, 0);
  let atual = { x: 0, y: 0 };
  let inicio = atual;

  while (indice < path.length) {
    const explicito = Object.hasOwn(ARIDADE, path[indice]);
    const tipo = explicito ? (path[indice++] as TipoComando) : repeticao;
    if (!tipo || (!comandos.length && tipo !== 'M') || comandos.length === LIMITE_COMANDOS) {
      return null;
    }

    const valores: number[] = [];
    for (let posicao = 0; posicao < ARIDADE[tipo]; posicao++) {
      indice = pularEspacos(path, indice);
      if ((posicao > 0 || !explicito) && path[indice] === ',') {
        indice = pularEspacos(path, indice + 1);
      }

      if (tipo === 'A' && (posicao === 3 || posicao === 4)) {
        const flag = path[indice++];
        if (flag !== '0' && flag !== '1') return null;
        valores.push(Number(flag));
        continue;
      }

      numero.lastIndex = indice;
      const trecho = numero.exec(path)?.[0];
      if (!trecho) return null;
      const valor = Number(trecho);
      const maximo = tipo === 'A' && posicao === 2 ? 360 : 4;
      const minimo = tipo === 'A' && posicao < 2 ? 0 : -maximo;
      if (!Number.isFinite(valor) || valor < minimo || valor > maximo) return null;
      valores.push(valor);
      indice = numero.lastIndex;
    }

    if (tipo === 'A' && !arcoLimitado(atual, valores)) return null;
    switch (tipo) {
      case 'H':
        atual = { x: valores[0], y: atual.y };
        break;
      case 'V':
        atual = { x: atual.x, y: valores[0] };
        break;
      case 'Z':
        atual = inicio;
        break;
      default:
        atual = { x: valores.at(-2)!, y: valores.at(-1)! };
    }
    if (tipo === 'M') inicio = atual;
    comandos.push({ tipo, valores });
    if (tipo !== 'M' && tipo !== 'Z') temSegmento = true;
    repeticao = tipo === 'Z' ? undefined : tipo === 'M' ? 'L' : tipo;
    indice = pularEspacos(path, indice);
  }

  return temSegmento ? comandos : null;
}

export function validarCaminho(path: unknown): path is string {
  return lerCaminho(path) !== null;
}

const PREENCHIMENTOS = new Set<unknown>(['none', 'solid', 'giz', 'marcador', 'aquarela']);
const CONTORNOS = new Set<unknown>([...PREENCHIMENTOS, 'dash', 'dot']);

function temSomenteChaves(valor: unknown, chaves: string[]): valor is Record<string, unknown> {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    Object.getPrototypeOf(valor) === Object.prototype &&
    Object.keys(valor).every((chave) => chaves.includes(chave))
  );
}

function nomeLimpo(valor: unknown, maximo: number, mensagem: string): string {
  if (typeof valor !== 'string' || /[\p{Cc}\u2028\u2029]/u.test(valor)) throw new Error(mensagem);
  const nome = valor.trim();
  if (!nome || nome.length > maximo) throw new Error(mensagem);
  return nome;
}

function validarEstilo(valor: unknown): EstiloFormaSalvo | undefined {
  if (valor === undefined) return undefined;
  const corHex = /^#[\da-f]{6}$/i;
  if (
    !temSomenteChaves(valor, ['cor1', 'cor2', 'espessura', 'contorno', 'preenchimento']) ||
    typeof valor.cor1 !== 'string' ||
    !corHex.test(valor.cor1) ||
    typeof valor.cor2 !== 'string' ||
    !corHex.test(valor.cor2) ||
    typeof valor.espessura !== 'number' ||
    !Number.isFinite(valor.espessura) ||
    valor.espessura < 1 ||
    valor.espessura > 100 ||
    !CONTORNOS.has(valor.contorno) ||
    !PREENCHIMENTOS.has(valor.preenchimento)
  ) {
    throw new Error('O estilo padrão da forma é inválido.');
  }
  return {
    cor1: valor.cor1.toLowerCase(),
    cor2: valor.cor2.toLowerCase(),
    espessura: valor.espessura,
    contorno: valor.contorno as EstiloContorno,
    preenchimento: valor.preenchimento as EstiloPreenchimento,
  };
}

export function validarDadosForma(
  dados: Record<string, unknown> | DadosFormaPropria,
): DadosFormaPropria {
  const nome = nomeLimpo(dados.nome, MAX_NOME_FORMA, 'Informe um nome de até 64 caracteres.');
  const pasta = nomeLimpo(
    dados.pasta === '' ? PASTA_PADRAO : dados.pasta,
    MAX_PASTA_FORMA,
    'Informe uma pasta de até 48 caracteres.',
  );
  if (!validarCaminho(dados.path) || typeof dados.fechada !== 'boolean') {
    throw new Error('O contorno da forma é inválido ou excede o limite.');
  }
  const estilo = validarEstilo(dados.estilo);
  const path = dados.path.trim().replace(/[ \t\n\r]+/g, ' ');
  return { nome, pasta, path, fechada: dados.fechada, ...(estilo && { estilo }) };
}

export function lerPacoteFormas(texto: string): FormaPortatil[] {
  if (
    texto.length > LIMITE_ARQUIVO_FORMAS ||
    new TextEncoder().encode(texto).length > LIMITE_ARQUIVO_FORMAS
  ) {
    throw new Error('O arquivo de formas excede o limite de 1 MiB.');
  }

  let pacote: unknown;
  try {
    pacote = JSON.parse(texto);
  } catch {
    throw new Error('O arquivo de formas não é um JSON válido.');
  }

  if (
    !temSomenteChaves(pacote, ['versao', 'formas']) ||
    pacote.versao !== 1 ||
    !Array.isArray(pacote.formas) ||
    pacote.formas.length > LIMITE_FORMAS
  ) {
    throw new Error('O pacote de formas tem formato, versão ou quantidade inválida.');
  }

  return pacote.formas.map((forma: unknown) => {
    if (
      !temSomenteChaves(forma, ['nome', 'pasta', 'path', 'fechada', 'favorita', 'estilo']) ||
      typeof forma.favorita !== 'boolean'
    ) {
      throw new Error('O pacote contém uma predefinição inválida.');
    }
    return { ...validarDadosForma(forma), favorita: forma.favorita };
  });
}

export function exportarFormas(formas: readonly FormaPropria[]): string {
  const porOrdem = [...formas].sort((primeira, segunda) => primeira.ordem - segunda.ordem);
  const portateis = porOrdem.map(
    (forma): FormaPortatil => ({
      ...validarDadosForma(forma),
      favorita: forma.favorita,
    }),
  );
  return JSON.stringify({ versao: 1, formas: portateis }, null, 2);
}
