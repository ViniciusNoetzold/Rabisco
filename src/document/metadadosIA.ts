/** Proveniência que acompanha uma camada de pixels no autosave e no arquivo .rabisco. */
export interface MetadadosIA {
  provedor: string;
  prompt: string;
  operacao: 'gerar' | 'editar';
  semente?: number;
  modelo?: string;
}

export const LIMITE_PROMPT_IA = 2000;

/** Recria a proveniência a partir dos campos públicos esperados. */
export function metadadosIASeguros(valor: unknown): MetadadosIA | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const { provedor, prompt, operacao, semente, modelo } = valor as Record<string, unknown>;
  if (
    typeof provedor !== 'string' ||
    !provedor.trim() ||
    typeof prompt !== 'string' ||
    !prompt.trim() ||
    (operacao !== 'gerar' && operacao !== 'editar')
  )
    return undefined;

  const dados: MetadadosIA = {
    provedor: provedor.trim().slice(0, 64),
    prompt: prompt.trim().slice(0, LIMITE_PROMPT_IA),
    operacao,
  };
  if (typeof semente === 'number' && Number.isSafeInteger(semente) && semente >= 0)
    dados.semente = semente;
  if (typeof modelo === 'string' && modelo.trim()) dados.modelo = modelo.trim().slice(0, 128);
  return dados;
}
