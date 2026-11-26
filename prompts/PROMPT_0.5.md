# Prompt — Rabisco 0.5 "Estilos e filtros"

> Cole o bloco abaixo na IA de código, aberta na pasta do projeto. A etapa tem **8 passos**:
> a IA para no fim de cada um, roda tudo, faz commit e `git push`, e espera o seu "ok, próximo".
> Antes de começar, decida as perguntas da seção "Decisões" (ou aceite os padrões sugeridos).

## Decisões (com o padrão sugerido)

| Pergunta                                              | Padrão sugerido                                               | Por quê                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Usar `image-q` (MIT) para reduzir paleta e dithering? | **Não no começo**: Floyd–Steinberg, Atkinson e Bayer próprios | São algoritmos curtos; `image-q` só se a quantização (Wu/NeuQuant) for pedida |
| Usar `figlet.js` (MIT) para títulos ASCII?            | **Sim, no Passo 5**, carregado sob demanda (com 3 fontes)     | Fontes figlet prontas; pedir aprovação com tamanho                            |
| Filtros em WebGL (glfx.js ou shaders próprios)?       | **Não**: Canvas/JS em worker; WebGL só se o perf pedir        | Menos risco de cor errada e de diferença entre prévia e resultado             |
| OpenCV.js?                                            | **Não** na 0.5 (pesado)                                       | Bordas e desfoque cabem em código próprio                                     |
| Camadas de ajuste (não destrutivas) entram na 0.5?    | **Sim, no Passo 7** (opcional se o tempo apertar)             | É o jeito "certo" de filtros; reaproveita o compositor                        |

