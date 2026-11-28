# Rascunhos da integração da 0.5

Os patches registram o ponto de parada durante o desenvolvimento da 0.5. A integração está na branch `main`. Para retomar o projeto, abra [CONTINUAR_0.5.md](../CONTINUAR_0.5.md).

Os rascunhos foram preparados em bases diferentes. Durante a integração, `git apply --check` ajudou a identificar trechos compartilhados que precisavam ser conciliados.

## Passo 6

[`passo-6-filtros.patch`](passo-6-filtros.patch) reúne os algoritmos de dithering e estilos e os testes unitários iniciais. Os filtros foram integrados ao registro em `src/filtros/registro.ts`.

## Passo 7

[`ajustes.patch`](ajustes.patch) contém o rascunho das camadas de ajuste, do compositor, da edição e do armazenamento no `.rabisco`.

## Passo 8

A sequência de integração partiu destes rascunhos.

1. [`selecao.patch`](selecao.patch) — soma e subtração em seleções.
2. [`dedo-simetria.patch`](dedo-simetria.patch) — dedo com simetria.
3. [`formas-simetria.patch`](formas-simetria.patch) — formas inteligentes com simetria.
4. [`balde-faixas.patch`](balde-faixas.patch) — aplicação do balde em faixas.
5. [`vista-reguas-miniatura.patch`](vista-reguas-miniatura.patch) — réguas e miniatura na vista girada ou espelhada.
6. [`guias-historico.patch`](guias-historico.patch) — histórico das guias. Sua base já inclui o patch anterior.
7. [`capturas.patch`](capturas.patch) — roteiro de capturas. Os 15 itens de [`guia-0.5.md`](guia-0.5.md) serviram de base para o [guia de uso](../../docs/guia-de-uso.md#roteiro-manual-da-05).

As validações da versão estão no [changelog](../../CHANGELOG.md) e nas [medições de desempenho](../../docs/desempenho.md).
