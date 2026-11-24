# Histórico de alterações

## 0.3 em desenvolvimento

### Passo 3 (parcial) — Ferramentas cientes de camadas

- O texto confirmado entra numa camada própria ("Texto: …"), num único item do histórico. Dá para desligar em Texto › Fundo › "Em nova camada".
- Balde e conta-gotas ganharam "Amostrar todas as camadas": a área ou a cor vêm do que se vê, mas o balde pinta só na camada ativa.
- Já no Passo 1: borracha transparente fora do papel, travar transparência e aviso ao pintar em camada oculta ou bloqueada. Falta "Copiar mesclado" (Ctrl+Shift+C) e a opção de formas em nova camada.

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
