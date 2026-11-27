import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { EscalaExportacao, OpcoesExportacao } from '../../io/imagens';
import type { OpcoesImpressao } from '../../io/imprimir';
import './export-dialogs.css';

export type { OpcoesExportacao } from '../../io/imagens';

type FormatoSaida = OpcoesExportacao['formato'];

const FORMATOS: Record<FormatoSaida, string> = {
  rabisco: 'Rabisco com camadas (.rabisco)',
  psd: 'Photoshop com camadas (.psd)',
  ora: 'OpenRaster com camadas (.ora — Krita, GIMP, MyPaint)',
  'camadas-png': 'Cada camada em PNG (.zip)',
  png: 'PNG (.png)',
  jpeg: 'JPEG (.jpg)',
  bmp: 'BMP de 24 bits (.bmp)',
  gif: 'GIF (.gif)',
  webp: 'WebP (.webp)',
};

const ACHATADOS =
  'As camadas serão unidas numa imagem só. Para continuar editando depois, salve também em .rabisco.';

const AVISOS: Partial<Record<FormatoSaida, string>> = {
  psd: 'Grupos, máscaras, modos e opacidade vão para o PSD. Camadas com contorno ou sombra entram com o efeito aplicado aos pixels.',
  ora: 'Máscaras e efeitos entram aplicados aos pixels; grupos, modos e opacidade são mantidos.',
  'camadas-png': 'Um PNG por camada, com máscara e efeitos aplicados, dentro de um .zip.',
  jpeg: 'A transparência será preenchida com branco. A compressão pode alterar detalhes e cores.',
  bmp: 'A transparência será preenchida com branco.',
  gif: 'O GIF usa até 256 cores e converte a semitransparência em pixels totalmente transparentes ou opacos.',
  webp: 'A compressão pode alterar detalhes e cores.',
};

function FormularioSaida({
  acao,
  rotulo,
  fechar,
  children,
}: {
  acao(): Promise<void>;
  rotulo: string;
  fechar(): void;
  children: ReactNode;
}) {
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState('');

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    definirErro('');
    definirEnviando(true);
    try {
      await acao();
      fechar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível concluir a operação.');
      definirEnviando(false);
    }
  }

  return (
    <form className="export-form" onSubmit={confirmar} aria-busy={enviando}>
      <fieldset disabled={enviando} className="export-form-inputs">
        {children}
      </fieldset>
      {erro && (
        <p className="form-error" role="alert">
          {erro}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={fechar} disabled={enviando}>
          Cancelar
        </button>
        <button type="submit" className="primary-button" disabled={enviando}>
          {enviando ? 'Preparando…' : rotulo}
        </button>
      </div>
    </form>
  );
}

export function SalvarComo({
  nome,
  fechar,
  salvar,
}: {
  nome: string;
  fechar(): void;
  salvar(opcoes: OpcoesExportacao): Promise<void>;
}) {
  const [nomeArquivo, definirNome] = useState(nome);
  const [formato, definirFormato] = useState<FormatoSaida>('png');
  const [qualidade, definirQualidade] = useState(92);
  const [escala, definirEscala] = useState<EscalaExportacao>(1);
  const idFormato = useId();
  const ajustarQualidade = formato === 'jpeg' || formato === 'webp';
  const ampliar = !['rabisco', 'psd', 'ora', 'camadas-png'].includes(formato);

  return (
    <FormularioSaida
      fechar={fechar}
      rotulo="Salvar arquivo"
      acao={() => {
        if (!nomeArquivo.trim()) throw new Error('Informe o nome do arquivo.');
        return salvar({
          nome: nomeArquivo.trim(),
          formato,
          qualidade: qualidade / 100,
          escala: ampliar ? escala : 1,
        });
      }}
    >
      <label className="field">
        Nome do arquivo
        <input
          data-foco-inicial
          value={nomeArquivo}
          required
          maxLength={120}
          onChange={(evento) => definirNome(evento.target.value)}
        />
      </label>
      <div className="field">
        <label htmlFor={idFormato}>Formato</label>
        <select
          id={idFormato}
          value={formato}
          onChange={(evento) => definirFormato(evento.target.value as FormatoSaida)}
        >
          {Object.entries(FORMATOS).map(([tipo, rotulo]) => (
            <option value={tipo} key={tipo}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {ampliar && (
        <label className="field">
          Ampliação
          <select
            value={escala}
            onChange={(evento) => definirEscala(Number(evento.target.value) as EscalaExportacao)}
          >
            <option value={1}>1× (tamanho original)</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
            <option value={8}>8×</option>
          </select>
        </label>
      )}
      {ajustarQualidade && (
        <label className="field">
          Qualidade
          <span className="export-quality">
            <input
              type="range"
              min={1}
              max={100}
              value={qualidade}
              aria-valuetext={`${qualidade}%`}
              onChange={(evento) => definirQualidade(Number(evento.target.value))}
            />
            <output aria-hidden="true">{qualidade}%</output>
          </span>
        </label>
      )}
      {AVISOS[formato] && (
        <p className="export-warning" role="status">
          {AVISOS[formato]}
        </p>
      )}
    </FormularioSaida>
  );
}

export function ImprimirDesenho({
  fechar,
  imprimir,
}: {
  fechar(): void;
  imprimir(opcoes: OpcoesImpressao): Promise<void>;
}) {
  const [orientacao, definirOrientacao] = useState<OpcoesImpressao['orientacao']>('retrato');
  const [ajustar, definirAjustar] = useState(true);
  const [centralizar, definirCentralizar] = useState(true);
  const idOrientacao = useId();

  return (
    <FormularioSaida
      fechar={fechar}
      rotulo="Imprimir"
      acao={() => imprimir({ orientacao, ajustar, centralizar })}
    >
      <div className="field">
        <label htmlFor={idOrientacao}>Orientação</label>
        <select
          id={idOrientacao}
          data-foco-inicial
          value={orientacao}
          onChange={(evento) =>
            definirOrientacao(evento.target.value as OpcoesImpressao['orientacao'])
          }
        >
          <option value="retrato">Retrato</option>
          <option value="paisagem">Paisagem</option>
        </select>
      </div>
      <div className="print-checks">
        <label>
          <input
            type="checkbox"
            checked={ajustar}
            onChange={(evento) => definirAjustar(evento.target.checked)}
          />{' '}
          Ajustar à página
        </label>
        <label>
          <input
            type="checkbox"
            checked={centralizar}
            onChange={(evento) => definirCentralizar(evento.target.checked)}
          />{' '}
          Centralizar
        </label>
      </div>
    </FormularioSaida>
  );
}
