import { useEffect, useRef, useState } from 'react';
import type { DocumentInfo } from '../../canvas/editorTypes';
import type { OpcoesTransformacao } from '../../commands/comandos';
import type { OpcoesExportacao } from '../../io/imagens';
import type { OpcoesImpressao } from '../../io/imprimir';
import { dimensoesValidas, LIMITE_LADO, MENSAGEM_DIMENSOES } from '../../document/dimensoes';
import { PropriedadesImagem, RedimensionarInclinar } from './PaperDialogs';
import { Logo } from './Primitives';
import { ColorEditor } from './ColorEditor';
import { ImprimirDesenho, SalvarComo } from './ExportDialogs';
import { ATALHOS } from './atalhos';

export type EditorDialogKind =
  | 'new'
  | 'about'
  | 'help'
  | 'properties'
  | 'transform'
  | 'save-as'
  | 'print'
  | 'colors'
  | 'fit-paste'
  | null;

const titulos: Record<NonNullable<EditorDialogKind>, string> = {
  new: 'Um novo começo',
  about: 'Sobre o Rabisco',
  help: 'Uma ajudinha para começar',
  properties: 'Propriedades da imagem',
  transform: 'Redimensionar e inclinar',
  'save-as': 'Salvar como',
  print: 'Imprimir desenho',
  colors: 'Editar cores',
  'fit-paste': 'Aumentar o papel para caber?',
};

interface EditorDialogsProps {
  dialog: EditorDialogKind;
  info: DocumentInfo;
  corDeFundo: string;
  corAtiva: string;
  ajustarColagem: { largura: number; altura: number; podeAumentar: boolean } | null;
  onClose(): void;
  onNew(name: string, width: number, height: number): void;
  onPropriedades(largura: number, altura: number, fundo: string, dpi: number): void;
  onTransformar(opcoes: OpcoesTransformacao): void;
  onSalvarComo(opcoes: OpcoesExportacao): Promise<void>;
  onImprimir(opcoes: OpcoesImpressao): Promise<void>;
  onAplicarCor(cor: string): void;
  onColagem(aumentar: boolean): void;
}

