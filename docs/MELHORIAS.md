# Melhorias para o Rabisco ficar "completinho"

> Lista viva, além do roteiro por versões ([ROADMAP.md](../ROADMAP.md)). Quando um item for
> feito, marque com ✅ e a versão. Onde a 0.3 parou: [prompts/CONTINUAR_0.3.md](../prompts/CONTINUAR_0.3.md).

## Terminar a 0.3 (próximo)

- [ ] Salvar e abrir **.rabisco** (camadas, máscaras, efeitos, grupos), **PSD** e **ORA** — precisa aprovar fflate e ag-psd
- [ ] Exportar cada camada como PNG; lista de **arquivos recentes** no menu Arquivo
- [ ] **Grupos** no painel (agrupar, desagrupar, recolher, olho do grupo; os comandos já existem)
- [ ] "Formas em nova camada" (opção como a do texto)
- [ ] Transformação livre: **distorcer pelos cantos**, perspectiva, **guias de encaixe**, alinhar e distribuir
- [ ] Medir 20 camadas de 4000 × 4000 com `npm run perf`; README e roteiro manual da 0.3

## Desenho (0.4 e depois)

- [ ] **Estabilizador de traço** ajustável (0–100)
- [ ] **Simetria** vertical, horizontal e radial (mandala)
- [ ] **Formas inteligentes**: segurar no fim do traço e ele vira linha, círculo ou retângulo perfeito
- [ ] Régua e guias magnéticas
- [ ] Rotação do canvas (girar a vista, não a imagem)
- [ ] Prévia do traço respeitando as camadas de cima (hoje aparece por cima de tudo durante o gesto)
- [ ] Mais pincéis: textura de papel, borrar/esfumar, misturador de cor
- [ ] Gradiente (linear e radial) e balde com gradiente
- [ ] Texto editável depois de confirmado (camada de texto "viva")
- [ ] Formas vetoriais editáveis depois (camada de forma)
- [ ] Varinha mágica (seleção por cor) e seleção por elipse

## Estilos e efeitos (0.5)

- [ ] **ASCII**: converter camada ou seleção, conjuntos de caracteres, colorido (ANSI/HTML), editar letra por letra, títulos com figlet; exportar .txt, .html e .png
- [ ] **Pixel art**: grade, paletas (Game Boy, NES, PICO-8, CGA), pixelizar foto, papel-cebola
- [ ] **Dithering** retrô, **meio-tom**, mosaico, pontilhismo, vitral, "CRT"
- [ ] Filtros: brilho/contraste, matiz/saturação, curvas, desfoque, nitidez, ruído
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
- [ ] Mais de um documento aberto (abas) e "Arquivos recentes"
- [ ] Definir a **licença** do código e verificar a marca "Rabisco"
- [ ] CI no GitHub (testes a cada envio) e página pública (GitHub Pages) para experimentar
