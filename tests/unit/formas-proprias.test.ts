import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import {
  lerCaminho,
  lerPacoteFormas,
  LIMITE_ARQUIVO_FORMAS,
  LIMITE_CAMINHO,
  PASTA_PADRAO,
  type DadosFormaPropria,
} from '../../src/shapes/presets';
import { database, loadDocument, type DocumentSnapshot } from '../../src/storage/documents';
import {
  atualizarForma,
  duplicarForma,
  excluirForma,
  exportarFormas,
  importarFormas,
  listarFormas,
  reordenarFormas,
  salvarForma,
} from '../../src/storage/formas';

const caminho = 'M0 0 L1 0 .5 .5 H0 V1 Q.5 0 1 1 C1 0 0 1 0 .5 A.5 .5 0 0 1 0 0 Z';
const dados: DadosFormaPropria = {
  nome: 'Contorno novo',
  pasta: PASTA_PADRAO,
  path: caminho,
  fechada: true,
  estilo: {
    cor1: '#112233',
    cor2: '#ffffff',
    espessura: 3,
    contorno: 'dash',
    preenchimento: 'giz',
  },
};
const pacote = (formas: unknown[]) => JSON.stringify({ versao: 1, formas });

describe('validação do pacote de formas', () => {
  it('lê contornos normalizados com curvas, arcos e pares implícitos', () => {
    const forma = { ...dados, favorita: true };
    expect(lerPacoteFormas(pacote([forma]))).toEqual([forma]);
    expect(lerCaminho(caminho)?.map(({ tipo }) => tipo)).toEqual([
      'M',
      'L',
      'L',
      'H',
      'V',
      'Q',
      'C',
      'A',
      'Z',
    ]);
  });

  it.each([
    ['tag de script', 'M0 0 L1 1 Z <script>alert(1)</script>'],
    ['atributo HTML', 'M0 0 L1 1" onpointerover="alert(1)'],
    ['comando excluído do esquema', 'M0 0 S.5 0 1 1'],
    ['comando relativo', 'M0 0 l1 1'],
    ['início sem M', 'L1 1 M0 0'],
    ['argumento ausente', 'M0 0 L1,'],
    ['vírgula antes de um comando', 'M0 0 L1 0, Z'],
    ['flag de arco inválida', 'M0 0 A.5 .5 0 0 2 1 1'],
    ['raio de arco negativo', 'M0 0 A-.5 .5 0 0 1 1 1'],
    ['raio de arco ampliado fora do limite', 'M0 0 A1e-300 4 0 0 1 1 1'],
    ['rotação de arco fora do limite', 'M0 0 A.5 .5 361 0 1 1 1'],
    ['valor não finito', 'M0 0 L1 1e400'],
    ['excesso de comandos', `M0 0 ${'L1 1 '.repeat(513)}`],
    ['excesso de caracteres', `M0 0 L1 1 ${' '.repeat(LIMITE_CAMINHO)}`],
  ])('rejeita um contorno com %s', (_motivo, path) => {
    expect(lerCaminho(path)).toBeNull();
    expect(() => lerPacoteFormas(pacote([{ ...dados, path, favorita: false }]))).toThrow(
      'contorno',
    );
  });

  it('rejeita campos extras, estilos impróprios, versões desconhecidas e excesso de bytes', () => {
    const forma = { ...dados, favorita: false };
    expect(() => lerPacoteFormas(pacote([{ ...forma, onclick: 'alert(1)' }]))).toThrow(
      'predefinição',
    );
    expect(() =>
      lerPacoteFormas(pacote([{ ...forma, estilo: { ...forma.estilo, cor1: 'url(x)' } }])),
    ).toThrow('estilo');
    expect(() => lerPacoteFormas('{"versao":2,"formas":[]}')).toThrow('versão');
    expect(() => lerPacoteFormas('é'.repeat(LIMITE_ARQUIVO_FORMAS / 2 + 1))).toThrow('1 MiB');
  });
});

describe('biblioteca local de formas próprias', () => {
  afterEach(async () => {
    await database.formas.clear();
    await database.documents.clear();
  });

  it('acrescenta as formas ao banco da 0.1 e mantém os pixels gravados sem DPI', async () => {
    await database.delete();
    const antigo = new Dexie(database.name);
    antigo.version(1).stores({ documents: 'id' });
    const documento: DocumentSnapshot = {
      id: 'current',
      name: 'Documento 0.1',
      width: 2,
      height: 1,
      pixels: new Uint8ClampedArray([10, 20, 30, 255, 50, 60, 70, 128]),
      updatedAt: 100,
    };
    await antigo.table('documents').put(documento);
    antigo.close();

    await database.open();
    const forma = await salvarForma(dados);
    database.close();
    await database.open();
    expect(await loadDocument()).toEqual(documento);
    expect(await listarFormas()).toEqual([forma]);
  });

  it('preserva a identidade na edição e a ordem manual dentro das favoritas', async () => {
    const primeira = await salvarForma(dados);
    const segunda = await duplicarForma(primeira.id);
    const terceira = await salvarForma({ ...dados, nome: 'Outra' });
    await atualizarForma(terceira.id, { favorita: true });
    await reordenarFormas([segunda.id, primeira.id]);
    await atualizarForma(segunda.id, { nome: 'Duplicada', pasta: 'Subpasta' });
    const editada = await salvarForma(
      { ...dados, nome: 'Editada', estilo: undefined },
      terceira.id,
    );

    const biblioteca = await listarFormas();
    expect(biblioteca.map(({ id }) => id)).toEqual([terceira.id, segunda.id, primeira.id]);
    expect(biblioteca.map(({ nome, pasta }) => [nome, pasta])).toEqual([
      ['Editada', PASTA_PADRAO],
      ['Duplicada', 'Subpasta'],
      [dados.nome, PASTA_PADRAO],
    ]);
    expect(editada).toEqual({ ...terceira, nome: 'Editada', favorita: true, estilo: undefined });
    expect(editada).not.toHaveProperty('estilo');
  });

  it('exporta e importa sem colisões e rejeita o pacote inteiro em caso de erro', async () => {
    const original = await salvarForma(dados);
    const favorito = await atualizarForma(original.id, { favorita: true });
    await expect(importarFormas(pacote([{ ...dados, favorita: true }, favorito]))).rejects.toThrow(
      'predefinição',
    );
    expect(await listarFormas()).toEqual([favorito]);

    const exportado = exportarFormas([favorito]);
    const [importada] = await importarFormas(exportado);
    expect(importada).toEqual({ ...favorito, id: expect.any(String), ordem: 1 });
    expect(importada.id).not.toBe(original.id);
    await excluirForma(original.id);
    expect(await listarFormas()).toEqual([importada]);
  });
});
