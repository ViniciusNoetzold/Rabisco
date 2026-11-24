# Histórico de alterações

## 0.2 em desenvolvimento

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
