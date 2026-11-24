import { describe, expect, it } from 'vitest';
import {
  decidirRecolhimento,
  LARGURA_RECOLHIDO,
} from '../../src/app/components/ribbonRecolhimento';
import { margemDoPincel } from '../../src/brushes/motor';

const grupos = [
  { chave: 'transferencia', prioridade: 5, largura: 150 },
  { chave: 'imagem', prioridade: 4, largura: 330 },
  { chave: 'ferramentas', prioridade: 6, largura: 140 },
  { chave: 'pinceis', prioridade: 3, largura: 100 },
  { chave: 'formas', prioridade: 2, largura: 250 },
  { chave: 'espessura', prioridade: 1, largura: 120 },
  { chave: 'cores', prioridade: Infinity, largura: 470 },
];
const total = grupos.reduce((soma, { largura }) => soma + largura, 0);

describe('recolhimento do ribbon', () => {
  it('não recolhe nada quando tudo cabe', () => {
    const { recolhidos, sobra } = decidirRecolhimento(grupos, total);
    expect([...recolhidos]).toEqual([]);
    expect(sobra).toBe(0);
  });

  it('recolhe pela prioridade, só o necessário', () => {
    const faltam = 120 - LARGURA_RECOLHIDO + 1;
    const { recolhidos } = decidirRecolhimento(grupos, total - faltam);
    expect([...recolhidos]).toEqual(['espessura', 'formas']);
  });

  it('nunca recolhe as cores e informa quanto ainda falta', () => {
    const { recolhidos, sobra } = decidirRecolhimento(grupos, 700);
    expect(recolhidos.has('cores')).toBe(false);
    expect(recolhidos.size).toBe(6);
    expect(sobra).toBe(700 - (6 * LARGURA_RECOLHIDO + 470));
  });

  it('não recolhe um grupo que já é mais estreito que o botão', () => {
    const { recolhidos } = decidirRecolhimento(
      [
        { chave: 'estreito', prioridade: 1, largura: 50 },
        { chave: 'largo', prioridade: 2, largura: 300 },
      ],
      200,
    );
    expect([...recolhidos]).toEqual(['largo']);
  });
});

describe('gotas do aerógrafo', () => {
  it('gotas médias aumentam a margem da área do traço, comandos antigos seguem iguais', () => {
    const base = { tipo: 'spray' as const, cor: '#000000', espessura: 24, semente: 1 };
    expect(margemDoPincel(base)).toBe(margemDoPincel({ ...base, gota: 1 }));
    expect(margemDoPincel({ ...base, gota: 2 })).toBe(margemDoPincel(base) + 1);
  });
});
