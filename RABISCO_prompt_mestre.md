# 🖌️ RABISCO — "O paint de sempre, com uma IA no pincel"

> Documento-mestre do projeto: nome, visão, pesquisa de ferramentas open source e **prompt estruturado** pronto para colar numa IA de código (Claude Code, Cursor etc.) e começar a construir.

---

## 0. Nome do projeto

### Nome principal: **Rabisco**
- Palavra brasileira, curta, simpática, fácil de lembrar e que já diz o que o app faz: *rabiscar sem medo*.
- Combina com a proposta "fácil de desenhar", não intimida iniciantes.
- Funciona como marca: **Rabisco**, **Rabisco AI**, **Rabisco 7** (versão com visual estilo Windows 7).
- Mascote sugerido: **"Rabi"**, um lápis/borracha que é o tutor de IA (lembra os assistentes antigos, mas com personagem próprio).
- Tagline: *"O paint de sempre, com uma IA no pincel."*

### Alternativas (caso o nome esteja ocupado)
| Nome | Ideia |
|---|---|
| **Pincel Aero** | Faz referência ao visual "Aero" (vidro/brilho) da era Win7 |
| **Garatuja** | Sinônimo de rabisco, bem brasileiro e único |
| **Tinta7** | Curto, direto, remete ao "7" |
| **Pixel & Prosa** | Desenho + IA que conversa |
| **Rabiscódromo** | Divertido, bom para comunidade/galeria |

> ⚠️ Antes de fechar: pesquisar no INPI, domínio (.com / .com.br / .app), GitHub e lojas de apps. **Não usar "Paint", "MS Paint", "Windows" nem logos/ícones da Microsoft no nome ou na marca** — o visual deve ser *inspirado* na época, com arte própria.

---

## 1. Visão em uma frase
Um editor de imagens no navegador (e desktop) com **a simplicidade e a "cara" do Paint do Windows 7** — faixa de ferramentas (ribbon), cores grandes, ferramentas clássicas — somado a **camadas editáveis, colagem, estilos alternativos (ASCII, pixel art, dithering)** e uma **IA interna** que gera/transforma imagens *usando as próprias ferramentas do app* e que também **ensina a desenhar**.

## 2. Pilares
1. **Nostalgia funcional** — parece o paint clássico, mas mais gostoso de usar (suavização de traço, pressão de caneta, zoom fluido).
2. **Fácil de desenhar** — estabilizador de traço, régua/simetria, formas que "se ajeitam", desfazer ilimitado.
3. **Camadas e colagem** — importar imagens, recortar, sobrepor, desenhar por cima.
4. **IA com chave do usuário (BYOK)** — o usuário cola uma chave gratuita (ou usa um provedor sem chave) e a IA gera, edita e transforma.
5. **IA que ensina** — tutor que observa o canvas e dá dicas, propõe exercícios, explica técnicas.
6. **Local-first e privado** — funciona offline, salva no navegador, chave de API nunca sai do dispositivo (exceto para o próprio provedor).

---

## 3. Pesquisa de ferramentas open source

> Legenda de licença: ✅ permissiva (MIT/Apache/BSD — pode usar em projeto fechado/comercial) · ⚠️ copyleft (GPL/AGPL — só se o Rabisco também for open source com a mesma licença, ou usada como serviço separado) · ⛔ não-comercial.

### 3.1 Base do app / stack
| Ferramenta | Para quê | Licença |
|---|---|---|
| **TypeScript + Vite** | Linguagem e build rápido | ✅ |
| **React** (ou **Svelte/SolidJS**) | Interface (ribbon, painéis, diálogos) | ✅ |
| **Zustand** + **Immer** | Estado global + histórico de desfazer/refazer | ✅ |
| **Tauri 2** | Versão desktop leve (Windows/Mac/Linux) a partir do mesmo código web | ✅ |
| **vite-plugin-pwa** | Instalar como app e funcionar offline | ✅ |
| **Dexie.js** / **idb-keyval** | Salvar projetos e preferências no IndexedDB | ✅ |
| **Comlink** + Web Workers | Rodar filtros e IA local sem travar a tela | ✅ |

