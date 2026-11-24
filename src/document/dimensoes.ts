export const LIMITE_LADO = 8192;
export const LIMITE_PIXELS = 40_000_000;
export const DPI_PADRAO = 96;
export const DPI_MAXIMO = 9600;
export const MENSAGEM_DIMENSOES = 'Use dimensões de 1 a 8192 px e no máximo 40 milhões de pixels.';

export function dimensoesValidas(largura: number, altura: number): boolean {
  return (
    Number.isInteger(largura) &&
    Number.isInteger(altura) &&
    largura >= 1 &&
    altura >= 1 &&
    largura <= LIMITE_LADO &&
    altura <= LIMITE_LADO &&
    largura * altura <= LIMITE_PIXELS
  );
}

export function validarDimensoes(largura: number, altura: number): void {
  if (!dimensoesValidas(largura, altura)) throw new Error(MENSAGEM_DIMENSOES);
}

export function dpiValido(dpi: number): boolean {
  return Number.isInteger(dpi) && dpi >= 1 && dpi <= DPI_MAXIMO;
}
