import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React muda pouco entre versões do Rabisco: arquivo próprio, guardado em cache.
        manualChunks(caminho) {
          if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(caminho)) return 'react';
        },
      },
    },
  },
  // O Dexie é importado sob demanda. Sem isto o servidor de desenvolvimento o descobriria
  // tarde, reotimizaria as dependências e recarregaria a página no meio do uso.
  optimizeDeps: { include: ['dexie'] },
  // Traces contêm HTML: ignorá-los evita recarregar o app durante os testes E2E.
  server: { watch: { ignored: ['**/output/**', '**/test-results/**', '**/playwright-report/**'] } },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