### 3.2 Visual "Windows 7"
| Ferramenta | Para quê | Licença |
|---|---|---|
| **7.css** (khang-nd) | CSS que recria janelas, botões, abas, barras do Win7 (baseado em XP.css/98.css) | ✅ MIT |
| **98.css / XP.css** | Temas extras ("modo retrô 98", "modo XP") | ✅ MIT |
| **Fugue Icons** (Yusuke Kamiyamane) | +3000 ícones 16px no estilo exato da era Win7 | ✅ CC BY 3.0 (exige crédito) |
| **Silk Icons** (famfamfam) | Ícones clássicos dos anos 2000 | ✅ CC BY 2.5 (exige crédito) |
| **Selawik** | Fonte open source métrica-compatível com Segoe UI | ✅ OFL |
| Ribbon | Não há boa lib pronta → **construir componente próprio** com 7.css | — |

### 3.3 Motor de desenho / canvas
| Ferramenta | Para quê | Licença |
|---|---|---|
| **Canvas 2D + OffscreenCanvas** | Base raster (pixels), simples e rápida | nativo |
| **PixiJS v8** (WebGL/WebGPU) | Renderização acelerada de camadas grandes, blend modes, zoom fluido | ✅ MIT |
| **perfect-freehand** | Traços com pressão bonitos e suaves | ✅ MIT |
| **lazy-brush** | Estabilizador de traço ("pincel preguiçoso") — chave para "fácil de desenhar" | ✅ MIT |
| **simplify-js** | Simplificar/suavizar curvas | ✅ BSD |
| **Pointer Events API** | Pressão, inclinação de caneta, toque | nativo |
| **Paper.js** ou **Fabric.js** | Camadas vetoriais opcionais (formas/textos editáveis depois) | ✅ MIT |
| **opentype.js** | Texto com fontes customizadas, contornos | ✅ MIT |
| **q-floodfill** | Balde de tinta rápido com tolerância | ✅ MIT |

**Projetos de referência para estudar (não copiar arte):**
- **JS Paint** (1j01) — remake fiel do paint clássico em web, MIT. Ótimo para estudar ferramentas originais (seleção livre, spray, curva em 2 cliques).
- **Klecks** (motor do Kleki, bitbof) — MIT, camadas, pressão, estabilizador, gestos de toque. *O nome/marca "Kleki" não é coberto pela licença.*
- **miniPaint** (viliusle) — editor web com camadas e filtros (confirmar licença no repo oficial).
- **Pixelorama** (Godot, MIT) — referência para modo pixel art e animação.
- **Krita / GIMP / Pinta** — referência de UX para camadas, máscaras e pincéis (Krita e GIMP são GPL).

### 3.4 Processamento de imagem (transformações "clássicas", sem IA)
| Ferramenta | Para quê | Licença |
|---|---|---|
| **OpenCV.js** | Detecção de bordas, desfoque, perspectiva, contornos | ✅ Apache 2.0 |
| **glfx.js** / shaders WebGL próprios | Filtros em tempo real (brilho, curvas, matiz, ondas) | ✅ MIT |
| **Pica** | Redimensionar com alta qualidade | ✅ MIT |
| **image-q** / **RgbQuant.js** | Reduzir paleta + dithering (Floyd-Steinberg, Atkinson…) → modo retrô/pixel | ✅ MIT |
| **UPNG.js / gifenc / gif.js** | Exportar PNG otimizado e GIF animado | ✅ MIT |

### 3.5 Importação / exportação / formatos
| Ferramenta | Para quê | Licença |
|---|---|---|
| **ag-psd** | Ler e gravar **PSD com camadas** (interop com Photoshop/Photopea) | ✅ MIT |
| **OpenRaster (.ora)** via **JSZip** | Formato aberto de camadas (compatível com Krita/GIMP/MyPaint) | ✅ |
| Formato próprio **.rabisco** | ZIP com `manifest.json` + PNG por camada + histórico IA | — |
| **heic2any** | Importar fotos HEIC de iPhone | ✅ MIT |
| **jsPDF** | Exportar PDF (para imprimir) | ✅ MIT |
| Clipboard API | Colar imagem direto do Ctrl+V (essencial para colagem) | nativo |

