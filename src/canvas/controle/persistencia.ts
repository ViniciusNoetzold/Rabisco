import { DPI_PADRAO } from '../../document/dimensoes';
import { useEditor } from '../../app/store';
import { guiasSeguras } from '../../document/guias';
import { alvoDaChave, chaveDoAlvo } from '../../document/camadas';
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
          camadas: doc.layers.flatMap(({ id, name, mascara, ajuste }) => [
            ...(ajuste ? [] : [{ id, nome: name }]),
            ...(mascara
              ? [{ id: chaveDoAlvo({ camada: id, mascara: true }), nome: `${name} (máscara)` }]
              : []),
          ]),
          estrutura: doc.estrutura(),
          guias: useEditor.getState().guiasDoPapel,
        }),
        lerArea: (chave, area) => doc.lerPixels(area, alvoDaChave(chave)),
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

  /** Marca a área alterada de uma camada ou máscara (chave). `null` significa ela inteira. */
  marcar(chave: string, area: Rect | null) {
    this.autosave.marcar(chave, area);
  }

  /** Estrutura, nome ou propriedades mudaram: grava a descrição. */
  marcarDescricao() {
    this.autosave.marcarDescricao();
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
        await this.restaurarBlocos(
          papel.nome,
          papel.largura,
          papel.altura,
          blocos,
          papel.estrutura,
        );
        if (!this.nucleo.ativo()) return false;
        doc.dpi = papel.dpi;
        useEditor
          .getState()
          .set({ guiasDoPapel: guiasSeguras(papel.guias, papel.largura, papel.altura) });
        this.autosave.definirTamanhoGravado(papel.largura, papel.altura);
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
        this.marcar(doc.activeLayerId, null);
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
    estrutura?: import('../../document/camadas').EstruturaDocumento,
  ) {
    const { doc } = this.nucleo;
    const imagens = await Promise.all(
      blocos.map((bloco) => (bloco.png ? createImageBitmap(bloco.png) : null)),
    );
    if (!this.nucleo.ativo()) return;
    doc.preencherPapel(largura, altura, 'transparent');
    doc.name = nome;
    // 0.3: várias camadas e máscaras. Sem estrutura salva (0.2.1), a camada única recebe os blocos.
    if (estrutura) doc.aplicarEstrutura(estrutura);
    const unica = estrutura ? null : doc.activeLayerId;
    blocos.forEach((bloco, i) => {
      const alvo = alvoDaChave(
        unica && !bloco.camada.includes('#') ? chaveDoAlvo({ camada: unica }) : bloco.camada,
      );
      if (!doc.existe(alvo)) return;
      const contexto = doc.contexto(alvo);
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
