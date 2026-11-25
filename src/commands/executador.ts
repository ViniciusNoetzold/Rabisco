import {
  chaveDoAlvo,
  propriedadesPadrao,
  type Alvo,
  type EstruturaDocumento,
  type PropriedadesCamada,
} from '../document/camadas';
import { comporDocumento, desenharCamadaSobre } from '../document/compositor';
import { desenharDistorcido } from '../document/distorcer';
import { DPI_MAXIMO, DPI_PADRAO, dpiValido } from '../document/dimensoes';
import type { RabiscoDocument } from '../document/model';
import {
  apagarRecorte,
  caminhoDaSelecao,
  pintarRecorte,
  prepararRecorte,
  prepararRecorteDaArea,
} from '../document/selecao';
import {
  girarPixels,
  inverterPixels,
  redimensionarEInclinar,
  redimensionarPapel,
  sobreporPixels,
} from '../document/transformacoes';
import type { PixelBuffer, Rect } from '../layers/types';
import {
  areaDaForma as areaFormaEditavel,
  desenharForma as aplicarFormaEditavel,
  obterDefinicaoForma,
} from '../shapes/render';
import {
  aplicarBorrachaDeCor,
  aplicarPreenchimento,
  clearRectPixels,
  planejarPreenchimento,
} from '../tools/pixels';
import { areaDoTexto, desenharTexto } from '../tools/texto';
import {
  desserializarImagem,
  validarDimensoes,
  type Comando,
  type ComandoCamada,
  type ComandoTraco,
} from './comandos';
import {
  areaDaForma,
  areaDoSegmento,
  desenharForma,
  desenharSegmento,
  limitarArea,
  unirAreas,
} from './desenho';
import {
  HistoricoComandos,
  recortarPixels,
  type AlteracaoPixels,
  type EntradaComando,
} from './history';
import { areaDaPincelada, desenharPincelada, nomeDaPincelada } from './pincelada';

const NOMES_TRACO = { pencil: 'Traço de lápis', brush: 'Pincelada', eraser: 'Borracha' };
const NOMES_FORMA = { line: 'Linha', rectangle: 'Retângulo', ellipse: 'Elipse' };
const NOMES_ROTACAO = {
  90: 'Girar 90° à direita',
  [-90]: 'Girar 90° à esquerda',
  180: 'Girar 180°',
};
const SEM_PIXELS: PixelBuffer = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
const TRANSPARENTE = '#00000000';

/** Comandos que pintam na camada ativa: recusados se ela estiver oculta ou bloqueada. */
const PINTURA = new Set<Comando['tipo']>([
  'TracarPincel',
  'Pincelar',
  'DesenharForma',
  'AplicarForma',
  'AplicarTexto',
  'Preencher',
  'ApagarSelecao',
  'MoverSelecao',
  'ColarImagem',
]);

export type DocumentoEditavel = RabiscoDocument;

/** Por que o último comando não fez nada (para a interface avisar). */
export type MotivoRecusa = 'bloqueada' | 'oculta' | 'ultima-camada' | 'sem-camada-abaixo' | null;

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

/** Bloqueio de transparência: a tinta só fica onde já havia pixel, com o mesmo alfa. */
function preservarAlfa(antes: PixelBuffer, depois: PixelBuffer): PixelBuffer {
  const resultado = { ...depois, data: new Uint8ClampedArray(depois.data) };
  for (let i = 0; i < resultado.data.length; i += 4) {
    if (antes.data[i + 3] === 0) resultado.data.set(antes.data.subarray(i, i + 4), i);
    else resultado.data[i + 3] = antes.data[i + 3];
  }
  return resultado;
}

/**
 * Aplica comandos ao documento e registra no histórico só o necessário para desfazer: o recorte
 * de pixels de uma camada, ou a estrutura e os pixels inteiros das camadas afetadas.
 */
export class Executador {
  readonly historico = new HistoricoComandos();
  /** Camadas e áreas alteradas pelo último comando, desfazer ou refazer. */
  ultimasAlteracoes: { alvo: Alvo; area: Rect | null }[] = [];
  /** Camadas, grupos, tamanho ou propriedades mudaram (recompor tudo, salvar a descrição). */
  estruturaMudou = false;
  ultimaSelecaoTransformada: Rect | null = null;
  motivoRecusa: MotivoRecusa = null;

  constructor(private readonly doc: DocumentoEditavel) {}

  /** Área alterada para recompor a tela; `null` quando é preciso recompor tudo. */
  get ultimaAlteracao(): Rect | null {
    if (this.estruturaMudou || this.ultimasAlteracoes.length === 0) return null;
    let area: Rect | null = null;
    for (const alteracao of this.ultimasAlteracoes) {
      if (!alteracao.area) return null;
      area = area ? unirAreas(area, alteracao.area) : alteracao.area;
    }
    return area;
  }

  executar(comando: Comando): boolean {
    this.ultimasAlteracoes = [];
    this.estruturaMudou = false;
    this.ultimaSelecaoTransformada = null;
    this.motivoRecusa = null;
    const entrada = this.aplicar(comando);
    if (!entrada) return false;
    if (comando.tipo === 'NovoDocumento') this.historico.clear();
    else this.historico.registrarComando(entrada);
    return true;
  }

  desfazer(): boolean {
    return this.restaurar(this.historico.desfazer(), 'before');
  }

