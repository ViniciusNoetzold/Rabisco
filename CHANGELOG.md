# Histórico de alterações

## Correção de ASCII

- **Colunas** aceita até 1.024. A janela reduz a prévia de artes grandes e mantém as dimensões informadas na cópia e exportação. O PNG respeita os limites de imagem do Rabisco.

## 0.5.0 — 2026-11-28 — Estilos e filtros

### Passo 8 — Seleções, simetria, vista e desempenho

- **Shift** soma e **Alt** subtrai nas seleções retangular, elíptica e de laço. Use o modificador no início do arraste. Ao iniciar a elipse sem modificador, pressione **Shift** durante o arraste para fazer um círculo.
- **Dedo** e **Formas inteligentes** acompanham a simetria. As cópias entram em uma única edição reversível.
- As réguas e a miniatura acompanham a vista girada ou espelhada. Criar, mover, remover ou limpar guias gera uma edição no histórico.
- O balde prepara áreas grandes em faixas entre quadros. **Esc** cancela o processamento e as faixas são confirmadas juntas em uma edição.
- O guia inclui um roteiro manual de 15 verificações. O README mostra o Rabisco em ASCII e pixel art. [Guia da 0.5](docs/guia-de-uso.md#roteiro-manual-da-05)
- Validação com 263 testes unitários, build de produção e 109 fluxos E2E no Edge.
- Em 4000 × 4000, a maior tarefa do balde caiu de 306 ms para 97 ms. O tempo total passou de 786 ms para 1.232 ms com a divisão em quadros. O movimento do pincel ficou em até 0,4 ms (p95). [Desempenho](docs/desempenho.md)

### Passo 7 — Camadas de ajuste

- **Nova camada de ajuste**, no painel Camadas, oferece brilho e contraste, matiz e saturação, curvas e preto e branco com prévia no papel. O ajuste preserva os pixels abaixo. A opacidade e a máscara controlam sua intensidade. Um duplo clique no nome reabre os parâmetros.
- O `.rabisco` v3 mantém os ajustes editáveis e lê os formatos v1 e v2. A exportação para PSD, ORA e ZIP de PNGs avisa quando os ajustes são aplicados à imagem achatada.
- Validação com 247 testes unitários, build de produção e 102 fluxos E2E no Edge. A suíte verificou também a leitura e a edição do texto ASCII com o novo formato.
- Em 4000 × 4000, criar a camada de ajuste de brilho levou 211,7 ms. A prévia e a confirmação tiveram uma tarefa máxima de 239 ms na thread principal. [Desempenho](docs/desempenho.md)

### Passo 6 — Dithering e estilos artísticos

- **Dithering** oferece Floyd–Steinberg, Atkinson e Bayer de 2 × 2, 4 × 4 e 8 × 8. Escolha de 2 a 16 cores em tons de cinza ou extraídas do desenho.
- **Estilos** reúne meio-tom com uma cor ou CMYK, mosaico, pontilhismo, vitral e CRT. Os filtros preservam o alfa e o vitral e o pontilhismo usam uma semente fixa para repetir o resultado.
- Validação com 238 testes unitários, build de produção e 101 fluxos E2E concluídos. Os testes de apagar uma seleção e desenhar na janela reduzida passaram na retentativa.
- Em 4000 × 4000, o dithering Floyd–Steinberg levou 697,9 ms no worker com transferência. A maior tarefa da thread principal foi de 99 ms. [Desempenho](docs/desempenho.md)

### Passo 5 — ASCII

- **Início › Imagem › Filtros › Converter em ASCII** converte a camada ativa ou a seleção com os conjuntos simples, detalhado, blocos e Braille. A janela tem prévia monoespaçada, inversão, cores, cópia e exportação `.txt`, `.html` e `.png`.
- A arte pode entrar como camada rasterizada ou texto editável. **Editar ASCII** altera os caracteres em uma edição reversível e o arquivo `.rabisco` mantém o texto editável. Operações como mesclar ou aplicar uma máscara produzem pixels rasterizados. Desfazer recupera o texto.
- Validação com 222 testes unitários, build de produção e 100 fluxos E2E concluídos. O teste da biblioteca de formas passou na retentativa. Os dois fluxos de ASCII passaram na primeira tentativa da suíte completa.

### Passo 4 — Pixel art

- **Pixelizar** usa blocos com média ponderada pela transparência. **Reduzir paleta** aceita Game Boy, NES, PICO-8, CGA ou uma paleta extraída do desenho, com dithering Floyd–Steinberg opcional.
- **Exibir › Pixel art** liga o lápis de 1 px sem antisserrilhado e mostra a grade de 8, 16 ou 32 px. O modo usa a simetria e o conta-gotas do editor. Em **Salvar como**, a ampliação de 2×, 4× ou 8× usa vizinho mais próximo.
- Validação com 216 testes unitários, 98 E2E, build de produção e ensaio completo. Em 4000 × 4000, **Pixelizar** levou 226,8 ms no worker. [Desempenho](docs/desempenho.md)

### Passo 3 — Desfoque, nitidez e ruído

- **Desfoque** agora reúne o gaussiano e o de movimento. **Detalhes** inclui nitidez, ruído com semente, redução de ruído por mediana, bordas Sobel e relevo.
- Os filtros de vizinhança leem uma margem além da seleção e registram apenas os pixels selecionados. Os desfoques misturam cores em alfa pré-multiplicado para evitar que as bordas transparentes escureçam.
- Validação com 206 testes unitários, 96 E2E e build de produção. O gaussiano em 4000 × 4000 levou 1,26 s no worker e o movimento do pincel ficou em 0,7 ms (p95). [Ensaio de desempenho](docs/desempenho.md)

### Passo 2 — Filtros de cor

- O menu **Filtros** ganhou brilho e contraste, matiz/saturação/luminosidade, níveis, curvas, preto e branco com mistura de canais, sépia, limiar e posterização.
- Em **Curvas**, adicione, mova e remova pontos ou ajuste os valores de entrada e saída. Os conta-gotas de **Níveis** amostram o ponto preto e o ponto branco no papel.
- Validação com 196 testes unitários, build de produção e 96 fluxos E2E verificados. A suíte passou em 94 fluxos na rodada completa. Os dois ensaios de traço que falharam nessa rodada passaram ao repetir em série.

### Passo 1 — Arquitetura de filtros e estilos

- **Início › Filtros › Inverter cores** abre uma janela com prévia no papel. Segure **Antes/depois** para ver o original, use **Aplicar** para gravar a edição ou `Esc` para cancelar. `Ctrl+F` repete o último filtro aplicado na sessão.
- O registro reúne os parâmetros, padrões e funções determinísticas dos filtros. O worker devolve o resultado usado na prévia e no comando `AplicarFiltro`. Cada aplicação registra uma edição no histórico, respeitando a seleção, o alvo de edição e **Travar transparência**.
- Validação deste passo com 187 testes unitários, 94 fluxos E2E, build de produção e ensaio completo de desempenho. O movimento do pincel em 4000 × 4000 ficou em 0,5 ms (p95). Os tempos do filtro estão em [docs/desempenho.md](docs/desempenho.md).

## 0.4.0 — 2026-11-26 — "Desenhar fica fácil"

Estabilizador, pressão, simetria e mandala, formas inteligentes, régua e guias, vista girada e espelhada, gradiente, varinha mágica, seleção elíptica, dedo, várias camadas e balde em worker. Validação: 181 testes unitários, 91 fluxos E2E, build de produção e `npm run perf` completo (estabilizador e simetria ligados) aprovados.

### Passo 8 — Pendências, desempenho e fechamento

- **Balde num Web Worker** em papéis a partir de 1 megapixel: a área é calculada fora da thread da tela (pixels transferidos, sem cópia) e o comando continua o mesmo (o JSON refaz igual). Passando de 200 ms, a barra mostra "Preenchendo…"; novos gestos esperam o balde terminar. Sem worker, calcula na hora como antes.
- **Várias camadas**: Ctrl+clique soma ou tira uma camada da escolha, Shift+clique pega o intervalo. Com 3 ou mais, **Distribuir ↔** e **Distribuir ↕** deixam espaços iguais entre elas (as das pontas ficam paradas), num item só do histórico.
- **Primeira pincelada em papel grande e primeira troca de visibilidade com 20 camadas**: investigado; o atraso único é a primeira leitura dos pixels de cada camada desenhada pela GPU. Trocar as camadas para canvas na memória comum (`willReadFrequently`) já foi tentado na 0.3 e mudava as cores; ficou documentado em docs/desempenho.md.
- Grade de Ferramentas 5 × 2 com Gradiente e Varinha, na mesma largura da antiga 4 × 2 (os grupos do ribbon não recolhem antes do tempo).
- README, guia (roteiro manual da 0.4 com 15 verificações), ROADMAP e versão 0.4.0 na janela e no Sobre.
- Desempenho (detalhes em docs/desempenho.md): movimento do pincel 0,3–0,4 ms (p95) nos três papéis com estabilizador e simetria de 12 fatias; o balde em 4000 × 4000 trava a tela ~420 ms em vez de ~930 ms (do clique ao pronto: 813 ms).
- Testes: 3 unitários do distribuir; 2 E2E (balde em papel grande pelo worker; Ctrl+clique e distribuir). Total: 181 unitários e 91 E2E.

### Passo 7 — Ferramentas que faltavam

- **Gradiente** (G, no grupo do balde): arraste da Cor 1 até a Cor 2 (botão direito inverte; Shift prende o ângulo). Linear ou radial, e "Até transparente" (a Cor 1 vai sumindo). Com seleção, pinta só dentro dela; travar transparência é respeitado; um item no histórico. Prévia enquanto arrasta.
- **Varinha mágica** (W, também no menu Seleção): clique numa cor para selecionar a área dela, com a tolerância do balde e a opção "mesma cor em toda a imagem". **Shift soma** e **Alt subtrai** da seleção atual. Regiões separadas e buracos viram um contorno só (juntado por pontes de ida e volta que se anulam no recorte); o tracejado esconde as pontes. A seleção da varinha se move, apaga, copia e transforma como qualquer outra.
- **Seleção elíptica** (menu Seleção); Shift faz um círculo.
- **Dedo (borrar)**, novo item na galeria de pincéis, com "Força" ajustável: arrasta os pixels por onde passa (em alfa pré-multiplicado, sem puxar preto das bordas transparentes). A prévia usa o mesmo algoritmo do resultado; um item "Dedo" no histórico.
- Código: `src/tools/gradiente.ts`, `src/tools/varinha.ts`, `src/document/mascaraPixels.ts` (contornos, junção, soma/subtração), `src/brushes/borrar.ts`.
- Testes: 3 unitários do gradiente, 5 da varinha (contígua, global com buraco, cantos, soma/subtração, elipse) e 4 do dedo (força, recorte igual ao papel inteiro, borda transparente); 4 E2E (gradiente com e sem seleção, varinha com Shift e Alt, seleção elíptica, dedo). O teste de larguras confere o ribbon também com o gradiente e a varinha.

### Passo 6 — Vista e conforto

- **Girar a vista** (só a tela; a imagem não muda): **R segurada + arrastar** no papel gira livre (prende perto dos ângulos retos; Shift de 15 em 15°), **4** e **6** giram 15°, **5** volta a 0°, dois dedos girando na tela também giram. Botões no grupo "Vista" da aba Exibir e o ângulo na barra de status (clique volta ao normal). Com o zoom ajustado à janela, girar reajusta para o papel caber. Soltar o R sem girar continua escolhendo o retângulo.
- **Espelhar a vista** (**H**), para conferir proporções; aparece "⇋ espelhada" na barra.
- Todas as ferramentas, alças, conta-gotas, texto, guias, régua de desenho e o centro da simetria acertam o ponto com a vista girada ou espelhada: a conversão tela→papel fica em `src/canvas/vista.ts`. Com a vista girada, as réguas laterais, a miniatura e as alças de tamanho do papel se escondem (voltam em 0°).
- **Prévia do traço respeitando as camadas**: com camadas visíveis acima da ativa, elas aparecem por cima da prévia durante o traço (antes a prévia ficava por cima de tudo). Pendência da 0.3 resolvida.
- **Toque**: com caneta em uso, a palma encostando não desenha; dois dedos tocando e soltando desfazem, três refazem.
- **Cursor do pincel e da borracha** no tamanho real, com a ponta oval da caligrafia e do marcador; some quando fica menor que 4 px na tela. Gira junto com a vista.
- Testes: 6 unitários da conversão (90°, espelho, ida e volta em vários ângulos, arraste) e 4 E2E (traço horizontal na tela vira vertical no papel a 90°; conta-gotas e alça do retângulo com a vista girada; prévia atrás da camada de cima e espelho com H; R + arrastar gira e R sozinho escolhe o retângulo). Total: 166 unitários e 85 E2E.

### Passo 5 — Régua de desenho e guias

- **Régua de desenho** (aba Exibir › Régua e guias, ou **Shift+R**): uma régua com marcas aparece no meio da área visível. Arraste a bolinha do meio para mover e as pontas para girar ou esticar (Shift gira de 15 em 15°). Um traço de lápis, pincel, spray ou borracha que **começa perto da borda** (até 28 px de tela) gruda nela e sai reto até soltar, como numa régua de verdade; longe dela o traço é livre.
- **Guias**: com as réguas laterais ligadas (Ctrl+R), arraste da régua de cima para criar uma guia horizontal e da lateral para uma vertical. Seleção retangular e formas (criar e redimensionar pelas alças) encaixam nas guias a até 6 px de tela; a transformação livre também. Com a ferramenta Mover (V), as guias se arrastam; soltas fora do papel, somem. "Guias" mostra ou esconde, "Limpar guias" tira todas.
- Guias e régua vão junto no **.rabisco (formato v2)** e no salvamento automático. Arquivos v1 (0.3) continuam abrindo; um arquivo de versão mais nova é recusado com aviso. Papel novo ou imagem comum começam sem guias.
- Perspectiva com pontos de fuga (opcional no plano) ficou para depois; anotada em MELHORIAS.
- Código em `src/document/guias.ts` (projeção, encaixe, leitura segura), `src/canvas/GuiasPapel.tsx` e nas réguas laterais.
- Testes: 9 unitários (projeção na régua, Shift de 15°, encaixe, guias inválidas, leitura do .rabisco v1, v2 e recusa da v3) e 2 E2E (traço torto perto da régua sai reto e longe dela não; guia arrastada da régua, retângulo encaixando, guia salva e reaberta no .rabisco, limpar guias). Total: 160 unitários e 81 E2E.

### Passo 4 — Formas inteligentes ("segura que ajeita")

- Termine um traço de **lápis ou pincel** e **segure parado** (0,5 s por padrão): se ele parece uma forma, vira **linha, círculo, elipse, quadrado, retângulo, triângulo, seta ou polígono** (até 8 lados). Em dúvida, nada muda.
- A forma reconhecida é uma **forma editável do Rabisco**, com as mesmas alças da 0.2 (mover, redimensionar, girar), na cor, espessura e pincel do traço (giz, marcador e aquarela viram o contorno do mesmo estilo), sem preenchimento. **Enter** confirma, **Esc** volta ao traço exatamente como foi desenhado, clicar fora confirma e já volta a desenhar com o lápis ou pincel.
- Feedback: a forma dá um leve "pulo" (desligado com "reduzir movimento" no sistema) e a dica "Virou um círculo! Enter confirma, Esc desfaz.".
- Liga/desliga com o ícone ao lado do campo de espessura (lápis e pincel) e no cartão "Seu traço", com o tempo de espera ajustável (0,3–1,5 s).
- Reconhecedor próprio em `src/shapes/reconhecer.ts`: Ramer–Douglas–Peucker para linha e seta, cantos pela virada da direção em trechos curtos (resistente ao tremor), elipse pelos eixos principais e erro do raio normalizado, ângulos retos para o retângulo e o tamanho do caminho comparado ao perímetro contra rabiscos.
- Com a simetria ligada, as formas inteligentes ficam desligadas (anotado em MELHORIAS).
- Testes: 7 unitários do reconhecedor (círculo com ruído, oval, retângulo torto, quase quadrado, triângulo, seta, linha trêmula e rabiscos que **não** viram forma) e 3 E2E (círculo à mão vira elipse e Enter confirma; retângulo com o pincel e Esc volta ao traço; soltar sem segurar e a opção desligada). Total: 151 unitários e 79 E2E.

### Passo 3 — Simetria e mandala

- Grupo **Simetria** na aba Exibir e atalho **Shift+S** (liga no último modo usado e desliga). Modos: espelho esquerda/direita, cima/baixo, quatro quadrantes e **radial** com 2 a 24 fatias, com a opção **Caleidoscópio** (espelha dentro de cada fatia, como numa mandala).
- O centro aparece como uma bolinha roxa sobre o papel: arraste para mudar (Shift ou soltar perto do meio prende no centro); "Centralizar no papel" volta ao meio. Linhas-guia tracejadas, cortadas na borda do papel, podem ser escondidas.
- Vale para lápis, os 9 pincéis, spray, borracha e borracha de cor. A prévia já mostra todas as cópias enquanto se desenha. Formas e texto ficam para depois (anotado em MELHORIAS).
- O comando guarda a simetria e as marcas de um eixo só; o executor pinta as cópias. Um traço simétrico é **um item no histórico**: um Ctrl+Z apaga todas as cópias.
- O histórico guarda um recorte por cópia (não o retângulo que junta todas), quando isso economiza memória: num papel 4000 × 4000, um traço radial longe do centro ocupava quase o papel inteiro e empurrava itens antigos para fora do limite de 128 MB.
- Medido com estabilizador 40 e radial de 12 fatias: cada movimento do pincel custa 0,2–0,3 ms (p95) nos três papéis (meta: < 4 ms); soltar o traço custa 18 ms em 1024 × 640 e 45–53 ms em 4000 × 4000 e 8192 × 4096. `npm run perf` aceita `PERF_SIMETRIA=12`.
- Algoritmos em `src/brushes/simetria.ts`; guias em `src/canvas/GuiasSimetria.tsx`.
- Testes: 7 unitários das transformações, 1 do executor (cópias num item, recortes por cópia) e 3 E2E (radial de 6 pinta 6 cópias e desfaz de uma vez; espelho com o centro arrastado; Shift+S). Total: 144 unitários e 76 E2E.

### Passo 2 — Pressão e curvas

- **Curva da caneta** (suave, linear, firme) no cartão "Seu traço", com mini gráfico de prévia. Com força 0,4: suave pinta 18 px, firme 10 px (pincel de 24 px).
- **Simular pressão pela velocidade** (mouse e toque): rápido afina, devagar engrossa, sem saltos (amortecida). Medido: 24 px devagar e 16–20 px rápido.
- **Afinar pontas** (0–100%): o começo sai fino enquanto se desenha e o fim é afinado ao soltar. Com 100%: 8 px nas pontas e 24 px no meio.
- As curvas entre pontos já eram suaves (quadráticas no amostrador do pincel desde a 0.2).
- Vale para os pincéis; lápis e borracha seguem com espessura fixa. Algoritmos em `src/brushes/pressao.ts`.
- Testes: 6 unitários e 3 E2E. Total: 136 unitários e 73 E2E.

### Passo 1 — Estabilizador de traço

- **Estabilizar** (0–100) no cartão "Seu traço": o pincel segue o ponteiro como se puxado por uma corda do comprimento escolhido (em px de tela), então o tremor da mão não chega ao papel. **Suavizar** (0–100%) amortece ainda mais cada passo, para curvas redondas no mouse. "Terminar onde a mão parou" faz o fim do traço alcançar o ponteiro ao soltar.
- Vale para lápis, os 9 pincéis, spray, borracha e borracha de cor (formas, seleção e balde não). Durante o traço, uma corda tracejada liga o ponteiro à ponta do pincel.
- Alt+[ e Alt+] ajustam o estabilizador em passos de 10, com aviso do valor.
- O comando do histórico guarda os pontos já estabilizados: o traço refeito pelo JSON sai igual.
- Medido: numa linha com tremor de ±10 px, o desvio médio da reta caiu de 3,65 px para 0,90 px com Estabilizar 40. Com o estabilizador ligado, cada movimento do pincel custa 0,3 ms (p95) em 4000 × 4000 e 8192 × 4096 (meta: < 4 ms).
- Algoritmo próprio (sem a biblioteca lazy-brush), em `src/brushes/estabilizador.ts`. `npm run perf` aceita `PERF_ESTABILIZAR=40`.
- Testes: 6 unitários do estabilizador e 2 E2E (tremor medido com e sem, corda visível, atalhos). Total: 130 unitários e 70 E2E.

## 0.3.0 — 2026-11-25

Camadas, colagem e arquivos com camadas. Validação: 124 testes unitários, 68 fluxos E2E e build de produção aprovados.

### Passo 4 — Máscaras, recorte e efeitos na interface

- Seção "Efeitos e máscara" no painel de Camadas: contorno (cor, espessura, por fora ou por dentro) e sombra (cor, distância, desfoque), recalculados sem estragar os pixels. O botão "✨ Virar adesivo" aplica contorno branco e sombra suave num clique, para as colagens.
- Com uma seleção (retângulo ou laço), o botão Máscara cria uma máscara em que só a área selecionada fica visível. Também há "Aplicar máscara" (junta a máscara aos pixels) e "Excluir máscara".
- Copiar mesclado (Ctrl+Shift+C) copia a seleção como se vê, com todas as camadas visíveis.

### Passo 3 (parcial) — Ferramentas cientes de camadas

- O texto confirmado entra numa camada própria ("Texto: …"), num único item do histórico. Dá para desligar em Texto › Fundo › "Em nova camada".
- Balde e conta-gotas ganharam "Amostrar todas as camadas": a área ou a cor vêm do que se vê, mas o balde pinta só na camada ativa.
- Já no Passo 1: borracha transparente fora do papel, travar transparência e aviso ao pintar em camada oculta ou bloqueada. Falta "Copiar mesclado" (Ctrl+Shift+C) e a opção de formas em nova camada.

### Passo 7 — Desempenho, alinhar e fechamento

- **Alinhar ao painel**: no painel de Camadas, "Alinhar ao papel" leva a camada ativa à esquerda, ao centro, à direita, ao topo, ao meio ou à base, num item do histórico. Distribuir várias camadas fica para quando o painel tiver seleção múltipla.
- `npm run perf` ganhou o cenário de 20 camadas de 4000 × 4000 (`PERF_SO_CAMADAS=1` roda só ele): movimento do pincel 0,2 ms (p95), ocultar camada 34,1 ms até a tela atualizar (mediana; 148,7 ms na primeira vez) e nenhuma tarefa longa. Detalhes em [docs/desempenho.md](docs/desempenho.md).
- Comandos de camada passaram a ser medidos ("camada" no relatório).
- Versão 0.3 na janela e no Sobre. Roteiro manual da 0.3 no guia de uso.

### Passo 6 — Arquivos com camadas

- **Formato .rabisco**: um ZIP com `manifest.json` (versão do formato, tamanho, DPI e toda a estrutura: camadas, grupos, modos, opacidade, bloqueios, máscaras e efeitos), um PNG por camada e por máscara, `preview.png` e `thumbnail.png`. **Ctrl+S** e "Salvar (.rabisco)" salvam o desenho inteiro; abrir o arquivo devolve tudo como estava.
- **PSD** (Photoshop e Photopea): salva e abre camadas, nomes, visibilidade, opacidade, modos, grupos, máscaras e recorte. Contorno e sombra do Rabisco entram aplicados aos pixels. Ao abrir, efeitos do Photoshop e camadas de ajuste são avisados, e textos viram pixels.
- **OpenRaster (.ora)** (Krita, GIMP, MyPaint): salva e abre camadas, grupos, modos, opacidade e visibilidade. Máscaras e efeitos entram aplicados aos pixels.
- **Cada camada em PNG (.zip)**, em "Salvar como". Formatos achatados (PNG, JPEG…) avisam que as camadas serão unidas. O botão rápido virou "Exportar PNG", e o menu Arquivo ganhou "Exportar PNG".
- **Arquivos recentes** no menu Arquivo: os 10 últimos abertos ou salvos, com miniatura, reabrem com um clique; "Limpar recentes" esvazia a lista (até 64 MB por arquivo, guardados neste navegador).
- Segurança ao abrir: até 512 MB descompactados, no máximo 200 camadas, caminhos sem `..` nem barra invertida, manifest validado campo a campo (nada é usado cru), cada PNG precisa ter o tamanho do papel e ids repetidos são corrigidos. Arquivo quebrado mostra um aviso e o desenho atual continua.
- Bibliotecas novas, aprovadas: **fflate** 0.8.3 (MIT) e **ag-psd** 34.2.3 (MIT, com pako MIT/Zlib e base64-js MIT). Só carregam quando usadas: 26 KB para .rabisco/.ora e 376 KB a mais só para PSD. O verificador de licenças passou a entender expressões compostas (A AND B, A OR B) e aceita Zlib.
- Testes E2E: ida e volta em .rabisco, PSD e ORA (camadas, nomes, modo, máscara e pixels conferidos), arquivo quebrado recusado e Ctrl+S com Recentes. Total: 124 unitários e 67 E2E.

### Passos 3 a 5 — O que faltava

- **Formas em nova camada:** opção no painel de Camadas. Cada forma confirmada entra numa camada própria ("Forma: Retângulo"…), num único item do histórico.
- **Grupos no painel:** "Agrupar" (Ctrl+G) põe a camada ativa num grupo novo, e outras camadas entram nele arrastadas. O cabeçalho do grupo tem setinha para recolher, olho (oculta o grupo inteiro), nome editável com duplo clique e "desagrupar". As camadas do grupo aparecem recuadas. A grade passou de Ctrl+G para Ctrl+'.
- **Distorcer:** na transformação livre, Ctrl+arraste num canto move só aquele canto (encaixar uma imagem em perspectiva numa parede, numa tela…). A imagem é deformada por uma malha de triângulos (8 × 8 na prévia, 24 × 24 ao confirmar). No histórico aparece como "Distorcer".
- **Guias de encaixe:** ao mover na transformação livre, as bordas e o centro da camada grudam nas bordas e no centro do papel e das outras camadas visíveis, com uma linha magenta. Shift desliga na hora; a opção "Guias de encaixe" na aba Exibir desliga de vez.
- A aba Exibir mostra as opções em duas colunas, para caber a quarta.
- Testes E2E novos: formas em nova camada e grupos, distorcer por um canto e encaixe no centro do papel. Total: 124 unitários e 62 E2E.

### Passo 5 — Transformação livre

- Ctrl+T (ou "Transformar" no painel de Camadas) mostra a caixa dos pixels da camada ativa com 8 alças e uma alça de giro. Arrastar por dentro move, as alças escalam a partir do centro (Shift mantém a proporção) e a bolinha gira (Shift de 15° em 15°). A prévia aparece no lugar da camada. Enter, um clique fora ou trocar de ferramenta confirmam num único item do histórico ("Transformação livre"), e Esc cancela. A máscara acompanha os pixels.

### Passo 5 (parcial) — Colagem em camadas e ferramenta Mover

- Imagem colada de fora (Ctrl+V) ou arrastada para a janela flutua para ser posicionada e, ao confirmar, vira uma camada nova com o nome do arquivo. Ctrl+Shift+V cola na camada atual, como antes. Várias imagens soltas de uma vez viram uma camada cada, centralizadas; as maiores que o papel são reduzidas para caber.
- Ferramenta Mover (V): arrasta a camada ativa inteira, com a máscara, num único item do histórico. Respeita o bloqueio de pixels e o de posição.
- Falta deste passo: transformação livre (escalar, girar, distorcer, perspectiva), guias de encaixe e o modo "adesivo" com um clique.

### Passo 2 — Painel de Camadas

- Seção "Camadas" no painel Meu ateliê, no estilo Aero: lista com a camada de cima primeiro, miniatura (atualizada até 4 vezes por segundo), miniatura da máscara, olho (Alt+clique mostra só esta), cadeado, nome editável com duplo clique ou F2, opacidade e etiqueta de cor. Arrastar uma camada reordena a pilha.
- Propriedades da camada ativa: opacidade, modo de mesclagem, travar transparência e recortar pela camada de baixo. Ações: nova, duplicar, máscara, mesclar abaixo e excluir (com confirmação; dá para desfazer).
- Clique na miniatura da máscara: pincéis e borracha passam a pintar na máscara. Shift+clique liga ou desliga a máscara.
- Atalhos: Ctrl+Shift+N (nova camada), Ctrl+J (duplicar), Ctrl+Shift+M (mesclar abaixo) e Ctrl+[ / Ctrl+] (mover a camada). Ctrl+E e Ctrl+W continuam sendo Propriedades e Redimensionar.
- Testes E2E: criar, pintar, ocultar, aviso ao pintar em camada oculta, modo de mesclagem, desfazer e refazer a camada inteira, recuperar duas camadas depois de recarregar, mesclar abaixo, e a borracha apagando para transparência numa camada nova. Total: 124 unitários e 56 E2E.

### Passo 1 — Modelo de camadas e histórico por camada

- O documento passou a ter várias camadas do mesmo tamanho, de baixo para cima, com nome, visibilidade, opacidade, 16 modos de mesclagem, bloqueios (pixels, transparência e posição), etiqueta, grupo, máscara de recorte, máscara em tons de cinza e efeitos (contorno e sombra). Os grupos têm visibilidade, opacidade e modo próprios.
- Compositor novo: modos de mesclagem, máscaras (a luminância vira transparência), recorte pela camada de baixo, grupos isolados, contorno por fora/por dentro e sombra. A tela é recomposta só na área alterada, com margem para os efeitos.
- Comandos novos, todos no histórico: nova camada (com pixels opcionais), duplicar, excluir, alterar propriedades, mover, mesclar abaixo, mesclar visíveis, achatar, agrupar, desagrupar, alterar grupo, adicionar/aplicar/excluir máscara e lote (vários comandos num item). Desfazer restaura pixels e estrutura.
- Girar, inverter, redimensionar, cortar e colar com papel maior valem para todas as camadas e máscaras. Pintar numa camada oculta ou bloqueada mostra um aviso. A borracha apaga para transparência fora da camada de fundo. O bloqueio de transparência mantém o alfa. O balde pode decidir a área pela imagem toda.
- O autosave grava cada camada e cada máscara em blocos próprios, guarda a estrutura e apaga os blocos de camadas removidas. Correção: num desenho novo, ou depois de mudar o tamanho, a primeira gravação agora salva o papel inteiro. Antes, as áreas brancas nunca tocadas voltavam transparentes ao recuperar.

## 0.2.1 — 2026-11-24

Estabilização depois da revisão da 0.2: testes confiáveis, desempenho medido de verdade, um só lugar para os pixels, autosave por blocos, editor em módulos, interface em qualquer largura e um app mais leve para abrir. Os números de cada passo estão em [docs/desempenho.md](docs/desempenho.md).

### Passo 7 — App mais leve para abrir

- O arquivo JavaScript inicial passou de 516,7 KB para 185,6 KB (gzip: de 167,2 KB para 62,0 KB), sem aviso de tamanho no build. O React foi para um arquivo próprio (223,4 KB, guardado em cache entre versões). O banco local (Dexie, 101,4 KB) passou a carregar logo depois que a janela aparece, para recuperar o desenho e salvar. Somando o que o navegador baixa para abrir: 409,0 KB contra 516,7 KB antes.
- Diálogos, editor e biblioteca de formas, editor de cores, codificadores BMP, GIF e ICO e impressão continuam carregando só quando usados. Se a espera passar de 200 ms, aparece um aviso discreto "Carregando…".
- O servidor de desenvolvimento pré-otimiza o Dexie para não recarregar a página quando o banco é importado sob demanda.
- Testes: um E2E segura o módulo dos diálogos e confere o aviso. O teste de conversão da 0.2 passou a esperar o banco ser criado.
- Correção encontrada na validação final: ao desmontar o editor, a última gravação do autosave ainda avisava "Salvo neste dispositivo". Em desenvolvimento o React monta o editor duas vezes, então a interface mostrava "Salvo" enquanto a instância nova ainda recuperava o desenho, e abrir um arquivo nesse instante não fazia nada. O editor agora se desliga antes da última gravação.

### Validação da 0.2.1

- 124 testes unitários, build de produção sem avisos e três rodadas seguidas da suíte E2E completa no Edge (`npm run test:e2e:estavel`), com 54 de 54 fluxos em cada rodada.

### Passo 6 — Interface em qualquer largura

- Quando falta espaço, os grupos do ribbon se recolhem em botões grandes com ícone, nome e seta, como no paint do Windows 7. Um clique abre o grupo num painel suspenso, e Esc ou um clique fora fecha. A ordem de recolher é Espessura, Formas, Pincéis, Imagem, Área de transferência e Ferramentas. Cores nunca recolhe: se ainda faltar espaço, a paleta passa a mostrar 7 × 2 cores. O ribbon não rola mais na horizontal.
- Em 1440 px todos os grupos ficam abertos: as amostras de cor têm 17 px abaixo de 1600 px, e o grupo Imagem mostra "Propriedades", "Redimensionar" e "Seleção" (o nome completo continua na dica e para leitores de tela). As sete ferramentas ocupam duas linhas, e as ações do grupo Imagem não invadem mais o rótulo.
- O título da janela encurta com reticências e não passa mais por baixo do botão Sobre. O painel "Meu ateliê" fecha sozinho abaixo de 1100 px e respeita quem o reabre.
- Arrastar alças, réguas e botões não seleciona mais o texto da página.
- Spray: opção de gotas finas (1 px, como no paint clássico) ou médias (2 px). A partir de 100% de zoom, os pixels do papel aparecem nítidos.
- Testes: layout em 800, 1024, 1366 e 1920 px (sem rolagem, nenhum botão sobre o rótulo do grupo, título longe do botão Sobre, nas abas Início e Exibir e com balde, borracha e spray), imagens de referência do topo da janela, painel de grupo recolhido, fechamento do painel do ateliê, seleção de texto ao arrastar e 5 testes unitários do recolhimento e das gotas. Total: 124 unitários e 53 E2E.

### Passo 5 — Editor em módulos

- O `EditorController` passou de 999 para 364 linhas e virou o coordenador. O que sobrou nele é o histórico e as chamadas de uma linha que a interface `EditorApi` exige. O trabalho especializado foi para `src/canvas/controle/`:
  - `superficie.ts`: composição da tela, prévias e overlay;
  - `ferramentas.ts`: gestos, teclado, contexto das ferramentas, conta-gotas e formas pendentes;
  - `selecao.ts`: seleção, laço, marquise e silhueta;
  - `colagem.ts`: copiar, colar e imagem flutuante;
  - `papel.ts`: abrir, novo, tamanho, girar e transformar;
  - `persistencia.ts`: recuperação e autosave;
  - `arquivos.ts`: salvar, exportar e imprimir;
  - `opcoes.ts` e `nucleo.ts`: as opções das ferramentas e o contrato comum.
- Nenhum comportamento mudou: 119 testes unitários e 46 fluxos E2E aprovados.

### Passo 4 — Autosave leve

- O autosave grava o papel em blocos de 256 × 256 px. Cada edição marca só os blocos que tocou. Depois de 800 ms sem edições, esses blocos são lidos, convertidos em PNG num Web Worker e gravados numa transação com a descrição do papel. Blocos de uma cor só viram um número. A aba oculta (`visibilitychange`) e o fechamento da página (`pagehide`) gravam na hora.
- Uma pincelada em 4000 × 4000 grava 18 KiB em 2 blocos, contra 62,5 MB antes. Soltar o pincel caiu de 210 para 10,7 ms, e desfazer de 210 para 8,2 ms. O autosave passou a terminar também em 8192 × 4096.
- O IndexedDB ganhou as tabelas `papeis` e `blocos` (esquema 4), com a chave documento + camada + bloco, pronta para várias camadas. O desenho salvo pela 0.2 é convertido em blocos na primeira abertura, e o registro antigo só é apagado depois da gravação nova. Com o armazenamento cheio, aparece a mensagem para salvar em PNG.
- Testes: 9 unitários (grade de blocos, cores lisas, transação, recusa de bloco inválido, agendador, falha e nova tentativa) e um E2E de conversão da 0.2 que confere pixels dos dois lados da divisa entre blocos. O teste da fundação passou a aceitar leituras de bloco (até 256 × 256) e continua recusando a leitura do papel inteiro.

### Passo 3 — Pixels num lugar só

- O documento deixou de manter uma cópia dos pixels em JavaScript. Cada camada guarda os pixels no próprio canvas, e os comandos leem só a área que alteram. `copiarPixels()` copia o papel inteiro e fica restrito a balde, transformações, arquivos e autosave.
- Memória JS em repouso depois dos traços: de 72,2 para 11,2 MiB em 4000 × 4000 e de 139,1 para 11,1 MiB em 8192 × 4096.
- Até o Passo 4, o autosave lê o papel inteiro do canvas a cada gravação. Soltar o pincel em 4000 × 4000 passou de 85 para 210 ms, e o balde de 0,9 para 1,2 s.

### Passo 2 — Medição do custo do editor

- `npm run perf` mede tempo síncrono dos eventos de desenho e comandos de histórico, tarefas longas e memória em três tamanhos de papel. O [relatório](docs/desempenho.md) explica como reproduzir e interpretar as medidas.
- Linha de base medida: movimento do traço abaixo de 1 ms; histórico da pincelada de 4 a 16 ms a partir da segunda; desfazer e refazer de 17 a 48 ms. Pendências registradas: a primeira pincelada depois de criar o papel (127 ms em 4000 × 4000), o autosave do papel inteiro e o balde em papel grande (0,9 s em 4000 × 4000).
- O ensaio encontrou um gargalo ao soltar o pincel: a máscara temporária era criada na GPU, e copiá-la para a camada forçava uma sincronização. Agora máscaras, transformações e texturas usam a memória comum. A confirmação da pincelada caiu de 125 ms para 3,6 ms em 4000 × 4000 e de 233 ms para 5,5 ms em 8192 × 4096.
- Pendências medidas: o autosave ainda grava o papel inteiro (Passo 4), e o balde em papel inteiro leva 0,9 s em 4000 × 4000.

### Passo 1 — Testes reproduzíveis

- Os quatro fluxos com área de transferência usam um projeto Playwright de um worker e uma área de transferência por contexto. Os demais fluxos rodam em paralelo.
- O teste de cores aguarda a abertura do diálogo, a leitura das vagas e a confirmação da gravação no IndexedDB.
- Validação de 24/11/2026 com 110 testes unitários, build de produção e três rodadas completas de 45 testes no Edge sem retentativas.

## 0.2.0 — 2026-11-24

Os oito passos da paridade clássica foram concluídos. A revisão encontrou instabilidade na repetição da suíte de lançamento. A validação repetida foi refeita no Passo 1 da 0.2.1.

### Passo 8 — Arquivos, colagem, cores e impressão

- Abertura de PNG, JPEG, BMP, GIF pelo primeiro quadro, WebP e ICO. Exportação em PNG, JPEG, BMP de 24 bits, GIF e WebP, com avisos de perda de transparência ou cores e ajuste de qualidade onde aplicável.
- Colagem pelo navegador, botão Colar, arquivo e arraste. A imagem externa fica flutuante para posicionamento e pode ampliar o papel quando necessário em uma única edição no histórico.
- Editor com espectro, HSL, RGB, hexadecimal e 16 cores persistentes. Impressão com ajuste à página, centralização e orientação. A ajuda lista os atalhos atualizados.
- O ensaio de lançamento registrava intervalos entre quadros. A 0.2.1 passou a medir o custo dos eventos e comandos.

### Passo 7 — Navegação no papel

- Zoom de 12,5% a 800%, com níveis fixos na barra de status, Ctrl e roda no cursor, pinça, lupa e ajuste à janela.
- Pan com Espaço, botão do meio, dois dedos, barras de rolagem ou miniatura navegável. Réguas em canvas mostram coordenadas conforme a escala e a posição do cursor.
- Grade automática por pixel a partir de 400%, modo tela inteira e estimativa do espaço da recuperação local na barra de status.

### Passo 6 — Seleção, texto e ferramentas de cor

- Laço, seleção invertida, marquise animada, alças para redimensionar, deslocamento pelas setas, duplicação com Ctrl e opção de ignorar a Cor 2.
- Texto multilinha com formatação, fundo opcional e caixa reposicionável. O texto entra no histórico ao confirmar.
- A borracha indica no papel o diâmetro da área apagada. O botão esquerdo pinta com Cor 2 e o direito substitui só a Cor 1, com tolerância e espessura própria.
- O balde tem tolerância ajustável e modo para cores espalhadas na imagem. O conta-gotas amplia a área sob o ponteiro, escolhe Cor 1 ou Cor 2 conforme o botão e retorna à ferramenta anterior.

### Passo 5 — Formas próprias

- Editor com cinco bases paramétricas, desenho por pontos e curvas Bézier com encaixe e desfazer próprio. Permite reaproveitar a forma ativa, a última forma ou uma silhueta da seleção.
- Biblioteca local com pastas, estilos opcionais, favoritas, edição, duplicação, exclusão confirmada e reordenação. Os pacotes `.rabisco-formas.json` aceitam somente comandos geométricos validados.
- Formas próprias usam as mesmas alças, estilos e histórico das formas clássicas. A migração do IndexedDB preserva o último desenho salvo.

### Passo 4 — Formas clássicas editáveis

- Biblioteca de 37 formas com miniaturas renderizadas a partir da mesma definição usada no papel. Inclui curva com dois controles, polígono livre, estrelas com número de pontas ajustável e polígonos regulares.
- A forma fica na prévia até ser confirmada. Pode ser movida, redimensionada por oito alças e girada antes de criar uma única edição no histórico.
- Contornos sólidos, tracejados, pontilhados e texturizados usam a Cor 1. Preenchimentos sólidos ou texturizados usam a Cor 2.
- Os testes de retângulo aguardam a confirmação. O teste de seleção passou a definir a Cor 2 para testar o preenchimento sólido.

### Passo 3 — Pincéis clássicos e spray

- Galeria com nove pincéis e miniaturas desenhadas pelo motor do editor. A reamostragem aplica carimbos em intervalos proporcionais à espessura e interpola as curvas do traço.
- O aerógrafo continua pintando enquanto o botão está pressionado. Tem três tamanhos rápidos, três densidades e atalho `A`. Cada gesto grava a semente e confirma uma única edição.
- A pressão da caneta altera o resultado dos pincéis. O marcador aplica a transparência uma vez por traço, inclusive onde o caminho se cruza.
- A espessura aceita de 1 a 100 px, com quatro opções clássicas. A prévia na rede atualiza a página quando um novo build está pronto.

### Passo 2 — Tamanho e orientação do papel

- As três alças do papel aumentam ou cortam o canvas e mostram o tamanho previsto. `Shift` mantém a proporção, `Esc` cancela e a área nova recebe a Cor 2.
- **Propriedades da imagem** ajusta tamanho, unidade, fundo e DPI. Dimensões e resolução são persistidas no autosave e gravadas no PNG.
- **Redimensionar e inclinar** reamostra em pixels ou porcentagem e inclina nos dois eixos. **Girar** oferece as rotações de 90° e 180° e inversões horizontal e vertical. As operações funcionam para a imagem inteira e para seleções.
- Novo limite de 8192 px por lado e 40 milhões de pixels. Os testes de dimensão de PNG, autosave e comandos foram ajustados ao novo limite.

### Passo 1 — Fundação

- Modelo de documento com camada ativa e composição da tela separada da superfície editável.
- Registro das nove ferramentas existentes, com gestos, prévias e atalhos separados da interface.
- API de comandos serializáveis, histórico por área e autosave a partir do buffer em memória. Uma pincelada curta lê apenas sua região no canvas.
- Testes para o registro das ferramentas, a serialização dos comandos e a área registrada no histórico.

## 0.1.0 — 2026-11-24

MVP 0.1 implementado e validado em 24 de novembro de 2026.

- Estrutura TypeScript, Vite e React, com separação entre interface, canvas, operações, histórico, persistência e arquivos.
- Interface Aero retrô em português com ribbon, paleta de cores e controles acessíveis por teclado.
- Ferramentas raster básicas, formas e seleção retangular.
- Histórico desfazer/refazer com orçamento de memória.
- Importação e exportação PNG com validação de arquivo.
- Recuperação automática do último desenho usando IndexedDB.
- Fonte Selawik e ícones Fugue hospedados junto ao aplicativo, com créditos e licenças.
- Testes de unidade e fluxos de navegador para o escopo do MVP.
- Validação: 28 testes unitários, 9 fluxos E2E no Edge e compilação de produção aprovados.
- E2E verifica pixels de desenho, cores, seleção/cópia/colagem/movimentação/recorte, PNG, autosave, diálogos, zoom, grade, régua e viewport de 390 px.

As versões 0.2 a 1.0 permanecem no [roteiro](ROADMAP.md).
