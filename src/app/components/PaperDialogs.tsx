import { useId, useState, type FormEvent } from 'react';
import type { DocumentInfo } from '../../canvas/editorTypes';
import type { OpcoesTransformacao } from '../../commands/comandos';
import {
  dimensoesValidas,
  dpiValido,
  DPI_MAXIMO,
  DPI_PADRAO,
  MENSAGEM_DIMENSOES,
} from '../../document/dimensoes';
import { converterMedida, pixelsDaMedida, type UnidadeMedida } from '../../document/medidas';
import './paper-tools.css';

type Eixo = 'largura' | 'altura';
type DimensoesFormulario = Record<Eixo, string>;

const numeroPt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function dimensoes(largura: number, altura: number): DimensoesFormulario {
  return { largura: String(largura), altura: String(altura) };
}

function limitarCasas(valor: number): string {
  return String(Number(valor.toFixed(6)));
}

function camposConvertidos(
  campos: DimensoesFormulario,
  converter: (medida: number, eixo: Eixo) => number,
): DimensoesFormulario {
  function transformar(eixo: Eixo) {
    const valor = campos[eixo];
    return valor === '' ? '' : limitarCasas(converter(Number(valor), eixo));
  }
  return { largura: transformar('largura'), altura: transformar('altura') };
}

function CamposDimensoes({
  valores,
  editar,
  passo,
}: {
  valores: DimensoesFormulario;
  editar(eixo: Eixo, valor: string): void;
  passo: number | 'any';
}) {
  return (
    <div className="dimension-fields">
      <label className="field">
        Largura
        <input
          data-foco-inicial
          type="number"
          step={passo}
          inputMode={passo === 1 ? 'numeric' : 'decimal'}
          value={valores.largura}
          onChange={(evento) => editar('largura', evento.target.value)}
          required
        />
      </label>
      <span aria-hidden="true">×</span>
      <label className="field">
        Altura
        <input
          type="number"
          step={passo}
          inputMode={passo === 1 ? 'numeric' : 'decimal'}
          value={valores.altura}
          onChange={(evento) => editar('altura', evento.target.value)}
          required
        />
      </label>
    </div>
  );
}

function AcoesFormulario({
  fechar,
  erro,
  rotulo,
}: {
  fechar(): void;
  erro: string;
  rotulo: string;
}) {
  return (
    <>
      {erro && (
        <p role="alert" className="form-error">
          {erro}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={fechar}>
          Cancelar
        </button>
        <button type="submit" className="primary-button">
          {rotulo}
        </button>
      </div>
    </>
  );
}

interface PropriedadesProps {
  info: DocumentInfo;
  corDeFundo: string;
  fechar(): void;
  aplicar(largura: number, altura: number, fundo: string, dpi: number): void;
}

export function PropriedadesImagem({ info, corDeFundo, fechar, aplicar }: PropriedadesProps) {
  const idUnidades = useId();
  const [unidade, definirUnidade] = useState<UnidadeMedida>('px');
  const [valores, definirValores] = useState(() => dimensoes(info.width, info.height));
  const [dpi, definirDpi] = useState(String(info.dpi));
  const [fundo, definirFundo] = useState(corDeFundo);
  const [erro, definirErro] = useState('');

  function mudarUnidade(destino: UnidadeMedida) {
    const resolucao = Number(dpi);
    if (!dpiValido(resolucao)) {
      definirErro(`Use uma resolução inteira de 1 a ${numeroPt.format(DPI_MAXIMO)} DPI.`);
      return;
    }
    definirValores(
      camposConvertidos(valores, (valor) => {
        const convertido = converterMedida(valor, unidade, destino, resolucao);
        return destino === 'px' ? Math.round(convertido) : convertido;
      }),
    );
    definirUnidade(destino);
    definirErro('');
  }

  function restaurarPadrao() {
    definirUnidade('px');
    definirValores(dimensoes(1024, 640));
    definirDpi(String(DPI_PADRAO));
    definirFundo('#ffffff');
    definirErro('');
  }

  function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resolucao = Number(dpi);
    if (!dpiValido(resolucao)) {
      definirErro(`Use uma resolução inteira de 1 a ${numeroPt.format(DPI_MAXIMO)} DPI.`);
      return;
    }
    const largura = pixelsDaMedida(Number(valores.largura), unidade, resolucao);
    const altura = pixelsDaMedida(Number(valores.altura), unidade, resolucao);
    if (!dimensoesValidas(largura, altura)) {
      definirErro(MENSAGEM_DIMENSOES);
      return;
    }
    try {
      aplicar(largura, altura, fundo, resolucao);
      fechar();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não foi possível redimensionar o papel.',
      );
    }
  }

  const bytes = info.width * info.height * 4;
  return (
    <form className="paper-dialog" onSubmit={confirmar} noValidate>
      <p className="paper-memory">
        Tamanho em memória <strong>{numeroPt.format(bytes)} bytes</strong>
      </p>
      <div className="paper-form-pair">
        <div className="field">
          <label htmlFor={idUnidades}>Unidades</label>
          <select
            id={idUnidades}
            value={unidade}
            onChange={(evento) => mudarUnidade(evento.target.value as UnidadeMedida)}
          >
            <option value="px">Pixels (px)</option>
            <option value="cm">Centímetros (cm)</option>
            <option value="pol">Polegadas (pol)</option>
          </select>
        </div>
        <label className="field">
          Resolução (DPI)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={DPI_MAXIMO}
            value={dpi}
            onChange={(evento) => definirDpi(evento.target.value)}
            required
          />
        </label>
      </div>
      <CamposDimensoes
        valores={valores}
        editar={(eixo, valor) => definirValores((anteriores) => ({ ...anteriores, [eixo]: valor }))}
        passo={unidade === 'px' ? 1 : 'any'}
      />
      <p className="paper-help">Ao aumentar o papel, a área nova recebe a cor escolhida abaixo.</p>
      <div className="paper-color-row">
        <label>
          <input
            type="color"
            value={fundo}
            onChange={(evento) => definirFundo(evento.target.value)}
          />
          Cor de fundo
        </label>
        <button type="button" onClick={restaurarPadrao}>
          Padrão
        </button>
      </div>
      <AcoesFormulario fechar={fechar} erro={erro} rotulo="Aplicar" />
    </form>
  );
}