  refazer(): boolean {
    return this.restaurar(this.historico.refazer(), 'after');
  }

  private aplicar(comando: Comando): EntradaComando | null {
    if (PINTURA.has(comando.tipo)) {
      const camada = this.doc.activeLayer;
      if (camada.locked) {
        this.motivoRecusa = 'bloqueada';
        return null;
      }
      if (!camada.visible) {
        this.motivoRecusa = 'oculta';
        return null;
      }
    }

    switch (comando.tipo) {
      case 'TracarPincel':
        return this.tracar(comando);
      case 'Pincelar': {
        const limites = areaDaPincelada(comando);
        const area = limites && limitarArea(limites, this.doc);
        if (!area) return null;
        return this.pintar(comando, nomeDaPincelada(comando), area, (ctx) =>
          desenharPincelada(ctx, comando, area),
        );
      }
      case 'DesenharForma':
        return this.pintar(comando, NOMES_FORMA[comando.forma], areaDaForma(comando), (ctx) =>
          desenharForma(ctx, comando),
        );
      case 'AplicarForma': {
        const { configuracao } = comando;
        return this.pintar(
          comando,
          obterDefinicaoForma(configuracao).nome,
          areaFormaEditavel(configuracao),
          (ctx) => aplicarFormaEditavel(ctx, configuracao),
        );
      }
      case 'AplicarTexto': {
        const { configuracao } = comando;
        if (!configuracao.texto.trim()) return null;
        const area = areaDoTexto(this.doc.contextoAtivo(), configuracao);
        return this.pintar(comando, 'Texto', area, (ctx) => desenharTexto(ctx, configuracao));
      }
      case 'Preencher': {
        // O balde pode alcançar qualquer ponto do papel. Com "imagem toda", decide a área
        // pelo que se vê, mas pinta só na camada ativa.
        const referencia = comando.amostrarTudo ? this.composto() : this.doc.copiarPixels();
        const plano = planejarPreenchimento(
          referencia,
          comando.ponto.x,
          comando.ponto.y,
          comando.cor,
          comando.tolerancia,
          comando.global,
        );
        if (!plano) return null;
        const depois = comando.amostrarTudo
          ? this.doc.lerPixels(plano.area)
          : recortarPixels(referencia, plano.area);
        aplicarPreenchimento(depois, plano, plano.area);
        return this.escrever(comando, 'Preenchimento', plano.area, depois);
      }
      case 'ApagarSelecao': {
        const area = limitarArea(comando.area, this.doc);
        if (!area) return null;
        if (comando.mascara)
          return this.pintar(comando, 'Apagar seleção', area, (ctx) => {
            apagarRecorte(ctx, area, comando.mascara);
          });
        const depois = {
          width: area.width,
          height: area.height,
          data: new Uint8ClampedArray(area.width * area.height * 4),
        };
        return this.escrever(comando, 'Apagar seleção', area, depois);
      }
      case 'MoverSelecao': {
        const origem = limitarArea(comando.origem, this.doc);
        const { destino, duplicar, mascara, corTransparente } = comando;
        if (!origem || destino.width < 1 || destino.height < 1) return null;
        const redimensionou = origem.width !== destino.width || origem.height !== destino.height;
        if (!redimensionou && origem.x === destino.x && origem.y === destino.y) return null;
        const recorte = prepararRecorteDaArea(
          this.doc.lerPixels(origem),
          origem,
          mascara,
          corTransparente,
        );
        const rotulo = duplicar
          ? 'Duplicar seleção'
          : redimensionou
            ? 'Redimensionar seleção'
            : 'Mover seleção';
        return this.pintar(
          comando,
          rotulo,
          duplicar ? destino : unirAreas(origem, destino),
          (ctx) => {
            pintarRecorte(ctx, recorte, duplicar ? null : origem, destino);
          },
        );
      }
      case 'ColarImagem':
        return this.colar(comando);
      case 'CortarPapel': {
        const area = limitarArea(comando.area, this.doc);
        if (
          !area ||
          (!comando.mascara && area.width === this.doc.width && area.height === this.doc.height)
        )
          return null;
        // Todas as camadas são cortadas; o laço deixa transparente o que fica fora dele.
        return this.alterarDocumento(comando, 'Cortar para seleção', this.todosOsAlvos(), () => {
          const novos = this.todosOsAlvos().map((alvo) => {
            const dados = this.doc.lerPixels(area, alvo);
            const recortado =
              comando.mascara && !alvo.mascara
                ? prepararRecorteDaArea(dados, area, comando.mascara)
                    .imagem.getContext('2d')!
                    .getImageData(0, 0, area.width, area.height)
                : dados;
            return [alvo, recortado] as const;
          });
          this.doc.redimensionarDocumento(area.width, area.height);
          for (const [alvo, pixels] of novos) this.doc.aplicarPixels(pixels, 0, 0, alvo);
        });
      }
      case 'AbrirImagem': {
        const imagem = desserializarImagem(comando.imagem);
        const dpi = comando.dpi ?? DPI_PADRAO;
        if (!dpiValido(dpi)) throw new Error(`Use uma resolução de 1 a ${DPI_MAXIMO} DPI.`);
        return this.alterarDocumento(
          comando,
          `Abrir ${(comando.formato ?? 'png').toUpperCase()}`,
          this.todosOsAlvos(),
          () => {
            this.doc.substituir(comando.nome, imagem);
            this.doc.dpi = dpi;
          },
        );
      }
      case 'NovoDocumento': {
        // Novo desenho inicia uma sessão de edição independente, como na versão 0.1.
        const { largura, altura, nome } = comando;
        validarDimensoes(largura, altura);
        this.doc.preencherPapel(largura, altura, '#ffffff');
        this.doc.name = nome.trim() || 'Sem título';
        this.doc.dpi = DPI_PADRAO;
        this.estruturaMudou = true;
        return this.entradaVazia(comando, 'Novo desenho');
      }
      case 'RedimensionarPapel': {
        const { largura, altura, fundo, dpi } = comando;
        if (dpi !== undefined && !dpiValido(dpi))
          throw new Error(`Use uma resolução de 1 a ${DPI_MAXIMO} DPI.`);
        const mudaTamanho = largura !== this.doc.width || altura !== this.doc.height;
        return this.alterarDocumento(
          comando,
          'Redimensionar papel',
          mudaTamanho ? this.todosOsAlvos() : [],
          () => {
            if (dpi !== undefined) this.doc.dpi = dpi;
            if (mudaTamanho) this.redimensionarTodas(largura, altura, fundo);
          },
        );
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
      case 'Lote':
        return this.lote(comando);
      default:
        return this.camadas(comando);
    }
  }

  // ---- Comandos de camada --------------------------------------------------------------

  private camadas(comando: ComandoCamada): EntradaComando | null {
    const { doc } = this;
    const estrutura = doc.estrutura();
    const indice = (id: string) => estrutura.camadas.findIndex((camada) => camada.id === id);
    const mudarEstrutura = (rotulo: string, nova: EstruturaDocumento, alvos: Alvo[] = []) =>
      this.alterarDocumento(comando, rotulo, alvos, () => doc.aplicarEstrutura(nova));

    switch (comando.tipo) {
      case 'NovaCamada': {
        const referencia = indice(comando.acimaDe ?? doc.activeLayerId);
        const propriedades: PropriedadesCamada = {
          ...propriedadesPadrao(comando.id, comando.nome),
          ...structuredClone(comando.propriedades ?? {}),
          id: comando.id,
          grupo: comando.propriedades?.grupo ?? estrutura.camadas[referencia]?.grupo,
        };
        if (!propriedades.grupo) delete propriedades.grupo;
        estrutura.camadas.splice(referencia + 1, 0, propriedades);
        estrutura.ativa = comando.id;
        estrutura.editandoMascara = false;
        const alvo = { camada: comando.id };
        return this.alterarDocumento(comando, 'Nova camada', [alvo], () => {
          doc.aplicarEstrutura(estrutura);
          if (comando.imagem) {
            const imagem = desserializarImagem(comando.imagem);
            const area = limitarArea(
              { x: comando.x ?? 0, y: comando.y ?? 0, width: imagem.width, height: imagem.height },
              doc,
            );
            if (area) {
              const visivel = recortarPixels(imagem, {
                ...area,
                x: area.x - (comando.x ?? 0),
                y: area.y - (comando.y ?? 0),
              });
              doc.aplicarPixels(visivel, area.x, area.y, alvo);
            }
          }
        });
      }
      case 'DuplicarCamada': {
        const posicao = indice(comando.id);
        const original = doc.camada(comando.id);
        if (posicao < 0 || !original) return null;
        estrutura.camadas.splice(posicao + 1, 0, {
          ...structuredClone(estrutura.camadas[posicao]),
          id: comando.novoId,
          name: `${original.name} (cópia)`,
          fundo: undefined,
        });
        delete estrutura.camadas[posicao + 1].fundo;
        estrutura.ativa = comando.novoId;
        const alvos = [{ camada: comando.novoId }, { camada: comando.novoId, mascara: true }];
        return this.alterarDocumento(comando, 'Duplicar camada', alvos, () => {
          doc.aplicarEstrutura(estrutura);
          doc.contexto({ camada: comando.novoId }).drawImage(original.canvas, 0, 0);
          if (original.mascara)
            doc
              .contexto({ camada: comando.novoId, mascara: true })
              .drawImage(original.mascara, 0, 0);
        });
      }
      case 'ExcluirCamada': {
        const posicao = indice(comando.id);
        if (posicao < 0) return null;
        if (estrutura.camadas.length === 1) {
          this.motivoRecusa = 'ultima-camada';
          return null;
        }
        estrutura.camadas.splice(posicao, 1);
        if (estrutura.ativa === comando.id)
          estrutura.ativa = estrutura.camadas[Math.max(0, posicao - 1)].id;
        this.limparGruposVazios(estrutura);
        return mudarEstrutura('Excluir camada', estrutura, this.alvosDa(comando.id));
      }
      case 'AlterarCamada': {
        const posicao = indice(comando.id);
        if (posicao < 0) return null;
        const camada = estrutura.camadas[posicao];
        Object.assign(camada, structuredClone(comando.propriedades));
        if (camada.opacity !== undefined) camada.opacity = Math.min(1, Math.max(0, camada.opacity));
        for (const chave of Object.keys(camada) as (keyof PropriedadesCamada)[]) {
          if (camada[chave] === undefined) delete camada[chave];
        }
        return mudarEstrutura(this.rotuloDaAlteracao(comando.propriedades), estrutura);
      }
      case 'MoverCamada': {
        const posicao = indice(comando.id);
        if (posicao < 0) return null;
        const [camada] = estrutura.camadas.splice(posicao, 1);
        const destino = Math.max(0, Math.min(estrutura.camadas.length, comando.posicao));
        if (comando.grupo !== undefined) {
          if (comando.grupo) camada.grupo = comando.grupo;
          else delete camada.grupo;
        }
        estrutura.camadas.splice(destino, 0, camada);
        this.limparGruposVazios(estrutura);
        return mudarEstrutura('Mover camada', estrutura);
      }
      case 'DeslocarCamada': {
        const camada = doc.camada(comando.id);
        if (!camada || (!comando.dx && !comando.dy)) return null;
        if (camada.locked || camada.bloqueioPosicao) {
          this.motivoRecusa = 'bloqueada';
          return null;
        }
        const alvos = this.alvosDa(comando.id);
        return this.alterarDocumento(comando, 'Mover camada', alvos, () => {
          for (const alvo of alvos) {
            // O que sai do papel é perdido; a máscara anda junto com os pixels.
            const copia = document.createElement('canvas');
            copia.width = doc.width;
            copia.height = doc.height;
            copia.getContext('2d')!.drawImage(doc.canvasDo(alvo), 0, 0);
            const contexto = doc.contexto(alvo);
            if (alvo.mascara) {
              contexto.fillStyle = '#ffffff';
              contexto.fillRect(0, 0, doc.width, doc.height);
            } else contexto.clearRect(0, 0, doc.width, doc.height);
            contexto.drawImage(copia, comando.dx, comando.dy);
          }
        });
      }
      case 'TransformarCamada': {
        const camada = doc.camada(comando.id);
        if (!camada || comando.matriz.some((valor) => !Number.isFinite(valor))) return null;
        if (camada.locked || camada.bloqueioPosicao) {
          this.motivoRecusa = 'bloqueada';
          return null;
        }
        const alvos = this.alvosDa(comando.id);
        return this.alterarDocumento(comando, 'Transformação livre', alvos, () => {
          for (const alvo of alvos) {
            const copia = document.createElement('canvas');
            copia.width = doc.width;
            copia.height = doc.height;
            copia.getContext('2d')!.drawImage(doc.canvasDo(alvo), 0, 0);
            const contexto = doc.contexto(alvo);
            contexto.save();
            if (alvo.mascara) {
              contexto.fillStyle = '#ffffff';
              contexto.fillRect(0, 0, doc.width, doc.height);
            } else contexto.clearRect(0, 0, doc.width, doc.height);
            contexto.imageSmoothingEnabled = true;
            contexto.imageSmoothingQuality = 'high';
            contexto.setTransform(...comando.matriz);
            contexto.drawImage(copia, 0, 0);
            contexto.restore();
          }
        });
      }
      case 'DistorcerCamada': {
        const camada = doc.camada(comando.id);
        const numeros = [
          comando.origem.x,
          comando.origem.y,
          comando.origem.width,
          comando.origem.height,
          ...comando.cantos.flatMap(({ x, y }) => [x, y]),
        ];
        if (!camada || numeros.some((valor) => !Number.isFinite(valor))) return null;
        const origem = limitarArea(comando.origem, doc);
        if (!origem) return null;
        if (camada.locked || camada.bloqueioPosicao) {
          this.motivoRecusa = 'bloqueada';
          return null;
        }
        const alvos = this.alvosDa(comando.id);
        return this.alterarDocumento(comando, 'Distorcer', alvos, () => {
          for (const alvo of alvos) {
            const recorte = document.createElement('canvas');
            recorte.width = origem.width;
            recorte.height = origem.height;
            recorte
              .getContext('2d')!
              .drawImage(
                doc.canvasDo(alvo),
                origem.x,
                origem.y,
                origem.width,
                origem.height,
                0,
                0,
                origem.width,
                origem.height,
              );
            const contexto = doc.contexto(alvo);
            contexto.save();
            if (alvo.mascara) {
              contexto.fillStyle = '#ffffff';
              contexto.fillRect(0, 0, doc.width, doc.height);
            } else contexto.clearRect(0, 0, doc.width, doc.height);
            contexto.imageSmoothingEnabled = true;
            contexto.imageSmoothingQuality = 'high';
            desenharDistorcido(contexto, recorte, origem, comando.cantos, 24);
            contexto.restore();
          }
        });
      }
      case 'MesclarAbaixo': {
        const posicao = indice(comando.id);
        if (posicao <= 0) {
          this.motivoRecusa = 'sem-camada-abaixo';
          return null;
        }
        const cima = doc.camada(comando.id)!;
        const baixo = doc.layers[posicao - 1];
        estrutura.camadas.splice(posicao, 1);
        const base = estrutura.camadas[posicao - 1];
        delete base.temMascara;
        delete base.mascaraAtiva;
        estrutura.ativa = baixo.id;
        estrutura.editandoMascara = false;
        this.limparGruposVazios(estrutura);
        return this.alterarDocumento(
          comando,
          'Mesclar abaixo',
          [...this.alvosDa(cima.id), ...this.alvosDa(baixo.id)],
          () => {
            // A máscara da camada de baixo é aplicada aos pixels antes de receber a de cima.
            const mesclada = document.createElement('canvas');
            mesclada.width = doc.width;
            mesclada.height = doc.height;
            const contexto = mesclada.getContext('2d', { willReadFrequently: true })!;
            desenharCamadaSobre(contexto, {
              ...baixo,
              opacity: 1,
              modo: 'normal',
              efeitos: undefined,
            });
            desenharCamadaSobre(contexto, cima);
            doc.aplicarEstrutura(estrutura);
            const destino = doc.contexto({ camada: baixo.id });
            destino.clearRect(0, 0, doc.width, doc.height);
            destino.drawImage(mesclada, 0, 0);
          },
        );
      }
      case 'MesclarVisiveis':
      case 'AchatarImagem': {
        const achatar = comando.tipo === 'AchatarImagem';
        const visiveis = estrutura.camadas.filter((camada) => camada.visible);
        if (!achatar && visiveis.length < 2) return null;
        const novoId = achatar ? estrutura.camadas[0].id : comando.novoId;
        const topo = Math.max(...visiveis.map((camada) => indice(camada.id)));
        const resultado: PropriedadesCamada = {
          ...propriedadesPadrao(novoId, achatar ? 'Papel' : 'Camadas mescladas'),
          ...(achatar || visiveis.some((camada) => camada.fundo) ? { fundo: true } : {}),
        };
        const restantes = achatar
          ? [resultado]
          : estrutura.camadas.flatMap((camada, i) =>
              camada.visible ? (i === topo ? [resultado] : []) : [camada],
            );
        if (!achatar) delete resultado.grupo;
        const nova: EstruturaDocumento = {
          camadas: restantes,
          grupos: estrutura.grupos,
          ativa: novoId,
          editandoMascara: false,
        };
        this.limparGruposVazios(nova);
        const afetadas = achatar
          ? this.todosOsAlvos()
          : [...visiveis.flatMap((camada) => this.alvosDa(camada.id)), { camada: novoId }];
        return this.alterarDocumento(
          comando,
          achatar ? 'Achatar imagem' : 'Mesclar visíveis',
          afetadas,
          () => {
            const imagem = this.composto();
            doc.aplicarEstrutura(nova);
            const alvo = { camada: novoId };
            const destino = doc.contexto(alvo);
            destino.clearRect(0, 0, doc.width, doc.height);
            if (achatar) {
              // Como no paint: o que era transparente vira papel branco.
              destino.fillStyle = '#ffffff';
              destino.fillRect(0, 0, doc.width, doc.height);
              const camada = document.createElement('canvas');
              camada.width = doc.width;
              camada.height = doc.height;
              camada.getContext('2d')!.putImageData(imagem, 0, 0);
              destino.drawImage(camada, 0, 0);
            } else doc.aplicarPixels(imagem, 0, 0, alvo);
          },
        );
      }
      case 'AgruparCamadas': {
        const ids = new Set(comando.ids.filter((id) => indice(id) >= 0));
        if (!ids.size) return null;
        const membros = estrutura.camadas.filter((camada) => ids.has(camada.id));
        const outras = estrutura.camadas.filter((camada) => !ids.has(camada.id));
        const topo = Math.max(...membros.map((camada) => indice(camada.id)));
        // As camadas do grupo ficam juntas, onde estava a mais alta delas.
        const acimaDoGrupo = estrutura.camadas
          .slice(topo + 1)
          .filter((camada) => !ids.has(camada.id)).length;
        for (const camada of membros) camada.grupo = comando.grupoId;
        outras.splice(outras.length - acimaDoGrupo, 0, ...membros);
        estrutura.camadas = outras;
        estrutura.grupos.push({
          id: comando.grupoId,
          name: comando.nome,
          visible: true,
          opacity: 1,
          modo: 'normal',
          recolhido: false,
        });
        this.limparGruposVazios(estrutura);
        return mudarEstrutura('Agrupar camadas', estrutura);
      }
      case 'Desagrupar': {
        if (!estrutura.grupos.some((grupo) => grupo.id === comando.grupoId)) return null;
        for (const camada of estrutura.camadas)
          if (camada.grupo === comando.grupoId) delete camada.grupo;
        estrutura.grupos = estrutura.grupos.filter((grupo) => grupo.id !== comando.grupoId);
        return mudarEstrutura('Desagrupar', estrutura);
      }
      case 'AlterarGrupo': {
        const grupo = estrutura.grupos.find((item) => item.id === comando.id);
        if (!grupo) return null;
        Object.assign(grupo, structuredClone(comando.propriedades));
        grupo.opacity = Math.min(1, Math.max(0, grupo.opacity));
        return mudarEstrutura('Alterar grupo', estrutura);
      }
      case 'AdicionarMascara': {
        const camada = estrutura.camadas[indice(comando.id)];
        if (!camada || camada.temMascara) return null;
        camada.temMascara = true;
        camada.mascaraAtiva = true;
        estrutura.ativa = comando.id;
        estrutura.editandoMascara = true;
        const alvo = { camada: comando.id, mascara: true };
        return this.alterarDocumento(comando, 'Adicionar máscara', [alvo], () => {
          doc.aplicarEstrutura(estrutura);
          if (!comando.area) return;
          // Máscara a partir da seleção: só a área selecionada fica visível.
          const contexto = doc.contexto(alvo);
          contexto.fillStyle = '#000000';
          contexto.fillRect(0, 0, doc.width, doc.height);
          contexto.fillStyle = '#ffffff';
          contexto.fill(caminhoDaSelecao(comando.area, comando.mascara), 'evenodd');
        });
      }
      case 'AplicarMascara': {
        const camada = doc.camada(comando.id);
        const propriedades = estrutura.camadas[indice(comando.id)];
        if (!camada?.mascara || !propriedades) return null;
        delete propriedades.temMascara;
        delete propriedades.mascaraAtiva;
        estrutura.editandoMascara = false;
        return this.alterarDocumento(comando, 'Aplicar máscara', this.alvosDa(comando.id), () => {
          const aplicada = document.createElement('canvas');
          aplicada.width = doc.width;
          aplicada.height = doc.height;
          desenharCamadaSobre(aplicada.getContext('2d', { willReadFrequently: true })!, {
            ...camada,
            opacity: 1,
            modo: 'normal',
            mascaraAtiva: true,
            efeitos: undefined,
          });
          doc.aplicarEstrutura(estrutura);
          const destino = doc.contexto({ camada: comando.id });
          destino.clearRect(0, 0, doc.width, doc.height);
          destino.drawImage(aplicada, 0, 0);
        });
      }
      case 'ExcluirMascara': {
        const propriedades = estrutura.camadas[indice(comando.id)];
        if (!propriedades?.temMascara) return null;
        delete propriedades.temMascara;
        delete propriedades.mascaraAtiva;
        estrutura.editandoMascara = false;
        return mudarEstrutura('Excluir máscara', estrutura, [
          { camada: comando.id, mascara: true },
        ]);
      }
    }
  }

  private rotuloDaAlteracao(propriedades: Record<string, unknown>): string {
    const chaves = Object.keys(propriedades);
    if (chaves.length !== 1) return 'Propriedades da camada';
    return (
      (
        {
          name: 'Renomear camada',
          visible: propriedades.visible ? 'Mostrar camada' : 'Ocultar camada',
          opacity: 'Opacidade da camada',
          modo: 'Modo de mesclagem',
          locked: 'Bloqueio da camada',
          bloqueioTransparencia: 'Bloquear transparência',
          bloqueioPosicao: 'Bloquear posição',
          etiqueta: 'Etiqueta da camada',
          recorte: 'Máscara de recorte',
          mascaraAtiva: 'Ligar ou desligar máscara',
          efeitos: 'Efeitos da camada',
        } as Record<string, string>
      )[chaves[0]] ?? 'Propriedades da camada'
    );
  }

  private limparGruposVazios(estrutura: EstruturaDocumento) {
    const usados = new Set(estrutura.camadas.map((camada) => camada.grupo).filter(Boolean));
    estrutura.grupos = estrutura.grupos.filter((grupo) => usados.has(grupo.id));
  }

  // ---- Pintura na camada ativa ---------------------------------------------------------

  private tracar(original: ComandoTraco): EntradaComando | null {
    // Borracha numa camada que não é o papel de fundo (nem máscara): apaga para transparência.
    const alvo = this.doc.alvoAtivo();
    const comando =
      original.ferramenta === 'eraser' &&
      !original.substituirCor &&
      !alvo.mascara &&
      !this.doc.activeLayer.fundo
        ? { ...original, transparente: true }
        : original;
    const [inicio, ...pontos] = comando.pontos;
    if (!inicio) return null;
    let area = areaDoSegmento(inicio, inicio, comando);
    let anterior = inicio;
    for (const ponto of pontos) {
      area = unirAreas(area, areaDoSegmento(anterior, ponto, comando));
      anterior = ponto;
    }
    if (comando.ferramenta === 'eraser' && comando.substituirCor) {
      const recorte = limitarArea(area, this.doc);
      if (!recorte) return null;
      const depois = this.doc.lerPixels(recorte);
      aplicarBorrachaDeCor(depois, recorte, comando.pontos, comando);
      return this.escrever(comando, 'Borracha de cor', recorte, depois);
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

  private colar(comando: Extract<Comando, { tipo: 'ColarImagem' }>): EntradaComando | null {
    const { x, y, papel, tamanho } = comando;
    const imagem = desserializarImagem(comando.imagem);
    const destino = {
      x,
      y,
      width: tamanho?.largura ?? imagem.width,
      height: tamanho?.altura ?? imagem.height,
    };
    validarDimensoes(destino.width, destino.height);
    const limites = papel ? { width: papel.largura, height: papel.altura } : this.doc;
    const area = limitarArea(destino, limites);
    if (!area) return null;
    const origem = { x: 0, y: 0, width: imagem.width, height: imagem.height };
    const recorte = prepararRecorte(imagem, origem, undefined, comando.corTransparente);
    if (!papel) {
      return this.pintar(comando, 'Colar seleção', area, (ctx) => {
        pintarRecorte(ctx, recorte, null, destino);
      });
    }
    // A imagem é maior que o papel: todas as camadas crescem e a imagem entra na ativa.
    return this.alterarDocumento(comando, 'Colar seleção', this.todosOsAlvos(), () => {
      this.redimensionarTodas(papel.largura, papel.altura, papel.fundo);
      const pixels = recorte.imagem
        .getContext('2d')!
        .getImageData(0, 0, origem.width, origem.height);
      const ajustada = redimensionarEInclinar(pixels, destino.width, destino.height, 0, 0);
      const visivel =
        area.width === ajustada.width && area.height === ajustada.height
          ? ajustada
          : recortarPixels(ajustada, { ...area, x: area.x - x, y: area.y - y });
      const camada = this.doc.copiarPixels();
      sobreporPixels(visivel, camada, area.x, area.y);
      this.doc.aplicarPixels(camada, 0, 0);
    });
  }

  private pintar(
    comando: Comando,
    label: string,
    limites: Rect,
    pintarNaCamada: (ctx: CanvasRenderingContext2D) => void,
  ): EntradaComando | null {
    const area = limitarArea(limites, this.doc);
    if (!area) return null;
    const alvo = this.doc.alvoAtivo();
    const before = this.doc.lerPixels(area, alvo);
    let after: PixelBuffer;
    try {
      pintarNaCamada(this.doc.contexto(alvo));
      after = this.doc.lerPixels(area, alvo);
    } catch (erro) {
      this.doc.aplicarPixels(before, area.x, area.y, alvo);
      throw erro;
    }
    if (this.preservaAlfa(alvo)) {
      after = preservarAlfa(before, after);
      this.doc.aplicarPixels(after, area.x, area.y, alvo);
    }
    if (pixelsIguais(before, after)) return null;
    return this.registrarPixels(comando, label, [{ alvo, rect: area, before, after }]);
  }

  private escrever(
    comando: Comando,
    label: string,
    area: Rect,
    novos: PixelBuffer,
  ): EntradaComando | null {
    const alvo = this.doc.alvoAtivo();
    const before = this.doc.lerPixels(area, alvo);
    const after = this.preservaAlfa(alvo) ? preservarAlfa(before, novos) : novos;
    if (pixelsIguais(before, after)) return null;
    this.doc.aplicarPixels(after, area.x, area.y, alvo);
    return this.registrarPixels(comando, label, [{ alvo, rect: area, before, after }]);
  }

  private preservaAlfa(alvo: Alvo): boolean {
    return !alvo.mascara && Boolean(this.doc.camada(alvo.camada)?.bloqueioTransparencia);
  }

  private transformar(
    comando: ComandoTransformacao,
    label: string,
    operacao: (imagem: PixelBuffer) => PixelBuffer,
  ): EntradaComando | null {
    if (!comando.area) {
      // A imagem inteira: todas as camadas e máscaras giram juntas.
      return this.alterarDocumento(comando, label, this.todosOsAlvos(), () => {
        const novos = this.todosOsAlvos().map(
          (alvo) => [alvo, operacao(this.doc.copiarPixels(alvo))] as const,
        );
        const [, primeira] = novos[0];
        this.doc.redimensionarDocumento(primeira.width, primeira.height);
        for (const [alvo, pixels] of novos) this.doc.aplicarPixels(pixels, 0, 0, alvo);
      });
    }
    if (this.doc.activeLayer.locked) {
      this.motivoRecusa = 'bloqueada';
      return null;
    }
    const papel = this.doc.copiarPixels();
    const origem = limitarArea(comando.area, papel);
    if (!origem) return null;
    const recorte = recortarPixels(papel, origem);
    const imagem = operacao(recorte);
    if (imagem === recorte) return null;
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

  // ---- Documento inteiro, lote e histórico ---------------------------------------------

  /** Pixels e máscara de uma camada, se existirem. */
  private alvosDa(id: string): Alvo[] {
    const camada = this.doc.camada(id);
    if (!camada) return [];
    return camada.mascara ? [{ camada: id }, { camada: id, mascara: true }] : [{ camada: id }];
  }

  private todosOsAlvos(): Alvo[] {
    return this.doc.layers.flatMap(({ id }) => this.alvosDa(id));
  }

  /** O que se vê, como pixels (camadas visíveis compostas). */
  private composto(): ImageData {
    return this.doc.composto(undefined, comporDocumento);
  }

  /** Muda o papel de todas as camadas. A camada de fundo ganha `fundo`; as outras, transparência. */
  private redimensionarTodas(largura: number, altura: number, fundo: string) {
    const novos = this.todosOsAlvos().map((alvo) => {
      const camada = this.doc.camada(alvo.camada)!;
      const cor = alvo.mascara ? '#ffffff' : camada.fundo ? fundo : TRANSPARENTE;
      return [alvo, redimensionarPapel(this.doc.copiarPixels(alvo), largura, altura, cor)] as const;
    });
    this.doc.redimensionarDocumento(largura, altura);
    for (const [alvo, pixels] of novos) this.doc.aplicarPixels(pixels, 0, 0, alvo);
  }

  /**
   * Executa uma mudança que pode alterar estrutura, tamanho, nome, DPI e os pixels inteiros de
   * algumas camadas, e guarda o antes/depois só do que mudou. `alvos` lista as camadas cujos
   * pixels podem mudar (as que existem antes ou depois da mudança).
   */
  private alterarDocumento(
    comando: Comando,
    label: string,
    alvos: Alvo[],
    mudanca: () => void,
  ): EntradaComando | null {
    const { doc } = this;
    const capturar = () =>
      new Map(
        alvos
          .filter((alvo) => doc.existe(alvo))
          .map((alvo) => [chaveDoAlvo(alvo), doc.copiarPixels(alvo)]),
      );
    const estruturaAntes = doc.estrutura();
    const tamanhoAntes = { largura: doc.width, altura: doc.height };
    const nomeAntes = doc.name;
    const dpiAntes = doc.dpi;
    const pixelsAntes = capturar();
    mudanca();
    const estruturaDepois = doc.estrutura();
    const tamanhoDepois = { largura: doc.width, altura: doc.height };
    const pixelsDepois = capturar();

    const alteracoes: AlteracaoPixels[] = [];
    for (const alvo of alvos) {
      const chave = chaveDoAlvo(alvo);
      const before = pixelsAntes.get(chave) ?? SEM_PIXELS;
      const after = pixelsDepois.get(chave) ?? SEM_PIXELS;
      if (alteracoes.some((alteracao) => chaveDoAlvo(alteracao.alvo) === chave)) continue;
      if (pixelsIguais(before, after)) continue;
      alteracoes.push({ alvo, rect: null, before, after });
    }
    const entrada = this.entradaVazia(comando, label);
    entrada.alteracoes = alteracoes;
    if (JSON.stringify(estruturaAntes) !== JSON.stringify(estruturaDepois))
      entrada.estrutura = { antes: estruturaAntes, depois: estruturaDepois };
    if (
      tamanhoAntes.largura !== tamanhoDepois.largura ||
      tamanhoAntes.altura !== tamanhoDepois.altura
    )
      entrada.dimensoes = { antes: tamanhoAntes, depois: tamanhoDepois };
    if (nomeAntes !== doc.name) entrada.nome = { antes: nomeAntes, depois: doc.name };
    if (dpiAntes !== doc.dpi) entrada.dpi = { antes: dpiAntes, depois: doc.dpi };
    if (
      !alteracoes.length &&
      !entrada.estrutura &&
      !entrada.dimensoes &&
      !entrada.nome &&
      !entrada.dpi
    )
      return null;
    this.anotar(entrada);
    return this.compat(entrada);
  }

  private lote(comando: Extract<Comando, { tipo: 'Lote' }>): EntradaComando | null {
    const subentradas: EntradaComando[] = [];
    try {
      for (const sub of comando.comandos) {
        const entrada = this.aplicar(sub);
        if (entrada) subentradas.push(entrada);
      }
    } catch (erro) {
      for (const entrada of subentradas.reverse()) this.aplicarEntrada(entrada, 'before');
      throw erro;
    }
    if (!subentradas.length) return null;
    const entrada = this.entradaVazia(comando, comando.rotulo);
    entrada.subentradas = subentradas;
    return entrada;
  }

  private registrarPixels(
    comando: Comando,
    label: string,
    alteracoes: AlteracaoPixels[],
  ): EntradaComando {
    const entrada = this.entradaVazia(comando, label);
    entrada.alteracoes = alteracoes;
    this.anotar(entrada);
    return this.compat(entrada);
  }

  private entradaVazia(comando: Comando, label: string): EntradaComando {
    return {
      comando: structuredClone(comando),
      label,
      camada: this.doc.activeLayerId,
      alteracoes: [],
      rect: null,
      before: SEM_PIXELS,
      after: SEM_PIXELS,
    };
  }

  /** Campos da 0.2 (rect, before, after, camada) a partir da primeira alteração. */
  private compat(entrada: EntradaComando): EntradaComando {
    const [primeira] = entrada.alteracoes;
    if (primeira && entrada.alteracoes.length === 1 && !entrada.estrutura) {
      entrada.rect = primeira.rect;
      entrada.before = primeira.before;
      entrada.after = primeira.after;
      entrada.camada = primeira.alvo.camada;
    }
    return entrada;
  }

  /** Registra o que mudou, para a tela recompor e o autosave gravar. */
  private anotar(entrada: EntradaComando) {
    for (const { alvo, rect } of entrada.alteracoes)
      this.ultimasAlteracoes.push({ alvo, area: rect });
    if (entrada.estrutura || entrada.dimensoes || entrada.nome || entrada.dpi)
      this.estruturaMudou = true;
  }

  private restaurar(entrada: EntradaComando | null, lado: 'before' | 'after'): boolean {
    this.ultimasAlteracoes = [];
    this.estruturaMudou = false;
    this.ultimaSelecaoTransformada = null;
    if (!entrada) return false;
    this.aplicarEntrada(entrada, lado);
    return true;
  }

  private aplicarEntrada(entrada: EntradaComando, lado: 'before' | 'after') {
    const { doc } = this;
    if (entrada.subentradas) {
      const ordem = lado === 'before' ? [...entrada.subentradas].reverse() : entrada.subentradas;
      for (const sub of ordem) this.aplicarEntrada(sub, lado);
      return;
    }
    const chave = lado === 'before' ? 'antes' : 'depois';
    if (entrada.dimensoes) {
      const { largura, altura } = entrada.dimensoes[chave];
      doc.redimensionarDocumento(largura, altura);
    }
    if (entrada.estrutura) doc.aplicarEstrutura(entrada.estrutura[chave]);
    for (const alteracao of entrada.alteracoes) {
      const pixels = alteracao[lado];
      if (!pixels.width || !doc.existe(alteracao.alvo)) continue;
      const { x, y } = alteracao.rect ?? { x: 0, y: 0 };
      if (!alteracao.rect) doc.contexto(alteracao.alvo).clearRect(0, 0, doc.width, doc.height);
      doc.aplicarPixels(pixels, x, y, alteracao.alvo);
    }
    if (entrada.nome) doc.name = entrada.nome[chave];
    if (entrada.dpi) doc.dpi = entrada.dpi[chave];
    this.anotar(entrada);
  }
}
