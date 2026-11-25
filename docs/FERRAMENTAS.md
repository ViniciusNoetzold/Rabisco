# Ferramentas e bibliotecas do Rabisco

> Catálogo da pesquisa feita no início do projeto (24/11/2026), atualizado com o que de fato
> entrou. Antes de procurar uma biblioteca nova, veja aqui. Antes de adicionar qualquer uma,
> confira a licença no repositório oficial e registre em [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

**Legenda de licença:** ✅ permissiva (MIT, Apache, BSD, ISC, OFL, CC BY) · ⚠️ copyleft (GPL/AGPL: só como serviço externo) · ⛔ não comercial (fora do padrão).
**Situação:** 🟢 em uso · 🔵 escolhida para uma versão · ⚪ alternativa ou referência.

## 1. Base do app

| Ferramenta                    | Para quê                               |    Licença    | Situação                                         |
| ----------------------------- | -------------------------------------- | :-----------: | ------------------------------------------------ |
| TypeScript + Vite             | Linguagem e build                      |      ✅       | 🟢 desde 0.1                                     |
| React                         | Interface                              |      ✅       | 🟢 desde 0.1                                     |
| Zustand + Immer               | Estado da interface                    |      ✅       | 🟢 desde 0.1                                     |
| Dexie (IndexedDB)             | Autosave, formas próprias, cores       |   ✅ Apache   | 🟢 desde 0.1 (carregado sob demanda desde 0.2.1) |
| Web Workers + OffscreenCanvas | PNG do autosave fora da interface      |    nativo     | 🟢 desde 0.2.1                                   |
| Vitest                        | Testes unitários                       |      ✅       | 🟢                                               |
| Playwright                    | Testes no navegador (Edge)             |   ✅ Apache   | 🟢                                               |
| Prettier                      | Formatação                             |      ✅       | 🟢                                               |
| vite-plugin-pwa               | Instalar como app, abrir offline       |      ✅       | 🔵 1.0                                           |
| Tauri 2                       | Versão desktop leve                    | ✅ MIT/Apache | 🔵 1.0                                           |
| Comlink                       | Conversar com workers com menos código |      ✅       | ⚪ se os workers crescerem (balde, filtros)      |

## 2. Visual "Windows 7"

| Ferramenta                       | Para quê                               |           Licença            | Situação                                         |
| -------------------------------- | -------------------------------------- | :--------------------------: | ------------------------------------------------ |
| 7.css (khang-nd)                 | Janelas, botões e abas da era Win7     |            ✅ MIT            | 🟢 desde 0.1                                     |
| Ícones Fugue (Yusuke Kamiyamane) | Ícones 16 px no estilo da época        | ✅ CC BY 3.0 (exige crédito) | 🟢 desde 0.1                                     |
| Selawik                          | Fonte compatível com Segoe UI          |            ✅ OFL            | 🟢 desde 0.1                                     |
| 98.css / XP.css                  | Temas extras "Clássico 98" e "Luna XP" |            ✅ MIT            | 🔵 temas, depois da 1.0                          |
| Silk Icons (famfamfam)           | Ícones extras dos anos 2000            |         ✅ CC BY 2.5         | ⚪                                               |
| Ribbon                           | Não há biblioteca boa                  |              —               | 🟢 feito do zero (recolhe por prioridade, 0.2.1) |

## 3. Desenho e canvas

| Ferramenta                         | Para quê                                                            | Licença | Situação                                                              |
| ---------------------------------- | ------------------------------------------------------------------- | :-----: | --------------------------------------------------------------------- |
| Canvas 2D                          | Pixels das camadas, composição                                      | nativo  | 🟢                                                                    |
| Motor de pincel próprio (carimbos) | 9 pincéis, spray, pressão                                           |    —    | 🟢 desde 0.2                                                          |
| Compositor próprio                 | 16 modos, máscaras, recorte, efeitos                                |    —    | 🟢 desde 0.3                                                          |
| lazy-brush                         | Estabilizador de traço ("pincel preguiçoso")                        | ✅ MIT  | 🔵 0.4                                                                |
| perfect-freehand                   | Traço suave com pressão                                             | ✅ MIT  | 🔵 0.4 (avaliar contra o motor próprio)                               |
| simplify-js                        | Suavizar curvas / reconhecer formas                                 | ✅ BSD  | 🔵 0.4                                                                |
| PixiJS v8 (WebGL/WebGPU)           | Composição acelerada se o Canvas 2D não aguentar 20 camadas grandes | ✅ MIT  | ⚪ só se o `npm run perf` pedir                                       |
| Paper.js / Fabric.js               | Camadas vetoriais editáveis                                         | ✅ MIT  | ⚪ (formas e texto hoje viram pixels)                                 |
| opentype.js                        | Texto com fontes carregadas e contorno                              | ✅ MIT  | ⚪                                                                    |
| q-floodfill                        | Balde rápido                                                        | ✅ MIT  | ⚪ o balde próprio funciona; o gargalo é a thread (levar a um worker) |

## 4. Projetos de referência (estudar, não copiar arte)

| Projeto                 | O que aproveitar                                                                |          Licença          |
| ----------------------- | ------------------------------------------------------------------------------- | :-----------------------: |
| JS Paint (1j01)         | Remake fiel do paint clássico: comportamento das ferramentas                    |          ✅ MIT           |
| Klecks (motor do Kleki) | Camadas, pressão, estabilizador e gestos de toque (a marca "Kleki" não é livre) |          ✅ MIT           |
| miniPaint               | Editor web com camadas e filtros                                                | confirmar no repo oficial |
| Pixelorama (Godot)      | Modo pixel art e animação                                                       |          ✅ MIT           |
| Krita / GIMP / Pinta    | Interface de camadas, máscaras e pincéis                                        |  ⚠️ GPL (só referência)   |

## 5. Processamento de imagem (sem IA)

| Ferramenta                  | Para quê                                                      |  Licença  | Situação                              |
| --------------------------- | ------------------------------------------------------------- | :-------: | ------------------------------------- |
| Transformações próprias     | Girar, inverter, redimensionar, inclinar                      |     —     | 🟢 desde 0.2                          |
| image-q / RgbQuant.js       | Reduzir paleta e dithering (Floyd-Steinberg, Atkinson, Bayer) |  ✅ MIT   | 🔵 0.5                                |
| glfx.js ou shaders próprios | Filtros em tempo real (brilho, curvas, matiz, ondas)          |  ✅ MIT   | 🔵 0.5                                |
| OpenCV.js                   | Bordas, desfoque, perspectiva, contornos                      | ✅ Apache | 🔵 0.5 (pesado: carregar sob demanda) |
| Pica                        | Redimensionar com alta qualidade                              |  ✅ MIT   | ⚪                                    |
| figlet.js                   | Títulos em letras ASCII                                       |  ✅ MIT   | 🔵 0.5                                |

## 6. Arquivos e formatos

| Ferramenta             | Para quê                                      |    Licença     | Situação                |
| ---------------------- | --------------------------------------------- | :------------: | ----------------------- |
| Codificadores próprios | BMP, GIF, ICO; PNG com DPI                    |       —        | 🟢 desde 0.2            |
| fflate (ou JSZip)      | ZIP do formato `.rabisco` e do ORA            |     ✅ MIT     | 🟢 desde 0.3 (aprovada) |
| ag-psd                 | Abrir e salvar PSD com camadas                |     ✅ MIT     | 🟢 desde 0.3 (aprovada) |
| OpenRaster (.ora)      | Camadas compatíveis com Krita, GIMP e MyPaint | formato aberto | 🔵 0.3, passo 6         |
| gifenc / gif.js        | GIF animado (quadros por camada)              |     ✅ MIT     | ⚪                      |
| heic2any               | Fotos HEIC do iPhone                          |     ✅ MIT     | ⚪                      |
| jsPDF                  | Exportar PDF                                  |     ✅ MIT     | ⚪ (hoje há impressão)  |

## 7. IA no navegador (sem chave)

| Ferramenta                                  | Para quê                                |               Licença               | Situação          |
| ------------------------------------------- | --------------------------------------- | :---------------------------------: | ----------------- |
| Transformers.js + ONNX Runtime Web (WebGPU) | Rodar modelos no navegador              |              ✅ Apache              | 🔵 0.7            |
| SAM / SlimSAM / MobileSAM                   | Seleção inteligente por clique          |              ✅ Apache              | 🔵 0.7            |
| MODNet ou BiRefNet (ONNX)                   | Remover fundo                           | ✅ (conferir o peso de cada modelo) | 🔵 0.7            |
| RMBG-1.4                                    | Remover fundo                           |          ⛔ não comercial           | ⚪ fora do padrão |
| @imgly/background-removal                   | Remover fundo                           |               ⚠️ AGPL               | ⚪ fora do padrão |
| LaMa (ONNX)                                 | Apagar objeto e preencher               |              ✅ Apache              | 🔵 0.7            |
| UpscalerJS / Real-ESRGAN                    | Ampliar                                 |            ✅ MIT / BSD             | 🔵 0.7            |
| Depth Anything (small)                      | Mapa de profundidade, desfoque de fundo |      ✅ Apache (versão small)       | ⚪                |
| WebLLM (MLC)                                | Tutor Rabi offline                      |              ✅ Apache              | 🔵 0.9            |

## 8. IA no computador da pessoa (opcional)

| Ferramenta                 | Para quê                                                       |               Licença               | Situação                        |
| -------------------------- | -------------------------------------------------------------- | :---------------------------------: | ------------------------------- |
| Ollama                     | LLM local para o tutor (Llama, Qwen, Gemma, modelos com visão) |               ✅ MIT                | 🔵 0.9                          |
| IOPaint (ex-lama-cleaner)  | Servidor local de inpainting/outpainting                       |              ✅ Apache              | 🔵 0.7 (opcional)               |
| ComfyUI                    | Geração avançada (SDXL, FLUX, ControlNet) por HTTP             |     ⚠️ GPL-3 (só como serviço)      | 🔵 0.6 (opcional)               |
| FLUX.1 [schnell]           | Modelo de imagem rápido e aberto                               |              ✅ Apache              | 🔵 0.6 (via ComfyUI/provedores) |
| FLUX.1 [dev] / Kontext     | Mais qualidade e edição                                        |          ⛔ não comercial           | ⚪ fora do padrão               |
| SDXL / SD 1.5 + ControlNet | Rabisco → imagem                                               | ✅ OpenRAIL (com restrições de uso) | 🔵 0.6                          |

## 9. Provedores de IA com camada gratuita (a pessoa cola a chave)

> Os limites gratuitos mudam com frequência. O app deve mostrar o link oficial de preços de
> cada provedor e nunca prometer números fixos.

| Provedor                                | O que oferece                                 | Observação                                                                                                                       | Situação     |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **AI Horde (Stable Horde)**             | SD, SDXL e FLUX por uma rede voluntária       | Funciona **sem cadastro** com a chave anônima `0000000000` (fila mais lenta). Conta grátis dá prioridade. **Padrão de fábrica.** | 🔵 0.6       |
| Cloudflare Workers AI                   | FLUX, SDXL, LLMs, visão                       | Camada grátis diária (~10 mil "neurons"/dia, segundo fontes de 2026). Requer conta e token.                                      | 🔵 0.6       |
| Google AI Studio (Gemini)               | Texto e visão para o tutor; modelos de imagem | Texto e visão têm camada grátis; para imagem, **as fontes divergem**: conferir na página oficial                                 | 🔵 0.6 / 0.9 |
| Hugging Face Inference Providers        | Milhares de modelos                           | Créditos grátis mensais com conta                                                                                                | 🔵 0.6       |
| Pollinations.ai                         | Imagem por URL simples                        | Historicamente grátis e sem chave; confirmar os termos                                                                           | 🔵 0.6       |
| Groq / OpenRouter (modelos `:free`)     | LLM rápido para o tutor e o agente            | Limite de requisições                                                                                                            | 🔵 0.8 / 0.9 |
| Stability AI, fal.ai, Replicate, OpenAI | Qualidade alta, edição, inpainting            | Pagos ou com créditos iniciais                                                                                                   | ⚪ opcionais |

**Fontes da pesquisa (2026):** [7.css no npm](https://www.npmjs.com/package/7.css) · [JS Paint](https://github.com/1j01/jspaint) · [Klecks](https://github.com/bitbof/klecks) · [AI Horde](https://github.com/db0/AI-Horde) · [Runflow: o que é grátis de verdade em 2026](https://www.runflow.io/blog/free-ai-image-generation-api-lies) · [Guia da camada grátis do Gemini](https://www.aifreeapi.com/en/posts/gemini-image-generation-free-api) · [ImaginePro: APIs grátis 2026](https://www.imaginepro.ai/blog/2026/7/best-free-image-generation-apis-2026)