### 3.6 Estilos alternativos
| Estilo | Ferramenta / técnica | Licença |
|---|---|---|
| **ASCII art** | Algoritmo próprio (luminância → caracteres) em Worker; **figlet.js** para títulos em letras ASCII | ✅ MIT |
| **ANSI / colorido** | Mesmo algoritmo com cor por célula; exportar `.txt`, `.html`, `.png` | — |
| **Pixel art** | Grade, paleta limitada, pincel 1px sem antialiasing, **image-q** para pixelizar fotos | ✅ |
| **Dithering retrô** | image-q (Floyd-Steinberg, Atkinson, Bayer) — "modo Game Boy", "modo CGA" | ✅ |
| **Pontilhismo / mosaico / meio-tom** | Shaders próprios | — |
| **Simetria / mandala** | Espelhamento N-eixos no motor de traço | — |

### 3.7 IA local (roda no navegador, sem chave)
| Ferramenta | Para quê | Licença |
|---|---|---|
| **Transformers.js** (Hugging Face) + **ONNX Runtime Web** (WebGPU) | Rodar modelos no navegador | ✅ Apache 2.0 |
| **SAM / SlimSAM / MobileSAM** | "Varinha mágica inteligente": clicar e selecionar o objeto | ✅ Apache 2.0 |
| **MODNet** ou **BiRefNet** (ONNX) | Remover fundo | ✅ (conferir cada peso; **RMBG-1.4 é ⛔ não-comercial**; **@imgly/background-removal é ⚠️ AGPL**) |
| **LaMa** (via ONNX) | Apagar objetos e preencher o buraco (inpainting) | ✅ Apache 2.0 |
| **UpscalerJS** / **Real-ESRGAN** | Aumentar resolução | ✅ MIT / BSD |
| **Depth Anything (small)** | Mapa de profundidade → efeito desfoque, relevo, 3D falso | ✅ Apache 2.0 (versão small) |
| **WebLLM** (MLC) | LLM pequeno local para o tutor offline | ✅ Apache 2.0 |

### 3.8 IA local "pesada" (opcional, roda no PC do usuário)
| Ferramenta | Para quê | Licença |
|---|---|---|
| **ComfyUI** (API local) | Geração/edição avançada por nós (SDXL, FLUX, ControlNet) | ⚠️ GPL-3 — usar como **serviço separado** via HTTP, não embutir |
| **IOPaint** (ex-lama-cleaner) | Servidor local de inpainting/outpainting | ✅ Apache 2.0 |
| **Ollama** | LLM local para o tutor (Llama, Qwen, Gemma; modelos de visão) | ✅ MIT |
| **FLUX.1 [schnell]** | Modelo de imagem rápido e aberto | ✅ Apache 2.0 (**FLUX.1 [dev]/Kontext são ⛔ não-comerciais**) |
| **Stable Diffusion XL / SD 1.5** + ControlNet | Gerar a partir do rabisco (sketch → imagem) | ✅ OpenRAIL (com restrições de uso) |

### 3.9 Provedores de API com camada gratuita (BYOK — o usuário cola a chave)
> Os limites mudam com frequência — o app deve mostrar o link oficial de preços de cada um e nunca prometer números fixos.

