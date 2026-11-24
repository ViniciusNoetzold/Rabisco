import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { LIMITE_LADO, MENSAGEM_DIMENSOES, dimensoesValidas } from '../document/dimensoes';
import './paperResize.css';

export interface TamanhoPapel {
  width: number;
  height: number;
}

type Borda = 'direita' | 'base' | 'canto';

interface Proposta {
  tamanho: TamanhoPapel;
  limitado: boolean;
}

interface Arraste {
  ponteiro: number;
  controle: HTMLButtonElement;
  borda: Borda;
  escala: number;
  origem: TamanhoPapel;
  inicioX: number;
  inicioY: number;
  atualX: number;
  atualY: number;
  proposta: Proposta | null;
}

interface PropsAlcas {
  tamanho: TamanhoPapel;
  zoom: number;
  aoPrevisualizar(tamanho: TamanhoPapel | null): void;
  aoAplicar(tamanho: TamanhoPapel): void;
  aoAvisar(mensagem: string): void;
}

const alcas = [
  { borda: 'direita', rotulo: 'Redimensionar papel pela direita' },
  { borda: 'base', rotulo: 'Redimensionar papel pela base' },
  { borda: 'canto', rotulo: 'Redimensionar papel pelo canto' },
] as const;

function proporTamanho(origem: TamanhoPapel, borda: Borda, dx: number, dy: number, shift: boolean) {
  const { width, height } = origem;
  const deslocamentoX = borda === 'base' ? 0 : dx;
  const deslocamentoY = borda === 'direita' ? 0 : dy;
  let largura = width + deslocamentoX;
  let altura = height + deslocamentoY;

  if (shift) {
    const variacaoX = deslocamentoX / width;
    const variacaoY = deslocamentoY / height;
    const dominante = Math.abs(variacaoX) >= Math.abs(variacaoY) ? variacaoX : variacaoY;
    largura = width * (1 + dominante);
    altura = height * (1 + dominante);
  }

  const desejado = { width: Math.round(largura), height: Math.round(altura) };
  if (dimensoesValidas(desejado.width, desejado.height)) {
    return { tamanho: desejado, limitado: false };
  }

  const arredondar = shift
    ? Math.round
    : (valor: number) => Math.max(1, Math.min(LIMITE_LADO, Math.round(valor)));
  const interpolar = (parcela: number) => ({
    width: arredondar(width + (largura - width) * parcela),
    height: arredondar(height + (altura - height) * parcela),
  });
  const limitadoPorLado = interpolar(1);
  if (dimensoesValidas(limitadoPorLado.width, limitadoPorLado.height)) {
    return { tamanho: limitadoPorLado, limitado: true };
  }

  // Busca o último tamanho válido ao longo do gesto, mantendo a proporção com Shift.
  let minimo = 0;
  let maximo = 1;
  for (let passo = 0; passo < 16; passo++) {
    const meio = (minimo + maximo) / 2;
    const candidato = interpolar(meio);
    if (dimensoesValidas(candidato.width, candidato.height)) minimo = meio;
    else maximo = meio;
  }
  return { tamanho: interpolar(minimo), limitado: true };
}

