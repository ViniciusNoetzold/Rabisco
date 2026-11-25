# Prompt — Rabisco 0.2 "Paridade clássica"

> Cole tudo o que está dentro do bloco abaixo na IA de código, aberta na pasta `C:\Users\Ana\Desktop\Rabisco`.
> A etapa foi dividida em **8 passos**. A IA deve parar ao fim de cada um e esperar seu "ok, próximo".

```text
# PAPEL
Você é um engenheiro sênior de editores gráficos web (Canvas 2D, TypeScript, React) trabalhando
no projeto RABISCO, que já está na versão 0.1 nesta pasta. Leia README.md, ROADMAP.md,
CHANGELOG.md e todo o código em src/ e tests/ antes de alterar qualquer coisa.

Regras de trabalho:
- Faça UM passo por vez, na ordem abaixo. Antes de começar o passo, mostre um plano curto
  (arquivos que vai criar ou alterar). No fim do passo: rode `npm test`, `npm run build` e
  `npm run test:e2e`, mostre o resultado, faça um commit em git e PARE. Espere eu responder
  "ok, próximo" para continuar.
- Nunca quebre o que já funciona: os 28 testes unitários e os 9 fluxos E2E da 0.1 devem
  continuar passando (atualize um teste só quando o comportamento mudar de propósito e diga qual).
- Código e comentários em português do Brasil, textos da interface em pt-BR.
- Sem novas dependências sem me perguntar (diga o nome, a licença e o motivo). Só aceitar
  licenças MIT, Apache-2.0, BSD, ISC, OFL e CC BY.
- Visual inspirado no paint da era Windows 7, com arte própria: nada de ícones, sons, fontes ou
  nomes da Microsoft. Ícones novos vêm do conjunto Fugue (já em public/icons, CC BY 3.0) ou são
  SVG próprios. Atualize THIRD_PARTY_NOTICES quando acrescentar algo.
- Gestos de desenho continuam fora do ciclo de renderização do React (como hoje).
- Cada ação que altera pixels ou dimensões gera exatamente UM item no histórico, com nome em
  português, e pode ser desfeita e refeita.

# CONTEXTO: O QUE JÁ EXISTE (0.1)
- Ferramentas: lápis, pincel (um só tipo), borracha, balde (tolerância fixa 12), linha,
  retângulo, elipse, seleção retangular e conta-gotas.
- Cor 1/Cor 2, paleta de 28 cores, editar cor, espessura de 1 a 48, histórico por retângulos de
  pixels (PixelHistory), PNG abrir/salvar, autosave em IndexedDB (Dexie), zoom de 10% a 400%,
  grade e régua.
- Toda a lógica de ferramentas fica em src/canvas/CanvasSurface.tsx (586 linhas).

# PROBLEMAS ENCONTRADOS NA REVISÃO (todos devem ser resolvidos nesta etapa)
1. O papel não pode ser aumentado nem reduzido: a alça `.canvas-grip` é só decoração, e não
   existem "Redimensionar", "Propriedades da imagem", "Girar" nem "Inverter".
2. Não há spray/aerógrafo nem os outros pincéis clássicos (caligrafia, óleo, giz de cera,
   marcador, lápis natural, aquarela).
3. Só existem 3 formas (linha, retângulo, elipse). Faltam as formas clássicas, e não há como
   criar e guardar formas próprias.
4. A borracha pinta sempre `#ffffff`. No paint clássico ela pinta com a Cor 2, e o botão direito
   é a "borracha de cor" (troca a Cor 1 pela Cor 2 só onde passa).
5. A tolerância do balde é fixa em 12 e não aparece na interface.
6. A régua é texto fixo e não acompanha o zoom nem o deslocamento.
7. Colar só funciona com o que foi copiado dentro do app: não aceita imagem copiada de outro
   programa, arrastada para a janela, nem "Colar de arquivo".
8. Abrir e salvar aceitam só PNG.
9. A seleção é só retangular e opaca: falta seleção livre, seleção transparente e alças para
   redimensionar o que foi selecionado.
10. Não existem texto, curva, polígono, lupa (como ferramenta), pan com espaço/botão do meio,
    zoom com Ctrl+roda, tela inteira nem miniatura.
11. O pincel desenha segmentos de linha simples, sem espaçamento de carimbo, o que impede
    pincéis com textura.