| Provedor | O que oferece | Observação |
|---|---|---|
| **AI Horde (Stable Horde)** | Geração SD/SDXL/FLUX por rede voluntária | **Funciona sem cadastro** com a chave anônima `0000000000` (fila mais lenta); conta grátis dá prioridade. Ótimo "padrão de fábrica". |
| **Cloudflare Workers AI** | FLUX (schnell/klein), SDXL, LLMs, visão | Camada grátis diária (~10k "neurons"/dia segundo fontes); requer conta + token. |
| **Google AI Studio (Gemini)** | Gemini (texto/visão) para o tutor; modelos de imagem ("Nano Banana") | Texto/visão tem camada grátis; **imagem: fontes divergem** sobre gratuidade — verificar na página oficial. |
| **Hugging Face Inference Providers** | Milhares de modelos (imagem, segmentação, LLM) | Créditos grátis mensais com conta. |
| **Pollinations.ai** | Geração de imagem via URL simples | Historicamente grátis/sem chave; confirmar termos atuais. |
| **Groq / OpenRouter (modelos :free)** | LLMs rápidos para o tutor e para o "agente que desenha" | Camadas grátis com limite de taxa. |
| **Stability AI, fal.ai, Replicate, OpenAI** | Qualidade alta, edição, inpainting | Pagos/créditos iniciais — suporte opcional. |

---

## 4. ✨ PROMPT MESTRE (copiar e colar na IA de código)

