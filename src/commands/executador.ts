import type { RabiscoDocument } from '../document/model';
import type { PixelBuffer, Rect } from '../layers/types';
import { aplicarPreenchimento, planejarPreenchimento } from '../tools/pixels';
import { type Comando, type ComandoTraco, desserializarImagem, validarDimensoes } from './comandos';
import {
  areaDaForma,
  areaDoSegmento,
  desenharForma,
  desenharSegmento,
  limitarArea,
  unirAreas,
} from './desenho';
import { type EntradaComando, HistoricoComandos, recortarPixels } from './history';

const NOMES_TRACO = { pencil: 'Traço de lápis', brush: 'Pincelada', eraser: 'Borracha' };
const NOMES_FORMA = { line: 'Linha', rectangle: 'Retângulo', ellipse: 'Elipse' };

type DocumentoEditavel = Pick<
  RabiscoDocument,
  | 'activeLayer'
  | 'activeLayerId'
  | 'width'
  | 'height'
  | 'name'
  | 'contextoAtivo'
  | 'obterDados'
  | 'lerPixels'
  | 'registrarPixels'
  | 'aplicarPixels'
  | 'substituir'
>;

function pixelsIguais(a: PixelBuffer, b: PixelBuffer): boolean {
  return (
    a.width === b.width && a.height === b.height && a.data.every((byte, i) => byte === b.data[i])
  );
}

/** Aplica comandos à camada ativa e guarda somente os recortes necessários para restaurá-la. */
export class Executador {
  readonly historico = new HistoricoComandos();
  ultimaAlteracao: Rect | null = null;

  constructor(private readonly doc: DocumentoEditavel) {}

  executar(comando: Comando): boolean {
    this.ultimaAlteracao = null;
    if (this.doc.activeLayer.locked) return false;

    switch (comando.tipo) {
      case 'TracarPincel':
        return this.tracar(comando);
      case 'DesenharForma':
        return this.pintar(comando, NOMES_FORMA[comando.forma], areaDaForma(comando), (ctx) =>
          desenharForma(ctx, comando),
        );
      case 'Preencher': {
        const dados = this.doc.obterDados();
        const plano = planejarPreenchimento(
          dados,
          comando.ponto.x,
          comando.ponto.y,
          comando.cor,
          comando.tolerancia,
        );
        if (!plano) return false;
        const depois = recortarPixels(dados, plano.area);
        aplicarPreenchimento(depois, plano, plano.area);
        return this.escrever(comando, 'Preenchimento', plano.area, depois);
      }
      case 'ApagarSelecao': {
        const area = limitarArea(comando.area, this.doc);
        if (!area) return false;
        const depois = {
          width: area.width,
          height: area.height,
          data: new Uint8ClampedArray(area.width * area.height * 4),
        };
        return this.escrever(comando, 'Apagar seleção', area, depois);
      }
      case 'MoverSelecao': {
        const origem = limitarArea(comando.origem, this.doc);
        if (!origem || (origem.x === comando.destino.x && origem.y === comando.destino.y))
          return false;
        const selecao = recortarPixels(this.doc.obterDados(), origem);
        const destino = { ...comando.destino, width: origem.width, height: origem.height };
        return this.pintar(comando, 'Mover seleção', unirAreas(origem, destino), (ctx) => {
          ctx.clearRect(origem.x, origem.y, origem.width, origem.height);
          const recorte = new ImageData(
            new Uint8ClampedArray(selecao.data),
            selecao.width,
            selecao.height,
          );
          ctx.putImageData(recorte, destino.x, destino.y);
        });
      }
      case 'ColarImagem': {
        const { x, y } = comando;
        const imagem = desserializarImagem(comando.imagem);
        const area = limitarArea({ x, y, width: imagem.width, height: imagem.height }, this.doc);
        if (!area) return false;
        const depois = recortarPixels(imagem, { ...area, x: area.x - x, y: area.y - y });
        return this.escrever(comando, 'Colar seleção', area, depois);
      }
      case 'CortarPapel': {
        const area = limitarArea(comando.area, this.doc);
        if (!area || (area.width === this.doc.width && area.height === this.doc.height))
          return false;
        const recorte = recortarPixels(this.doc.obterDados(), area);
        return this.substituir(comando, 'Cortar para seleção', this.doc.name, recorte);
      }
      case 'AbrirImagem':
        return this.substituir(
          comando,
          'Abrir PNG',
          comando.nome,
          desserializarImagem(comando.imagem),
        );
      case 'NovoDocumento': {
        // Novo desenho inicia uma sessão de edição independente, como na versão 0.1.
        const { largura, altura, nome } = comando;
        validarDimensoes(largura, altura);
        const data = new Uint8ClampedArray(largura * altura * 4);
        data.fill(255);
        this.doc.substituir(nome.trim() || 'Sem título', { width: largura, height: altura, data });
        this.historico.clear();
        return true;
      }
    }
  }

