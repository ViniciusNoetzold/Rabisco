import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { FormatoExportacao, OpcoesExportacao } from '../../io/imagens';
import type { OpcoesImpressao } from '../../io/imprimir';
import './export-dialogs.css';

export type { OpcoesExportacao } from '../../io/imagens';

const FORMATOS: Record<FormatoExportacao, string> = {
  png: 'PNG (.png)',
  jpeg: 'JPEG (.jpg)',
  bmp: 'BMP de 24 bits (.bmp)',
  gif: 'GIF (.gif)',
  webp: 'WebP (.webp)',
};

const AVISOS: Partial<Record<FormatoExportacao, string>> = {
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
  const [formato, definirFormato] = useState<FormatoExportacao>('png');
  const [qualidade, definirQualidade] = useState(92);
  const idFormato = useId();
  const ajustarQualidade = formato === 'jpeg' || formato === 'webp';

  return (
    <FormularioSaida
      fechar={fechar}
      rotulo="Salvar arquivo"
      acao={() => {
        if (!nomeArquivo.trim()) throw new Error('Informe o nome do arquivo.');
        return salvar({ nome: nomeArquivo.trim(), formato, qualidade: qualidade / 100 });
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
          onChange={(evento) => definirFormato(evento.target.value as FormatoExportacao)}
        >
          {Object.entries(FORMATOS).map(([tipo, rotulo]) => (
            <option value={tipo} key={tipo}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
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
