import { describe, expect, it } from 'vitest';
import { converterMedida, pixelsDaMedida } from '../../src/document/medidas';

describe('medidas do papel', () => {
  it('converte polegadas e centímetros pela resolução escolhida', () => {
    expect(converterMedida(2, 'pol', 'px', 96)).toBe(192);
    expect(converterMedida(192, 'px', 'cm', 96)).toBeCloseTo(5.08);
    expect(converterMedida(5.08, 'cm', 'px', 300)).toBeCloseTo(600);
  });

  it('arredonda medidas físicas para a grade e preserva valores inválidos de pixels para validação', () => {
    expect(pixelsDaMedida(1, 'cm', 96)).toBe(38);
    expect(pixelsDaMedida(0.125, 'pol', 96)).toBe(12);
    expect(pixelsDaMedida(18.25, 'px', 96)).toBe(18.25);
  });

  it('mantém o tamanho ao percorrer todas as unidades na mesma resolução', () => {
    const cm = converterMedida(4096, 'px', 'cm', 9600);
    const polegadas = converterMedida(cm, 'cm', 'pol', 9600);
    expect(pixelsDaMedida(polegadas, 'pol', 9600)).toBe(4096);
  });
});
