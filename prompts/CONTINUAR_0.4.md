# Continuar a 0.4 — ponto de parada

Plano completo em [PROMPT_0.4.md](PROMPT_0.4.md). Leia também README, CHANGELOG e docs/MELHORIAS.md.

## Feito (cada passo com commit e push no `main`)

- Passo 1: estabilizador de traço (corda, suavizar, terminar onde a mão parou, Alt+[ / Alt+]). ✅
- Passo 2: pressão (curva da caneta, pressão pela velocidade, afinar pontas). ✅
- Passo 3: simetria e mandala (espelhos, quatro quadrantes, radial 2–24 com caleidoscópio, centro arrastável, Shift+S, um item no histórico com recorte por cópia). ✅
- Passo 4: formas inteligentes (segurar parado no fim do traço de lápis/pincel vira forma editável; Enter confirma, Esc volta ao traço). ✅
- Passo 5: régua de desenho (Shift+R) e guias arrastadas das réguas, com encaixe; salvas no .rabisco v2 e no autosave. Perspectiva ficou para depois. ✅
- Passo 6: vista girada (R + arrastar, 4/5/6, dois dedos) e espelhada (H), prévia atrás das camadas de cima, palma e gestos de dois/três dedos, cursor do pincel no tamanho real. ✅
- Passo 7: gradiente (G), varinha mágica (W, Shift soma, Alt subtrai), seleção elíptica e dedo (borrar). ✅

Validação no fim do Passo 6: 166 testes unitários e 85 E2E passando; `npm run build` ok.

## Próximo: Passo 8 — Pendências, desempenho e fechamento

Siga o PASSO 8 do PROMPT_0.4.md (pendências: balde em worker, primeira pincelada em papel grande, seleção múltipla de camadas + distribuir, perf completo, docs e versão 0.4.0).

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
