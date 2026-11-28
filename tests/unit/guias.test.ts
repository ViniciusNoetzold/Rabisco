import { describe, expect, it } from 'vitest';
import {
  comGuia,
  distanciaDaRegua,
  encaixarNasGuias,
  guiasSeguras,
  prenderAnguloDaRegua,
  projetarNaRegua,
  semGuia,
  SEM_GUIAS,
} from '../../src/document/guias';
import { lerCabecalhoRabisco, VERSAO_RABISCO } from '../../src/io/camadas';

const regua = { a: { x: 100, y: 100 }, b: { x: 300, y: 100 } };

describe('régua de desenho', () => {
  it('projeta o ponto na borda da régua, preso entre as pontas', () => {
    expect(projetarNaRegua({ x: 150, y: 120 }, regua)).toEqual({ x: 150, y: 100 });
    expect(projetarNaRegua({ x: 50, y: 90 }, regua)).toEqual({ x: 100, y: 100 });
    expect(projetarNaRegua({ x: 400, y: 80 }, regua)).toEqual({ x: 300, y: 100 });
    // A pressão do ponto passa adiante.
    expect(projetarNaRegua({ x: 200, y: 95, pressure: 0.4 }, regua).pressure).toBe(0.4);
    expect(distanciaDaRegua({ x: 200, y: 130 }, regua)).toBe(30);
  });

  it('régua inclinada: o ponto cai na reta a 45°', () => {
    const inclinada = { a: { x: 0, y: 0 }, b: { x: 100, y: 100 } };
    const p = projetarNaRegua({ x: 60, y: 40 }, inclinada);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(50);
  });

  it('Shift prende o ângulo em passos de 15°', () => {
    const p = prenderAnguloDaRegua({ x: 0, y: 0 }, { x: 100, y: 8 });
    expect(p.x).toBeCloseTo(Math.hypot(100, 8));
    expect(p.y).toBeCloseTo(0);
    const q = prenderAnguloDaRegua({ x: 0, y: 0 }, { x: 100, y: 95 });
    expect(Math.atan2(q.y, q.x)).toBeCloseTo(Math.PI / 4);
  });
});

describe('guias do papel', () => {
  const guias = { horizontais: [100, 300], verticais: [50], regua: null };

  it('encaixa x e y na guia mais perto dentro do raio', () => {
    expect(encaixarNasGuias({ x: 54, y: 297 }, guias, 6)).toEqual({ x: 50, y: 300 });
    expect(encaixarNasGuias({ x: 70, y: 200 }, guias, 6)).toEqual({ x: 70, y: 200 });
    const fora = { x: 70, y: 200 };
    expect(encaixarNasGuias(fora, guias, 6)).toBe(fora);
  });

  it('acrescenta sem repetir e remove', () => {
    const mais = comGuia(guias, 'horizontal', 199.6);
    expect(mais.horizontais).toEqual([100, 200, 300]);
    expect(comGuia(mais, 'horizontal', 200)).toBe(mais);
    expect(semGuia(mais, 'horizontal', 100).horizontais).toEqual([200, 300]);
    expect(comGuia(SEM_GUIAS, 'vertical', 10).verticais).toEqual([10]);
  });

  it('dados de fora são limpos: números inválidos, fora do papel, repetidos', () => {
    expect(
      guiasSeguras(
        {
          horizontais: [10, 10, -5, 'x', 900, Number.NaN, 20.4],
          verticais: null,
          regua: { a: { x: 0, y: 0 }, b: { x: 1e9, y: 'y' } },
        },
        800,
        600,
      ),
    ).toEqual({ horizontais: [10, 20], verticais: [], regua: null });
    expect(guiasSeguras('lixo', 800, 600)).toEqual(SEM_GUIAS);
    const longe = guiasSeguras({ regua: { a: { x: 0, y: 0 }, b: { x: 1e9, y: 10 } } }, 800, 600);
    expect(longe.regua?.b.x).toBe(1600);
  });
});

describe('cabeçalho do .rabisco', () => {
  const base = { formato: 'rabisco', largura: 800, altura: 600, dpi: 96, nome: 'Teste' };

  it('lê a v1 (0.3) sem guias', () => {
    const cabecalho = lerCabecalhoRabisco({ ...base, versao: 1 }, 'a.rabisco');
    expect(cabecalho).toMatchObject({ versao: 1, largura: 800, altura: 600, nome: 'Teste' });
    expect(cabecalho.guias).toEqual(SEM_GUIAS);
  });

  it('lê a v2 com guias e régua', () => {
    const guias = { horizontais: [100], verticais: [400], regua };
    const cabecalho = lerCabecalhoRabisco({ ...base, versao: 2, guias }, 'a.rabisco');
    expect(cabecalho.guias).toEqual(guias);
    expect(VERSAO_RABISCO).toBe(4);
  });

  it('recusa versão mais nova, formato errado e tamanho inválido', () => {
    expect(() => lerCabecalhoRabisco({ ...base, versao: VERSAO_RABISCO + 1 }, 'a')).toThrow(
      'mais nova',
    );
    expect(() => lerCabecalhoRabisco({ ...base, versao: 2, formato: 'ora' }, 'a')).toThrow(
      'não é um .rabisco',
    );
    expect(() => lerCabecalhoRabisco({ ...base, versao: 2, largura: 0 }, 'a')).toThrow('dimensões');
  });
});
