# Histórico de alterações

## 0.2.1 em desenvolvimento

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
