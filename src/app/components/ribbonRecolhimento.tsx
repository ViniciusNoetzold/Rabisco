import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/** Largura de um grupo recolhido (botão grande com ícone, nome e seta). */
export const LARGURA_RECOLHIDO = 73;

interface Recolhimento {
  recolhidos: ReadonlySet<string>;
  compactarCores: boolean;
}

export const RecolhimentoContexto = createContext<Recolhimento>({
  recolhidos: new Set(),
  compactarCores: false,
});

export function useRecolhimento() {
  return useContext(RecolhimentoContexto);
}

interface GrupoMedido {
  chave: string;
  prioridade: number;
  largura: number;
}

/**
 * Decide quais grupos do ribbon se recolhem para caber na largura, como no paint do
 * Windows 7: os de menor prioridade recolhem primeiro. Guarda a largura natural de cada grupo
 * (medida quando está aberto) para saber quando ele volta a caber.
 */
export function decidirRecolhimento(
  grupos: GrupoMedido[],
  disponivel: number,
): { recolhidos: Set<string>; sobra: number } {
  let total = grupos.reduce((soma, { largura }) => soma + largura, 0);
  const recolhidos = new Set<string>();
  const candidatos = grupos
    .filter(({ prioridade }) => Number.isFinite(prioridade))
    .sort((a, b) => a.prioridade - b.prioridade);
  for (const grupo of candidatos) {
    if (total <= disponivel) break;
    if (grupo.largura <= LARGURA_RECOLHIDO) continue;
    recolhidos.add(grupo.chave);
    total -= grupo.largura - LARGURA_RECOLHIDO;
  }
  return { recolhidos, sobra: disponivel - total };
}

/** Mede o ribbon e os grupos a cada mudança de largura ou de conteúdo. */
export function useMedirRibbon(ribbon: RefObject<HTMLElement | null>, aba: string) {
  const larguras = useRef(new Map<string, number>());
  const [estado, setEstado] = useState<Recolhimento>({
    recolhidos: new Set(),
    compactarCores: false,
  });

  const medir = useCallback(() => {
    const elemento = ribbon.current;
    if (!elemento) return;
    const estilo = getComputedStyle(elemento);
    const disponivel =
      elemento.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    const grupos: GrupoMedido[] = [];
    const elementos = elemento.querySelectorAll<HTMLElement>(':scope > .ribbon-group');
    for (const [indice, grupo] of elementos.entries()) {
      const chave = grupo.dataset.grupo ?? `#${indice}`;
      const prioridade = Number(grupo.dataset.prioridade ?? Infinity);
      // Grupo recolhido ou compactado: vale a largura natural medida quando estava aberto.
      if (!grupo.hasAttribute('data-recolhido') && !grupo.hasAttribute('data-compacto')) {
        larguras.current.set(`${aba}:${chave}`, grupo.getBoundingClientRect().width);
      }
      grupos.push({
        chave,
        prioridade,
        largura: larguras.current.get(`${aba}:${chave}`) ?? grupo.getBoundingClientRect().width,
      });
    }
    const { recolhidos, sobra } = decidirRecolhimento(grupos, disponivel);
    // A paleta perde a segunda linha quando nem com tudo recolhido o ribbon cabe.
    const compactarCores = sobra < 0;
    setEstado((anterior) =>
      anterior.compactarCores === compactarCores &&
      anterior.recolhidos.size === recolhidos.size &&
      [...recolhidos].every((chave) => anterior.recolhidos.has(chave))
        ? anterior
        : { recolhidos, compactarCores },
    );
  }, [aba, ribbon]);

  useLayoutEffect(() => {
    medir();
  });

  useLayoutEffect(() => {
    const elemento = ribbon.current;
    if (!elemento) return;
    const observador = new ResizeObserver(() => medir());
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [medir, ribbon]);

  return estado;
}
