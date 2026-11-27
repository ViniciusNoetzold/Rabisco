# Melhorias para o Rabisco ficar "completinho"

> Lista viva, além do roteiro por versões ([ROADMAP.md](../ROADMAP.md)). Quando um item for
> feito, marque com ✅ e a versão. Plano da próxima versão: [prompts/PROMPT_0.4.md](../prompts/PROMPT_0.4.md).

## 0.3 — concluída

- [x] Salvar e abrir **.rabisco**, **PSD** e **ORA** — 0.3
- [x] Exportar cada camada como PNG; **arquivos recentes** no menu Arquivo — 0.3
- [x] **Grupos** no painel (agrupar, desagrupar, recolher, olho do grupo) — 0.3
- [x] "Formas em nova camada" — 0.3
- [x] Transformação livre: **distorcer pelos cantos** e **guias de encaixe** — 0.3
- [x] Alinhar a camada ao papel — 0.3
- [ ] Distribuir várias camadas (precisa de seleção múltipla no painel)
- [x] Medir 20 camadas de 4000 × 4000; README e roteiro manual da 0.3 — 0.3
- [ ] Primeira troca de visibilidade com 20 camadas grandes (~150 ms; as seguintes ~34 ms) — investigado na 0.4: é a primeira leitura das camadas na GPU (ver docs/desempenho.md)
- [x] Balde em papel grande calculado num worker (a tela não trava) — 0.4
- [x] Seleção de várias camadas (Ctrl/Shift+clique) e distribuir — 0.4

## Desenho (0.4 — ver prompts/PROMPT_0.4.md)

- [x] **Estabilizador de traço** ajustável (0–100) — 0.4
- [x] **Pressão**: curva da caneta, pressão pela velocidade e pontas afinadas — 0.4
- [x] **Simetria** vertical, horizontal, quatro quadrantes e radial com caleidoscópio (mandala) — 0.4
- [ ] Simetria também nas formas e no texto (hoje vale para lápis, pincéis, spray e borrachas)
- [ ] Pincéis de caligrafia com o ângulo da ponta espelhado nas cópias simétricas
- [x] **Formas inteligentes**: segurar no fim do traço e ele vira linha, círculo, retângulo, triângulo, seta ou polígono — 0.4
- [ ] Formas inteligentes também com a simetria ligada (cada cópia vira a forma)
- [ ] Formas inteligentes: seta de linha (hoje vira a seta cheia do catálogo, só com contorno) e estrela
- [x] Régua de desenho e guias magnéticas (salvas no .rabisco v2) — 0.4
- [ ] Perspectiva: 1 e 2 pontos de fuga com traços seguindo a linha de fuga
- [ ] Guias no histórico (desfazer a criação ou remoção de uma guia)
- [ ] Régua curva (elipse / curva francesa)
- [x] Rotação e espelho da vista (girar a vista, não a imagem) — 0.4
- [ ] Réguas laterais e miniatura também com a vista girada
- [x] Prévia do traço respeitando as camadas de cima — 0.4
- [ ] Prévia com o modo de mesclagem e a opacidade da camada ativa (hoje é a cor pura)
- [x] Dedo (borrar/esfumar) — 0.4
- [ ] Mais pincéis: textura de papel, misturador de cor; dedo com simetria
- [x] Gradiente linear e radial, até transparente, dentro da seleção — 0.4
- [ ] Balde com gradiente (preencher uma área fechada com gradiente) e gradiente com várias cores
- [ ] Texto editável depois de confirmado (camada de texto "viva")
- [ ] Formas vetoriais editáveis depois (camada de forma)
- [x] Varinha mágica (soma e subtrai) e seleção por elipse — 0.4
- [ ] Somar e subtrair também nas seleções retangular, elíptica e laço

## Estilos e efeitos (0.5)

- [x] Registro de filtros, worker cancelável, prévia no papel e repetição do último filtro. **Inverter cores** inaugura o menu. ✅ 0.5, Passo 1.
- [x] Filtros de cor, editor de curvas e conta-gotas de níveis. ✅ 0.5, Passo 2.
- [ ] **ASCII**: converter camada ou seleção, conjuntos de caracteres, colorido (ANSI/HTML), editar letra por letra, títulos com figlet; exportar .txt, .html e .png
- [ ] **Pixel art**: grade, paletas (Game Boy, NES, PICO-8, CGA), pixelizar foto, papel-cebola
- [ ] **Dithering** retrô, **meio-tom**, mosaico, pontilhismo, vitral, "CRT"
- [x] Filtros espaciais: desfoque, nitidez, ruído, mediana, bordas e relevo. ✅ 0.5, Passo 3.
- [ ] Camadas de ajuste não destrutivas
- [ ] Arquitetura de plugins para novos estilos

## IA (0.6 a 0.9)

- [ ] Tela "Configurar IA": passo a passo para pegar a chave grátis de cada provedor, testar a chave, mostrar a cota
- [ ] **AI Horde sem chave** como padrão; fila de tarefas com progresso e cancelar
- [ ] Gerar, editar com texto, variações, **rabisco → imagem**, colorir desenho — sempre em camada nova, com prompt e seed guardados
- [ ] IA local: seleção inteligente, **remover fundo** (o "adesivo" fica perfeito), apagar objeto, ampliar
- [ ] **"Desenhe pra mim"**: o agente usa os comandos do app, visível e desfazível passo a passo
- [ ] **Tutor Rabi**: olhar o desenho e dar dicas com setas, lições (formas, perspectiva, rosto, mãos, sombra, cores), traçar por cima, desafio do dia
- [ ] Modo infantil (se o público incluir crianças)

## Qualidade e plataforma

- [ ] **Balde em Web Worker** (hoje ~1 s em 4000 × 4000)
- [ ] Eliminar o atraso da **primeira pincelada** em papel grande (sincronização GPU → camada)
- [ ] Toque e celular: gestos, ribbon compacto, painel de camadas em gaveta
- [ ] **PWA** (instalar e abrir offline) e **Tauri** (desktop)
- [ ] Idiomas: inglês e espanhol
- [ ] Acessibilidade: leitor de tela no painel de camadas, alto contraste, tamanho da interface
- [ ] Temas: Aero 7, Clássico 98, Luna XP, escuro
- [ ] Mais de um documento aberto (abas)
- [ ] Definir a **licença** do código e verificar a marca "Rabisco"
- [ ] CI no GitHub (testes a cada envio) e página pública (GitHub Pages) para experimentar
