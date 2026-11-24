import { liveQuery } from 'dexie';
import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from 'react';
import {
  gravarCorPersonalizada,
  listarCoresPersonalizadas,
  normalizarCorHex,
  VAGAS_DE_COR,
} from '../../storage/cores';
import './color-editor.css';

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface Hsl {
  h: number;
  s: number;
  l: number;
}
type Canal = keyof (Rgb & Hsl);
type Campo = Canal | 'hex';
type Edicao = { campo: Campo; valor: string };

const CAMPOS = {
  r: { nome: 'Vermelho', maximo: 255 },
  g: { nome: 'Verde', maximo: 255 },
  b: { nome: 'Azul', maximo: 255 },
  h: { nome: 'Matiz', maximo: 360 },
  s: { nome: 'Saturação', maximo: 100 },
  l: { nome: 'Luminosidade', maximo: 100 },
};

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

function lerRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function corHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((canal) => canal.toString(16).padStart(2, '0')).join('')}`;
}

export function rgbParaHsl({ r, g, b }: Rgb, matizAnterior = 0): Hsl {
  const maximo = Math.max(r, g, b);
  const minimo = Math.min(r, g, b);
  const diferenca = maximo - minimo;
  const luminosidade = (maximo + minimo) / (2 * 255);
  if (!diferenca) return { h: matizAnterior, s: 0, l: luminosidade * 100 };
  let matiz: number;
  if (maximo === r) matiz = (g - b) / diferenca;
  else if (maximo === g) matiz = 2 + (b - r) / diferenca;
  else matiz = 4 + (r - g) / diferenca;
  return {
    h: (matiz * 60 + 360) % 360,
    s: (diferenca / 255 / (1 - Math.abs(2 * luminosidade - 1))) * 100,
    l: luminosidade * 100,
  };
}

export function hslParaRgb({ h, s, l }: Hsl): Rgb {
  const luz = l / 100;
  const a = (s / 100) * Math.min(luz, 1 - luz);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    return limitar(Math.round(255 * (luz - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))), 0, 255);
  };
  return { r: canal(0), g: canal(8), b: canal(4) };
}

function validarCampo({ campo, valor }: Edicao): boolean {
  if (campo === 'hex') return normalizarCorHex(valor) !== null;
  return /^\d{1,3}$/.test(valor) && Number(valor) <= CAMPOS[campo].maximo;
}

interface ColorEditorProps {
  cor: string;
  aoAplicar(cor: string): void;
  fechar(): void;
}

export function ColorEditor({ cor, aoAplicar, fechar }: ColorEditorProps) {
  const instrucoes = useId();
  const idValidacao = useId();
  const [hsl, definirHsl] = useState(() => rgbParaHsl(lerRgb(normalizarCorHex(cor) ?? '#000000')));
  const [edicao, definirEdicao] = useState<Edicao | null>(null);
  const [cores, definirCores] = useState<(string | null)[] | null>(null);
  const [vaga, definirVaga] = useState<number | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState('');
  const [erro, definirErro] = useState('');

  useEffect(() => {
    const observacao = liveQuery(listarCoresPersonalizadas).subscribe({
      next: definirCores,
      error: () => definirErro('Não foi possível acessar as cores salvas neste navegador.'),
    });
    return () => observacao.unsubscribe();
  }, []);

  const rgb = hslParaRgb(hsl);
  const hex = corHex(rgb);
  const vazio = cores?.findIndex((salva) => salva === null) ?? -1;
  const slot = vaga ?? Math.max(0, vazio);
  const valido = !edicao || validarCampo(edicao);
  const validacao =
    valido || !edicao
      ? ''
      : edicao.campo === 'hex'
        ? 'Use três ou seis dígitos hexadecimais.'
        : `Use um número inteiro de 0 a ${CAMPOS[edicao.campo].maximo}.`;
  const estiloEspectro = {
    '--matiz': hsl.h,
    '--saturacao': `${hsl.s}%`,
    '--luminosidade-invertida': `${100 - hsl.l}%`,
  } as CSSProperties;

  function editar(campo: Campo, valor: string) {
    const novaEdicao = { campo, valor };
    definirEdicao(novaEdicao);
    if (!validarCampo(novaEdicao)) return;
    definirHsl((anterior) => {
      if (campo === 'hex') return rgbParaHsl(lerRgb(normalizarCorHex(valor)!), anterior.h);
      const numero = Number(valor);
      if (campo === 'r' || campo === 'g' || campo === 'b') {
        return rgbParaHsl({ ...hslParaRgb(anterior), [campo]: numero }, anterior.h);
      }
      return { ...anterior, [campo]: numero };
    });
  }

  function escolherNoEspectro(evento: PointerEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const s = limitar(((evento.clientX - caixa.left) / caixa.width) * 100, 0, 100);
    const l = limitar(100 - ((evento.clientY - caixa.top) / caixa.height) * 100, 0, 100);
    definirEdicao(null);
    definirHsl((anterior) => ({ ...anterior, s, l }));
  }

  function escolherVaga(indice: number, salva: string | null) {
    definirVaga(indice);
    definirEdicao(null);
    definirAviso('');
    if (salva) definirHsl((anterior) => rgbParaHsl(lerRgb(salva), anterior.h));
  }

  async function salvar() {
    if (!cores || !valido || salvando) return;
    definirSalvando(true);
    definirErro('');
    definirAviso('');
    try {
      await gravarCorPersonalizada(slot, hex);
      definirVaga(slot);
      definirAviso(`Cor salva na vaga ${slot + 1}.`);
    } catch {
      definirErro('Não foi possível salvar a cor. Tente novamente.');
    } finally {
      definirSalvando(false);
    }
  }

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!valido) return;
    aoAplicar(hex);
    fechar();
  }

  function campoNumerico(canal: Canal, atual: number) {
    const { nome, maximo } = CAMPOS[canal];
    return (
      <label className="field" key={canal}>
        {nome}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={maximo}
          step={1}
          value={edicao?.campo === canal ? edicao.valor : Math.round(atual)}
          aria-invalid={edicao?.campo === canal && !valido}
          aria-describedby={edicao?.campo === canal && !valido ? idValidacao : undefined}
          onBlur={() => definirEdicao(null)}
          onChange={(evento) => editar(canal, evento.target.value)}
        />
      </label>
    );
  }

  return (
    <form className="color-editor" onSubmit={aplicar} noValidate>
      <div className="color-editor-main">
        <section className="color-editor-picker" aria-label="Escolher no espectro">
          <div
            className="color-spectrum"
            role="group"
            aria-label="Espectro de saturação e luminosidade"
            aria-describedby={instrucoes}
            tabIndex={0}
            style={estiloEspectro}
            onPointerDown={(evento) => {
              if (evento.button !== 0 || !evento.isPrimary) return;
              evento.currentTarget.focus();
              evento.currentTarget.setPointerCapture(evento.pointerId);
              escolherNoEspectro(evento);
            }}
            onPointerMove={(evento) => {
              if (evento.currentTarget.hasPointerCapture(evento.pointerId))
                escolherNoEspectro(evento);
            }}
            onKeyDown={(evento) => {
              const { key, shiftKey } = evento;
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
              evento.preventDefault();
              evento.stopPropagation();
              const passo = shiftKey ? 10 : 1;
              const deltaS = key === 'ArrowLeft' ? -passo : key === 'ArrowRight' ? passo : 0;
              const deltaL = key === 'ArrowDown' ? -passo : key === 'ArrowUp' ? passo : 0;
              definirHsl((atual) => ({
                ...atual,
                s: limitar(atual.s + deltaS, 0, 100),
                l: limitar(atual.l + deltaL, 0, 100),
              }));
            }}
          >
            <span className="color-spectrum-marker" />
          </div>
          <span id={instrucoes} className="color-editor-assistive">
            As setas ajustam a saturação na horizontal e a luminosidade na vertical.
          </span>
          <input
            type="range"
            className="color-hue"
            aria-label="Matiz no espectro"
            min={0}
            max={360}
            value={Math.round(hsl.h)}
            onChange={(evento) => {
              definirEdicao(null);
              definirHsl((anterior) => ({ ...anterior, h: Number(evento.target.value) }));
            }}
          />
          <div
            className="color-editor-preview"
            style={{ backgroundColor: hex }}
            aria-hidden="true"
          />
        </section>

        <div className="color-editor-fields">
          <label className="field color-hex-field">
            Hexadecimal
            <input
              data-foco-inicial
              value={edicao?.campo === 'hex' ? edicao.valor : hex.toUpperCase()}
              maxLength={7}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={edicao?.campo === 'hex' && !valido}
              aria-describedby={edicao?.campo === 'hex' && !valido ? idValidacao : undefined}
              onBlur={() => definirEdicao(null)}
              onChange={(evento) => editar('hex', evento.target.value)}
            />
          </label>
          <div className="color-channel-fields" role="group" aria-label="RGB">
            {campoNumerico('r', rgb.r)}
            {campoNumerico('g', rgb.g)}
            {campoNumerico('b', rgb.b)}
          </div>
          <div
            className="color-channel-fields"
            role="group"
            aria-label="Matiz, saturação e luminosidade"
          >
            {campoNumerico('h', hsl.h)}
            {campoNumerico('s', hsl.s)}
            {campoNumerico('l', hsl.l)}
          </div>
          {validacao && (
            <span id={idValidacao} className="color-editor-validation" role="status">
              {validacao}
            </span>
          )}
        </div>
      </div>

      <fieldset className="color-editor-custom">
        <legend>Cores personalizadas</legend>
        <div className="color-editor-swatches">
          {Array.from({ length: VAGAS_DE_COR }, (_, indice) => {
            const salva = cores?.[indice] ?? null;
            const rotulo = `Vaga ${indice + 1}${salva ? ` ${salva.toUpperCase()}` : ' vazia'}`;
            return (
              <button
                key={indice}
                type="button"
                className={`color-custom-swatch${salva ? '' : ' color-custom-empty'}`}
                style={salva ? { background: salva } : undefined}
                aria-label={rotulo}
                title={rotulo}
                aria-pressed={indice === slot}
                disabled={!cores || salvando}
                onClick={() => escolherVaga(indice, salva)}
              />
            );
          })}
        </div>
        <div className="color-editor-palette-actions">
          <button
            type="button"
            disabled={!cores || !valido || salvando}
            onClick={() => void salvar()}
          >
            Salvar na vaga {slot + 1}
          </button>
          <span role="status">{aviso}</span>
        </div>
      </fieldset>
      {erro && (
        <p role="alert" className="form-error">
          {erro}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={fechar}>
          Cancelar
        </button>
        <button type="submit" className="primary-button" disabled={!valido}>
          Aplicar cor
        </button>
      </div>
    </form>
  );
}