```text
# PAPEL
Você é um engenheiro de software sênior e designer de produto especialista em editores gráficos
web (Canvas/WebGL), UX retrô e integração com IA generativa. Você vai construir, por etapas, o
projeto RABISCO. Escreva código de produção em TypeScript, bem organizado, testado e comentado
em português. Antes de cada etapa, apresente um plano curto; ao final de cada etapa, rode os
testes e mostre como verificar no navegador.

# 1. VISÃO DO PRODUTO
RABISCO é um editor de imagens que tem a aparência e a simplicidade do paint clássico da era
Windows 7 (faixa de opções "ribbon", paleta de cores grande, ferramentas clássicas, janelas com
efeito vidro), mas com recursos modernos:
- desenho mais fácil (estabilizador de traço, pressão de caneta, simetria, formas inteligentes);
- camadas editáveis, colagem e importação de imagens para desenhar por cima;
- estilos alternativos (ASCII, pixel art, dithering retrô, meio-tom, mosaico);
- motores de transformação de imagem (filtros clássicos + IA local);
- uma IA interna que gera/edita imagens USANDO AS FERRAMENTAS DO PRÓPRIO APP, com chave de API
  do usuário (BYOK) ou provedores gratuitos;
- uma IA tutora ("Rabi") que ensina a desenhar, observa o canvas e dá dicas.
Público: iniciantes, crianças/adolescentes (com supervisão), nostálgicos, artistas casuais,
criadores de memes e colagens. Idioma padrão: português do Brasil, com i18n (en, es).

# 2. RESTRIÇÕES IMPORTANTES
- NÃO usar ícones, logotipos, sons, fontes proprietárias (ex.: Segoe UI) ou nomes de marcas da
  Microsoft. O visual é INSPIRADO na época: use 7.css (MIT), ícones Fugue/Silk (CC BY, com
  crédito na tela "Sobre") e a fonte Selawik (OFL). Crie arte própria para logo e mascote.
- Só dependências com licença permissiva (MIT, Apache-2.0, BSD, OFL, CC BY) dentro do app.
  Ferramentas GPL/AGPL (ex.: ComfyUI) apenas como serviço externo opcional via HTTP.
  Modelos com licença não-comercial (ex.: RMBG-1.4, FLUX.1-dev) ficam fora do padrão.
- Local-first: tudo funciona offline (exceto IA na nuvem). Chaves de API ficam apenas no
  dispositivo (IndexedDB, criptografadas com WebCrypto + senha opcional), nunca em logs, URLs
  ou servidores do Rabisco. As chamadas vão direto do cliente ao provedor (ou via proxy local
  do Tauri quando houver CORS).
- Desempenho: 60 fps desenhando em canvas 4000x4000 com 20 camadas num notebook comum.
  Operações pesadas em Web Workers / OffscreenCanvas / WebGPU.
- Acessibilidade: navegação por teclado, atalhos clássicos, alto contraste, tamanho de UI
  ajustável, leitores de tela nos menus, modo canhoto.

# 3. STACK
- TypeScript + Vite + React (ou SolidJS) ; Zustand + Immer (estado e histórico).
- Renderização: PixiJS v8 (WebGL/WebGPU) para composição de camadas; Canvas 2D/OffscreenCanvas
  para rasterização dos pincéis.
- Traço: perfect-freehand, lazy-brush, simplify-js, Pointer Events (pressão/inclinação).
- Imagem: OpenCV.js, shaders próprios, Pica, image-q (quantização/dithering), q-floodfill.
- Arquivos: ag-psd (PSD), JSZip (OpenRaster .ora e formato próprio .rabisco), gifenc, jsPDF,
  heic2any, Clipboard API, File System Access API (com fallback de download).
- IA local: Transformers.js + ONNX Runtime Web (WebGPU/WASM) — SlimSAM, MODNet/BiRefNet,
  LaMa, UpscalerJS, Depth Anything small, WebLLM para tutor offline.
- Persistência: Dexie (IndexedDB) com autosalvamento e recuperação após travar.
- Desktop: Tauri 2. Web: PWA instalável (vite-plugin-pwa).
- Testes: Vitest (unidade), Playwright (E2E e testes visuais com screenshot).

# 4. INTERFACE (estilo clássico Win7)
Layout da janela principal:
- Barra de título com botão de menu do app (menu "Arquivo" em forma de botão azul à esquerda),
  barra de acesso rápido (Salvar, Desfazer, Refazer) e botões minimizar/maximizar/fechar
  (no desktop).
- RIBBON com abas:
  * Início: Área de transferência (Colar, Recortar, Copiar) | Imagem (Selecionar, Cortar,
    Redimensionar, Girar) | Ferramentas (Lápis, Balde, Texto, Borracha, Conta-gotas, Lupa) |
    Pincéis (galeria com prévia) | Formas (galeria + Contorno/Preenchimento) | Espessura |
    Cor 1 / Cor 2 | Paleta 28 cores + "Editar cores".
  * Exibir: Zoom, Régua, Linhas de grade, Barra de status, Tela inteira, Miniatura.
  * Camadas: Nova, Duplicar, Mesclar, Opacidade, Modo de mesclagem, Máscara, Bloquear.
  * Efeitos: filtros clássicos e estilos (ASCII, Pixel, Dithering, Meio-tom, Mosaico...).
  * IA ✨: Gerar, Editar com texto, Remover fundo, Apagar objeto, Ampliar, Rabisco→Imagem,
    Variações, Colorir desenho, "Desenhe pra mim" (agente).
  * Aprender 🎓: abrir tutor Rabi, Exercícios, Modo traçar por cima, Desafio do dia.
- Painel lateral recolhível de Camadas (miniaturas, olho, cadeado, opacidade, arrastar para
  reordenar) e painel de Histórico.
- Barra de status: posição do cursor, tamanho da seleção, tamanho da imagem, zoom com slider.
- Temas: "Aero 7" (padrão), "Clássico 98", "Luna XP", "Escuro moderno".
- Sons de interface opcionais (próprios, desligados por padrão).

# 5. FERRAMENTAS "ORIGINAIS" (paridade com o paint clássico)
Seleção retangular e livre (com seleção transparente), recortar, copiar, colar, colar de
arquivo, cortar para seleção, redimensionar/inclinar (%, px, manter proporção), girar e
inverter, lápis 1px, balde com tolerância, texto (fonte, tamanho, negrito/itálico, fundo
transparente/opaco), borracha (e borracha de cor com botão direito), conta-gotas, lupa,
pincéis (pincel, caligrafia 1 e 2, aerógrafo/spray, óleo, giz de cera, marcador, lápis
natural, aquarela), formas (linha, curva com 2 pontos de controle, oval, retângulo,
retângulo arredondado, polígono, triângulo, triângulo retângulo, losango, pentágono,
hexágono, setas, estrelas 4/5/6, balões de fala, coração, raio), cor 1 com botão esquerdo
e cor 2 com botão direito, propriedades da imagem, atalhos clássicos (Ctrl+Z/Y/A/C/V/X/E/W,
Ctrl+Page Up/Down para zoom, Shift para restringir proporção).

# 6. MELHORIAS DE "FÁCIL DE DESENHAR"
- Estabilizador de traço ajustável (0–100) e "suavização final" da curva.
- Pressão e inclinação da caneta afetando espessura/opacidade; simulação de pressão por
  velocidade no mouse.
- Formas inteligentes: segurar no final do traço transforma o rabisco em linha/círculo/
  retângulo perfeito (reconhecimento de forma).
- Simetria (vertical, horizontal, radial N eixos), régua e guias magnéticas.
- Zoom e pan fluidos (roda, pinça, barra de espaço), rotação do canvas.
- Desfazer/refazer ilimitado (por comando, com memória limitada por blocos de pixels).
- Modo "traçar por cima": imagem de referência semitransparente travada.
- Conta-gotas rápido com Alt; trocar Cor1/Cor2 com X.

# 7. CAMADAS E COLAGEM
- Camadas raster, camadas de texto editável, camadas de forma vetorial editável, camadas de
  ajuste (brilho/contraste, matiz/saturação, curvas) não destrutivas.
- Grupos, máscaras, modos de mesclagem (normal, multiplicar, tela, sobrepor, adicionar,
  diferença…), opacidade, bloqueio de transparência, recorte (clipping).
- Importar imagens (arquivo, arrastar e soltar, Ctrl+V, câmera, URL) como nova camada com
  transformar livre (mover, escalar, girar, distorcer, perspectiva).
- Ferramentas de colagem: recorte livre, remover fundo com 1 clique, contorno/sombra
  automáticos ("adesivo"), biblioteca de recortes salvos.
- Exportar: PNG, JPG, WebP, GIF (inclui animado por camadas/quadros), BMP, SVG (camadas
  vetoriais), PDF, PSD com camadas, ORA, .rabisco, .txt/.html (ASCII).
- Importar: PNG, JPG, WebP, GIF, BMP, HEIC, SVG, PSD, ORA, .rabisco.

# 8. ESTILOS ALTERNATIVOS
- ASCII: converter camada/seleção em ASCII com conjuntos de caracteres configuráveis, largura
  em colunas, inverter, cores (ANSI/HTML), modo de edição de texto ASCII direto no canvas e
  títulos com figlet.js. Exporta .txt, .html e .png.
- Pixel art: canvas com grade, pincel sem antialias, paletas prontas (Game Boy, NES, PICO-8,
  CGA, EGA), pixelizar foto, contorno automático, prévia em tamanho real e animação simples
  com papel-cebola.
- Dithering e retrô: Floyd-Steinberg, Atkinson, Bayer, ruído; modos "jornal" (meio-tom),
  "mosaico", "pontilhismo", "vitral", "CRT/scanlines".
- Arquitetura de plugins para novos estilos (interface StylePlugin { id, nome, parametros,
  aplicar(imagem, params): Promise<ImageData> }).

# 9. MOTORES DE IA
## 9.1 Camada de provedores (BYOK)
Crie uma interface única:
  interface ImageProvider {
    id; nome; precisaChave: boolean; linkChave; linkPrecos;
    capacidades: ('gerar'|'editar'|'inpaint'|'outpaint'|'variacao'|'sketch2img'|'upscale'|'removerFundo')[];
    gerar(req): Promise<Resultado>; editar(req): Promise<Resultado>; ...
  }
  interface TextProvider { conversar(msgs, ferramentas?, imagens?): AsyncIterable<Evento> }
Implementar adaptadores: AI Horde (padrão, funciona sem chave com a chave anônima
"0000000000"), Cloudflare Workers AI, Google Gemini (AI Studio), Hugging Face Inference
Providers, Pollinations, Groq, OpenRouter, Ollama (local), ComfyUI (local), IOPaint (local),
OpenAI/Stability/fal (opcionais).
- Tela "Configurar IA": assistente passo a passo com prints de como obter a chave grátis de
  cada provedor, botão "Testar chave", indicador de cota/erros, aviso claro de que limites
  gratuitos mudam (link para página oficial). Nunca exibir a chave completa depois de salva.
- Fila de tarefas de IA com progresso, cancelar, repetir, e resultado sempre entrando como
  NOVA CAMADA (nunca destrói o desenho original).
- Metadados: guardar prompt, provedor, modelo, seed e parâmetros na camada ("refazer com
  outra seed").

## 9.2 IA local (sem internet)
SlimSAM (seleção inteligente por clique), remoção de fundo, LaMa (apagar objeto), upscale,
mapa de profundidade, colorização de lineart. Baixar modelos sob demanda, com tamanho
informado e cache.

## 9.3 "Desenhe pra mim" — IA que usa as ferramentas do app
Exponha TODAS as ferramentas como uma API de comandos tipada (que também alimenta
desfazer/refazer, macros e plugins):
  novaCamada(nome), selecionarCamada(id), definirCor(cor1, cor2), pincel(tipo, espessura),
  tracar(pontos[], pressao[]), forma(tipo, x, y, w, h, contorno, preenchimento),
  balde(x, y, tolerancia), texto(conteudo, x, y, fonte), selecionar(retangulo|poligono),
  transformar(...), aplicarFiltro(nome, params), aplicarEstilo(nome, params),
  gerarImagem(prompt, area?), inpaint(mascara, prompt), removerFundo(camada), ...
Use function calling (tool use) do LLM: o usuário pede "desenhe uma casinha com sol" e o
agente executa os comandos passo a passo, VISÍVEIS e animados no canvas, numa camada própria,
podendo pausar, desfazer cada passo ou "continuar daqui". Modo híbrido: o agente esboça com
ferramentas e opcionalmente refina com geração de imagem (sketch→imagem / ControlNet).
O agente recebe uma captura reduzida do canvas (visão) para ver o que já existe.

## 9.4 Tutor "Rabi" 🎓
- Painel de chat com mascote; responde em linguagem simples.
- "Olhar meu desenho": envia captura e devolve dicas sobre proporção, perspectiva, luz e
  sombra, cores — com setas/anotações desenhadas numa camada de guia temporária.
- Lições interativas (formas básicas, perspectiva de 1 e 2 pontos, rosto, mãos, sombreamento,
  teoria das cores, pixel art) com passos verificáveis.
- "Traçar por cima": gera um guia em linhas leves para o usuário cobrir.
- Explicar qualquer ferramenta do app ("o que faz o balde com tolerância?").
- Desafio do dia e conquistas (opcional, sem pressão).
- Funciona com LLM na nuvem (chave do usuário) ou local (Ollama/WebLLM).
- Modo infantil: linguagem adequada, sem geração de imagens fotorrealistas de pessoas.

# 10. SEGURANÇA E ÉTICA
- Respeitar as políticas de conteúdo de cada provedor; filtro de prompt básico no cliente.
- Marcar camadas geradas por IA (ícone ✨) e opção de incluir metadados C2PA/XMP na exportação.
- Não enviar nada para a nuvem sem ação explícita do usuário; mostrar qual provedor recebe a
  imagem antes do envio.
- CSP rígida, sanitização de SVG importado, limites de tamanho de arquivo.

# 11. ARQUITETURA E PASTAS
/src
  /app          (shell, temas, ribbon, janelas, atalhos)
  /canvas       (motor de render, viewport, camadas, composição)
  /tools        (cada ferramenta: interface Tool { onPointerDown/Move/Up, cursor, opcoes })
  /brushes      (motores de pincel)
  /commands     (API de comandos + histórico desfazer/refazer)
  /layers       (modelo de documento, máscaras, blend)
  /effects      (filtros e estilos: ascii, pixel, dither…)
  /io           (importar/exportar: png, psd, ora, rabisco, gif, pdf, ascii)
  /ai
    /providers  (adaptadores BYOK)
    /local      (modelos ONNX/Transformers.js em workers)
    /agent      (agente que desenha via comandos)
    /tutor      (Rabi, lições)
  /storage      (Dexie, autosave, cofre de chaves)
  /i18n         (pt-BR, en, es)
  /workers
/tests

# 12. ROTEIRO (entregar nesta ordem, cada etapa funcionando)
MVP 0.1 – Shell visual Win7 (7.css), canvas único, lápis, pincel, borracha, balde, formas,
         paleta Cor1/Cor2, seleção retangular, desfazer, abrir/salvar PNG, autosave.
0.2 – Todas as ferramentas originais da seção 5 + texto + zoom/pan + atalhos.
0.3 – Camadas completas + importar/colar imagem + transformar livre + .rabisco + PSD/ORA.
0.4 – Fácil de desenhar: estabilizador, pressão, simetria, formas inteligentes.
0.5 – Efeitos e estilos: filtros, ASCII, pixel art, dithering.
0.6 – IA BYOK: tela de provedores, AI Horde sem chave, gerar/editar como nova camada.
0.7 – IA local: seleção inteligente, remover fundo, apagar objeto, ampliar.
0.8 – Agente "Desenhe pra mim" usando a API de comandos.
0.9 – Tutor Rabi + lições + modo traçar por cima.
1.0 – PWA + Tauri, i18n, acessibilidade, testes visuais, performance, documentação.

# 13. CRITÉRIOS DE ACEITE GERAIS
- Um usuário que nunca usou o app desenha, adiciona uma foto como camada, remove o fundo,
  escreve um texto e exporta PNG em menos de 3 minutos sem tutorial.
- Nenhuma ação de IA apaga conteúdo do usuário; tudo é desfazível.
- O app abre offline e recupera o último trabalho após fechar a aba à força.
- Testes E2E cobrindo: desenhar, camadas, importar/exportar, ASCII, provedor de IA mockado,
  agente executando 10 comandos e desfazendo todos.
- Tela "Sobre" lista todas as bibliotecas e licenças/créditos (Fugue, Silk, 7.css etc.).

# 14. COMO TRABALHAR COMIGO
- Comece pela etapa MVP 0.1. Antes de codar, mostre a árvore de pastas e as decisões técnicas.
- Faça perguntas só quando a decisão for minha (ex.: nome final, licença do projeto).
- Mantenha um CHANGELOG.md e um ROADMAP.md atualizados.
- Ao terminar cada etapa, liste o que foi feito, o que falta e como testar.
```

