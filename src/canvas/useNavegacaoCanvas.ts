import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from 'react';
import { useEditor } from '../app/store';
import type { Point, Rect } from '../layers/types';
import { areaDeZoom, indiceDoZoom, limitarZoom, nivelSeguinte, NIVEIS_ZOOM } from './zoom';
import { normalizarAngulo, papelParaTela, teclaDeGiro, telaParaPapel } from './vista';
import { vistaAtual } from './vistaAtual';
import './navegacao-canvas.css';

interface OpcoesNavegacao {
  viewport: RefObject<HTMLDivElement | null>;
  palco: RefObject<HTMLDivElement | null>;
  zoom: number;
  lupaAtiva: boolean;
  cancelarDesenho(): void;
  bloqueada?: boolean | (() => boolean);
  /** Dois dedos tocando e soltando: desfazer; três: refazer. */
  desfazer?(): void;
  refazer?(): void;
}

type EventosNavegacao = Pick<
  HTMLAttributes<HTMLDivElement>,
  | 'onPointerEnter'
  | 'onPointerLeave'
  | 'onPointerDownCapture'
  | 'onPointerMoveCapture'
  | 'onPointerUpCapture'
  | 'onPointerCancelCapture'
  | 'onLostPointerCaptureCapture'
>;

interface Ancora {
  documento: Point;
  tela: Point;
}

interface Pan {
  ponteiro: number;
  inicio: Point;
  scroll: Point;
}

interface Pinca {
  fator: number;
  distancia: number;
  documento: Point;
  /** Ângulo entre os dois dedos no começo e a rotação da vista nessa hora. */
  angulo: number;
  rotacao: number;
}

/** R + arrastar: gira a vista em torno do centro do papel. */
interface Giro {
  ponteiro: number;
  centro: Point;
  angulo: number;
  rotacao: number;
}

/** Dedos na tela para "dois dedos desfazem, três refazem". */
interface Toque {
  inicio: number;
  maximo: number;
  moveu: boolean;
}

