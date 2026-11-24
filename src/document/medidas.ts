export type UnidadeMedida = 'px' | 'cm' | 'pol';

const CENTIMETROS_POR_POLEGADA = 2.54;

/** Mantém a precisão até a medida atingir a grade inteira de pixels do papel. */
export function converterMedida(
  valor: number,
  origem: UnidadeMedida,
  destino: UnidadeMedida,
  dpi: number,
): number {
  if (origem === destino) return valor;
  const porPolegada = { px: dpi, cm: CENTIMETROS_POR_POLEGADA, pol: 1 };
  return (valor / porPolegada[origem]) * porPolegada[destino];
}

export function pixelsDaMedida(valor: number, unidade: UnidadeMedida, dpi: number): number {
  return unidade === 'px' ? valor : Math.round(converterMedida(valor, unidade, 'px', dpi));
}
