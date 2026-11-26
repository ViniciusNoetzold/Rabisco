import type { Point } from '../layers/types';

/** A vista do papel: girada (graus) e/ou espelhada. Só a tela muda; a imagem não. */
export interface Vista {
  rotacao: number;
  espelhar: boolean;
}

export const VISTA_NORMAL: Vista = { rotacao: 0, espelhar: false };

/** Ângulo em −180…180, sem "−0". */
export function normalizarAngulo(graus: number): number {
  let a = ((((graus + 180) % 360) + 360) % 360) - 180;
  if (Object.is(a, -0) || a === -180) a = a === -180 ? 180 : 0;
  return Math.round(a * 10) / 10;
}

export function vistaNormal({ rotacao, espelhar }: Vista): boolean {
  return normalizarAngulo(rotacao) === 0 && !espelhar;
}

/** O CSS da vista, em torno do centro do papel: primeiro espelha, depois gira. */
export function transformacaoCss({ rotacao, espelhar }: Vista): string | undefined {
  const partes = [];
  if (rotacao) partes.push(`rotate(${rotacao}deg)`);
  if (espelhar) partes.push('scaleX(-1)');
  return partes.length ? partes.join(' ') : undefined;
}

/** Largura e altura (px de tela) que o papel girado ocupa. */
export function caixaGirada(largura: number, altura: number, graus: number) {
  const angulo = (graus * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angulo));
  const sen = Math.abs(Math.sin(angulo));
  return { width: largura * cos + altura * sen, height: largura * sen + altura * cos };
}

/**
 * Ponto da tela (clientX/Y) para o papel. `caixa` é o retângulo na tela de um elemento do
 * tamanho do papel dentro do palco (o navegador devolve a caixa já girada; o centro é o mesmo).
 */
export function telaParaPapel(
  cliente: Point,
  caixa: { left: number; top: number; width: number; height: number },
  largura: number,
  altura: number,
  zoom: number,
  vista: Vista,
): Point {
  const dx = cliente.x - (caixa.left + caixa.width / 2);
  const dy = cliente.y - (caixa.top + caixa.height / 2);
  const angulo = (-vista.rotacao * Math.PI) / 180;
  let x = dx * Math.cos(angulo) - dy * Math.sin(angulo);
  const y = dx * Math.sin(angulo) + dy * Math.cos(angulo);
  if (vista.espelhar) x = -x;
  return { x: x / zoom + largura / 2, y: y / zoom + altura / 2 };
}

/** O inverso: onde um ponto do papel aparece na tela. */
export function papelParaTela(
  ponto: Point,
  caixa: { left: number; top: number; width: number; height: number },
  largura: number,
  altura: number,
  zoom: number,
  vista: Vista,
): Point {
  let x = (ponto.x - largura / 2) * zoom;
  const y = (ponto.y - altura / 2) * zoom;
  if (vista.espelhar) x = -x;
  const angulo = (vista.rotacao * Math.PI) / 180;
  return {
    x: caixa.left + caixa.width / 2 + x * Math.cos(angulo) - y * Math.sin(angulo),
    y: caixa.top + caixa.height / 2 + x * Math.sin(angulo) + y * Math.cos(angulo),
  };
}

/** Converte um vetor de arraste da tela para o papel (para alças que somam deslocamentos). */
export function deslocamentoNoPapel(delta: Point, zoom: number, vista: Vista): Point {
  const angulo = (-vista.rotacao * Math.PI) / 180;
  let x = delta.x * Math.cos(angulo) - delta.y * Math.sin(angulo);
  const y = delta.x * Math.sin(angulo) + delta.y * Math.cos(angulo);
  if (vista.espelhar) x = -x;
  return { x: x / zoom, y: y / zoom };
}

/** A tecla R segurada (girar a vista arrastando) e se chegou a girar enquanto segurava. */
export const teclaDeGiro = { segurando: false, girou: false };
