import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Point } from '../../layers/types';
import {
  curvarNo,
  espelharContornos,
  moverNo,
  type ContornoEditor,
  type EnderecoNo,
} from '../../shapes/editorForma';

export const DIVISOES_DA_GRADE = 16;
export const TAMANHO_PREVIA = 280;
export const QUADRO_PREVIA = { x: 24, y: 24, width: 232, height: 232 };

type FerramentaPonto = 'adicionar' | 'mover' | 'remover';
const FERRAMENTAS: { id: FerramentaPonto; rotulo: string }[] = [
  { id: 'adicionar', rotulo: 'Adicionar ponto' },
  { id: 'mover', rotulo: 'Mover ponto' },
  { id: 'remover', rotulo: 'Remover ponto' },
];

interface GestoPonto {
  id: number;
  original: ContornoEditor[];
  base: ContornoEditor[];
  endereco: EnderecoNo;
  origem: Point;
  ferramenta: 'adicionar' | 'mover';
  mudou: boolean;
}

const MAXIMO_NOS = 64;
const MAXIMO_REVISOES = 40;
const limitar = (valor: number) => Math.max(0, Math.min(valor, 1));

function coordenada(evento: PointerEvent<HTMLCanvasElement>): Point {
  const tela = evento.currentTarget.getBoundingClientRect();
  return {
    x:
      ((evento.clientX - tela.left) * (TAMANHO_PREVIA / tela.width) - QUADRO_PREVIA.x) /
      QUADRO_PREVIA.width,
    y:
      ((evento.clientY - tela.top) * (TAMANHO_PREVIA / tela.height) - QUADRO_PREVIA.y) /
      QUADRO_PREVIA.height,
  };
}

