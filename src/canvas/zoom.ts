export const NIVEIS_ZOOM = [0.125, 0.25, 0.5, 1, 2, 3, 4, 6, 8] as const;
export const ZOOM_MIN = NIVEIS_ZOOM[0];
export const ZOOM_MAX = NIVEIS_ZOOM[NIVEIS_ZOOM.length - 1];

const casasDoZoom = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function limitarZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) : 1;
}

export function nivelSeguinte(zoom: number, direcao: -1 | 1): number {
  if (direcao > 0) return NIVEIS_ZOOM.find((nivel) => nivel > zoom) ?? ZOOM_MAX;
  for (let indice = NIVEIS_ZOOM.length - 1; indice >= 0; indice--) {
    if (NIVEIS_ZOOM[indice] < zoom) return NIVEIS_ZOOM[indice];
  }
  return ZOOM_MIN;
}

/** Escolhe pela distância proporcional em vez de favorecer escalas menores. */
export function indiceDoZoom(zoom: number): number {
  const atual = limitarZoom(zoom);
  return NIVEIS_ZOOM.reduce(
    (melhor, nivel, indice) =>
      Math.abs(Math.log(nivel / atual)) < Math.abs(Math.log(NIVEIS_ZOOM[melhor] / atual))
        ? indice
        : melhor,
    0,
  );
}

export function formatarZoom(zoom: number): string {
  return `${casasDoZoom.format(zoom * 100)}%`;
}

export function areaDeZoom(
  centro: { x: number; y: number },
  tela: { width: number; height: number },
  papel: { width: number; height: number },
  nivel: number,
) {
  const fator = limitarZoom(nivel);
  const width = Math.min(papel.width, tela.width / fator);
  const height = Math.min(papel.height, tela.height / fator);
  return {
    x: Math.max(0, Math.min(papel.width - width, centro.x - width / 2)),
    y: Math.max(0, Math.min(papel.height - height, centro.y - height / 2)),
    width,
    height,
  };
}
