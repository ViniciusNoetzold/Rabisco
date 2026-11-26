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

Validação da 0.4.0: 181 testes unitários e 91 E2E passando; `npm run build` e `npm run perf` completo ok.

- Passo 8: balde num worker, várias camadas + distribuir, atrasos de primeira leitura investigados e documentados, perf completo, docs e versão 0.4.0. ✅

**A 0.4 está concluída.**

## Próximo: a 0.5 — estilos e filtros

O plano está pronto em **[prompts/PROMPT_0.5.md](PROMPT_0.5.md)** (8 passos: arquitetura de filtros, filtros de cor, desfoque/nitidez/ruído, pixel art, ASCII, dithering e meio-tom, camadas de ajuste e fechamento). Decida as perguntas da seção "Decisões" (ou aceite os padrões), cole o bloco do prompt na IA de código e diga "começar".

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
