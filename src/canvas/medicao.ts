type FerramentaDoTraco = 'pincel' | 'spray';
export type FaseDoTraco = 'inicio' | 'movimento' | 'fim';

export type OperacaoMedida =
  | `${FerramentaDoTraco}:${FaseDoTraco}`
  | 'spray:quadro'
  | 'balde'
  | 'desfazer'
  | 'refazer'
  | `historico:${FerramentaDoTraco | 'balde' | 'desfazer' | 'refazer'}`;

interface GravacaoMedida {
  bytes: number;
  blocos: number;
}

interface SessaoMedida {
  inicio: number;
  medidas: Partial<Record<OperacaoMedida, number[]>>;
  tarefasLongas: { inicio: number; duracao: number }[];
  gravacoes: GravacaoMedida[];
}

interface MemoriaJS {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export const medicaoAtiva =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('medir') === '1';

let sessao: SessaoMedida | null = null;
let lerBytesDoEspelho: (() => number) | null = null;

function recolherTarefasLongas(entradas: PerformanceEntry[]) {
  if (!sessao) return;
  for (const entrada of entradas) {
    if (entrada.startTime >= sessao.inicio)
      sessao.tarefasLongas.push({ inicio: entrada.startTime, duracao: entrada.duration });
  }
}

const observador =
  medicaoAtiva &&
  typeof PerformanceObserver !== 'undefined' &&
  PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver((lista) => recolherTarefasLongas(lista.getEntries()))
    : null;

observador?.observe({ type: 'longtask' });

/** Mede o trabalho síncrono, incluindo a emissão de chamadas ao Canvas 2D. */
export function medirOperacao<T>(nome: OperacaoMedida, executar: () => T): T {
  const ativa = sessao;
  if (!ativa) return executar();
  const intervalo = `rabisco:${nome}`;
  const inicio = performance.mark(`${intervalo}:inicio`);
  try {
    return executar();
  } finally {
    const fim = performance.mark(`${intervalo}:fim`);
    const amostra = performance.measure(intervalo, { start: inicio.startTime, end: fim.startTime });
    (ativa.medidas[nome] ??= []).push(amostra.duration);
    // Cada amostra fica no relatório, sem acumular milhares de entradas na linha do tempo.
    performance.clearMarks(inicio.name);
    performance.clearMarks(fim.name);
    performance.clearMeasures(intervalo);
  }
}

export function definirMemoriaDoEspelho(medir: () => number): void {
  if (medicaoAtiva) lerBytesDoEspelho = medir;
}

export function registrarGravacao(gravacao: GravacaoMedida): void {
  sessao?.gravacoes.push(gravacao);
}

const medidor = {
  iniciar() {
    if (sessao) throw new Error('Encerre a medição em andamento primeiro.');
    sessao = { inicio: performance.now(), medidas: {}, tarefasLongas: [], gravacoes: [] };
  },
  encerrar() {
    if (!sessao) throw new Error('Nenhuma medição foi iniciada.');
    if (observador) recolherTarefasLongas(observador.takeRecords());
    const { medidas, tarefasLongas, gravacoes } = sessao;
    sessao = null;
    return { medidas, tarefasLongas, suportaTarefasLongas: Boolean(observador), gravacoes };
  },
  memoria() {
    const memoria = (performance as Performance & { memory?: MemoriaJS }).memory;
    return {
      heapUsado: memoria?.usedJSHeapSize ?? null,
      heapAlocado: memoria?.totalJSHeapSize ?? null,
      limiteHeap: memoria?.jsHeapSizeLimit ?? null,
      bytesEspelho: lerBytesDoEspelho?.() ?? null,
    };
  },
};

declare global {
  interface Window {
    rabiscoMedicao?: typeof medidor;
  }
}

if (medicaoAtiva) window.rabiscoMedicao = medidor;
