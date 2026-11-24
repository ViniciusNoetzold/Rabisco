import { validarDimensoes } from '../document/dimensoes';
import type { PixelBuffer } from '../layers/types';

class GravadorGif {
  private readonly partes: Uint8Array<ArrayBuffer>[] = [];
  private atual = new Uint8Array(16 * 1024);
  private posicao = 0;

  byte(valor: number): void {
    if (this.posicao === this.atual.length) {
      this.partes.push(this.atual);
      this.atual = new Uint8Array(this.atual.length);
      this.posicao = 0;
    }
    this.atual[this.posicao++] = valor;
  }

  palavra(valor: number): void {
    this.byte(valor & 255);
    this.byte(valor >>> 8);
  }

  bloco(bytes: Iterable<number>): void {
    for (const valor of bytes) this.byte(valor);
  }

  finalizar(): Blob {
    return new Blob([...this.partes, this.atual.subarray(0, this.posicao)], { type: 'image/gif' });
  }
}

interface PaletaGif {
  cores: number[];
  transparente: number | undefined;
  indice: (posicao: number) => number;
}

function criarPaleta(pixels: Uint8ClampedArray): PaletaGif {
  let transparencia = false;
  let exata = true;
  const cores: number[] = [];
  const indices = new Map<number, number>();
  const corEm = (i: number) => (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) {
      transparencia = true;
    } else if (exata) {
      const cor = corEm(i);
      if (!indices.has(cor)) {
        indices.set(cor, cores.length);
        cores.push(cor);
      }
    }
    if (cores.length + Number(transparencia) > 256) exata = false;
    if (!exata && transparencia) break;
  }

  if (exata) {
    const transparente = transparencia ? cores.push(0) - 1 : undefined;
    return {
      cores,
      transparente,
      indice: (i) => (pixels[i + 3] < 128 ? transparente! : indices.get(corEm(i))!),
    };
  }

  // A grade de 252 cores deixa espaço para transparência e conserva os extremos RGB.
  cores.length = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 7; g++) {
      for (let b = 0; b < 6; b++) {
        cores.push(
          (Math.round((r * 255) / 5) << 16) |
            (Math.round((g * 255) / 6) << 8) |
            Math.round((b * 255) / 5),
        );
      }
    }
  }
  const transparente = transparencia ? cores.push(0) - 1 : undefined;
  const niveis6 = Array.from({ length: 256 }, (_, i) => Math.round((i * 5) / 255));
  const niveis7 = Array.from({ length: 256 }, (_, i) => Math.round((i * 6) / 255));
  return {
    cores,
    transparente,
    indice: (i) =>
      pixels[i + 3] < 128
        ? transparente!
        : (niveis6[pixels[i]] * 7 + niveis7[pixels[i + 1]]) * 6 + niveis6[pixels[i + 2]],
  };
}

function escreverLzw(
  saida: GravadorGif,
  paleta: PaletaGif,
  bytes: number,
  bitsPorCor: number,
): void {
  const limpar = 1 << bitsPorCor;
  const fim = limpar + 1;
  let livre = fim + 1;
  let largura = bitsPorCor + 1;
  let acumulado = 0;
  let bits = 0;
  const dicionario = new Map<number, number>();
  const bloco = new Uint8Array(255);
  let pendentes = 0;

  const enviarBloco = () => {
    if (pendentes === 0) return;
    saida.byte(pendentes);
    saida.bloco(bloco.subarray(0, pendentes));
    pendentes = 0;
  };
  const enviarByte = (valor: number) => {
    bloco[pendentes++] = valor;
    if (pendentes === 255) enviarBloco();
  };
  const enviarCodigo = (codigo: number) => {
    acumulado |= codigo << bits;
    bits += largura;
    while (bits >= 8) {
      enviarByte(acumulado & 255);
      acumulado >>>= 8;
      bits -= 8;
    }
    // O leitor conhece o novo código ao receber o índice seguinte.
    if (livre === 1 << largura && largura < 12) largura++;
  };

  enviarCodigo(limpar);
  let prefixo = paleta.indice(0);
  for (let i = 4; i < bytes; i += 4) {
    const indice = paleta.indice(i);
    const chave = (prefixo << 8) | indice;
    const existente = dicionario.get(chave);
    if (existente !== undefined) {
      prefixo = existente;
      continue;
    }
    enviarCodigo(prefixo);
    prefixo = indice;
    if (livre < 4096) {
      dicionario.set(chave, livre++);
    } else {
      enviarCodigo(limpar);
      dicionario.clear();
      livre = fim + 1;
      largura = bitsPorCor + 1;
    }
  }
  enviarCodigo(prefixo);
  enviarCodigo(fim);
  if (bits > 0) enviarByte(acumulado);
  enviarBloco();
  saida.byte(0);
}

export function codificarGif({ width, height, data }: PixelBuffer): Blob {
  validarDimensoes(width, height);
  if (data.length !== width * height * 4) throw new Error('Os pixels deste GIF estão incompletos.');

  const paleta = criarPaleta(data);
  const bits = Math.max(1, Math.ceil(Math.log2(paleta.cores.length)));
  const minimoLzw = Math.max(2, bits);
  const saida = new GravadorGif();
  saida.bloco([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  saida.palavra(width);
  saida.palavra(height);
  saida.bloco([0x80 | 0x70 | (bits - 1), paleta.transparente ?? 0, 0]);
  for (let i = 0; i < 1 << bits; i++) {
    const cor = paleta.cores[i] ?? 0;
    saida.bloco([cor >>> 16, (cor >>> 8) & 255, cor & 255]);
  }
  if (paleta.transparente !== undefined) {
    saida.bloco([0x21, 0xf9, 4, 1, 0, 0, paleta.transparente, 0]);
  }
  saida.bloco([0x2c, 0, 0, 0, 0]);
  saida.palavra(width);
  saida.palavra(height);
  saida.bloco([0, minimoLzw]);
  escreverLzw(saida, paleta, data.length, minimoLzw);
  saida.byte(0x3b);
  return saida.finalizar();
}