---

## 5. Decisões que ainda são suas
1. **Licença do Rabisco**: open source (MIT → atrai contribuidores; GPL → poderia aproveitar código de GIMP/Krita/ComfyUI) ou fechado/freemium?
2. **Web primeiro ou desktop primeiro?** (Recomendo **web/PWA primeiro** e Tauri depois — mesmo código.)
3. **Público infantil?** Se sim, o modo infantil vira obrigatório e há cuidados legais extras (LGPD/ECA Digital).
4. **Nome final** — checar disponibilidade de "Rabisco" (há apps com nomes parecidos).

## 6. Fontes consultadas
- [7.css (khang-nd) — npm](https://www.npmjs.com/package/7.css) · [README 7.css](https://unpkg.com/7.css@0.13.0/README.md)
- [JS Paint (1j01)](https://github.com/1j01/jspaint) · [Klecks (bitbof)](https://github.com/bitbof/klecks) · [miniPaint](https://awesome.ecosyste.ms/projects/github.com%2Fviliusle%2FminiPaint)
- [AI Horde (Haidra-Org)](https://awesome.ecosyste.ms/projects/github.com%2Fhaidra-org%2Fai-horde) · [AI Horde README](https://github.com/db0/AI-Horde)
- [Free AI Image Generation API — o que é grátis de verdade em 2026 (Runflow)](https://www.runflow.io/blog/free-ai-image-generation-api-lies)
- [Gemini Image Generation API Free Tier (guia)](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-api)
- [Best Free Image Generation APIs 2026 (ImaginePro)](https://www.imaginepro.ai/blog/2026/7/best-free-image-generation-apis-2026)