```text
# PAPEL
Você é um engenheiro sênior de editores gráficos web trabalhando no RABISCO, nesta pasta
(repositório git em github.com/ViniciusNoetzold/Rabisco, branch main). Antes de mudar
qualquer coisa, leia nesta ordem: docs/IDEIA.md, docs/FERRAMENTAS.md, docs/MELHORIAS.md,
README.md, ROADMAP.md, CHANGELOG.md (0.4.0), docs/desempenho.md, prompts/CONTINUAR_0.4.md e o
código em src/ e tests/.

# REGRAS DE TRABALHO
- Um passo por vez, na ordem. Antes de cada passo, um plano curto com os arquivos afetados.
- No fim de cada passo: `npm test`, `npm run build`, `npm run test:e2e` (suíte COMPLETA, sem
  outro Playwright rodando em paralelo) e, quando o passo mexer em pixels pesados,
  `npm run perf -- --rotulo=passo-N`. Mostre a saída real, faça commit, `git push` e PARE até
  eu dizer "ok, próximo".
- Números no CHANGELOG e em docs/desempenho.md só se foram medidos nesta rodada.
- Dependências novas só com minha aprovação (nome, licença, tamanho, motivo). Só MIT, Apache-2.0,
  BSD, ISC, Zlib, OFL, CC BY. Registre em docs/FERRAMENTAS.md.
- Todo filtro e estilo é um COMANDO JSON no histórico (é a porta da IA da 0.8): parâmetros no
  comando, resultado determinístico (sementes fixas), um item no histórico, respeita seleção
  (inclusive a da varinha), travar transparência e máscara.
- A prévia usa o MESMO código do resultado (como o dedo da 0.4). Trabalho pesado vai para um
  worker (como o balde da 0.4): a tela não trava; acima de 200 ms, "Aplicando…".
- Visual do paint da era Windows 7, textos em português do Brasil, nada da Microsoft.
- O traço continua leve: movimento do pincel p95 < 4 ms em 4000 × 4000.
- Atualize docs/guia-de-uso.md, docs/MELHORIAS.md (marque ✅ e a versão) e o CHANGELOG a cada passo.

# OBJETIVO DA 0.5
Cumprir o pilar de "estilos" da ideia original (ASCII, pixel art e outros) e dar ao Rabisco os
filtros de um editor completo, todos com prévia ao vivo e desfazer.

# ============================================================
# PASSO 1 — Arquitetura de filtros e estilos
# ============================================================
1.1 Registro de filtros (src/filtros/): cada filtro declara id, nome, categoria, parâmetros
    (com faixas e padrão), função pura `(pixels, parametros, semente) → pixels` e se pode rodar
    por blocos (para worker e papéis grandes).
1.2 Comando `AplicarFiltro { filtro, parametros, semente, area?, mascara? }`; executor aplica no
    alvo ativo (camada ou máscara), recortado na seleção, com travar transparência.
1.3 Execução num worker genérico de filtros (reaproveitar o padrão do balde): pixels
    transferidos; resultado volta e é aplicado; "Aplicando…" após 200 ms; cancelar com Esc.
1.4 Janela de filtro: parâmetros à esquerda, prévia ao vivo no papel (com "antes/depois"
    segurando um botão), Aplicar e Cancelar. Menu "Filtros" na aba Início (ou aba nova
    "Efeitos"), com a lista por categoria e "Repetir último filtro" (Ctrl+F).
Testes: unitários do registro e de um filtro trivial (inverter cores) com seleção e
transparência travada; E2E: abrir a janela, ver a prévia, aplicar, desfazer.

# ============================================================
# PASSO 2 — Filtros de cor
# ============================================================
2.1 Brilho/contraste, matiz/saturação/luminosidade, níveis, curvas (editor de curva com pontos),
    preto e branco (com mistura de canais), sépia, inverter, limiar, posterizar.
2.2 Conta-gotas de ponto branco/preto nos níveis.
Testes: unitários com cores conhecidas (ex.: saturação 0 vira cinza com a luminância certa);
E2E de curvas.

# ============================================================
# PASSO 3 — Desfoque, nitidez e ruído
# ============================================================
3.1 Desfoque gaussiano (separável, em blocos), desfoque de movimento, nitidez (máscara de
    nitidez), ruído (com semente), mediana (tirar ruído), detectar bordas (Sobel), relevo.
3.2 Bordas da camada: nada de "puxar preto" do transparente (alfa pré-multiplicado, como o dedo).
Testes: unitários (desfoque preserva a soma; semente fixa dá o mesmo ruído); perf do desfoque
em 4000 × 4000 no worker.

# ============================================================
# PASSO 4 — Pixel art
# ============================================================
4.1 Pixelizar (tamanho do bloco), reduzir para uma paleta (Game Boy, NES, PICO-8, CGA,
    "paleta do desenho" com N cores), com e sem dithering.
4.2 Modo pixel art: lápis de 1 px sem antisserrilhado alinhado à grade, grade de pixels
    configurável (8/16/32), espelho de pixel e conta-gotas exato.
4.3 Exportar ampliado sem borrar (2×, 4×, 8×, vizinho mais próximo).
Testes: unitários das paletas (todas as cores do resultado estão na paleta); E2E pixelizar +
exportar 4×.

# ============================================================
# PASSO 5 — ASCII
# ============================================================
5.1 Converter camada ou seleção em ASCII: largura em colunas, conjunto de caracteres (simples,
    detalhado, blocos ░▒▓█, braille), inverter, colorido; prévia em fonte monoespaçada.
5.2 Resultado como camada de texto ASCII (editável letra por letra) ou rasterizado numa camada.
5.3 Exportar .txt, .html (colorido) e .png; copiar para a área de transferência.
5.4 Títulos em letras ASCII com figlet.js (se aprovado), sob demanda.
Testes: unitários (imagem conhecida → texto esperado); E2E converter, copiar e exportar .txt.

# ============================================================
# PASSO 6 — Dithering, meio-tom e estilos artísticos
# ============================================================
6.1 Dithering: Floyd–Steinberg, Atkinson, Bayer 2/4/8 (ordenado), com paleta de 2 a 16 cores.
6.2 Meio-tom (CMYK ou uma cor, ângulo e tamanho do ponto), mosaico, pontilhismo, vitral
    (Voronoi com semente), "CRT" (linhas e aberração de cor).
Testes: unitários (Bayer 4×4 com 50% de cinza dá o padrão esperado; semente fixa no vitral).

# ============================================================
# PASSO 7 — Camadas de ajuste (opcional se o tempo apertar)
# ============================================================
7.1 Camada de ajuste não destrutiva (brilho/contraste, matiz/saturação, curvas, P&B) que afeta
    as de baixo, com máscara e opacidade; editar os parâmetros depois com duplo clique.
7.2 Salva no .rabisco (versão do formato +1, lendo v1 e v2); PSD/ORA exportam achatada com aviso.
Testes: unitários do compositor; E2E criar, editar, ocultar e salvar/reabrir.

# ============================================================
# PASSO 8 — Pendências, desempenho e fechamento
# ============================================================
8.1 Pendências da 0.4 (docs/MELHORIAS.md): balde aplicando por faixas entre quadros (hoje a tela
    ainda fica ~420 ms ocupada em 4000 × 4000), somar/subtrair nas outras seleções, dedo com
    simetria, formas inteligentes com simetria, réguas e miniatura com a vista girada, guias no
    histórico.
8.2 `npm run perf` completo + filtros pesados (desfoque e dithering em 4000 × 4000); tabela em
    docs/desempenho.md.
8.3 README (estilos e filtros, capturas com `node scripts/capturas.mjs`, incluindo uma em ASCII
    e uma em pixel art), guia com o roteiro manual da 0.5 (15 verificações), ROADMAP marcando a
    0.5, versão 0.5.0 na janela e no Sobre, e prompts/CONTINUAR com o próximo passo (planejar a
    0.6: IA com chave gratuita, AI Horde sem cadastro como padrão).

Comece pelo PASSO 1.
```

## Depois da 0.5

A 0.6 começa a **IA com chave gratuita** (AI Horde sem cadastro como padrão, fila cancelável,
geração e edição sempre em camada nova). O roteiro completo está em [ROADMAP.md](../ROADMAP.md)
e a lista viva em [docs/MELHORIAS.md](../docs/MELHORIAS.md).
