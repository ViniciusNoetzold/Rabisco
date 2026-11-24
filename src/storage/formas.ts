import {
  lerPacoteFormas,
  LIMITE_FORMAS,
  MAX_NOME_FORMA,
  validarDadosForma,
  type DadosFormaPropria,
  type FormaPropria,
} from '../shapes/presets';
import { database } from './documents';

export { exportarFormas } from '../shapes/presets';

function criarId(): string {
  const partes = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(partes, (parte) => parte.toString(16).padStart(8, '0')).join('');
}

function compararOrdem(primeira: FormaPropria, segunda: FormaPropria): number {
  return primeira.ordem - segunda.ordem || primeira.id.localeCompare(segunda.id);
}

export async function listarFormas(): Promise<FormaPropria[]> {
  const formas = await database.formas.toArray();
  return formas.sort((primeira, segunda) => {
    return Number(segunda.favorita) - Number(primeira.favorita) || compararOrdem(primeira, segunda);
  });
}

async function obterForma(id: string): Promise<FormaPropria> {
  const forma = await database.formas.get(id);
  if (!forma) throw new Error('A forma já foi removida da biblioteca.');
  return forma;
}

/** Reserva posições no fim da biblioteca dentro da mesma transação de inserção. */
async function proximaOrdem(quantidade: number): Promise<number> {
  const atuais = await database.formas.toArray();
  if (atuais.length + quantidade > LIMITE_FORMAS) {
    throw new Error(`A biblioteca comporta até ${LIMITE_FORMAS} formas.`);
  }
  return atuais.reduce((maior, forma) => Math.max(maior, forma.ordem), -1) + 1;
}

export async function salvarForma(dados: DadosFormaPropria, id?: string): Promise<FormaPropria> {
  const validada = validarDadosForma(dados);
  return database.transaction('rw', database.formas, async () => {
    if (id !== undefined) {
      const { favorita, ordem } = await obterForma(id);
      const forma = { ...validada, id, favorita, ordem };
      await database.formas.put(forma);
      return forma;
    }

    const forma = { ...validada, id: criarId(), favorita: false, ordem: await proximaOrdem(1) };
    await database.formas.add(forma);
    return forma;
  });
}

export async function atualizarForma(
  id: string,
  alteracoes: Partial<Pick<FormaPropria, 'nome' | 'pasta' | 'favorita'>>,
): Promise<FormaPropria> {
  return database.transaction('rw', database.formas, async () => {
    const atual = await obterForma(id);
    const dados = validarDadosForma({
      ...atual,
      nome: alteracoes.nome ?? atual.nome,
      pasta: alteracoes.pasta ?? atual.pasta,
    });
    const forma = { ...atual, ...dados, favorita: alteracoes.favorita ?? atual.favorita };
    await database.formas.put(forma);
    return forma;
  });
}

export async function duplicarForma(id: string): Promise<FormaPropria> {
  return database.transaction('rw', database.formas, async () => {
    const origem = await obterForma(id);
    const sufixo = ' (cópia)';
    const nome = origem.nome.slice(0, MAX_NOME_FORMA - sufixo.length).trimEnd() + sufixo;
    const forma = { ...origem, nome, id: criarId(), favorita: false, ordem: await proximaOrdem(1) };
    await database.formas.add(forma);
    return forma;
  });
}

export async function excluirForma(id: string): Promise<void> {
  await database.formas.delete(id);
}

/** Mantém as posições das formas que a lista atual não inclui. */
export async function reordenarFormas(ids: readonly string[]): Promise<void> {
  await database.transaction('rw', database.formas, async () => {
    const atuais = await database.formas.toArray();
    const porId = new Map(atuais.map((forma) => [forma.id, forma]));
    const ordenadas = [...new Set(ids)].flatMap((id) => {
      const forma = porId.get(id);
      return forma ? [forma] : [];
    });
    const posicoes = [...ordenadas].sort(compararOrdem).map((forma) => forma.ordem);
    const alteradas = ordenadas.flatMap((forma, indice) => {
      const ordem = posicoes[indice];
      return forma.ordem === ordem ? [] : [{ ...forma, ordem }];
    });
    if (alteradas.length) await database.formas.bulkPut(alteradas);
  });
}

export async function importarFormas(texto: string): Promise<FormaPropria[]> {
  const validas = lerPacoteFormas(texto);
  return database.transaction('rw', database.formas, async () => {
    const ordemInicial = await proximaOrdem(validas.length);
    const novas = validas.map((forma, indice) => ({
      ...forma,
      id: criarId(),
      ordem: ordemInicial + indice,
    }));
    await database.formas.bulkAdd(novas);
    return novas;
  });
}
