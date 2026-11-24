import { useEditor } from '../../app/store';
import {
  serializarImagem,
  type Comando,
  type OpcoesTransformacao,
  type OrientacaoImagem,
} from '../../commands/comandos';
import { lerArquivoDeImagem } from './arquivos';
import type { ControleColagem } from './colagem';
import type { ControleFerramentas } from './ferramentas';
import type { NucleoEditor } from './nucleo';
import type { ControleSelecao } from './selecao';

type ComandoTransformacao = Extract<
  Comando,
  { tipo: 'RedimensionarInclinar' | 'Girar' | 'Inverter' }
>;

/** Ações sobre o papel inteiro: abrir, novo, tamanho, girar, inverter e redimensionar. */
export class ControlePapel {
  constructor(
    private readonly nucleo: NucleoEditor,
    private readonly selecao: ControleSelecao,
    private readonly colagem: ControleColagem,
    private readonly ferramentas: ControleFerramentas,
  ) {}

  async abrir(arquivo: File) {
    const imagem = await lerArquivoDeImagem(arquivo);
    if (!this.nucleo.disponivel()) return;
    this.colagem.descartar();
    this.ferramentas.confirmarPendente();
    const { name, width, height, pixels, dpi, formato } = imagem;
    this.selecao.definirSemAvisar(null);
    this.nucleo.executar({
      tipo: 'AbrirImagem',
      nome: name,
      dpi,
      formato,
      imagem: serializarImagem({ width, height, data: pixels }),
    });
    this.nucleo.fit();
    this.nucleo.notificar();
  }

  novo(nome: string, largura: number, altura: number) {
    if (!this.nucleo.disponivel()) return;
    this.colagem.descartar();
    this.ferramentas.descartarPendente();
    this.selecao.definirSemAvisar(null);
    this.nucleo.executar({
      tipo: 'NovoDocumento',
      nome: nome.trim() || 'Sem título',
      largura,
      altura,
    });
    this.nucleo.fit();
  }

  redimensionar(
    largura: number,
    altura: number,
    fundo = useEditor.getState().color2,
    dpi?: number,
  ) {
    if (!this.nucleo.disponivel()) return;
    this.ferramentas.confirmarPendente();
    this.nucleo.executar({ tipo: 'RedimensionarPapel', largura, altura, fundo, dpi }, () =>
      this.selecao.limitarAoPapel(),
    );
  }

  transformar(opcoes: OpcoesTransformacao) {
    if (!this.nucleo.disponivel()) return;
    this.ferramentas.confirmarPendente();
    this.executarTransformacao({
      tipo: 'RedimensionarInclinar',
      ...opcoes,
      area: this.selecao.area ?? undefined,
    });
  }

  girar(orientacao: OrientacaoImagem) {
    if (!this.nucleo.disponivel()) return;
    this.ferramentas.confirmarPendente();
    const area = this.selecao.area ?? undefined;
    if (orientacao === 'horizontal' || orientacao === 'vertical') {
      this.executarTransformacao({ tipo: 'Inverter', eixo: orientacao, area });
    } else {
      const graus = { direita: 90, esquerda: -90, '180': 180 } as const;
      this.executarTransformacao({ tipo: 'Girar', graus: graus[orientacao], area });
    }
  }

  /** A seleção acompanha a área transformada. */
  private executarTransformacao(comando: ComandoTransformacao) {
    const { comandos } = this.nucleo;
    const mudou = this.nucleo.executar(comando, () =>
      this.selecao.definirSemAvisar(comandos.ultimaSelecaoTransformada),
    );
    if (!mudou && comandos.ultimaSelecaoTransformada) {
      this.selecao.selecionar(comandos.ultimaSelecaoTransformada);
    }
  }
}
