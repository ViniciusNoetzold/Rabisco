# Continuar a 0.4 — ponto de parada

Plano completo em [PROMPT_0.4.md](PROMPT_0.4.md). Leia também README, CHANGELOG e docs/MELHORIAS.md.

## Feito (cada passo com commit e push no `main`)

- Passo 1: estabilizador de traço (corda, suavizar, terminar onde a mão parou, Alt+[ / Alt+]). ✅
- Passo 2: pressão (curva da caneta, pressão pela velocidade, afinar pontas). ✅
- Passo 3: simetria e mandala (espelhos, quatro quadrantes, radial 2–24 com caleidoscópio, centro arrastável, Shift+S, um item no histórico com recorte por cópia). ✅
- Passo 4: formas inteligentes (segurar parado no fim do traço de lápis/pincel vira forma editável; Enter confirma, Esc volta ao traço). ✅

Validação no fim do Passo 4: 151 testes unitários e 79 E2E passando; `npm run build` ok.

## Próximo: Passo 5 — Régua, linhas de fuga e guias

Siga o PASSO 5 do PROMPT_0.4.md. Depois os Passos 6 (vista: rotação, espelhar, prévia respeitando camadas, toque, cursor), 7 (gradiente, varinha mágica, borrar) e 8 (pendências: balde em worker, primeira pincelada em papel grande, seleção múltipla de camadas + distribuir, perf completo, docs e versão 0.4.0).

## Para rodar

```
npm install
npm run dev            # http://localhost:5173
npm test               # unitários (Vitest)
npm run test:e2e       # E2E (Playwright, canal Edge)
npm run perf -- --rotulo=nome   # PERF_ESTABILIZAR=40 PERF_SIMETRIA=12 opcionais
```

## Regras que continuam valendo

- Novas dependências só com aprovação e licença permissiva (MIT, Apache-2.0, BSD, ISC, Zlib, OFL, CC BY).
- Nada da Microsoft (ícones, fontes, nomes); textos em pt-BR.
- Cada edição é um comando JSON serializável; novos parâmetros entram no próprio comando.
- Movimento do pincel p95 < 4 ms em 4000 × 4000.
- A cada passo: testes, docs (CHANGELOG, MELHORIAS, guia-de-uso, desempenho), commit e push.