interface TransformacaoProps {
  info: DocumentInfo;
  fechar(): void;
  aplicar(opcoes: OpcoesTransformacao): void;
}

export function RedimensionarInclinar({ info, fechar, aplicar }: TransformacaoProps) {
  const idUnidades = useId();
  const [unidade, definirUnidade] = useState<'%' | 'px'>('%');
  const [valores, definirValores] = useState(() => dimensoes(100, 100));
  const [manterProporcao, definirProporcao] = useState(true);
  const [horizontal, definirHorizontal] = useState('0');
  const [vertical, definirVertical] = useState('0');
  const [erro, definirErro] = useState('');
  const origem = {
    largura: info.selection?.width ?? info.width,
    altura: info.selection?.height ?? info.height,
  };

  function editarDimensao(eixo: Eixo, valor: string, manter = manterProporcao) {
    definirValores((anteriores) => {
      if (!manter) return { ...anteriores, [eixo]: valor };
      const outroEixo = eixo === 'largura' ? 'altura' : 'largura';
      const proporcional =
        unidade === 'px'
          ? String(Math.round((Number(valor) * origem[outroEixo]) / origem[eixo]))
          : valor;
      return { ...anteriores, [eixo]: valor, [outroEixo]: valor === '' ? '' : proporcional };
    });
  }

  function mudarUnidade(destino: '%' | 'px') {
    definirValores(
      camposConvertidos(valores, (valor, eixo) =>
        destino === 'px' ? Math.round((valor * origem[eixo]) / 100) : (valor * 100) / origem[eixo],
      ),
    );
    definirUnidade(destino);
  }

  function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const largura =
      unidade === 'px'
        ? Number(valores.largura)
        : Math.round((Number(valores.largura) * origem.largura) / 100);
    const altura =
      unidade === 'px'
        ? Number(valores.altura)
        : Math.round((Number(valores.altura) * origem.altura) / 100);
    if (!dimensoesValidas(largura, altura)) {
      definirErro(MENSAGEM_DIMENSOES);
      return;
    }
    const inclinacaoHorizontal = Number(horizontal);
    const inclinacaoVertical = Number(vertical);
    if (
      [inclinacaoHorizontal, inclinacaoVertical].some(
        (angulo) => !Number.isFinite(angulo) || Math.abs(angulo) > 89,
      )
    ) {
      definirErro('Use ângulos de −89° a 89°.');
      return;
    }
    try {
      aplicar({ largura, altura, inclinacaoHorizontal, inclinacaoVertical });
      fechar();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não foi possível transformar a imagem.',
      );
    }
  }

  return (
    <form className="paper-dialog transform-dialog" onSubmit={confirmar} noValidate>
      <p className="paper-memory">
        {info.selection ? 'Seleção atual' : 'Imagem inteira'}
        <strong>
          {origem.largura} × {origem.altura} px
        </strong>
      </p>
      <fieldset className="paper-section">
        <legend>Redimensionar</legend>
        <div className="field">
          <label htmlFor={idUnidades}>Unidade do redimensionamento</label>
          <select
            id={idUnidades}
            value={unidade}
            onChange={(evento) => mudarUnidade(evento.target.value as '%' | 'px')}
          >
            <option value="%">Porcentagem (%)</option>
            <option value="px">Pixels (px)</option>
          </select>
        </div>
        <CamposDimensoes
          valores={valores}
          editar={editarDimensao}
          passo={unidade === 'px' ? 1 : 'any'}
        />
        <label className="paper-keep-ratio">
          <input
            type="checkbox"
            checked={manterProporcao}
            onChange={(evento) => {
              definirProporcao(evento.target.checked);
              if (evento.target.checked) editarDimensao('largura', valores.largura, true);
            }}
          />
          Manter proporção
        </label>
      </fieldset>
      <fieldset className="paper-section">
        <legend>Inclinar</legend>
        <div className="paper-form-pair">
          <label className="field">
            Horizontal (°)
            <input
              type="number"
              min={-89}
              max={89}
              step="any"
              inputMode="decimal"
              value={horizontal}
              onChange={(evento) => definirHorizontal(evento.target.value)}
            />
          </label>
          <label className="field">
            Vertical (°)
            <input
              type="number"
              min={-89}
              max={89}
              step="any"
              inputMode="decimal"
              value={vertical}
              onChange={(evento) => definirVertical(evento.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <AcoesFormulario fechar={fechar} erro={erro} rotulo="Aplicar" />
    </form>
  );
}
