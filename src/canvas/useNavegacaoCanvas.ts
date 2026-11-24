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
import './navegacao-canvas.css';

interface OpcoesNavegacao {
  viewport: RefObject<HTMLDivElement | null>;
  palco: RefObject<HTMLDivElement | null>;
  zoom: number;
  lupaAtiva: boolean;
  cancelarDesenho(): void;
  bloqueada?: boolean | (() => boolean);
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
    if (arraste.current || bloqueiaToques.current) area.dataset.pan = 'ativo';
    else if (espaco.current) area.dataset.pan = 'pronto';
    else delete area.dataset.pan;
  }

  function pontoNoDocumento(tela: Point): Point | null {
    const caixa = palco.current?.getBoundingClientRect();
    if (!caixa) return null;
    const fator = zoomRenderizado.current;
    return { x: (tela.x - caixa.left) / fator, y: (tela.y - caixa.top) / fator };
  }

  function moverAncora({ documento, tela }: Ancora) {
    const area = viewport.current;
    const caixa = palco.current?.getBoundingClientRect();
    if (!area || !caixa) return;
    const fator = zoomRenderizado.current;
    area.scrollLeft += caixa.left + documento.x * fator - tela.x;
    area.scrollTop += caixa.top + documento.y * fator - tela.y;
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
    const caixa = folha.getBoundingClientRect();
    setPreviaLupa(
      areaDeZoom(
        documento,
        {
          width: area.clientWidth,
          height: area.clientHeight,
        },
        {
          width: caixa.width / fator,
          height: caixa.height / fator,
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
        ? { fator: zoomRenderizado.current, distancia: medicao.distancia, documento }
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
      atualizarCursor();
    }

    function teclaSolta(evento: KeyboardEvent) {
      if (evento.code === 'Space') soltarEspaco();
    }

    area.addEventListener('wheel', roda, { passive: false });
    window.addEventListener('keydown', pressionarEspaco);
    window.addEventListener('keyup', teclaSolta);
    window.addEventListener('blur', soltarEspaco);
    return () => {
      area.removeEventListener('wheel', roda);
      window.removeEventListener('keydown', pressionarEspaco);
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
      if (pointerType === 'touch') {
        toques.current.set(pointerId, tela);
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
      if (toques.current.has(pointerId)) {
        toques.current.set(pointerId, tela);
        if (bloqueiaToques.current) {
          const gesto = pinca.current;
          const medicao = meioESeparacao(toques.current.values());
          if (gesto && medicao) {
            const alvo = limitarZoom(gesto.fator * (medicao.distancia / gesto.distancia));
            const indice = indiceDoZoom(alvo);
            const fator = indice === indiceDoZoom(gesto.fator) ? gesto.fator : NIVEIS_ZOOM[indice];
            zoomComAncora(fator, { documento: gesto.documento, tela: medicao.meio });
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

  function encerrarPonteiro(id: number, tela?: Point): boolean {
    const terminouToque = encerraToque(id);
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
