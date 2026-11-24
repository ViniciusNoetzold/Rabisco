import { DPI_PADRAO } from '../../document/dimensoes';
import type { Rect } from '../../layers/types';
import { AutosaveBlocos } from '../../storage/autosave';
import { LADO_BLOCO, rgbaDaCor } from '../../storage/blocos';
import { criarCodificadorPng } from '../../storage/codificador';
import type { BlocoSalvo } from '../../storage/papel';

/** O banco local (Dexie, ~100 KB) carrega depois da primeira pintura da janela. */
const armazenamento = () =>
  Promise.all([import('../../storage/papel'), import('../../storage/documents')]).then(
    ([papel, documentos]) => ({ ...papel, validateSnapshot: documentos.validateSnapshot }),
  );
import type { DocumentInfo } from '../editorTypes';
import { medicaoAtiva, registrarGravacao } from '../medicao';
import type { NucleoEditor } from './nucleo';

/** Recupera o último papel ao abrir e mantém o autosave em blocos funcionando. */
export class Persistencia {
  estado: DocumentInfo['saving'] = 'loading';
  private readonly codificador = criarCodificadorPng();
  private readonly autosave: AutosaveBlocos;
  private readonly aoOcultar = () => {
    if (document.visibilityState === 'hidden') void this.autosave.gravarAgora();
  };
  private readonly aoSair = () => void this.autosave.gravarAgora();

  constructor(private readonly nucleo: NucleoEditor) {
    const { doc } = nucleo;
    this.autosave = new AutosaveBlocos({
      fonte: {
        descrever: () => ({
          nome: doc.name,
          largura: doc.width,
          altura: doc.height,
          dpi: doc.dpi,
          camadas: doc.layers.map(({ id, name }) => ({ id, nome: name })),
        }),
        lerArea: (_camada, area) => doc.lerPixels(area),
      },
      codificar: this.codificador.codificar,
      gravar: async (...argumentos) => (await armazenamento()).gravarPapel(...argumentos),
      aoMudar: (estado, erro) => {
        if (!nucleo.ativo()) return;
        this.estado = estado;
        nucleo.notificar();
        if (erro) nucleo.avisar(erro.message);
      },
      aoGravar: medicaoAtiva ? registrarGravacao : undefined,
    });
    document.addEventListener('visibilitychange', this.aoOcultar);
    window.addEventListener('pagehide', this.aoSair);
  }

  /** Marca a área alterada na camada ativa. `null` significa o papel inteiro. */
  marcar(area: Rect | null) {
    this.autosave.marcar(this.nucleo.doc.activeLayerId, area);
  }

  /** Recupera o último papel salvo. Devolve true quando havia um. */
  async recuperar(): Promise<boolean> {
    const { doc } = this.nucleo;
    try {
      const { lerPapel, apagarLegado, validateSnapshot } = await armazenamento();
      const salvo = await lerPapel();
      if (!this.nucleo.ativo()) return false;
      if (salvo?.tipo === 'blocos') {
        const { papel, blocos } = salvo;
        await this.restaurarBlocos(papel.nome, papel.largura, papel.altura, blocos);
        if (!this.nucleo.ativo()) return false;
        doc.dpi = papel.dpi;
      } else if (salvo?.tipo === 'legado') {
        // Registro da 0.2 (pixels inteiros): converte em blocos e só então apaga o antigo.
        const { snapshot } = salvo;
        validateSnapshot(snapshot);
        doc.substituir(snapshot.name, {
          width: snapshot.width,
          height: snapshot.height,
          data: snapshot.pixels,
        });
        doc.dpi = snapshot.dpi ?? DPI_PADRAO;
        this.marcar(null);
        await this.autosave.gravarAgora();
        if (this.estado !== 'error') await apagarLegado();
      }
      if (this.estado !== 'error') this.estado = 'saved';
      return Boolean(salvo);
    } catch {
      if (!this.nucleo.ativo()) return false;
      this.estado = 'error';
      this.nucleo.avisar('O autosave não está disponível. Salve seu trabalho em PNG.');
      return false;
    }
  }

  /** Grava o que estiver pendente e libera o worker. */
  encerrar() {
    void this.autosave.gravarAgora().finally(() => this.codificador.encerrar());
    this.autosave.encerrar();
    document.removeEventListener('visibilitychange', this.aoOcultar);
    window.removeEventListener('pagehide', this.aoSair);
  }

  /** Monta a camada a partir dos blocos salvos: cores lisas são pintadas, PNGs decodificados. */
  private async restaurarBlocos(
    nome: string,
    largura: number,
    altura: number,
    blocos: BlocoSalvo[],
  ) {
    const { doc } = this.nucleo;
    const imagens = await Promise.all(
      blocos.map((bloco) => (bloco.png ? createImageBitmap(bloco.png) : null)),
    );
    if (!this.nucleo.ativo()) return;
    doc.preencherPapel(largura, altura, 'transparent');
    doc.name = nome;
    const contexto = doc.contextoAtivo();
    blocos.forEach((bloco, i) => {
      if (bloco.camada !== doc.activeLayerId) return;
      const x = bloco.bx * LADO_BLOCO;
      const y = bloco.by * LADO_BLOCO;
      const imagem = imagens[i];
      if (imagem) {
        contexto.drawImage(imagem, x, y);
        imagem.close();
      } else if (bloco.cor !== undefined) {
        const [r, g, b, a] = rgbaDaCor(bloco.cor);
        contexto.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        contexto.fillRect(x, y, LADO_BLOCO, LADO_BLOCO);
      }
    });
  }
}
