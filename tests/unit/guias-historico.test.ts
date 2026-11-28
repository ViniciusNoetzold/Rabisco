import { describe, expect, it, vi } from 'vitest';
import { serializarImagem, type ComandoGuia } from '../../src/commands/comandos';
import { Executador } from '../../src/commands/executador';
import { SEM_GUIAS, type GuiasDocumento } from '../../src/document/guias';
import { documentoFalso, papelBranco } from './documentoFalso';

function editorComGuias() {
  const doc = documentoFalso(papelBranco(80, 60));
  let atuais: GuiasDocumento = structuredClone(SEM_GUIAS);
  const editor = new Executador(doc, {
    ler: () => atuais,
    aplicar: (posicoes) => {
      atuais = { ...atuais, ...posicoes };
    },
  });
  return {
    doc,
    editor,
    get atuais() {
      return atuais;
    },
  };
}

describe('histórico de guias', () => {
  it('registra comandos JSON e refaz/desfaz as posições sem ler o raster', () => {
    const cenario = editorComGuias();
    const { editor, doc } = cenario;
    const registrar = vi.spyOn(editor.historico, 'registrarComando');
    const comandos: ComandoGuia[] = [
      { tipo: 'AdicionarGuia', eixo: 'horizontal', valor: 12 },
      { tipo: 'MoverGuia', eixo: 'horizontal', origem: 12, destino: 25 },
      { tipo: 'AdicionarGuia', eixo: 'vertical', valor: 20 },
      { tipo: 'RemoverGuia', eixo: 'horizontal', valor: 25 },
      { tipo: 'LimparGuias' },
    ];
    for (const comando of comandos)
      expect(editor.executar(JSON.parse(JSON.stringify(comando)))).toBe(true);
    expect(registrar.mock.calls.map(([entrada]) => entrada.comando)).toEqual(comandos);
    expect(editor.historico.entries.map(({ label }) => label)).toEqual([
      'Adicionar guia',
      'Mover guia',
      'Adicionar guia',
      'Remover guia',
      'Limpar guias',
    ]);
    expect(cenario.atuais).toEqual(SEM_GUIAS);
    expect(editor.desfazer()).toBe(true);
    expect(cenario.atuais.verticais).toEqual([20]);
    expect(editor.desfazer()).toBe(true);
    expect(cenario.atuais.horizontais).toEqual([25]);
    expect(editor.refazer()).toBe(true);
    expect(cenario.atuais.horizontais).toEqual([]);
    expect(editor.refazer()).toBe(true);
    expect(cenario.atuais).toEqual(SEM_GUIAS);
    expect(doc.lerPixels).not.toHaveBeenCalled();
    expect(doc.aplicarPixels).not.toHaveBeenCalled();
  });

  it('mantém a posição atual da régua de desenho e ignora operações sem efeito', () => {
    const cenario = editorComGuias();
    const { editor } = cenario;
    expect(editor.executar({ tipo: 'AdicionarGuia', eixo: 'vertical', valor: 11 })).toBe(true);
    expect(editor.executar({ tipo: 'AdicionarGuia', eixo: 'vertical', valor: 11 })).toBe(false);
    expect(editor.executar({ tipo: 'AdicionarGuia', eixo: 'horizontal', valor: 61 })).toBe(false);
    expect(
      editor.executar({ tipo: 'MoverGuia', eixo: 'vertical', origem: 11, destino: 11.2 }),
    ).toBe(false);
    expect(editor.executar({ tipo: 'RemoverGuia', eixo: 'vertical', valor: 13 })).toBe(false);
    const regua = { a: { x: 3, y: 5 }, b: { x: 30, y: 5 } };
    cenario.atuais.regua = regua;
    expect(editor.historico.entries).toHaveLength(1);
    editor.desfazer();
    expect(cenario.atuais).toEqual({ ...SEM_GUIAS, regua });
    editor.refazer();
    expect(cenario.atuais).toEqual({ ...SEM_GUIAS, verticais: [11], regua });
  });

  it('recupera as guias anteriores ao desfazer a abertura de uma imagem comum', () => {
    const cenario = editorComGuias();
    const { editor } = cenario;
    editor.executar({ tipo: 'AdicionarGuia', eixo: 'vertical', valor: 11 });
    expect(
      editor.executar({
        tipo: 'AbrirImagem',
        nome: 'Outra imagem',
        imagem: serializarImagem(papelBranco(16, 16)),
      }),
    ).toBe(true);
    expect(cenario.atuais.verticais).toEqual([]);
    expect(editor.historico.entries.map(({ label }) => label)).toEqual([
      'Adicionar guia',
      'Abrir PNG',
    ]);
    editor.desfazer();
    expect(cenario.atuais.verticais).toEqual([11]);
    editor.refazer();
    expect(cenario.atuais.verticais).toEqual([]);
  });
});
