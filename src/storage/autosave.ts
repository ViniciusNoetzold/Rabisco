import type { PixelBuffer, Rect } from '../layers/types';
import { areaDoBloco, BlocosSujos, corUniforme, type PosicaoBloco } from './blocos';
import type { CodificarPng } from './codificador';
import { gravarPapel, type BlocoParaGravar, type PapelSalvo } from './papel';

/** O que o autosave precisa saber do documento, sem depender do editor. */
export interface FonteDoPapel {
  descrever(): Omit<PapelSalvo, 'id' | 'atualizadoEm'>;
  lerArea(camada: string, area: Rect): PixelBuffer;
}

export type EstadoAutosave = 'saving' | 'saved' | 'error';

export interface OpcoesAutosave {
  fonte: FonteDoPapel;
  codificar: CodificarPng;
  aoMudar(estado: EstadoAutosave, erro?: Error): void;
  aoGravar?(gravacao: { bytes: number; blocos: number }): void;
  gravar?: typeof gravarPapel;
  /** Pausa sem edições antes de gravar. */
  espera?: number;
  /** Blocos lidos do canvas antes de devolver a vez para a interface. */
  blocosPorLeitura?: number;
  agora?: () => number;
}

interface BlocoLido extends PosicaoBloco {
  camada: string;
  cor: number | null;
  pixels: PixelBuffer;
}

const ceder = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

/**
 * Autosave por blocos de 256 × 256 px. Cada edição marca os blocos que tocou; depois de uma
 * pausa, só esses blocos são lidos, codificados em PNG (fora da thread da interface) e
 * gravados numa transação junto com a descrição do papel. Blocos de uma cor só viram um número.
 *
 * Um bloco alterado depois de lido é marcado de novo e entra na rodada seguinte, então o
 * que fica no IndexedDB sempre alcança a última edição.
 */
export class AutosaveBlocos {
  private readonly sujos = new Map<string, BlocosSujos>();
  private readonly espera: number;
  private readonly blocosPorLeitura: number;
  private readonly gravar: typeof gravarPapel;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private rodada: Promise<void> | null = null;
  private trocarTudo = false;
  private ativo = true;

  constructor(private readonly opcoes: OpcoesAutosave) {
    this.espera = opcoes.espera ?? 800;
    this.blocosPorLeitura = Math.max(1, opcoes.blocosPorLeitura ?? 16);
    this.gravar = opcoes.gravar ?? gravarPapel;
  }

  get pendente(): boolean {
    return [...this.sujos.values()].some((sujos) => !sujos.vazio);
  }

  /** Marca uma área alterada. `null` significa o papel inteiro (novo, aberto, redimensionado). */
  marcar(camada: string, area: Rect | null): void {
    if (!this.ativo) return;
    const { largura, altura } = this.opcoes.fonte.descrever();
    let sujos = this.sujos.get(camada);
    if (!sujos) this.sujos.set(camada, (sujos = new BlocosSujos()));
    sujos.marcar(area, largura, altura);
    if (!area) this.trocarTudo = true;
    this.opcoes.aoMudar('saving');
    this.agendar();
  }

  /** Grava sem esperar a pausa: aba oculta, página fechando ou conversão do formato antigo. */
  gravarAgora(): Promise<void> {
    clearTimeout(this.timer);
    this.rodada ??= this.executarRodadas().finally(() => {
      this.rodada = null;
    });
    return this.rodada;
  }

  encerrar(): void {
    this.ativo = false;
    clearTimeout(this.timer);
  }

  private agendar(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.gravarAgora(), this.espera);
  }

  private async executarRodadas(): Promise<void> {
    try {
      while (this.pendente) await this.rodadaUnica();
      this.opcoes.aoMudar('saved');
    } catch (erro) {
      this.opcoes.aoMudar(
        'error',
        erro instanceof Error ? erro : new Error('Não foi possível salvar neste navegador.'),
      );
    }
  }

  private async rodadaUnica(): Promise<void> {
    const descricao = this.opcoes.fonte.descrever();
    const { largura, altura } = descricao;
    const substituirTudo = this.trocarTudo;
    this.trocarTudo = false;

    const retirados = descricao.camadas.flatMap(({ id }) =>
      (this.sujos.get(id)?.retirar(largura, altura).blocos ?? []).map((bloco) => ({
        ...bloco,
        camada: id,
      })),
    );
    const devolver = () => {
      if (substituirTudo) this.trocarTudo = true;
      for (const { camada, bx, by } of retirados) {
        const area = areaDoBloco({ bx, by }, largura, altura);
        let sujos = this.sujos.get(camada);
        if (!sujos) this.sujos.set(camada, (sujos = new BlocosSujos()));
        sujos.marcar(area, largura, altura);
      }
    };

    try {
      const lidos: BlocoLido[] = [];
      for (let i = 0; i < retirados.length; i++) {
        if (i > 0 && i % this.blocosPorLeitura === 0) {
          await ceder();
          const atual = this.opcoes.fonte.descrever();
          // O papel mudou de tamanho no meio da leitura: a edição já marcou tudo de novo.
          if (atual.largura !== largura || atual.altura !== altura) return;
        }
        const { camada, bx, by } = retirados[i];
        const pixels = this.opcoes.fonte.lerArea(camada, areaDoBloco({ bx, by }, largura, altura));
        lidos.push({ camada, bx, by, pixels, cor: corUniforme(pixels.data) });
      }

      const blocos: BlocoParaGravar[] = await Promise.all(
        lidos.map(async ({ camada, bx, by, cor, pixels }) =>
          cor === null
            ? { camada, bx, by, png: await this.opcoes.codificar(pixels) }
            : { camada, bx, by, cor },
        ),
      );
      await this.gravar(
        { ...descricao, id: 'current', atualizadoEm: (this.opcoes.agora ?? Date.now)() },
        blocos,
        substituirTudo,
      );
      this.opcoes.aoGravar?.({
        bytes: blocos.reduce((total, bloco) => total + (bloco.png?.size ?? 4), 0),
        blocos: blocos.length,
      });
    } catch (erro) {
      devolver();
      throw erro;
    }
  }
}
