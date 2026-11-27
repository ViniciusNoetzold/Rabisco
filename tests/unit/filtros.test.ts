import { describe, expect, it, vi } from 'vitest';
import type { ComandoAplicarFiltro } from '../../src/commands/comandos';
import { Executador } from '../../src/commands/executador';
import { processarFiltro } from '../../src/filtros/processar';
import { FILTROS, obterFiltro } from '../../src/filtros/registro';
import { documentoFalso } from './documentoFalso';

const INVERTER: ComandoAplicarFiltro = {
  tipo: 'AplicarFiltro',
  filtro: 'inverter',
  parametros: {},
  semente: 19,
};

function faixa(...pixels: number[][]) {
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

describe('filtros', () => {
  it('registra Inverter cores e preserva os pixels de origem e o alfa', () => {
    const filtro = obterFiltro('inverter');
    expect(FILTROS).toContain(filtro);
    expect(filtro).toMatchObject({
      nome: 'Inverter cores',
      categoria: 'Cor',
      parametros: {},
      porBlocos: true,
    });
    const antes = faixa([16, 32, 48, 255], [61, 111, 7, 128], [0, 0, 0, 0]);
    const depois = filtro.aplicar(antes, {}, INVERTER.semente);
    expect(depois).toEqual(faixa([239, 223, 207, 255], [194, 144, 248, 128], [0, 0, 0, 0]));
    expect(antes).toEqual(faixa([16, 32, 48, 255], [61, 111, 7, 128], [0, 0, 0, 0]));
  });

  it('mantém a parte de fora da seleção e mistura a borda sem mudar o alfa bloqueado', () => {
    const antes = faixa([16, 32, 48, 128], [16, 32, 48, 128], [16, 32, 48, 128]);
    const cobertura = new Uint8ClampedArray([255, 128, 0]);
    const { depois } = processarFiltro(antes, INVERTER, cobertura, true);
    expect(depois).toEqual(faixa([239, 223, 207, 128], [128, 128, 128, 128], [16, 32, 48, 128]));
  });

  it('bloqueia mudanças de alfa e de pixels invisíveis quando o filtro altera a transparência', () => {
    const antes = faixa([16, 32, 48, 128], [0, 0, 0, 0]);
    const aplicar = vi
      .spyOn(obterFiltro('inverter'), 'aplicar')
      .mockReturnValue(faixa([239, 223, 207, 255], [255, 255, 255, 255]));
    try {
      expect(processarFiltro(antes, INVERTER, undefined, true).depois).toEqual(
        faixa([239, 223, 207, 128], [0, 0, 0, 0]),
      );
    } finally {
      aplicar.mockRestore();
    }
  });

  it('executa o comando JSON na seleção em uma única alteração reversível', () => {
    const antes = faixa([16, 32, 48, 255], [61, 111, 7, 128], [0, 0, 0, 0]);
    const doc = documentoFalso(antes);
    doc.activeLayer.bloqueioTransparencia = true;
    const editor = new Executador(doc);
    const comando = { ...INVERTER, area: { x: 1, y: 0, width: 2, height: 1 } };

    expect(editor.executar(JSON.parse(JSON.stringify(comando)))).toBe(true);
    expect(doc.raster).toEqual(faixa([16, 32, 48, 255], [194, 144, 248, 128], [0, 0, 0, 0]));
    expect(editor.historico.entries).toEqual([{ label: 'Inverter cores' }]);
    expect(editor.ultimaAlteracao).toEqual(comando.area);
    expect(doc.lerPixels.mock.calls).toEqual([[comando.area, doc.alvoAtivo()]]);
    expect(editor.desfazer()).toBe(true);
    expect(doc.raster).toEqual(antes);
    expect(editor.refazer()).toBe(true);
    expect(doc.raster).toEqual(faixa([16, 32, 48, 255], [194, 144, 248, 128], [0, 0, 0, 0]));
  });

  it('reaproveita o recorte pronto e registra a máscara quando ela é o alvo ativo', () => {
    const doc = documentoFalso(faixa([0, 0, 0, 255]));
    const alvo = { camada: doc.activeLayerId, mascara: true };
    vi.spyOn(doc, 'alvoAtivo').mockReturnValue(alvo);
    doc.activeLayer.bloqueioTransparencia = true;
    const editor = new Executador(doc);
    const preparo = editor.prepararFiltro(INVERTER)!;
    expect(preparo.alvo).toEqual(alvo);
    expect(preparo.travarAlfa).toBe(false);

    const { depois } = processarFiltro(
      preparo.antes,
      INVERTER,
      preparo.cobertura,
      preparo.travarAlfa,
    );
    editor.receberFiltroCalculado(INVERTER, preparo, depois);
    expect(editor.executar(INVERTER)).toBe(true);
    expect(doc.lerPixels).toHaveBeenCalledTimes(1);
    expect(doc.aplicarPixels).toHaveBeenCalledWith(depois, 0, 0, alvo);
    expect(editor.historico.desfazer()?.alteracoes[0].alvo).toEqual(alvo);
  });

  it('lê a margem do desfoque sem gravar os pixels vizinhos', () => {
    const vermelho = [255, 0, 0, 255];
    const original = faixa(vermelho, [0, 0, 0, 0], vermelho);
    const doc = documentoFalso(original);
    const editor = new Executador(doc);
    const area = { x: 1, y: 0, width: 1, height: 1 };
    expect(
      editor.executar({
        tipo: 'AplicarFiltro',
        filtro: 'desfoque-gaussiano',
        parametros: { raio: 2 },
        semente: 0,
        area,
      }),
    ).toBe(true);
    expect(Array.from(doc.raster.data.subarray(0, 7))).toEqual([...vermelho, 255, 0, 0]);
    expect(doc.raster.data[7]).toBeGreaterThan(0);
    expect(Array.from(doc.raster.data.subarray(8))).toEqual(vermelho);
    expect(editor.ultimaAlteracao).toEqual(area);
    expect(editor.desfazer()).toBe(true);
    expect(doc.raster).toEqual(original);
  });

  it('recusa o filtro em camadas bloqueadas e ocultas sem ler os pixels', () => {
    const doc = documentoFalso(faixa([1, 2, 3, 255]));
    const editor = new Executador(doc);
    doc.activeLayer.locked = true;
    expect(editor.prepararFiltro(INVERTER)).toBeNull();
    expect(editor.motivoRecusa).toBe('bloqueada');

    doc.activeLayer.locked = false;
    doc.activeLayer.visible = false;
    expect(editor.executar(INVERTER)).toBe(false);
    expect(editor.motivoRecusa).toBe('oculta');
    expect(doc.lerPixels).not.toHaveBeenCalled();
    expect(editor.historico.entries).toEqual([]);
  });
});
