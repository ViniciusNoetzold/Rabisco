import { DPI_MAXIMO, DPI_PADRAO, dpiValido } from '../document/dimensoes';
import type { RabiscoDocument } from '../document/model';
import {
  girarPixels,
  inverterPixels,
  redimensionarEInclinar,
  redimensionarPapel,
  sobreporPixels,
} from '../document/transformacoes';
import type { PixelBuffer, Rect } from '../layers/types';
import { aplicarPreenchimento, clearRectPixels, planejarPreenchimento } from '../tools/pixels';
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
const NOMES_ROTACAO = {
  90: 'Girar 90° à direita',
  [-90]: 'Girar 90° à esquerda',
  180: 'Girar 180°',
};
const SEM_PIXELS = { width: 0, height: 0, data: new Uint8ClampedArray(0) };

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
> &
  Partial<Pick<RabiscoDocument, 'dpi'>>;

type ComandoTransformacao = Extract<
  Comando,
  { tipo: 'RedimensionarInclinar' | 'Girar' | 'Inverter' }
>;

function pixelsIguais(a: PixelBuffer, b: PixelBuffer): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    (a.data === b.data || a.data.every((byte, i) => byte === b.data[i]))
  );
}

/** Aplica comandos à camada ativa e guarda somente os recortes necessários para restaurá-la. */
export class Executador {
  readonly historico = new HistoricoComandos();
  ultimaAlteracao: Rect | null = null;
  ultimaSelecaoTransformada: Rect | null = null;

  constructor(private readonly doc: DocumentoEditavel) {}

  executar(comando: Comando): boolean {
    this.ultimaAlteracao = null;
    this.ultimaSelecaoTransformada = null;
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
          comando.dpi ?? DPI_PADRAO,
        );
      case 'NovoDocumento': {
        // Novo desenho inicia uma sessão de edição independente, como na versão 0.1.
        const { largura, altura, nome } = comando;
        validarDimensoes(largura, altura);
        const data = new Uint8ClampedArray(largura * altura * 4);
        data.fill(255);
        this.doc.substituir(nome.trim() || 'Sem título', { width: largura, height: altura, data });
        this.doc.dpi = DPI_PADRAO;
        this.historico.clear();
        return true;
      }
      case 'RedimensionarPapel': {
        const { largura, altura, fundo, dpi } = comando;
        const antes = this.doc.obterDados();
        const depois =
          largura === antes.width && altura === antes.height
            ? antes
            : redimensionarPapel(antes, largura, altura, fundo);
        return this.substituir(comando, 'Redimensionar papel', this.doc.name, depois, dpi);
      }
      case 'RedimensionarInclinar':
        return this.transformar(comando, 'Redimensionar e inclinar', (imagem) =>
          redimensionarEInclinar(
            imagem,
            comando.largura,
            comando.altura,
            comando.inclinacaoHorizontal,
            comando.inclinacaoVertical,
          ),
        );
      case 'Girar':
        return this.transformar(comando, NOMES_ROTACAO[comando.graus], (imagem) =>
          girarPixels(imagem, comando.graus),
        );
      case 'Inverter':
        return this.transformar(
          comando,
          comando.eixo === 'horizontal' ? 'Inverter horizontalmente' : 'Inverter verticalmente',
          (imagem) => inverterPixels(imagem, comando.eixo),
        );
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

  private transformar(
    comando: ComandoTransformacao,
    label: string,
    operacao: (imagem: PixelBuffer) => PixelBuffer,
  ): boolean {
    const papel = this.doc.obterDados();
    if (!comando.area) return this.substituir(comando, label, this.doc.name, operacao(papel));

    const origem = limitarArea(comando.area, papel);
    if (!origem) return false;
    const recorte = recortarPixels(papel, origem);
    const imagem = operacao(recorte);
    if (imagem === recorte) return false;
    const destino = {
      x: origem.x,
      y: origem.y,
      width: Math.min(imagem.width, papel.width - origem.x),
      height: Math.min(imagem.height, papel.height - origem.y),
    };
    const afetada = unirAreas(origem, destino);
    const depois = recortarPixels(papel, afetada);
    clearRectPixels(depois, { ...origem, x: 0, y: 0 });
    sobreporPixels(imagem, depois, 0, 0);
    this.ultimaSelecaoTransformada = destino;
    return this.escrever(comando, label, afetada, depois);
  }

  private substituir(
    comando: Comando,
    label: string,
    nome: string,
    after: PixelBuffer,
    dpi = this.doc.dpi ?? DPI_PADRAO,
  ): boolean {
    if (!dpiValido(dpi)) throw new Error(`Use uma resolução de 1 a ${DPI_MAXIMO} DPI.`);
    const before = this.doc.obterDados();
    const dpiAnterior = this.doc.dpi ?? DPI_PADRAO;
    const alteracaoDpi = dpiAnterior === dpi ? undefined : { antes: dpiAnterior, depois: dpi };
    if (pixelsIguais(before, after)) {
      const nomeMudou = nome !== this.doc.name;
      this.doc.name = nome;
      if (!alteracaoDpi) return nomeMudou;
      this.doc.dpi = dpi;
      return this.registrar(comando, label, null, SEM_PIXELS, SEM_PIXELS, alteracaoDpi, true);
    }
    this.doc.substituir(nome, after);
    this.doc.dpi = dpi;
    return this.registrar(comando, label, null, before, after, alteracaoDpi);
  }

  private registrar(
    comando: Comando,
    label: string,
    rect: Rect | null,
    before: PixelBuffer,
    after: PixelBuffer,
    dpi?: EntradaComando['dpi'],
    apenasDpi?: boolean,
  ): boolean {
    this.ultimaAlteracao = rect;
    this.historico.registrarComando({
      comando: structuredClone(comando),
      label,
      rect,
      before,
      after,
      camada: this.doc.activeLayerId,
      dpi,
      apenasDpi,
    });
    return true;
  }

  private restaurar(entrada: EntradaComando | null, lado: 'before' | 'after'): boolean {
    this.ultimaAlteracao = entrada?.rect ?? null;
    this.ultimaSelecaoTransformada = null;
    if (!entrada) return false;
    if (entrada.rect) this.doc.aplicarPixels(entrada[lado], entrada.rect.x, entrada.rect.y);
    else if (!entrada.apenasDpi) this.doc.substituir(this.doc.name, entrada[lado]);
    if (entrada.dpi) this.doc.dpi = lado === 'before' ? entrada.dpi.antes : entrada.dpi.depois;
    return true;
  }
}