12. Desempenho: cada gesto faz `getImageData` do papel inteiro (às vezes duas vezes seguidas,
    como no balde) e PixelHistory.push percorre todos os pixels para achar a área alterada.
    Isso pesa em papéis grandes.

# ============================================================
# PASSO 1 — Fundação (sem mudança visível para quem usa)
# ============================================================
Objetivo: preparar o código para receber muitas ferramentas agora, e camadas e IA depois.
1.1 Rode `git init` com um .gitignore adequado (o atual serve) e faça o commit "Rabisco 0.1"
    ANTES de mudar qualquer coisa.
1.2 Modelo de documento em src/document/:
    - `RabiscoDocument { id, name, width, height, layers: Layer[], activeLayerId }`
    - `Layer { id, name, canvas: OffscreenCanvas|HTMLCanvasElement, visible, opacity, locked }`
    - Nesta etapa existe UMA camada, mas todo o código já deve usar `doc.activeLayer` em vez de
      acessar o canvas direto. O compositor desenha as camadas no canvas da tela.
1.3 Interface de ferramenta em src/tools/:
      interface Tool {
        id: ToolId; nome: string; icone: string; atalho?: string; cursor(ctx): string;
        opcoes?: ToolOptionsSchema;            // o que aparece no ribbon contextual
        onPointerDown(ctx, e): void; onPointerMove(ctx, e): void; onPointerUp(ctx, e): void;
        onKeyDown?(ctx, e): boolean; onCancel?(ctx): void;
        overlay?(ctx, g: CanvasRenderingContext2D): void; // desenha prévia, alças, marquise
        commitPendente?(ctx): void;             // forma/texto/seleção "flutuante" ainda editável
      }
    Um arquivo por ferramenta e um registro central (`toolRegistry`). CanvasSurface passa a
    só receber eventos, converter coordenadas e repassar para a ferramenta ativa.
1.4 API de comandos em src/commands/:
    - Toda alteração passa por `executar(comando)`. Exemplos: `TracarPincel`, `DesenharForma`,
      `Preencher`, `RedimensionarPapel`, `ColarImagem`, `Girar`, `Inverter`.
    - Cada comando é serializável em JSON (tipo + parâmetros). Isso vai servir para macros,
      testes e o agente de IA da versão 0.8.
    - O histórico guarda {comando, camada, retângulo afetado, pixels antes/depois}. A área
      afetada vem do próprio comando (caixa do traço com margem da espessura), e não de uma
      varredura do papel inteiro.
    - Mudanças de tamanho do papel entram no histórico como comando de documento.
1.5 Leitura de pixels: ler só o retângulo afetado; nunca dois `getImageData` do papel inteiro
    no mesmo gesto.
Critérios de aceite: o app funciona igual à 0.1, todos os testes passam e há testes novos para
o registro de ferramentas, a serialização de comandos e o histórico por área do comando.
O CanvasSurface deve ficar abaixo de ~200 linhas.

# ============================================================
# PASSO 2 — Papel que cresce: tamanho, girar, inverter
# ============================================================
2.1 Alças de redimensionamento do papel, como no paint clássico: alça na borda direita, na
    borda inferior e no canto inferior direito. Ao arrastar:
    - mostrar um contorno tracejado com o novo tamanho e o tamanho em px na barra de status;
    - soltar aplica: aumentar preenche a área nova com a Cor 2 (branco por padrão); diminuir
      corta;
    - Shift mantém a proporção; Esc cancela; vira um item "Redimensionar papel" no histórico.
    - As alças funcionam com mouse, toque e caneta, e respeitam o zoom.
2.2 Diálogo "Propriedades da imagem" (Ctrl+E): largura e altura em pixels, centímetros ou
    polegadas, resolução (DPI, padrão 96), cor de fundo para a área nova e botão "Padrão".
    Mostrar tamanho do arquivo em memória.
2.3 Diálogo "Redimensionar e inclinar" (Ctrl+W): redimensionar por porcentagem ou pixels,
    "manter proporção", inclinar horizontal/vertical em graus (-89 a 89). Aplica à seleção,
    se houver; senão, à imagem toda. Usar reamostragem de boa qualidade (imageSmoothingQuality
    "high", em etapas de 50% para reduções grandes).
2.4 Menu "Girar": 90° à direita, 90° à esquerda, 180°, inverter vertical, inverter horizontal.
    Na seleção ou na imagem toda.
