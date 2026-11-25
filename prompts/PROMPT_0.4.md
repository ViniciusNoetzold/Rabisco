# Prompt — Rabisco 0.4 "Desenhar fica fácil"

> Cole o bloco abaixo na IA de código, aberta na pasta do projeto. A etapa tem **8 passos**:
> a IA para no fim de cada um, roda tudo, faz commit e `git push`, e espera o seu "ok, próximo".
> Antes de começar, decida as perguntas da seção "Decisões" (ou aceite os padrões sugeridos).

## Decisões (com o padrão sugerido)

| Pergunta                                                   | Padrão sugerido                                     | Por quê                                                                |
| ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Usar a biblioteca `lazy-brush` (MIT) para o estabilizador? | **Não**: implementar o nosso (é um algoritmo curto) | Menos dependência, e funciona igual no pincel, lápis, borracha e spray |
| Usar `simplify-js` (BSD) para reconhecer formas?           | **Não**: Ramer–Douglas–Peucker próprio              | Também é curto e já temos geometria de formas                          |
| A 0.4 inclui gradiente, varinha mágica e borrar?           | **Sim, no Passo 7** (opcional se o tempo apertar)   | São pedidos clássicos de "paint completinho"                           |
| Público infantil?                                          | Fica para a 0.9 (tutor)                             | Não muda nada na 0.4                                                   |

