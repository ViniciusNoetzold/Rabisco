# Rascunhos para retomar a 0.5

Use este material junto de [CONTINUAR_0.5.md](../CONTINUAR_0.5.md) e do [plano da 0.5](../PROMPT_0.5.md). Consulte o ponto de continuação para saber quais passos já foram integrados antes de aplicar os patches.

Rode `npm install` na raiz do repositório. Antes de aplicar cada patch dessa pasta, use `git apply --check` seguido do caminho do arquivo. Os rascunhos foram preparados em bases diferentes. Se um trecho precisar de ajuste, confira as mudanças que já chegaram ao arquivo compartilhado e integre o trecho preservando ambas.

## Passo 6

Aplique [`passo-6-filtros.patch`](passo-6-filtros.patch), que cria os algoritmos e dois arquivos de testes unitários. Registre em `src/filtros/registro.ts` os exports `dithering`, `meioTom`, `mosaico`, `pontilhismo`, `vitral` e `efeitoCrt`. As opções de dithering e paleta são exportadas pelo módulo correspondente. Os parâmetros e os valores padrão estão nas funções dos dois módulos.

## Passo 7

Integre [`ajustes.patch`](ajustes.patch), com as camadas de ajuste, o compositor, a edição, o armazenamento no `.rabisco` e os testes.

## Passo 8

Integre as pendências nesta ordem:

1. [`selecao.patch`](selecao.patch) — soma e subtração em seleções.
2. [`dedo-simetria.patch`](dedo-simetria.patch) — dedo com simetria.
3. [`formas-simetria.patch`](formas-simetria.patch) — formas inteligentes com simetria.
4. [`balde-faixas.patch`](balde-faixas.patch) — aplicação do balde em faixas.
5. [`vista-reguas-miniatura.patch`](vista-reguas-miniatura.patch) — réguas e miniatura na vista girada ou espelhada.
6. [`guias-historico.patch`](guias-historico.patch) — histórico das guias. Sua base já inclui o patch anterior.
7. [`capturas.patch`](capturas.patch) — roteiro de capturas. Use também as 15 verificações de [`guia-0.5.md`](guia-0.5.md) no fechamento.

Valide cada passo com `npm test`, `npm run build` e `npm run test:e2e`. Complete as medições da 0.5 e o fechamento do plano antes de marcar a versão 0.5.0 como concluída.
