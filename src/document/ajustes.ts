import { luminancia, normalizarPontosCurva } from '../filtros/cores';
import { obterFiltro, type ParametrosFiltro } from '../filtros/registro';
import type { PixelBuffer } from '../layers/types';

export const FILTROS_AJUSTE = [
  'brilho-contraste',
  'matiz-saturacao',
  'curvas',
  'preto-e-branco',
] as const;
export type IdAjuste = (typeof FILTROS_AJUSTE)[number];

export interface AjusteCamada {
  filtro: IdAjuste;
  parametros: ParametrosFiltro;
}

function objeto(valor: unknown): Record<string, unknown> {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {};
}

function filtroDeAjuste(valor: unknown): valor is IdAjuste {
  return FILTROS_AJUSTE.some((filtro) => filtro === valor);
}

/** Usa só os filtros locais esperados e os parâmetros declarados no registro. */
export function ajusteSeguro(valor: unknown): AjusteCamada | undefined {
  const { filtro, parametros } = objeto(valor);
  if (!filtroDeAjuste(filtro)) return undefined;
  const dados = objeto(parametros);
  return {
    filtro,
    parametros: Object.fromEntries(
      Object.entries(obterFiltro(filtro).parametros).map(([id, campo]) => {
        const atual = dados[id];
        if (campo.tipo === 'curva') return [id, normalizarPontosCurva(atual ?? campo.padrao)];
        if (campo.tipo === 'numero' && typeof atual === 'number' && Number.isFinite(atual))
          return [id, Math.max(campo.minimo, Math.min(campo.maximo, atual))];
        return [id, campo.padrao];
      }),
    ),
  };
}

export function ajustePadrao(filtro: IdAjuste): AjusteCamada {
  return ajusteSeguro({ filtro })!;
}

/** A máscara e a opacidade regulam quanto o RGB muda. O alfa de baixo é preservado. */
export function comporAjuste(
  abaixo: PixelBuffer,
  ajuste: AjusteCamada,
  opacidade: number,
  mascara?: PixelBuffer,
): PixelBuffer {
  if (opacidade <= 0) return abaixo;
  const filtrado = obterFiltro(ajuste.filtro).aplicar(abaixo, ajuste.parametros, 0);
  if (filtrado === abaixo || (opacidade === 1 && !mascara)) return filtrado;

  const original = abaixo.data;
  const resultado = filtrado.data;
  const cinza = mascara?.data;
  for (let i = 0; i < original.length; i += 4) {
    if (!original[i + 3]) continue;
    const cobertura = cinza ? luminancia(cinza[i], cinza[i + 1], cinza[i + 2]) / 255 : 1;
    const peso = cobertura * opacidade;
    resultado[i] = original[i] + (resultado[i] - original[i]) * peso;
    resultado[i + 1] = original[i + 1] + (resultado[i + 1] - original[i + 1]) * peso;
    resultado[i + 2] = original[i + 2] + (resultado[i + 2] - original[i + 2]) * peso;
  }
  return filtrado;
}

export function exportacaoComAjusteAchatado(
  formato: string,
  camadas: readonly { ajuste?: AjusteCamada }[],
): boolean {
  return (
    (formato === 'psd' || formato === 'ora' || formato === 'camadas-png') &&
    camadas.some(({ ajuste }) => Boolean(ajuste))
  );
}