2.5 Limites: 1 a 8192 px por lado e no máximo 40 milhões de pixels. Mensagem amigável quando
    passar. Ajustar os limites de abrir/novo de acordo e documentar no README.
2.6 O autosave grava o novo tamanho. O botão "Ajustar à janela" continua funcionando.
Testes: E2E arrastando cada alça (aumentar e diminuir), desfazer/refazer, Shift, Esc; unitários
de girar, inverter, inclinar e conversão cm/pol/px.

# ============================================================
# PASSO 3 — Pincéis clássicos e spray
# ============================================================
3.1 Motor de pincel por carimbo (stamps): o traço é amostrado com espaçamento proporcional à
    espessura e cada carimbo é desenhado com a "ponta" do pincel. Interpolar com curvas
    (Catmull-Rom ou quadráticas) para o traço não ficar facetado em movimentos rápidos.
3.2 Pincéis (galeria "Pincéis" no ribbon, com miniatura do traço de cada um):
    - Pincel (redondo, liso)
    - Caligrafia 1 (ponta chata a 45°) e Caligrafia 2 (ponta chata a 135°)
    - Aerógrafo / SPRAY (ver 3.3)
    - Pincel a óleo (cerdas com variação de opacidade, tinta que "acaba" ao longo do traço)
    - Giz de cera (textura granulada, bordas irregulares)
    - Marcador (semitransparente, sem acumular opacidade dentro do mesmo traço)
    - Lápis natural (fino, granulado, levemente transparente)
    - Aquarela (bordas suaves, mais transparência, leve mistura com o que está embaixo)
    Texturas geradas por código (ruído com semente fixa), para não depender de imagens.
3.3 Spray clássico:
    - Pontos de 1 px espalhados aleatoriamente dentro de um círculo do diâmetro da espessura.
    - CONTINUA borrifando enquanto o botão está pressionado, mesmo com o mouse parado (usar
      requestAnimationFrame com taxa em pontos por segundo); parado, a tinta vai acumulando.
    - Três tamanhos rápidos no ribbon (pequeno, médio, grande), mais "Densidade" (baixa/
      média/alta).
    - Cor 1 com botão esquerdo, Cor 2 com o direito. Atalho A.
3.4 Pressão de caneta (pointer events) afeta espessura e/ou opacidade quando houver; no mouse,
    pressão fixa.
3.5 Espessura: no ribbon, lista visual de 4 espessuras clássicas (como no paint) + campo
    numérico de 1 a 100. Atalhos [ e ] continuam valendo.
Testes: unitários do espaçamento de carimbos e do gerador de spray com semente fixa (mesma
semente = mesmos pixels); E2E que segura o mouse parado com o spray e confirma que a quantidade
de pixels pintados aumenta com o tempo.

# ============================================================
# PASSO 4 — Formas clássicas, edição antes de confirmar e estilos
# ============================================================
4.1 Biblioteca de formas com uma definição única para todas:
      interface ShapeDef {
        id; nome; categoria: 'basicas'|'setas'|'estrelas'|'baloes'|'simbolos'|'minhas';
        // caminho normalizado na caixa 0..1, como string de path SVG ou função geradora
        path: string | ((w: number, h: number, params) => Path2D);
        params?: ParamSchema;   // ex.: número de pontas, raio interno, arredondamento
        fechada: boolean;
      }
    Renderizar com Path2D escalado para a caixa arrastada.
4.2 Formas que precisam existir:
    - Básicas: linha, curva (ver 4.4), oval, retângulo, retângulo arredondado, polígono livre
      (ver 4.4), triângulo, triângulo retângulo, losango, pentágono, hexágono, octógono,
      trapézio, paralelogramo, cruz, anel, meia-lua, gota, nuvem.
    - Setas: direita, esquerda, cima, baixo, dupla horizontal, dupla vertical, seta curva.
    - Estrelas: 4, 5 e 6 pontas, e "estrela de N pontas" (parâmetros: pontas 3–24, raio
      interno 10–90%).
    - Balões: retangular arredondado, oval, nuvem de pensamento (com a "cauda").
    - Símbolos: coração, raio, polígono regular de N lados (3–24), espiral.
4.3 A forma fica EDITÁVEL depois de desenhada, até clicar fora, trocar de ferramenta ou
    pressionar Enter (comportamento do paint clássico):
    - 8 alças para redimensionar, arrastar por dentro para mover, alça de rotação;
    - trocar cor, espessura, contorno e preenchimento enquanto ela está ativa atualiza a prévia;
    - Esc descarta; o commit gera um único item no histórico.