export function useEdicaoPontos(inicial: () => ContornoEditor[], editando: boolean) {
  const [contornos, definirContornos] = useState(inicial);
  const [ferramenta, definirFerramenta] = useState<FerramentaPonto>(
    editando ? 'mover' : 'adicionar',
  );
  const [encaixe, definirEncaixe] = useState(true);
  const [selecao, selecionar] = useState<EnderecoNo | null>(null);
  const [revisoes, definirRevisoes] = useState<ContornoEditor[][]>([]);
  const gesto = useRef<GestoPonto | null>(null);
  const indiceContorno = selecao?.contorno ?? Math.max(0, contornos.length - 1);
  const total = contornos.reduce((quantidade, contorno) => quantidade + contorno.nos.length, 0);

  function guardar(original: ContornoEditor[]) {
    definirRevisoes((anteriores) => [...anteriores.slice(1 - MAXIMO_REVISOES), original]);
  }

  function atualizar(atualizacao: (novos: ContornoEditor[]) => void) {
    const novos = structuredClone(contornos);
    atualizacao(novos);
    guardar(contornos);
    definirContornos(novos);
  }

  function desfazer() {
    if (gesto.current) return;
    const anterior = revisoes.at(-1);
    if (!anterior) return;
    selecionar(null);
    definirContornos(anterior);
    definirRevisoes(revisoes.slice(0, -1));
  }

  function espelhar(eixo: 'x' | 'y') {
    guardar(contornos);
    definirContornos(espelharContornos(contornos, eixo));
  }

  function fecharContorno(fechado: boolean) {
    atualizar((novos) => {
      if (!novos.length) novos.push({ nos: [], fechado });
      else novos[indiceContorno].fechado = fechado;
    });
  }

  function encaixar(ponto: Point): Point {
    const arredondar = (valor: number) =>
      encaixe ? Math.round(valor * DIVISOES_DA_GRADE) / DIVISOES_DA_GRADE : valor;
    return { x: arredondar(limitar(ponto.x)), y: arredondar(limitar(ponto.y)) };
  }

  function localizarNo(ponto: Point, distancia: number): EnderecoNo | null {
    let encontrado: EnderecoNo | null = null;
    contornos.forEach(({ nos }, contorno) =>
      nos.forEach(({ ponto: posicao }, no) => {
        const perto = Math.hypot(ponto.x - posicao.x, ponto.y - posicao.y);
        if (perto < distancia) {
          distancia = perto;
          encontrado = { contorno, no };
        }
      }),
    );
    return encontrado;
  }

  function adicionar(novos: ContornoEditor[], ponto: Point): EnderecoNo {
    if (!novos.length) novos.push({ nos: [], fechado: true });
    const nos = novos[indiceContorno].nos;
    const indice = selecao ? selecao.no + 1 : nos.length;
    nos.splice(indice, 0, { ponto });
    return { contorno: indiceContorno, no: indice };
  }

  function remover({ contorno, no }: EnderecoNo) {
    atualizar((novos) => {
      novos[contorno].nos.splice(no, 1);
      if (!novos[contorno].nos.length) novos.splice(contorno, 1);
    });
    selecionar(null);
  }

  function aoPressionar(evento: PointerEvent<HTMLCanvasElement>) {
    if (evento.button !== 0 || gesto.current) return;
    evento.currentTarget.focus();
    const ponto = coordenada(evento);
    const distancia =
      ((evento.pointerType === 'touch' ? 15 : 9) *
        (TAMANHO_PREVIA / evento.currentTarget.clientWidth)) /
      QUADRO_PREVIA.width;
    let endereco = localizarNo(ponto, distancia);
    if (ferramenta === 'remover') {
      if (endereco) remover(endereco);
      return;
    }

    let base = contornos;
    let mudou = false;
    if (!endereco) {
      if (ferramenta !== 'adicionar' || total >= MAXIMO_NOS) return;
      base = structuredClone(contornos);
      endereco = adicionar(base, encaixar(ponto));
      mudou = true;
      definirContornos(base);
    }
    selecionar(endereco);
    gesto.current = {
      id: evento.pointerId,
      original: contornos,
      base,
      endereco,
      origem: ponto,
      ferramenta,
      mudou,
    };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function aoArrastar(evento: PointerEvent<HTMLCanvasElement>) {
    const ativo = gesto.current;
    if (!ativo || ativo.id !== evento.pointerId) return;
    const ponto = coordenada(evento);
    const delta = { x: ponto.x - ativo.origem.x, y: ponto.y - ativo.origem.y };
    if (Math.hypot(delta.x, delta.y) < 0.01) {
      definirContornos(ativo.base);
      return;
    }
    const { contorno, no } = ativo.endereco;
    const novos = structuredClone(ativo.base);
    const ancora = novos[contorno].nos[no];
    const destino = { x: ancora.ponto.x + delta.x, y: ancora.ponto.y + delta.y };
    if (ativo.ferramenta === 'mover') moverNo(ancora, encaixar(destino));
    else
      curvarNo(novos[contorno], no, {
        x: Math.max(-1, Math.min(2, destino.x)),
        y: Math.max(-1, Math.min(2, destino.y)),
      });
    ativo.mudou = true;
    definirContornos(novos);
  }

  function finalizar(evento: PointerEvent<HTMLCanvasElement>, cancelar = false) {
    const ativo = gesto.current;
    if (!ativo || ativo.id !== evento.pointerId) return;
    gesto.current = null;
    if (cancelar) {
      definirContornos(ativo.original);
      selecionar(null);
    } else if (ativo.mudou) guardar(ativo.original);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLCanvasElement>) {
    if (gesto.current) return;
    const tecla = evento.key;
    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey && tecla.toLowerCase() === 'z') {
      evento.preventDefault();
      evento.stopPropagation();
      desfazer();
      return;
    }
    const passo = 1 / (encaixe ? DIVISOES_DA_GRADE : 100);
    const direcoes: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    if (tecla === 'Enter' && ferramenta === 'adicionar' && total < MAXIMO_NOS) {
      evento.preventDefault();
      const novos = structuredClone(contornos);
      selecionar(adicionar(novos, { x: 0.5, y: 0.5 }));
      guardar(contornos);
      definirContornos(novos);
    } else if (selecao && (tecla === 'Delete' || tecla === 'Backspace')) {
      evento.preventDefault();
      remover(selecao);
    } else if (selecao && direcoes[tecla]) {
      evento.preventDefault();
      const [dx, dy] = direcoes[tecla];
      atualizar((novos) => {
        const no = novos[selecao.contorno].nos[selecao.no];
        moverNo(no, encaixar({ x: no.ponto.x + dx, y: no.ponto.y + dy }));
      });
    }
  }

  return {
    contornos,
    ferramenta,
    definirFerramenta,
    encaixe,
    definirEncaixe,
    selecao,
    selecionar,
    total,
    fechado: contornos[indiceContorno]?.fechado ?? true,
    fecharContorno,
    espelhar,
    desfazer,
    podeDesfazer: revisoes.length > 0,
    aoPressionar,
    aoArrastar,
    finalizar,
    aoTeclar,
  };
}