function anguloEntre(pontos: Iterable<Point>) {
  const [a, b] = pontos;
  return a && b ? (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI : 0;
}

/** Ângulo do ponteiro em volta do centro, em graus. */
function anguloEmVolta(centro: Point, ponto: Point) {
  return (Math.atan2(ponto.y - centro.y, ponto.x - centro.x) * 180) / Math.PI;
}

/** Gira a vista e prende perto dos ângulos retos (ou de 15 em 15° com Shift). */
function girarVista(rotacao: number, prender15: boolean) {
  let alvo = normalizarAngulo(rotacao);
  if (prender15) alvo = normalizarAngulo(Math.round(alvo / 15) * 15);
  else {
    const reto = Math.round(alvo / 90) * 90;
    if (Math.abs(alvo - reto) < 4) alvo = normalizarAngulo(reto);
  }
  if (alvo !== useEditor.getState().rotacaoVista) useEditor.getState().set({ rotacaoVista: alvo });
}

function meioESeparacao(pontos: Iterable<Point>) {
  const [a, b] = pontos;
  if (!a || !b) return null;
  return {
    meio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distancia: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
  };
}

function pontoNaTela(evento: { clientX: number; clientY: number }): Point {
  return { x: evento.clientX, y: evento.clientY };
}

/** Intercepta só os gestos de navegação e mantém o primeiro toque disponível para desenhar. */
export function useNavegacaoCanvas(opcoes: OpcoesNavegacao) {
  const { viewport, palco, zoom, lupaAtiva } = opcoes;
  const atuais = useRef(opcoes);
  atuais.current = opcoes;
  const zoomRenderizado = useRef(zoom);
  const ancoraPendente = useRef<Ancora | null>(null);
  const arraste = useRef<Pan | null>(null);
  const toques = useRef(new Map<number, Point>());
  const bloqueiaToques = useRef(false);
  const pinca = useRef<Pinca | null>(null);
  const toqueDaLupa = useRef<{ ponteiro: number; tela: Point } | null>(null);
  const giro = useRef<Giro | null>(null);
  const toqueMultiplo = useRef<Toque | null>(null);
  /** Viu uma caneta: toques da mão (palma) não desenham mais. */
  const temCaneta = useRef(false);
  const espaco = useRef(false);
  const ponteiroSobre = useRef(false);
  const ultimaPosicaoLupa = useRef<Point | null>(null);
  const [previaLupa, setPreviaLupa] = useState<Rect | null>(null);

  function navegacaoBloqueada() {
    const bloqueio = atuais.current.bloqueada;
    return typeof bloqueio === 'function' ? bloqueio() : bloqueio;
  }

  function atualizarCursor() {
    const area = viewport.current;
    if (!area) return;
    if (giro.current) area.dataset.pan = 'girando';
    else if (teclaDeGiro.segurando) area.dataset.pan = 'girar';
    else if (arraste.current || bloqueiaToques.current) area.dataset.pan = 'ativo';
    else if (espaco.current) area.dataset.pan = 'pronto';
    else delete area.dataset.pan;
  }

  /** Tamanho do papel (px do documento): o tamanho de layout do palco não muda com o giro. */
  function papel() {
    const folha = palco.current;
    const fator = zoomRenderizado.current;
    return folha
      ? { largura: folha.offsetWidth / fator, altura: folha.offsetHeight / fator }
      : null;
  }

  function pontoNoDocumento(tela: Point): Point | null {
    const caixa = palco.current?.getBoundingClientRect();
    const dimensoes = papel();
    if (!caixa || !dimensoes) return null;
    return telaParaPapel(
      tela,
      caixa,
      dimensoes.largura,
      dimensoes.altura,
      zoomRenderizado.current,
      vistaAtual(),
    );
  }

  function moverAncora({ documento, tela }: Ancora) {
    const area = viewport.current;
    const caixa = palco.current?.getBoundingClientRect();
    const dimensoes = papel();
    if (!area || !caixa || !dimensoes) return;
    const agora = papelParaTela(
      documento,
      caixa,
      dimensoes.largura,
      dimensoes.altura,
      zoomRenderizado.current,
      vistaAtual(),
    );
    area.scrollLeft += agora.x - tela.x;
    area.scrollTop += agora.y - tela.y;
  }

  function zoomComAncora(fator: number, ancora: Ancora) {
    const estado = useEditor.getState();
    if (fator === estado.zoom && fator === zoomRenderizado.current) {
      ancoraPendente.current = null;
      moverAncora(ancora);
    } else {
      ancoraPendente.current = ancora;
      if (fator !== estado.zoom) estado.set({ zoom: fator });
    }
  }

  function mostrarLupa(tela: Point | null) {
    ultimaPosicaoLupa.current = tela;
    const area = viewport.current;
    const folha = palco.current;
    const fator = zoomRenderizado.current;
    const seguinte = nivelSeguinte(fator, 1);
    const documento = tela && pontoNoDocumento(tela);
    if (!area || !folha || !documento || fator === seguinte) {
      setPreviaLupa(null);
      return;
    }
    setPreviaLupa(
      areaDeZoom(
        documento,
        {
          width: area.clientWidth,
          height: area.clientHeight,
        },
        {
          width: folha.offsetWidth / fator,
          height: folha.offsetHeight / fator,
        },
        seguinte,
      ),
    );
  }

  function usarLupa(tela: Point, direcao: -1 | 1) {
    const area = viewport.current;
    const documento = pontoNoDocumento(tela);
    if (!area || !documento) return;
    const novo = nivelSeguinte(useEditor.getState().zoom, direcao);
    if (novo === useEditor.getState().zoom) return;
    atuais.current.cancelarDesenho();
    const caixa = area.getBoundingClientRect();
    zoomComAncora(novo, {
      documento,
      tela: {
        x: caixa.left + area.clientLeft + area.clientWidth / 2,
        y: caixa.top + area.clientTop + area.clientHeight / 2,
      },
    });
  }

  function iniciarPinca() {
    const medicao = meioESeparacao(toques.current.values());
    const documento = medicao && pontoNoDocumento(medicao.meio);
    pinca.current =
      medicao && documento
        ? {
            fator: zoomRenderizado.current,
            distancia: medicao.distancia,
            documento,
            angulo: anguloEntre(toques.current.values()),
            rotacao: useEditor.getState().rotacaoVista,
          }
        : null;
  }

  useLayoutEffect(() => {
    zoomRenderizado.current = zoom;
    if (ancoraPendente.current) {
      moverAncora(ancoraPendente.current);
      ancoraPendente.current = null;
    }
    if (lupaAtiva && ultimaPosicaoLupa.current) mostrarLupa(ultimaPosicaoLupa.current);
    else if (!lupaAtiva && ultimaPosicaoLupa.current) mostrarLupa(null);
  }, [zoom, lupaAtiva]);

  useEffect(() => {
    const area = viewport.current;
    if (!area) return;
    let acumulado = 0;
    let ultimoScroll = 0;

    function roda(evento: WheelEvent) {
      if (!evento.ctrlKey || navegacaoBloqueada()) return;
      evento.preventDefault();
      const delta =
        evento.deltaY * (evento.deltaMode === 0 ? 1 : evento.deltaMode === 1 ? 16 : 100);
      if (evento.timeStamp - ultimoScroll > 160 || Math.sign(acumulado) !== Math.sign(delta))
        acumulado = 0;
      ultimoScroll = evento.timeStamp;
      acumulado += delta;
      if (Math.abs(acumulado) < 24) return;
      const direcao = acumulado < 0 ? 1 : -1;
      acumulado = 0;
      const antigo = useEditor.getState().zoom;
      const fator = nivelSeguinte(antigo, direcao);
      const tela = pontoNaTela(evento);
      const documento = pontoNoDocumento(tela);
      if (!documento || antigo === fator) return;
      atuais.current.cancelarDesenho();
      zoomComAncora(fator, { documento, tela });
    }

    function pressionarEspaco(evento: KeyboardEvent) {
      if (evento.code !== 'Space' || evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const alvo = evento.target;
      if (
        navegacaoBloqueada() ||
        (alvo instanceof Element &&
          alvo.closest('input, textarea, select, button, [contenteditable="true"], dialog')) ||
        (!ponteiroSobre.current && !area!.contains(document.activeElement)) ||
        document.querySelector('dialog[open]')
      )
        return;
      evento.preventDefault();
      espaco.current = true;
      atualizarCursor();
    }

    function soltarEspaco() {
      espaco.current = false;
      teclaDeGiro.segurando = false;
      atualizarCursor();
    }

    function teclaSolta(evento: KeyboardEvent) {
      if (evento.code === 'Space') soltarEspaco();
      if (evento.key.toLowerCase() === 'r') {
        teclaDeGiro.segurando = false;
        atualizarCursor();
      }
    }

    /** R segurada: arrastar no papel gira a vista (soltar sem girar escolhe o retângulo). */
    function pressionarR(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() !== 'r' || evento.repeat) return;
      if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
      const alvo = evento.target;
      if (
        alvo instanceof Element &&
        alvo.closest('input, textarea, select, [contenteditable="true"], dialog')
      )
        return;
      teclaDeGiro.segurando = true;
      teclaDeGiro.girou = false;
      atualizarCursor();
    }

    area.addEventListener('wheel', roda, { passive: false });
    window.addEventListener('keydown', pressionarEspaco);
    window.addEventListener('keydown', pressionarR);
    window.addEventListener('keyup', teclaSolta);
    window.addEventListener('blur', soltarEspaco);
    return () => {
      area.removeEventListener('wheel', roda);
      window.removeEventListener('keydown', pressionarEspaco);
      window.removeEventListener('keydown', pressionarR);
      window.removeEventListener('keyup', teclaSolta);
      window.removeEventListener('blur', soltarEspaco);
    };
  }, [viewport, palco]);

  const eventos: EventosNavegacao = {
    onPointerEnter() {
      ponteiroSobre.current = true;
    },
    onPointerLeave() {
      ponteiroSobre.current = false;
      if (ultimaPosicaoLupa.current) mostrarLupa(null);
    },
    onPointerDownCapture(evento) {
      if (navegacaoBloqueada()) return;
      const { currentTarget: area, pointerId, pointerType, button } = evento;
      const tela = pontoNaTela(evento);
      if (pointerType === 'pen') temCaneta.current = true;
      if (pointerType === 'touch') {
        // Com caneta em uso, a palma encostando não desenha (os gestos de dois dedos seguem).
        if (temCaneta.current && toques.current.size === 0 && sobrePapel(evento.target)) {
          toques.current.set(pointerId, tela);
          registrarToque();
          evento.preventDefault();
          evento.stopPropagation();
          return;
        }
        toques.current.set(pointerId, tela);
        registrarToque();
        if (toques.current.size >= 2 || bloqueiaToques.current) {
          if (!bloqueiaToques.current) {
            atuais.current.cancelarDesenho();
            toqueDaLupa.current = null;
          }
          if (!pinca.current && toques.current.size >= 2) iniciarPinca();
          bloqueiaToques.current = true;
          for (const id of toques.current.keys()) area.setPointerCapture(id);
          mostrarLupa(null);
          atualizarCursor();
          evento.preventDefault();
          evento.stopPropagation();
          return;
        }
      }
      if (button === 0 && teclaDeGiro.segurando && sobrePapel(evento.target)) {
        const caixa = palco.current?.getBoundingClientRect();
        if (caixa) {
          atuais.current.cancelarDesenho();
          const centro = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
          giro.current = {
            ponteiro: pointerId,
            centro,
            angulo: anguloEmVolta(centro, tela),
            rotacao: useEditor.getState().rotacaoVista,
          };
          area.setPointerCapture(pointerId);
          atualizarCursor();
          evento.preventDefault();
          evento.stopPropagation();
          return;
        }
      }
      if (button === 1 || (button === 0 && espaco.current)) {
        atuais.current.cancelarDesenho();
        arraste.current = {
          ponteiro: pointerId,
          inicio: tela,
          scroll: { x: area.scrollLeft, y: area.scrollTop },
        };
        area.setPointerCapture(pointerId);
        mostrarLupa(null);
        atualizarCursor();
        evento.preventDefault();
        evento.stopPropagation();
      } else if (lupaAtiva && (button === 0 || button === 2) && sobrePapel(evento.target)) {
        if (pointerType === 'touch') toqueDaLupa.current = { ponteiro: pointerId, tela };
        else usarLupa(tela, button === 2 ? -1 : 1);
        evento.preventDefault();
        evento.stopPropagation();
      }
    },
    onPointerMoveCapture(evento) {
      const { currentTarget: area, pointerId } = evento;
      const tela = pontoNaTela(evento);
      const girando = giro.current;
      if (girando?.ponteiro === pointerId) {
        teclaDeGiro.girou = true;
        girarVista(
          girando.rotacao + anguloEmVolta(girando.centro, tela) - girando.angulo,
          evento.shiftKey,
        );
        evento.stopPropagation();
        return;
      }
      if (toques.current.has(pointerId)) {
        const anterior = toques.current.get(pointerId)!;
        if (toqueMultiplo.current && Math.hypot(tela.x - anterior.x, tela.y - anterior.y) > 2)
          toqueMultiplo.current.moveu ||= Math.hypot(tela.x - anterior.x, tela.y - anterior.y) > 10;
        toques.current.set(pointerId, tela);
        if (bloqueiaToques.current) {
          const gesto = pinca.current;
          const medicao = meioESeparacao(toques.current.values());
          if (gesto && medicao) {
            const alvo = limitarZoom(gesto.fator * (medicao.distancia / gesto.distancia));
            const indice = indiceDoZoom(alvo);
            const fator = indice === indiceDoZoom(gesto.fator) ? gesto.fator : NIVEIS_ZOOM[indice];
            zoomComAncora(fator, { documento: gesto.documento, tela: medicao.meio });
            // Girar os dois dedos gira a vista (pequenas variações não contam).
            const virada = normalizarAngulo(anguloEntre(toques.current.values()) - gesto.angulo);
            if (Math.abs(virada) > 8) {
              if (toqueMultiplo.current) toqueMultiplo.current.moveu = true;
              girarVista(gesto.rotacao + virada, false);
            }
          }
          evento.stopPropagation();
          return;
        }
      }
      const pan = arraste.current;
      if (pan?.ponteiro === pointerId) {
        area.scrollLeft = pan.scroll.x - (tela.x - pan.inicio.x);
        area.scrollTop = pan.scroll.y - (tela.y - pan.inicio.y);
        evento.stopPropagation();
      } else if (lupaAtiva && evento.pointerType !== 'touch') {
        if (sobrePapel(evento.target)) mostrarLupa(tela);
        else if (ultimaPosicaoLupa.current) mostrarLupa(null);
      }
    },
    onPointerUpCapture(evento) {
      if (encerrarPonteiro(evento.pointerId, pontoNaTela(evento))) evento.stopPropagation();
    },
    onPointerCancelCapture(evento) {
      if (encerrarPonteiro(evento.pointerId)) evento.stopPropagation();
    },
    onLostPointerCaptureCapture(evento) {
      if (evento.target === evento.currentTarget && encerrarPonteiro(evento.pointerId)) {
        evento.stopPropagation();
      }
    },
  };

  function encerraToque(id: number) {
    if (!toques.current.delete(id) || !bloqueiaToques.current) return false;
    if (toques.current.size >= 2) iniciarPinca();
    else pinca.current = null;
    if (toques.current.size === 0) bloqueiaToques.current = false;
    atualizarCursor();
    return true;
  }

  /** Conta os dedos de um toque: dois dedos que tocam e soltam rápido desfazem, três refazem. */
  function registrarToque() {
    const agora = performance.now();
    const atual = toqueMultiplo.current;
    if (!atual || toques.current.size === 1)
      toqueMultiplo.current = { inicio: agora, maximo: toques.current.size, moveu: false };
    else atual.maximo = Math.max(atual.maximo, toques.current.size);
  }

  function concluirToque() {
    const toque = toqueMultiplo.current;
    if (!toque || toques.current.size > 0) return;
    toqueMultiplo.current = null;
    if (toque.moveu || performance.now() - toque.inicio > 350) return;
    if (toque.maximo === 2) atuais.current.desfazer?.();
    else if (toque.maximo === 3) atuais.current.refazer?.();
  }

  function encerrarPonteiro(id: number, tela?: Point): boolean {
    if (giro.current?.ponteiro === id) {
      giro.current = null;
      atualizarCursor();
      return true;
    }
    const eraToque = toques.current.has(id);
    const terminouToque = encerraToque(id);
    if (eraToque) concluirToque();
    if (arraste.current?.ponteiro === id) {
      arraste.current = null;
      atualizarCursor();
      return true;
    }
    const toque = toqueDaLupa.current;
    if (toque?.ponteiro === id) {
      toqueDaLupa.current = null;
      if (tela && Math.hypot(tela.x - toque.tela.x, tela.y - toque.tela.y) < 12) usarLupa(tela, 1);
      return true;
    }
    return terminouToque;
  }

  return { eventos, previaLupa: lupaAtiva ? previaLupa : null };
}

function sobrePapel(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.matches('.drawing-canvas');
}