4.4 Curva: arrastar a linha base, depois clicar/arrastar até 2 vezes para curvar (2 pontos de
    controle), como no paint clássico. Polígono: clicar vértices, clique duplo ou clicar no
    primeiro ponto fecha; Shift prende em 45°.
4.5 Estilos no ribbon contextual da forma:
    - Contorno: nenhum, sólido, tracejado, pontilhado, giz de cera, marcador, aquarela
      (reaproveitando os pincéis do passo 3).
    - Preenchimento: nenhum, sólido (usa a Cor 2), e os mesmos estilos de textura.
    - Contorno usa Cor 1 e preenchimento usa Cor 2, como no paint clássico.
4.6 Galeria de formas no ribbon com rolagem e botão "mais", mostrando o ícone de cada forma
    gerado a partir da própria definição (nada de imagem fixa).
Testes: unitário gerando cada forma num canvas pequeno e comparando com imagens de referência
(snapshot); E2E de desenhar, redimensionar, girar e confirmar uma estrela.

# ============================================================
# PASSO 5 — Criar formas próprias e salvar como predefinição
# ============================================================
5.1 Botão "Criar forma…" na galeria abre o diálogo "Editor de formas", com três modos:
    a) Paramétrica: escolher a base (polígono regular, estrela, retângulo arredondado, seta,
       balão) e ajustar lados/pontas, raio interno, arredondamento dos cantos, rotação, largura
       da haste da seta, etc., com prévia ao vivo.
    b) Desenhar: grade com encaixe (snap) onde se clicam pontos para formar o contorno;
       arrastar um ponto cria curva Bézier; ferramentas de adicionar/remover/mover ponto;
       espelhar horizontal/vertical para fazer formas simétricas; desfazer próprio.
    c) A partir da seleção ou da última forma: converte a forma ativa (com os parâmetros atuais)
       em predefinição.
5.2 Salvar: nome, categoria "Minhas formas" (ou subpasta escolhida), estilo padrão opcional
    (contorno, preenchimento, espessura, cores). Guardar em nova tabela Dexie `formas` com
    versão de esquema e migração.
5.3 Gerenciar: renomear, duplicar, editar, excluir (com confirmação), reordenar arrastando,
    marcar favorita (favoritas aparecem primeiro na galeria).
5.4 Exportar e importar o pacote de formas como arquivo `.rabisco-formas.json` (com validação
    rigorosa do JSON e do path: tamanho máximo, só comandos M L C Q Z H V A, sem scripts).
5.5 As formas próprias usam exatamente o mesmo ShapeDef das formas nativas, então funcionam
    com alças, estilos, histórico e, no futuro, com a API de comandos do agente de IA.
Testes: unitários de validação do arquivo (aceitar válido, recusar path malicioso ou gigante),
persistência e migração; E2E criando uma estrela de 7 pontas personalizada, salvando,
recarregando a página e usando-a no desenho.

# ============================================================
# PASSO 6 — Seleção completa, texto, borracha e balde
# ============================================================
6.1 Seleção livre (laço) além da retangular; "Selecionar tudo", "Inverter seleção",
    "Excluir", e a opção "Seleção transparente" (ignora pixels da Cor 2 ao mover/colar).
6.2 A seleção vira um objeto flutuante enquanto é movida: alças para redimensionar, Shift
    mantém proporção, Ctrl+arrastar duplica, setas movem 1 px (Shift+setas 10 px).
6.3 Marquise animada ("formigas andando"), desenhada no overlay e com o zoom correto.
6.4 Ferramenta Texto (atalho T): caixa de texto arrastável sobre o papel, editável enquanto
    ativa; ribbon contextual "Texto" com fonte (fontes do sistema + Selawik), tamanho, negrito,
    itálico, sublinhado, tachado, fundo transparente/opaco (Cor 2) e cor (Cor 1). Commit ao
    clicar fora. Suporte a acentos, colar texto e várias linhas.
6.5 Borracha: pinta com a Cor 2 (comportamento clássico). Botão direito = borracha de cor:
    troca só os pixels da Cor 1 (com tolerância) pela Cor 2. Espessuras próprias da borracha.
