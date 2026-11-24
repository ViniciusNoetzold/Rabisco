import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Traces contêm HTML: ignorá-los evita recarregar o app durante os testes E2E.
  server: { watch: { ignored: ['**/output/**', '**/test-results/**', '**/playwright-report/**'] } },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