export function EditorDialogs({
  dialog,
  info,
  corDeFundo,
  corAtiva,
  ajustarColagem,
  onClose,
  onNew,
  onPropriedades,
  onTransformar,
  onSalvarComo,
  onImprimir,
  onAplicarCor,
  onColagem,
}: EditorDialogsProps) {
  const [newName, setNewName] = useState('Meu rabisco');
  const [newWidth, setNewWidth] = useState(1024);
  const [newHeight, setNewHeight] = useState(640);
  const [newError, setNewError] = useState('');
  const modal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (dialog) {
      setNewError('');
      if (!modal.current?.open) modal.current?.showModal();
      modal.current?.querySelector<HTMLInputElement>('[data-foco-inicial]')?.focus();
    } else modal.current?.close();
  }, [dialog]);

  return (
    <dialog
      ref={modal}
      className="window glass app-dialog"
      aria-labelledby="editor-dialog-title"
      onCancel={() => onClose()}
      onClick={(event) => {
        if (event.target === modal.current) onClose();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id="editor-dialog-title">
          {dialog ? titulos[dialog] : ''}
        </div>
        <button className="dialog-close" aria-label="Fechar janela" onClick={() => onClose()}>
          ×
        </button>
      </div>
      <div className="window-body dialog-body">
        {dialog === 'new' && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!dimensoesValidas(newWidth, newHeight)) {
                setNewError(MENSAGEM_DIMENSOES);
                return;
              }
              onNew(newName, newWidth, newHeight);
              onClose();
            }}
          >
            <h2>O que vamos criar hoje?</h2>
            <p>Salve uma cópia do desenho atual antes de começar outro.</p>
            <label className="field">
              Nome do desenho
              <input
                data-foco-inicial
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={120}
              />
            </label>
            <div className="dimension-fields">
              <label className="field">
                Largura (px)
                <input
                  type="number"
                  min="1"
                  max={LIMITE_LADO}
                  value={newWidth}
                  onChange={(event) => setNewWidth(Number(event.target.value))}
                  required
                />
              </label>
              <span>×</span>
              <label className="field">
                Altura (px)
                <input
                  type="number"
                  min="1"
                  max={LIMITE_LADO}
                  value={newHeight}
                  onChange={(event) => setNewHeight(Number(event.target.value))}
                  required
                />
              </label>
            </div>
            <div className="preset-buttons">
              <button
                type="button"
                onClick={() => {
                  setNewWidth(1024);
                  setNewHeight(640);
                }}
              >
                Paisagem
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewWidth(800);
                  setNewHeight(800);
                }}
              >
                Quadrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewWidth(640);
                  setNewHeight(900);
                }}
              >
                Retrato
              </button>
            </div>
            {newError && (
              <p role="alert" className="form-error">
                {newError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => onClose()}>
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Criar desenho
              </button>
            </div>
          </form>
        )}
        {dialog === 'properties' && (
          <PropriedadesImagem
            info={info}
            corDeFundo={corDeFundo}
            fechar={onClose}
            aplicar={onPropriedades}
          />
        )}
        {dialog === 'transform' && (
          <RedimensionarInclinar info={info} fechar={onClose} aplicar={onTransformar} />
        )}
        {dialog === 'save-as' && (
          <SalvarComo nome={info.name} fechar={onClose} salvar={onSalvarComo} />
        )}
        {dialog === 'print' && <ImprimirDesenho fechar={onClose} imprimir={onImprimir} />}
        {dialog === 'colors' && (
          <ColorEditor cor={corAtiva} fechar={onClose} aoAplicar={onAplicarCor} />
        )}
        {dialog === 'fit-paste' && ajustarColagem && (
          <>
            <p>
              A imagem mede {ajustarColagem.largura} × {ajustarColagem.altura} px. O papel atual
              mede {info.width} × {info.height} px.
            </p>
            <p>
              Escolha <strong>Sim</strong> para aumentar o papel ao confirmar a colagem ou{' '}
              <strong>Não</strong> para manter o tamanho atual.
            </p>
            {!ajustarColagem.podeAumentar && <p className="form-error">{MENSAGEM_DIMENSOES}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onColagem(false);
                  onClose();
                }}
              >
                Não
              </button>
              <button
                data-foco-inicial
                type="button"
                className="primary-button"
                disabled={!ajustarColagem.podeAumentar}
                onClick={() => {
                  onColagem(true);
                  onClose();
                }}
              >
                Sim
              </button>
            </div>
          </>
        )}
        {dialog === 'about' && (
          <>
            <Logo large />
            <p className="about-tagline">Um pequeno ateliê. Infinitas possibilidades.</p>
            <p>
              Versão 0.3.0 · Feito para desenhar com calma, curiosidade e um pouco de nostalgia.
            </p>
            <div className="about-credits">
              <h3>Feito com ferramentas abertas</h3>
              <p>
                Interface: 7.css (MIT). Fonte: Selawik (OFL 1.1). Ícones: Fugue, por Yusuke
                Kamiyamane (
                <a
                  href="https://creativecommons.org/licenses/by/3.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 3.0
                </a>
                ).
              </p>
              <p>
                React, Zustand, Immer, Vite e Vitest (MIT); Dexie, TypeScript, Playwright e
                fake-indexeddb (Apache-2.0). Logo e ilustrações originais do Rabisco.
              </p>
              <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
                Ver licenças e créditos completos
              </a>
            </div>
            <p className="about-footnote">
              Seu desenho é salvo apenas neste navegador. Use Salvar como para guardar uma cópia.
            </p>
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => onClose()}>
                Vamos desenhar
              </button>
            </div>
          </>
        )}
        {dialog === 'help' && (
          <>
            <h2>Seu próximo traço começa aqui.</h2>
            <p>
              Escolha uma ferramenta, uma cor e faça o primeiro risco. Você pode desfazer quando
              quiser.
            </p>
            <div className="shortcut-list">
              {ATALHOS.map(([key, label]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="help-note">
              A seleção pode ser movida arrastando por dentro dela. O botão direito desenha com a
              Cor 2.
            </p>
            <p className="help-note">
              Para desenhar uma curva, arraste a linha e ajuste até dois pontos de controle. Para
              desenhar um polígono, clique nos vértices e feche com um clique duplo ou no primeiro
              ponto. Segure Shift para restringir os ângulos.
            </p>
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => onClose()}>
                Entendi, mãos à obra
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