6.6 Balde: tolerância de 0 a 100% no ribbon contextual; opção "preencher cor em toda a imagem"
    (não contíguo).
6.7 Conta-gotas: botão esquerdo define Cor 1, direito define Cor 2; prévia ampliada do pixel
    sob o cursor. Depois de usar, volta para a ferramenta anterior (como no paint clássico).
Testes: E2E do laço, seleção transparente, texto com acento, borracha de cor e tolerância.

# ============================================================
# PASSO 7 — Exibir: zoom, pan, réguas reais, lupa e tela inteira
# ============================================================
7.1 Zoom de 12,5% a 800% (níveis fixos: 12,5, 25, 50, 100, 200, 300, 400, 600, 800), com
    Ctrl+roda centrado no cursor, pinça no touchpad/toque e o controle deslizante da barra
    de status.
7.2 Ferramenta Lupa (atalho Z): clique amplia, botão direito reduz, mostrando o retângulo da
    área que será ampliada.
7.3 Pan: barra de espaço segurada, botão do meio do mouse, dois dedos no toque e barras de
    rolagem.
7.4 Grade de pixels automática a partir de 400% (opção "Linhas de grade" continua existindo).
7.5 Réguas reais (horizontal e vertical) desenhadas em canvas, com marcações que mudam
    conforme o zoom, seguem o deslocamento e mostram a posição do cursor.
7.6 Tela inteira (F11 dentro do app) mostrando só o desenho; Esc volta.
7.7 Miniatura: janelinha flutuante com a imagem inteira e o retângulo da área visível,
    arrastável para navegar.
7.8 Barra de status: posição do cursor, tamanho da seleção, tamanho do papel, tamanho em disco
    estimado e zoom.

# ============================================================
# PASSO 8 — Área de transferência, arquivos e atalhos completos
# ============================================================
8.1 Colar imagem vinda de outros programas (Ctrl+V e botão Colar) usando a Clipboard API e o
    evento `paste`; copiar a seleção também para a área de transferência do sistema como PNG.
    Se a imagem colada for maior que o papel, perguntar "Aumentar o papel para caber?"
    (Sim/Não), como no paint clássico.
8.2 "Colar de…" (abrir um arquivo de imagem e colar como seleção flutuante) e arrastar e soltar
    imagens na janela.
8.3 Abrir: PNG, JPEG, BMP, GIF (primeiro quadro), WebP e ICO. Salvar como: PNG, JPEG (com
    qualidade), BMP 24 bits, GIF e WebP. Avisar quando o formato perder transparência ou cores.
    BMP e GIF com codificadores próprios ou dependência MIT, aprovada por mim.
8.4 Diálogo "Editar cores" completo: espectro, matiz/saturação/luminosidade, RGB, hexadecimal,
    16 "cores personalizadas" salvas no IndexedDB.
8.5 Atalhos clássicos completos e uma tela de ajuda que lista todos:
    Ctrl+N/O/S/Shift+S/P(imprimir)/Z/Y/A/C/X/V/E/W, Ctrl+Page Up/Page Down (zoom), Ctrl+R
    (réguas), Ctrl+G (grade), F11, Delete, Esc, Enter, setas, +/- (espessura), X (trocar
    cores), e uma letra por ferramenta (P lápis, B pincel, A spray, E borracha, F balde,
    I conta-gotas, Z lupa, T texto, S seleção, L laço, U formas).
8.6 Imprimir (Ctrl+P) com configuração simples: ajustar à página, centralizar, orientação.

# DEFINIÇÃO DE PRONTO DA 0.2
- Todos os 12 problemas da revisão foram resolvidos e cada um aparece no CHANGELOG.
- ROADMAP.md marca a 0.2 como "Concluída e validada", com a data.
- README.md atualizado (ferramentas, atalhos, limites, como criar formas).
- Testes unitários e E2E novos para cada passo, todos passando, mais build sem erros.
- Teste manual guiado ao final: uma lista de 15 verificações que eu possa fazer em 10 minutos.
- Desempenho: em um papel de 4000 × 4000, um traço de pincel não pode travar a interface
  (meça o tempo médio por quadro e informe o número).

Comece pelo PASSO 1.
```

## Dica de uso

- Depois de cada passo, teste com `npm run dev` antes de mandar "ok, próximo".
- Se algo não ficar como você imaginou, descreva o que viu antes de liberar o passo seguinte. É mais barato corrigir no passo em que o problema apareceu.