  desfazer(): boolean {
    return this.restaurar(this.historico.desfazer(), 'before');
  }

  refazer(): boolean {
    return this.restaurar(this.historico.refazer(), 'after');
  }

  private tracar(comando: ComandoTraco): boolean {
    const [inicio, ...pontos] = comando.pontos;
    if (!inicio) return false;
    let area = areaDoSegmento(inicio, inicio, comando);
    let anterior = inicio;
    for (const ponto of pontos) {
      area = unirAreas(area, areaDoSegmento(anterior, ponto, comando));
      anterior = ponto;
    }
    return this.pintar(comando, NOMES_TRACO[comando.ferramenta], area, (ctx) => {
      desenharSegmento(ctx, inicio, inicio, comando);
      anterior = inicio;
      for (const ponto of pontos) {
        desenharSegmento(ctx, anterior, ponto, comando);
        anterior = ponto;
      }
    });
  }

  private pintar(
    comando: Comando,
    label: string,
    limites: Rect,
    pintarNaCamada: (ctx: CanvasRenderingContext2D) => void,
  ): boolean {
    const area = limitarArea(limites, this.doc);
    if (!area) return false;
    const before = recortarPixels(this.doc.obterDados(), area);
    let after: PixelBuffer;
    try {
      pintarNaCamada(this.doc.contextoAtivo());
      after = this.doc.lerPixels(area);
    } catch (erro) {
      this.doc.aplicarPixels(before, area.x, area.y);
      throw erro;
    }
    if (pixelsIguais(before, after)) return false;
    this.doc.registrarPixels(after, area.x, area.y);
    return this.registrar(comando, label, area, before, after);
  }

  private escrever(comando: Comando, label: string, area: Rect, after: PixelBuffer): boolean {
    const before = recortarPixels(this.doc.obterDados(), area);
    if (pixelsIguais(before, after)) return false;
    this.doc.aplicarPixels(after, area.x, area.y);
    return this.registrar(comando, label, area, before, after);
  }

  private substituir(comando: Comando, label: string, nome: string, after: PixelBuffer): boolean {
    const before = this.doc.obterDados();
    if (pixelsIguais(before, after)) {
      if (nome === this.doc.name) return false;
      this.doc.name = nome;
      return true;
    }
    this.doc.substituir(nome, after);
    return this.registrar(comando, label, null, before, after);
  }

  private registrar(
    comando: Comando,
    label: string,
    rect: Rect | null,
    before: PixelBuffer,
    after: PixelBuffer,
  ): boolean {
    this.ultimaAlteracao = rect;
    this.historico.registrarComando({
      comando: structuredClone(comando),
      label,
      rect,
      before,
      after,
      camada: this.doc.activeLayerId,
    });
    return true;
  }

  private restaurar(entrada: EntradaComando | null, lado: 'before' | 'after'): boolean {
    this.ultimaAlteracao = entrada?.rect ?? null;
    if (!entrada) return false;
    if (entrada.rect) this.doc.aplicarPixels(entrada[lado], entrada.rect.x, entrada.rect.y);
    else this.doc.substituir(this.doc.name, entrada[lado]);
    return true;
  }
}