```text
# PAPEL
Você é um engenheiro sênior de editores gráficos web trabalhando no RABISCO, nesta pasta
(repositório git em github.com/ViniciusNoetzold/Rabisco, branch main). Antes de mudar
qualquer coisa, leia nesta ordem: docs/IDEIA.md, docs/FERRAMENTAS.md, docs/MELHORIAS.md,
README.md, ROADMAP.md, CHANGELOG.md (0.3), docs/desempenho.md e o código em src/ e tests/.

# REGRAS DE TRABALHO
- Um passo por vez, na ordem. Antes de cada passo, um plano curto com os arquivos afetados.
- No fim de cada passo: `npm test`, `npm run build`, `npm run test:e2e` (suíte COMPLETA) e,
  quando o passo mexer no traço ou na tela, `npm run perf -- --rotulo=passo-N`. Mostre a saída
  real, faça commit, `git push` e PARE até eu dizer "ok, próximo".
- Números no CHANGELOG e em docs/desempenho.md só se foram medidos nesta rodada.
- Dependências novas só com minha aprovação (nome, licença, tamanho, motivo). Só MIT, Apache-2.0,
  BSD, ISC, Zlib, OFL, CC BY. Registre em docs/FERRAMENTAS.md.
- Toda edição continua sendo um comando JSON no histórico (é a porta da IA da 0.8). Ajustes
  novos (estabilizador, simetria…) entram no próprio comando, para o traço poder ser refeito
  igual a partir do JSON.
- Visual do paint da era Windows 7, textos em português do Brasil, nada da Microsoft.
- Nada pode deixar o traço mais lento: movimento do pincel p95 < 4 ms em 4000 × 4000, mesmo com
  estabilizador e simetria radial de 12 eixos ligados.
- Atualize docs/guia-de-uso.md, docs/MELHORIAS.md (marque ✅ e a versão) e o CHANGELOG a cada passo.

# OBJETIVO DA 0.4
Cumprir o pilar 2 da ideia original: "mais fácil de desenhar que o paint original". Quem tem a
mão tremida, usa mouse ou está começando precisa conseguir traços bonitos, formas certinhas e
desenhos simétricos sem esforço.

# ============================================================
# PASSO 1 — Estabilizador de traço ("pincel preguiçoso")
# ============================================================
1.1 Implementar um estabilizador por "corda": o pincel segue o ponteiro a uma distância
    (raio da corda) e só anda quando a corda estica. Raio de 0 (desligado) a 100 px de tela.
1.2 Suavização extra opcional: média móvel ponderada dos últimos N pontos (0–100%).
1.3 Ao soltar, o traço "alcança" o ponteiro (sem perder o fim do gesto), com opção de desligar.
1.4 Vale para lápis, pincéis (todos os 9), borracha, borracha de cor e spray. Não vale para
    formas, seleção e balde.
1.5 Interface: controle "Estabilizar" (0–100) no ribbon contextual do pincel/lápis/borracha e
    no painel "Seu traço", com prévia; atalho Alt+[ / Alt+] para ajustar em passos de 10.
    Mostrar a corda no overlay enquanto desenha (linha fina do ponteiro até a ponta do pincel).
1.6 O comando guarda os pontos JÁ estabilizados (o JSON refaz o mesmo traço).
Testes: unitários do algoritmo (zigue-zague com ruído vira linha mais reta; com 0 nada muda;
o fim do traço alcança o ponteiro); E2E: traço trêmulo sintético com e sem estabilizador,
comparando o desvio da linha.

# ============================================================
# PASSO 2 — Pressão e suavização de curvas
# ============================================================
2.1 Curva de pressão ajustável (suave, linear, firme) para caneta, com prévia.
2.2 Pressão simulada pela velocidade no mouse e no toque (mais rápido = mais fino), desligável.
2.3 Afinar a ponta no início e no fim do traço (entrada e saída), 0–100%.
2.4 Interpolação por spline (Catmull-Rom ou Bézier) entre os pontos, para curvas sem quinas em
    movimentos rápidos — conferir que o motor por carimbos já espaça bem e ajustar.
Testes: unitários de curva de pressão e afinamento; E2E com pointerType "pen" e pressões
sintéticas (já existe um teste de pressão em pinceis.spec.ts para estender).

# ============================================================
# PASSO 3 — Simetria e mandala
# ============================================================
3.1 Modos: vertical (espelho esquerda/direita), horizontal, os dois (4 quadrantes) e radial com
    N eixos (2–24), com opção "espelhar dentro de cada fatia" (mandala caleidoscópio).
3.2 Centro da simetria ajustável: alça arrastável no overlay; botão "Centralizar no papel".
3.3 Linhas-guia da simetria no overlay (finas, discretas), desligáveis.
3.4 Vale para lápis, pincéis, spray, borracha e borracha de cor. Formas e texto: fica para depois
    (anotar em MELHORIAS).
3.5 O comando guarda os parâmetros da simetria e as marcas de UM eixo; o executor replica.
    Um traço simétrico é UM item no histórico, e a área afetada (autosave, recomposição) é a
    união das cópias.
3.6 Interface: grupo "Simetria" na aba Exibir (ou botão no ribbon com menu), atalho para
    ligar/desligar (sugestão: Shift+S não está em uso — conferir em atalhos.ts).
Testes: unitários das transformações de espelho e rotação (pontos conhecidos); E2E: um traço
com simetria radial de 6 eixos pinta os 6 pontos esperados; desfazer remove todos de uma vez.

# ============================================================
# PASSO 4 — Formas inteligentes ("segura que ajeita")
# ============================================================
4.1 Ao terminar um traço de lápis/pincel e SEGURAR o ponteiro parado ~500 ms, reconhecer:
    linha reta, círculo/elipse, retângulo/quadrado, triângulo, seta e polígono simples.
4.2 Reconhecimento: simplificação Ramer–Douglas–Peucker + testes geométricos (fechado ou
    aberto, número de cantos, desvio do raio médio, ângulos retos). Em dúvida, não troca nada.
4.3 A forma reconhecida vira uma FORMA EDITÁVEL do Rabisco (as mesmas alças da 0.2), com a cor,
    espessura e pincel do traço; Esc volta ao traço original; Enter confirma.
4.4 Feedback: um leve "pulo" da forma e uma dica na barra ("Virou um círculo! Enter confirma,
    Esc desfaz.").
4.5 Liga/desliga no ribbon contextual ("Formas inteligentes") e tempo de espera ajustável.
Testes: unitários do reconhecedor com traços sintéticos (círculo com ruído, retângulo torto,
linha trêmula, rabisco aleatório que NÃO deve virar forma); E2E: desenhar um círculo à mão,
segurar, conferir a forma editável e confirmar.

# ============================================================
# PASSO 5 — Régua, linhas de fuga e guias
# ============================================================
5.1 Régua (ferramenta ou modo): uma linha reta posicionável no papel (arrastar as pontas, girar);
    traços perto dela grudam e saem retos, como uma régua de verdade.
5.2 Guias: arrastar das réguas laterais cria guias horizontais/verticais (como no Photoshop);
    seleções, formas e a transformação livre encaixam nelas; menu para limpar guias.
5.3 Perspectiva (opcional se o tempo apertar): 1 e 2 pontos de fuga; os traços seguem a linha
    de fuga mais próxima.
5.4 Guias e régua são salvas no .rabisco (manifest, versão do formato +1, compatível com o v1).
Testes: unitários da projeção na régua e da leitura do .rabisco v1 e v2; E2E: traço torto perto
da régua sai reto; guia arrastada da régua aparece e a forma encaixa nela.

# ============================================================
# PASSO 6 — Vista e conforto
# ============================================================
6.1 Rotação da vista (não da imagem): R + arrastar, ou dois dedos girando; atalho para voltar
    a 0°; indicador do ângulo na barra de status. Todas as ferramentas e alças continuam certas
    com a vista girada (converter coordenadas no CanvasSurface).
6.2 Espelhar a vista (H), para conferir proporções como os artistas fazem.
6.3 Prévia do traço respeitando as camadas de cima: durante o gesto, desenhar a prévia na
    posição certa da pilha (hoje aparece por cima de tudo) — pendência da 0.3.
6.4 Toque: rejeição da palma quando há caneta; desfazer com dois dedos tocando, refazer com três.
6.5 Cursor do pincel mostrando o tamanho real (círculo) e a forma da ponta, com zoom.
Testes: E2E com a vista girada a 90°: um traço horizontal na tela vira vertical no papel; o
conta-gotas e as alças das formas continuam acertando o ponto.

# ============================================================
# PASSO 7 — Ferramentas que faltam (opcional se o tempo apertar)
# ============================================================
7.1 Gradiente linear e radial (Cor 1 → Cor 2, ou com transparência), arrastando no papel;
    respeita seleção e travar transparência; um item no histórico.
7.2 Varinha mágica: seleção por cor com tolerância, contígua ou global, somar (Shift) e subtrair
    (Alt) à seleção atual. Seleção por elipse.
7.3 Borrar/esfumar (dedo) como pincel novo, com força ajustável.
Testes: unitários do gradiente e da varinha (máscaras esperadas); E2E de cada ferramenta.

# ============================================================
# PASSO 8 — Pendências, desempenho e fechamento
# ============================================================
8.1 Balde num Web Worker (hoje ~1 s em 4000 × 4000 bloqueia a tela): a interface não trava e
    mostra "Preenchendo…" se passar de 200 ms.
8.2 Primeira pincelada em papel grande (atraso único de ~127 ms) e primeira troca de
    visibilidade com 20 camadas (~150 ms): investigar e reduzir, ou documentar por que não dá.
8.3 Seleção múltipla no painel de Camadas (Ctrl/Shift+clique) e "Distribuir" (horizontal e
    vertical) — pendência da 0.3.
8.4 `npm run perf` completo (três papéis + 20 camadas) com estabilizador e simetria ligados;
    tabela antes/depois em docs/desempenho.md.
8.5 README (recursos e atalhos novos, capturas com `node scripts/capturas.mjs`), guia de uso
    com o roteiro manual da 0.4 (15 verificações em 10 minutos), ROADMAP marcando a 0.4 como
    concluída, versão 0.4 na janela e no Sobre, e prompts/CONTINUAR com o próximo passo
    (planejar a 0.5: filtros, ASCII, pixel art, dithering).

Comece pelo PASSO 1.
```

## Depois da 0.4

A 0.5 traz os **estilos** do pedido original (ASCII, pixel art, dithering, meio-tom, filtros) e a 0.6 começa a **IA com chave gratuita** (AI Horde sem cadastro como padrão). O roteiro completo está em [ROADMAP.md](../ROADMAP.md) e a lista viva em [docs/MELHORIAS.md](../docs/MELHORIAS.md).
