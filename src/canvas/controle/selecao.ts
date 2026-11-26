import { FERRAMENTAS_DE_SELECAO } from '../../tools/select';
import { useEditor } from '../../app/store';
import { limitarArea } from '../../commands/desenho';
import {
  contornoRetangular,
  prepararRecorteDaArea,
  type MascaraSelecao,
} from '../../document/selecao';
import type { Rect } from '../../layers/types';
import { referenciaDaSelecao } from '../../shapes/referencia';
import type { NucleoEditor } from './nucleo';

/** Área selecionada, máscara do laço e a marquise animada. */
export class ControleSelecao {
  area: Rect | null = null;
  mascara?: MascaraSelecao;
  private timerMarquise = 0;

  constructor(
    private readonly nucleo: NucleoEditor,
    /** Redesenha o overlay da ferramenta ativa (onde a marquise aparece). */
    private readonly redesenharMarquise: () => void,
  ) {}

  selecionar(area: Rect | null, mascara?: MascaraSelecao) {
    const proxima = area && area.width > 0 && area.height > 0 ? area : null;
    if (this.area === proxima && this.mascara === mascara) return;
    this.area = proxima;
    this.mascara = proxima ? mascara : undefined;
    this.atualizarMarquise();
    this.nucleo.notificar();
  }

  /** Troca a seleção sem avisar ninguém: usada dentro de um comando, antes da atualização geral. */
  definirSemAvisar(area: Rect | null) {
    this.area = area;
    this.mascara = undefined;
  }

  /** Mantém a seleção dentro do papel depois de uma mudança de tamanho. */
  limitarAoPapel() {
    if (this.area) this.area = limitarArea(this.area, this.nucleo.doc);
  }

  selecionarTudo() {
    useEditor.getState().setTool('select');
    const { width, height } = this.nucleo.doc;
    this.selecionar({ x: 0, y: 0, width, height });
  }

  inverter() {
    const { doc } = this.nucleo;
    if (!this.area) {
      this.selecionarTudo();
      return;
    }
    const papel = { x: 0, y: 0, width: doc.width, height: doc.height };
    if (!this.mascara && this.area.width === papel.width && this.area.height === papel.height) {
      this.selecionar(null);
      return;
    }
    const contorno = this.mascara?.contorno ?? contornoRetangular(this.area);
    const inversa = !this.mascara?.inversa;
    const xs = contorno.map(({ x }) => x);
    const ys = contorno.map(({ y }) => y);
    const area = inversa
      ? papel
      : limitarArea(
          {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          },
          papel,
        );
    useEditor.getState().setTool('select');
    this.selecionar(area, { contorno, inversa });
  }

  apagar() {
    if (!this.area) return;
    const area = this.area;
    const mascara = this.mascara;
    this.selecionar(null);
    this.nucleo.executar({ tipo: 'ApagarSelecao', area, mascara });
    this.nucleo.notificar();
  }

  cortarPapel() {
    if (!this.area) return;
    const area = this.area;
    const mascara = this.mascara;
    this.selecionar(null);
    this.nucleo.executar({ tipo: 'CortarPapel', area, mascara });
    this.nucleo.fit();
    this.nucleo.notificar();
  }

  /** Silhueta da seleção para virar forma própria. */
  referencia() {
    if (!this.area) return null;
    const area = this.area;
    if (this.mascara) {
      const recorte = prepararRecorteDaArea(this.nucleo.doc.lerPixels(area), area, this.mascara);
      const pixels = recorte.imagem.getContext('2d')!.getImageData(0, 0, area.width, area.height);
      return referenciaDaSelecao(pixels, { ...area, x: 0, y: 0 });
    }
    return referenciaDaSelecao(this.nucleo.doc.lerPixels(area), { ...area, x: 0, y: 0 });
  }

  encerrar() {
    window.clearTimeout(this.timerMarquise);
  }

  private atualizarMarquise() {
    const { tool } = useEditor.getState();
    if (FERRAMENTAS_DE_SELECAO.has(tool)) this.redesenharMarquise();
    if (!this.nucleo.ativo() || !this.area || this.timerMarquise) return;
    this.timerMarquise = window.setTimeout(() => {
      this.timerMarquise = 0;
      if (this.area) this.atualizarMarquise();
    }, 90);
  }
}
