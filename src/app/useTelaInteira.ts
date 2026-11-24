import { useCallback, useEffect, useState, type RefObject } from 'react';

export function useTelaInteira(area: RefObject<HTMLElement | null>) {
  const [ativa, definirAtiva] = useState(false);

  useEffect(() => {
    const sincronizar = () => definirAtiva(document.fullscreenElement === area.current);
    document.addEventListener('fullscreenchange', sincronizar);
    return () => document.removeEventListener('fullscreenchange', sincronizar);
  }, [area]);

  const sair = useCallback(() => {
    definirAtiva(false);
    if (document.fullscreenElement === area.current) void document.exitFullscreen().catch(() => {});
  }, [area]);

  const alternar = useCallback(() => {
    if (ativa) {
      sair();
      return;
    }
    definirAtiva(true);
    // Em navegadores que restringem a API, o desenho ainda ocupa toda a área da aplicação.
    void area.current?.requestFullscreen?.().catch(() => {});
  }, [area, ativa, sair]);

  return { ativa, sair, alternar };
}
