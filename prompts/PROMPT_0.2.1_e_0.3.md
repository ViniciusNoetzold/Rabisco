# Prompts — Rabisco 0.2.1 "Estabilização" e 0.3 "Camadas"

> São **dois prompts**, para usar em sequência na IA de código aberta em `C:\Users\Ana\Desktop\Rabisco`.
> Só cole o da 0.3 depois que a 0.2.1 estiver concluída e testada por você.
> Os dois funcionam passo a passo: a IA para no fim de cada passo e espera o seu "ok, próximo".

---

## PROMPT 1 — Rabisco 0.2.1 "Estabilização"

```text
# PAPEL
Você é um engenheiro sênior de editores gráficos web (Canvas 2D, TypeScript, React, IndexedDB)
trabalhando no RABISCO, que está na versão 0.2 nesta pasta (repositório git já existe).
Leia README.md, ROADMAP.md, CHANGELOG.md, prompts/PROMPT_0.2.md e o código em src/ e tests/
antes de mudar qualquer coisa.

Regras de trabalho (as mesmas da 0.2):
- Um passo por vez, na ordem. Antes de cada passo, plano curto com os arquivos afetados.
  No fim: `npm test`, `npm run build` e `npm run test:e2e` (a suíte E2E COMPLETA, não só os
  testes novos), mostrar o resultado real, commit em git e PARAR até eu dizer "ok, próximo".
- Nunca declarar no CHANGELOG um número de testes ou de desempenho que você não mediu nesta
  rodada. Se algo falhar, diga que falhou e mostre a saída.
- Sem dependências novas sem me perguntar (nome, licença, motivo). Só MIT, Apache-2.0, BSD,
  ISC, OFL, CC BY.
- Nada muda para quem usa, exceto o que cada passo pede. Português do Brasil em tudo.

# CONTEXTO: PROBLEMAS ENCONTRADOS NA REVISÃO DA 0.2
1. Testes E2E instáveis: rodando a suíte inteira, 4 testes falham (colagem.spec.ts:72, :97,
   :133 e cores.spec.ts:3). Rodados sozinhos, passam. Causa provável: os testes em paralelo
   (fullyParallel) disputam a área de transferência do sistema, que é uma só. O CHANGELOG
   afirma "45 fluxos passaram", o que não se repetiu.
2. Medição de desempenho inválida: "16,67 ms por quadro" é a taxa de atualização do monitor
   (60 Hz), não o custo do pincel.
3. Autosave grava o papel INTEIRO a cada edição (DocumentSnapshot.pixels). Em 8192 × 8192 são
   ~256 MB por pincelada. Com camadas isso se multiplica.
4. RabiscoDocument guarda os pixels duas vezes: um PixelBuffer espelho em memória e o canvas da
   camada. O espelho só existe para uma camada e dobra o uso de memória.
5. src/canvas/editorController.ts tem 931 linhas: virou o novo "arquivo que faz tudo".
6. Ribbon em janela estreita (~800 px): aparece barra de rolagem horizontal, "Opções de
   seleção" fica por cima do rótulo do grupo "Imagem" e o ícone ⓘ cobre o título da janela.
7. Arrastar as alças do papel seleciona o texto da página (ex.: "Um pequeno espaço para
   grandes ideias." fica destacado em azul).
8. O bundle principal tem 503 KB num único arquivo (aviso do Vite).
9. Os pontos de 1 px do spray quase somem com zoom abaixo de 100% (os pixels estão corretos;
   é só a visualização reduzida).

# ============================================================
# PASSO 1 — Testes confiáveis
# ============================================================
1.1 Isolar os testes que usam a área de transferência: colocá-los num arquivo/grupo com
    `test.describe.configure({ mode: 'serial' })` ou num projeto Playwright próprio com
    `workers: 1`. Os demais continuam em paralelo.
1.2 Revisar o teste de cores (cores.spec.ts:3) e corrigir a causa da instabilidade (esperas
    por estado real, não por tempo; IndexedDB isolado por contexto).
1.3 Criar o script `npm run test:e2e:estavel`, que roda a suíte completa 3 vezes seguidas e
    falha se qualquer rodada falhar.
1.4 Corrigir o CHANGELOG da 0.2 com os números reais.
Aceite: 3 rodadas seguidas da suíte completa sem nenhuma falha, mostrando a saída.

# ============================================================
# PASSO 2 — Medir desempenho de verdade
# ============================================================
2.1 Instrumentar com `performance.mark/measure` o caminho do traço: do evento de ponteiro até
    o fim do desenho na camada (sem esperar o próximo quadro), e o commit no histórico.
2.2 Registrar tarefas longas com PerformanceObserver ('longtask').
2.3 Script `npm run perf` (Playwright no Edge) que, em papéis de 1024 × 640, 4000 × 4000 e
    8192 × 4096: faz 300 movimentos de pincel, 300 de spray, um balde no papel todo, um desfazer
    e um refazer. Imprime p50, p95 e máximo em ms de cada operação, número de long tasks e
    memória JS (performance.memory quando existir).
2.4 Salvar o resultado em docs/desempenho.md com a data e a máquina, e documentar como ler.
Metas (se não atingir, mostre os números e proponha o ajuste; não mascare):
- traço: p95 < 4 ms por evento em 4000 × 4000;
- desfazer/refazer: < 50 ms em 4000 × 4000;
- nenhuma long task > 100 ms durante o desenho.

# ============================================================
# PASSO 3 — Um só lugar para os pixels
# ============================================================
3.1 Remover o PixelBuffer espelho de RabiscoDocument. A fonte da verdade de cada camada passa a
    ser o canvas da camada (OffscreenCanvas quando disponível). Leituras usam getImageData só
    da área necessária.
3.2 `obterDados()` deixa de existir ou passa a ser explicitamente caro (`copiarPixels(area?)`),
    e todos os usos são revisados para ler só a área necessária.
3.3 O desenho continua pixel a pixel igual: os testes de pixels existentes devem passar sem
    alteração de valores esperados.
Aceite: memória medida pelo `npm run perf` cai em comparação ao Passo 2 (mostrar antes/depois).

# ============================================================
# PASSO 4 — Autosave leve
# ============================================================
4.1 Salvamento por blocos (tiles) de 256 × 256 px: cada comando marca os blocos que alterou;
    o autosave grava só os blocos sujos.
4.2 Esperar 800 ms sem edições antes de gravar (debounce), e gravar imediatamente em
    `visibilitychange` (aba oculta) e `pagehide`.
4.3 Codificar os blocos em PNG num Web Worker (OffscreenCanvas.convertToBlob) para não travar a
    interface; guardar Blob no IndexedDB.
4.4 Nova versão do esquema Dexie com migração: o registro da 0.2 (pixels inteiros) é convertido
    em blocos na primeira abertura, sem perder o último desenho. Testar a migração.
4.5 O indicador "Salvando… / Salvo neste dispositivo" continua correto. Se o navegador negar
    espaço (QuotaExceededError), avisar com mensagem amigável e sugerir salvar o arquivo.
4.6 A estrutura de blocos já deve aceitar várias camadas (chave: documento + camada + bloco),
    porque a 0.3 vai usá-la.
Aceite: no `npm run perf`, uma pincelada em 8192 × 4096 grava apenas alguns blocos (mostrar
quantos bytes foram gravados); recarregar a página recupera o desenho idêntico.

# ============================================================
# PASSO 5 — Quebrar o editorController
# ============================================================
5.1 Extrair de src/canvas/editorController.ts módulos com responsabilidade única, por exemplo:
    - controle/selecao.ts (seleção, máscara, marquise)
    - controle/colagem.ts (colagem flutuante e área de transferência)
    - controle/persistencia.ts (autosave do Passo 4)
    - controle/previas.ts (prévias de traço, pincel e overlay)
    - controle/arquivos.ts (abrir, salvar como, imprimir)
5.2 O EditorController vira um coordenador com menos de ~300 linhas.
5.3 Sem mudança de comportamento: suíte inteira verde.

# ============================================================
# PASSO 6 — Interface em qualquer largura
# ============================================================
6.1 Ribbon adaptável como no paint do Windows 7: quando falta espaço, os grupos se recolhem,
    por ordem de prioridade, num único botão grande com o ícone do grupo e uma seta, que abre o
    conteúdo do grupo num painel suspenso. Nunca barra de rolagem horizontal.
    Prioridade de recolher (primeiro a recolher → último): Espessura, Formas, Pincéis, Imagem,
    Área de transferência, Ferramentas. Cores ficam sempre visíveis (paleta pode reduzir para
    uma linha de cores + botão "mais cores").
6.2 Barra de título: o título se encurta com reticências e nunca fica sob o ícone ⓘ.
6.3 Painel "Meu ateliê" vira recolhível automaticamente abaixo de 1100 px de largura.
6.4 Testes visuais (toHaveScreenshot) em 800 × 600, 1024 × 768, 1366 × 768 e 1920 × 1080, e
    um teste que falha se `document.documentElement.scrollWidth > innerWidth`.
6.5 `user-select: none` na área de trabalho, alças, réguas, ribbon e barra de status (mas não
    em campos de texto nem na ferramenta Texto). Corrige o texto destacado ao arrastar a alça.
6.6 Spray abaixo de 100% de zoom: o canvas de exibição usa `image-rendering: pixelated` só
    para o desenho quando zoom ≥ 100% e uma renderização reduzida de melhor qualidade abaixo
    disso; além disso, adicionar ao spray a opção "Gotas: finas (1 px) / médias (2 px)".

# ============================================================
# PASSO 7 — App mais leve para abrir
# ============================================================
7.1 Carregar sob demanda (import dinâmico + React.lazy): diálogos, editor de formas, biblioteca
    de formas, editor de cores, codificadores BMP/GIF/ICO, impressão.
7.2 Meta: arquivo JS inicial < 300 KB (sem gzip) e sem aviso do Vite. Mostrar a tabela do build.
7.3 Mostrar um indicador discreto de "carregando…" quando um módulo sob demanda demora.

# DEFINIÇÃO DE PRONTO DA 0.2.1
- Os 9 problemas acima resolvidos e listados no CHANGELOG como 0.2.1, com números medidos.
- docs/desempenho.md com a tabela antes/depois.
- ROADMAP.md com a linha 0.2.1 "Concluída e validada" e a data.
- `npm run test:e2e:estavel` verde.

Comece pelo PASSO 1.
```