export function PaperResizeHandles({
  tamanho,
  zoom,
  aoPrevisualizar,
  aoAplicar,
  aoAvisar,
}: PropsAlcas) {
  const arraste = useRef<Arraste | null>(null);
  const contorno = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ aoPrevisualizar, aoAplicar, aoAvisar });
  callbacks.current = { aoPrevisualizar, aoAplicar, aoAvisar };

  function mostrarPrevia(gesto: Arraste, shift: boolean) {
    const proposta = proporTamanho(
      gesto.origem,
      gesto.borda,
      (gesto.atualX - gesto.inicioX) / gesto.escala,
      (gesto.atualY - gesto.inicioY) / gesto.escala,
      shift,
    );
    const anterior = gesto.proposta;
    if (
      anterior?.tamanho.width === proposta.tamanho.width &&
      anterior.tamanho.height === proposta.tamanho.height &&
      anterior.limitado === proposta.limitado
    )
      return;
    gesto.proposta = proposta;
    const elemento = contorno.current!;
    elemento.style.width = `${proposta.tamanho.width * gesto.escala}px`;
    elemento.style.height = `${proposta.tamanho.height * gesto.escala}px`;
    elemento.toggleAttribute('data-limited', proposta.limitado);
    elemento.hidden = false;
    callbacks.current.aoPrevisualizar(proposta.tamanho);
  }

  function encerrar() {
    const gesto = arraste.current;
    if (!gesto) return null;
    arraste.current = null;
    if (gesto.controle.hasPointerCapture(gesto.ponteiro)) {
      gesto.controle.releasePointerCapture(gesto.ponteiro);
    }
    if (contorno.current) contorno.current.hidden = true;
    callbacks.current.aoPrevisualizar(null);
    return gesto;
  }

  useLayoutEffect(() => {
    const gesto = arraste.current;
    if (
      gesto &&
      (gesto.origem.width !== tamanho.width ||
        gesto.origem.height !== tamanho.height ||
        gesto.escala !== zoom)
    ) {
      encerrar();
    }
  }, [tamanho.width, tamanho.height, zoom]);

  useEffect(() => {
    function tecla(evento: globalThis.KeyboardEvent) {
      if (!arraste.current) return;
      if (evento.key === 'Escape' && evento.type === 'keydown') {
        evento.preventDefault();
        evento.stopPropagation();
        encerrar();
      } else if (evento.key === 'Shift') {
        mostrarPrevia(arraste.current, evento.shiftKey);
      }
    }
    function cancelarAoPerderFoco() {
      encerrar();
    }

    window.addEventListener('keydown', tecla, true);
    window.addEventListener('keyup', tecla, true);
    window.addEventListener('blur', cancelarAoPerderFoco);
    return () => {
      window.removeEventListener('keydown', tecla, true);
      window.removeEventListener('keyup', tecla, true);
      window.removeEventListener('blur', cancelarAoPerderFoco);
      encerrar();
    };
  }, []);

  function aplicar(origem: TamanhoPapel, proposta: Proposta) {
    const { tamanho: destino, limitado } = proposta;
    if (origem.width !== destino.width || origem.height !== destino.height) {
      callbacks.current.aoAplicar(destino);
    }
    if (limitado) callbacks.current.aoAvisar(`Tamanho ajustado ao limite. ${MENSAGEM_DIMENSOES}`);
  }

  function iniciar(evento: PointerEvent<HTMLButtonElement>, borda: Borda) {
    if (evento.button !== 0 || !evento.isPrimary || arraste.current) return;
    evento.preventDefault();
    const controle = evento.currentTarget;
    controle.focus({ preventScroll: true });
    controle.setPointerCapture(evento.pointerId);
    arraste.current = {
      ponteiro: evento.pointerId,
      controle,
      borda,
      escala: zoom,
      origem: tamanho,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      atualX: evento.clientX,
      atualY: evento.clientY,
      proposta: null,
    };
    mostrarPrevia(arraste.current, evento.shiftKey);
  }

  function mover(evento: PointerEvent<HTMLButtonElement>) {
    const gesto = arraste.current;
    if (gesto?.ponteiro !== evento.pointerId) return;
    gesto.atualX = evento.clientX;
    gesto.atualY = evento.clientY;
    mostrarPrevia(gesto, evento.shiftKey);
  }

  function terminar(evento: PointerEvent<HTMLButtonElement>) {
    mover(evento);
    if (arraste.current?.ponteiro !== evento.pointerId) return;
    const gesto = encerrar();
    if (gesto?.proposta) aplicar(gesto.origem, gesto.proposta);
  }

  function cancelar(evento: PointerEvent<HTMLButtonElement>) {
    if (arraste.current?.ponteiro === evento.pointerId) encerrar();
  }

  function ajustarComSeta(evento: KeyboardEvent<HTMLButtonElement>, borda: Borda) {
    if (arraste.current || evento.ctrlKey || evento.altKey || evento.metaKey) return;
    const dx = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    const dy = evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowUp' ? -1 : 0;
    if ((!dx || borda === 'base') && (!dy || borda === 'direita')) return;
    evento.preventDefault();
    aplicar(tamanho, proporTamanho(tamanho, borda, dx, dy, evento.shiftKey));
  }

  return (
    <>
      <div ref={contorno} className="paper-resize-preview" hidden aria-hidden="true" />
      {alcas.map(({ borda, rotulo }) => (
        <button
          key={borda}
          type="button"
          className={`paper-resize-handle paper-resize-handle--${borda}`}
          aria-label={rotulo}
          title={`${rotulo}. Arraste ou use as setas. Shift mantém a proporção.`}
          onPointerDown={(evento) => iniciar(evento, borda)}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={cancelar}
          onLostPointerCapture={cancelar}
          onKeyDown={(evento) => ajustarComSeta(evento, borda)}
        />
      ))}
    </>
  );
}
