import type { Comando } from '../../commands/comandos';
import type { Executador } from '../../commands/executador';
import type { RabiscoDocument } from '../../document/model';
import type { DocumentoComCamadas } from '../../io/camadas';

/** O que os módulos do editor compartilham com o coordenador (EditorController). */
export interface NucleoEditor {
  readonly doc: RabiscoDocument;
  readonly comandos: Executador;
  /** Editor montado e ainda não encerrado. */
  ativo(): boolean;
  /** Pronto para uma ação: carregado, ativo e sem gesto em andamento. */
  disponivel(): boolean;
  /** Executa um comando no histórico. `aposExecutar` roda antes de atualizar tela e autosave. */
  executar(comando: Comando, aposExecutar?: () => void): boolean;
  notificar(): void;
  avisar(mensagem: string): void;
  fit(): void;
  /** Troca o documento inteiro por um arquivo com camadas aberto (o histórico recomeça). */
  substituirDocumento(dados: DocumentoComCamadas): void;
}