export type EdicaoPontos = ReturnType<typeof useEdicaoPontos>;

export function FreeShapeControls({ edicao }: { edicao: EdicaoPontos }) {
  const { selecao, selecionar, contornos } = edicao;
  return (
    <div className="shape-editor-controls">
      <div className="shape-editor-toolset" role="group" aria-label="Ferramentas de pontos">
        {FERRAMENTAS.map(({ id, rotulo }) => (
          <button
            type="button"
            key={id}
            aria-pressed={edicao.ferramenta === id}
            onClick={() => edicao.definirFerramenta(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <p className="shape-editor-hint">
        {edicao.ferramenta === 'adicionar' &&
          'Clique na grade para adicionar um ponto ou arraste um ponto para criar uma curva.'}
        {edicao.ferramenta === 'mover' &&
          'Arraste um ponto para movê-lo. Com o ponto ativo, também é possível usar as setas do teclado na grade.'}
        {edicao.ferramenta === 'remover' && 'Clique em um ponto para removê-lo do contorno.'}
      </p>
      {edicao.total >= MAXIMO_NOS && (
        <p className="shape-editor-hint">
          Limite de {MAXIMO_NOS} pontos para adicionar neste desenho.
        </p>
      )}
      <div className="shape-editor-checks">
        <label>
          <input
            type="checkbox"
            checked={edicao.encaixe}
            onChange={(evento) => edicao.definirEncaixe(evento.target.checked)}
          />{' '}
          Encaixe na grade
        </label>
        <label>
          <input
            type="checkbox"
            checked={edicao.fechado}
            onChange={(evento) => edicao.fecharContorno(evento.target.checked)}
          />{' '}
          Fechar contorno
        </label>
      </div>
      {edicao.total > 0 && (
        <label className="shape-editor-field">
          Ponto ativo
          <select
            value={selecao ? `${selecao.contorno}:${selecao.no}` : ''}
            onChange={(evento) => {
              if (!evento.target.value) selecionar(null);
              else {
                const [contorno, no] = evento.target.value.split(':').map(Number);
                selecionar({ contorno, no });
              }
            }}
          >
            <option value="">Nenhum</option>
            {contornos.map(({ nos }, contorno) =>
              nos.map((_, no) => (
                <option key={`${contorno}:${no}`} value={`${contorno}:${no}`}>
                  {contornos.length > 1 ? `Traçado ${contorno + 1} · ` : ''}Ponto {no + 1}
                </option>
              )),
            )}
          </select>
        </label>
      )}
      <div className="shape-editor-toolset" role="group" aria-label="Transformar contorno">
        <button type="button" disabled={!edicao.total} onClick={() => edicao.espelhar('x')}>
          Espelhar horizontal
        </button>
        <button type="button" disabled={!edicao.total} onClick={() => edicao.espelhar('y')}>
          Espelhar vertical
        </button>
        <button type="button" disabled={!edicao.podeDesfazer} onClick={edicao.desfazer}>
          Desfazer pontos
        </button>
      </div>
    </div>
  );
}