---

## PROMPT 2 — Rabisco 0.3 "Camadas e colagem"

```text
# PAPEL
Você é um engenheiro sênior de editores gráficos web trabalhando no RABISCO, agora na versão
0.2.1 nesta pasta. Leia README.md, ROADMAP.md, CHANGELOG.md, docs/desempenho.md, os prompts em
prompts/ e o código antes de começar. Mesmas regras de trabalho da 0.2.1: um passo por vez,
suíte completa + `npm run perf` no fim de cada passo, commit, PARAR até "ok, próximo", números
reais no CHANGELOG, dependências só com minha aprovação.

# OBJETIVO DA 0.3
Camadas editáveis de verdade e colagem confortável: importar várias imagens, recortar, sobrepor,
desenhar por cima, transformar livremente e salvar tudo sem perder as camadas, inclusive para
abrir no Photoshop/Photopea (PSD) e no Krita/GIMP (ORA).

# PRINCÍPIOS
- Nenhuma ação apaga trabalho sem poder desfazer. Toda operação de camada é um comando
  serializável no histórico (prepara o agente de IA da 0.8).
- Transparência real: camadas novas começam transparentes (xadrez cinza/branco no fundo da
  tela). A primeira camada "Papel" continua opaca por padrão, como no paint clássico.
- Desempenho: compor só a área suja; cache da composição das camadas abaixo e acima da camada
  ativa durante o desenho; miniaturas atualizadas no máximo 4×/s.
- Memória: mostrar na barra de status a memória estimada do documento
  (largura × altura × 4 × nº de camadas). Avisar acima de 1 GB e impedir acima de 2 GB com
  mensagem amigável. (20 camadas de 4000 × 4000 = ~1,28 GB: aceitável, com aviso.)

# ============================================================
# PASSO 1 — Modelo de camadas e histórico por camada
# ============================================================
1.1 Layer (raster) com: id, nome, canvas próprio, visível, opacidade 0–100, modo de mesclagem,
    bloqueios (pixels, transparência, posição), deslocamento x/y, cor de etiqueta, e
    pertence a um grupo opcional.
1.2 Grupos (pastas) com visibilidade, opacidade e modo próprios; podem ser recolhidos.
1.3 Comandos novos: NovaCamada, DuplicarCamada, ExcluirCamada, RenomearCamada, MoverCamada
    (reordenar), MesclarAbaixo, MesclarVisiveis, AchatarImagem, AlterarPropriedadesCamada,
    AgruparCamadas, DesagruparCamadas, DefinirCamadaAtiva (não entra no histórico).
1.4 Todos os comandos de desenho existentes passam a carregar o id da camada. Desfazer/refazer
    restaura pixels e também a estrutura (ordem, propriedades).
1.5 Compositor com os modos: normal, multiplicar, tela, sobrepor, escurecer, clarear,
    subexposição de cor, superexposição de cor, luz forte, luz suave, diferença, exclusão,
    matiz, saturação, cor, luminosidade (usar globalCompositeOperation do Canvas).
1.6 Autosave por blocos (da 0.2.1) passa a gravar cada camada + manifesto da estrutura.
Testes: unitários de cada comando (executar/desfazer/refazer), compositor com modos e
opacidade (pixels esperados), migração do autosave da 0.2.1 para camadas.

# ============================================================
# PASSO 2 — Painel de Camadas
# ============================================================
2.1 Painel "Camadas" no lado direito (aba no "Meu ateliê", junto de Histórico), no estilo
    Aero: lista com miniatura, olho (visível), cadeado, nome editável com duplo clique,
    opacidade, modo de mesclagem e etiqueta de cor.
2.2 Arrastar para reordenar, inclusive para dentro/fora de grupos. Alt+clique no olho mostra
    só aquela camada. Ctrl+clique na miniatura seleciona o conteúdo da camada.
2.3 Barra do painel: Nova camada, Nova a partir de colagem, Duplicar, Grupo, Máscara, Mesclar
    abaixo, Excluir (pede confirmação se a camada tiver conteúdo).
2.4 Aba "Camadas" no ribbon com as mesmas ações em botões grandes.
2.5 Atalhos sem conflitar com os clássicos (Ctrl+E e Ctrl+W continuam sendo Propriedades e
    Redimensionar): Ctrl+Shift+N nova camada, Ctrl+J duplicar, Ctrl+G agrupar (mover o atual
    "Ctrl+G grade" para Ctrl+' e documentar), Ctrl+Shift+M mesclar abaixo, Ctrl+[ e Ctrl+]
    mover camada, Alt+[ e Alt+] trocar camada ativa. Atualizar a tela de ajuda.
2.6 Acessibilidade: o painel é uma lista navegável por teclado, com rótulos para leitor de tela.

# ============================================================
# PASSO 3 — Ferramentas cientes de camadas
# ============================================================
3.1 Borracha: em camada transparente apaga para transparência; na camada "Papel" opaca, mantém
    o comportamento clássico (pinta com a Cor 2). Botão direito continua sendo a borracha de cor.
3.2 Bloquear transparência: pintar só onde já existe pixel (ótimo para colorir lineart).
3.3 Conta-gotas e balde com opção "Amostrar: camada atual / imagem toda".
3.4 Seleção: "Selecionar conteúdo da camada", e as operações recortar/copiar/colar/apagar agem
    na camada ativa. "Copiar mesclado" (Ctrl+Shift+C) copia o que se vê.
3.5 Formas e texto confirmados vão para a camada ativa, com a opção no ribbon
    "Criar em nova camada" (padrão: ligado para texto, desligado para formas).
3.6 Desenhar numa camada oculta ou bloqueada mostra aviso amigável em vez de não fazer nada.

# ============================================================
# PASSO 4 — Máscaras e recorte (clipping)
# ============================================================
4.1 Máscara de camada (escala de cinza): pintar com preto esconde, branco revela; miniatura da
    máscara ao lado da miniatura da camada; clicar alterna entre editar pixels e máscara;
    Shift+clique desativa a máscara temporariamente; aplicar ou descartar máscara.
4.2 "Máscara a partir da seleção" e "Seleção a partir da máscara".
4.3 Máscara de recorte (clipping): a camada só aparece dentro dos pixels da camada abaixo
    (Alt+clique entre camadas no painel).
4.4 Efeitos simples e não destrutivos por camada, editáveis a qualquer momento:
    contorno (cor, espessura, dentro/fora) e sombra (cor, distância, ângulo, desfoque).
    Pensados para o modo "adesivo" das colagens.

# ============================================================
# PASSO 5 — Colagem: importar, colar e transformar
# ============================================================
5.1 Importar como camada: Arquivo › "Importar como camada…" (vários arquivos de uma vez),
    arrastar e soltar (cada imagem vira uma camada com o nome do arquivo), e Ctrl+V de imagem
    externa cria nova camada (Ctrl+Shift+V cola na camada atual, comportamento antigo).
5.2 Imagem maior que o papel: perguntar "Reduzir para caber / Manter tamanho / Aumentar papel".
5.3 Transformação livre (Ctrl+T) da camada ou da seleção: mover, escalar (Shift mantém
    proporção, Alt a partir do centro), girar (Shift em passos de 15°), inclinar, distorcer
    pelos cantos (Ctrl) e perspectiva. Prévia em tempo real; reamostragem de qualidade só ao
    confirmar; Enter confirma, Esc cancela; um único item no histórico.
5.4 Guias inteligentes de encaixe: bordas e centro do papel e das outras camadas, com linhas
    magenta durante o arraste (desligável em Exibir).
5.5 Ferramenta "Mover" (atalho V): move a camada ativa; com Ctrl, escolhe a camada clicada.
5.6 Opções rápidas de colagem no ribbon contextual: "Recortar livre para nova camada",
    "Recorte vira adesivo" (aplica contorno branco + sombra do Passo 4), alinhar e distribuir
    camadas selecionadas.
(A remoção de fundo com IA fica para a 0.7; deixe o botão visível e desativado, com dica
"Disponível na versão 0.7".)

# ============================================================
# PASSO 6 — Formato .rabisco, PSD e ORA
# ============================================================
6.1 Formato próprio .rabisco = ZIP (pedir aprovação para JSZip ou fflate, ambos MIT) contendo:
    manifest.json (versão do formato, dimensões, DPI, árvore de camadas e grupos com todas as
    propriedades, efeitos e máscaras), um PNG por camada e por máscara, thumbnail.png e
    preview.png achatado. Versionar o formato e validar tudo ao abrir (tamanhos, caminhos sem
    "..", JSON com esquema, limites de memória).
6.2 Arquivo › Salvar (Ctrl+S) passa a salvar .rabisco (com File System Access API quando
    houver; senão download). "Salvar como" mantém PNG/JPEG/BMP/GIF/WebP achatados e ganha
    .rabisco, PSD e ORA. Ao salvar em formato achatado, avisar que as camadas serão unidas.
6.3 PSD: abrir e salvar com ag-psd (MIT, pedir aprovação), preservando camadas raster, nomes,
    visibilidade, opacidade, modos de mesclagem, grupos e máscaras. Avisar sobre o que não for
    suportado (camadas de ajuste, efeitos do Photoshop, texto vetorial) e rasterizar.
6.4 ORA (OpenRaster): abrir e salvar (stack.xml + PNGs), compatível com Krita, GIMP e MyPaint.
6.5 "Exportar camadas como PNGs" (um ZIP com um PNG por camada).
6.6 Arquivos recentes: lista dos últimos 10 documentos no menu Arquivo (guardados no IndexedDB
    com miniatura), com opção de limpar.
Testes: ida e volta (salvar → abrir → comparar pixels e propriedades) para .rabisco, PSD e ORA;
arquivos malformados recusados com mensagem clara; arquivo PSD de exemplo criado pelo próprio
teste (não baixar arquivos da internet).

# ============================================================
# PASSO 7 — Desempenho, documentação e validação final
# ============================================================
7.1 `npm run perf` ganha o cenário de 20 camadas de 4000 × 4000 com modos de mesclagem
    variados: pincelada na camada 10, alternar visibilidade, mover camada, desfazer.
    Metas: traço p95 < 8 ms por evento; alternar visibilidade < 100 ms; sem long task > 200 ms.
    Se não atingir, mostrar os números e propor solução (ex.: blocos/tiles por camada).
7.2 README: seção "Camadas e colagem" com passo a passo e atalhos; limites de memória.
7.3 Roteiro manual de 10 minutos com 15 verificações, incluindo: importar 3 fotos, recortar
    uma, transformar a outra em adesivo, desenhar por cima numa camada nova com modo
    multiplicar, máscara, salvar .rabisco, recarregar, abrir de novo, exportar PSD e PNG.
7.4 CHANGELOG 0.3 com números medidos; ROADMAP marca 0.3 "Concluída e validada" com data.

Comece pelo PASSO 1.
```

---

## Dicas de uso
- Depois de cada passo, rode o app (`npm run dev`) e teste com as próprias mãos antes de liberar o próximo.
- Quando a IA pedir aprovação de dependência, as sugeridas são todas MIT: **JSZip** ou **fflate** (ZIP) e **ag-psd** (PSD).
- Se a IA disser que passou tudo, peça a saída do `npm run test:e2e:estavel` e do `npm run perf`. Os números do CHANGELOG precisam bater com essas saídas.
