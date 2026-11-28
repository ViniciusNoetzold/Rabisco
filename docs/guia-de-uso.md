# Guia de uso do Rabisco

Tudo o que dá para fazer hoje, ferramenta por ferramenta. Visão geral e instalação no [README](../README.md).

## Camadas e colagem (0.3)

- O painel **Camadas** fica em Meu ateliê, com a camada de cima primeiro. Clique para ativar, use o olho para mostrar ou ocultar (Alt+clique mostra só ela), o cadeado para bloquear e um duplo clique (ou F2) para renomear. Arraste uma camada para reordenar.
- Abaixo da lista ficam a opacidade, o modo de mesclagem (16 modos), **Travar transparência** (pinta só onde já há pixel) e **Recortar pela de baixo** (máscara de recorte).
- **Nova** (Ctrl+Shift+N), **Duplicar** (Ctrl+J), **Mesclar** com a de baixo (Ctrl+Shift+M), **Excluir** e Ctrl+[ / Ctrl+] para subir ou descer. Tudo entra no histórico.
- **Máscara**: cria uma máscara em tons de cinza (branco revela, preto esconde). Com uma seleção, só a área selecionada fica visível. Clique na miniatura da máscara para pintar nela e use Shift+clique para ligar ou desligar.
- **Efeitos e máscara**: contorno (por fora ou por dentro) e sombra, que dá para mudar a qualquer momento. **✨ Virar adesivo** aplica contorno branco e sombra suave num clique.
- Imagens coladas (Ctrl+V) ou arrastadas flutuam para posicionar e viram uma **camada nova** ao confirmar. Ctrl+Shift+V cola na camada atual. Várias imagens soltas de uma vez viram uma camada cada.
- **Grupos:** **Agrupar** (Ctrl+G) põe a camada ativa num grupo; arraste outras camadas para dentro. No cabeçalho do grupo: setinha para recolher, olho para ocultar o grupo todo, duplo clique para renomear e ⊘ para desagrupar.
- **Formas em nova camada:** marque a opção no painel de Camadas e cada forma confirmada ganha uma camada própria.
- **Mover (V)** arrasta a camada inteira. **Transformação livre (Ctrl+T)**: arraste por dentro para mover, as alças para escalar (Shift mantém a proporção) e a bolinha de cima para girar (Shift de 15° em 15°). **Ctrl+arraste num canto distorce** (só aquele canto anda). Ao mover, a camada **encaixa** nas bordas e no centro do papel e das outras camadas (linha magenta; Shift solta; a aba Exibir desliga). Enter confirma, Esc cancela.
- **Salvar com camadas:** Ctrl+S salva o desenho inteiro em **.rabisco** (camadas, grupos, máscaras, efeitos). Em **Salvar como** (Ctrl+Shift+S) há também **PSD** (Photoshop/Photopea), **ORA** (Krita, GIMP, MyPaint) e "Cada camada em PNG (.zip)". **Abrir** (Ctrl+O) aceita esses três formatos além das imagens. Os 10 últimos arquivos ficam em **Arquivo › Recentes**.
- A borracha apaga para transparência nas camadas novas e pinta a Cor 2 no Papel. O texto entra numa camada própria (dá para desligar na aba Texto). Balde e conta-gotas podem **amostrar todas as camadas**. **Copiar mesclado** (Ctrl+Shift+C) copia o que se vê.

## Desenhar fácil (0.4)

- **Estabilizar** (cartão "Seu traço", ou Alt+[ / Alt+]): o pincel segue o ponteiro como se puxado por uma corda; quanto maior o valor, mais o tremor da mão some. A corda tracejada aparece enquanto você desenha. **Suavizar** arredonda ainda mais as curvas. "Terminar onde a mão parou" leva o fim do traço até o ponteiro.
- **Pressão** (cartão "Seu traço"): a curva da caneta escolhe se um toque leve já pinta cheio (suave) ou se é preciso apertar (firme). No mouse e no toque, "Simular pressão pela velocidade" afina o traço rápido. **Afinar pontas** deixa o começo e o fim de cada pincelada finos, como numa pincelada de verdade.
- **Simetria** (aba Exibir, ou `Shift+S`): repete o lápis, os pincéis, o spray, as borrachas, o dedo e as formas inteligentes. Escolha esquerda/direita, cima/baixo, quatro quadrantes ou **radial** com 2 a 24 fatias. Marque **Caleidoscópio** para espelhar dentro de cada fatia. Arraste a bolinha roxa para mudar o centro (`Shift` prende no meio do papel) e use **Centralizar no papel** para voltar. Um `Ctrl+Z` desfaz todas as cópias do traço.
- **Formas inteligentes** (ícone ao lado do campo de espessura, ou cartão "Seu traço"): termine um traço de lápis ou pincel e **segure parado** meio segundo. Se parecer uma linha, círculo, elipse, retângulo, quadrado, triângulo, seta ou polígono, ele vira essa forma certinha, com alças para ajustar. `Enter` confirma, `Esc` devolve o traço como você desenhou. Soltar logo deixa o traço como está.
- **Régua de desenho** (`Shift+R`, ou aba Exibir › Régua e guias): posicione a régua arrastando a bolinha do meio e gire pelas pontas (`Shift` prende de 15 em 15°). Comece o traço perto da borda e ele sai reto, mesmo com a mão tremendo.
- **Guias**. Ligue as réguas (`Ctrl+R`) e arraste a partir delas para o papel. Seleções, formas e a transformação livre encaixam nas guias. Use **Mover** (`V`) para mudar a posição de uma guia. Arraste-a para fora do papel para remover ou use **Limpar guias**. As guias entram no histórico e no arquivo `.rabisco`. As réguas laterais e a miniatura ficam disponíveis com a vista girada.
- **Girar e espelhar a vista** (só a tela, nunca a imagem): segure `R` e arraste no papel para girar como uma folha na mesa; `4` e `6` giram de 15 em 15°, `5` volta a 0°; no toque, gire dois dedos. `H` espelha a vista para conferir proporções. O ângulo aparece na barra de baixo; clique nele para voltar ao normal.
- **Gradiente** (`G`): arraste do ponto da Cor 1 ao da Cor 2. Escolha linear ou radial e, se quiser, "Até transparente". Com uma seleção, ele fica só dentro dela.
- **Varinha mágica** (`W`): clique numa cor para selecionar a área dela. `Shift` + clique soma outra área, `Alt` + clique tira. A tolerância é a mesma do balde.
- **Seleção elíptica** (menu Seleção). Arraste para selecionar uma elipse. Pressione `Shift` durante o arraste para obter um círculo. Com uma seleção ativa, segure `Shift` antes de iniciar outro arraste para somar ou `Alt` para subtrair. A combinação funciona no retângulo, na elipse e no laço.
- **Dedo (borrar)** (galeria de pincéis): esfuma e arrasta as cores como o dedo no carvão. A "Força" diz o quanto ele arrasta.
- **Toque e caneta**: com caneta, a mão apoiada na tela não risca. Dois dedos tocando desfazem, três refazem.

## Filtros (0.5)

- Em **Início › Filtros**, escolha **Inverter cores**. A prévia aparece no papel com as outras camadas na ordem em que estão.
- Segure **Antes/depois** para ver o original e solte para voltar à prévia. Clique em **Aplicar** para confirmar ou use **Cancelar** ou `Esc` para fechar a janela. Em papéis grandes, **Aplicando…** indica que o cálculo ainda está em andamento.
- O filtro atua na camada ativa ou na máscara em edição. Uma seleção limita a área afetada. **Travar transparência** preserva o alfa da camada. Use `Ctrl+Z` para desfazer a aplicação e `Ctrl+F` para repetir o último filtro aplicado na sessão sobre o alvo atual.
- Em **Curvas**, clique no gráfico ou em **Adicionar ponto**. Arraste os pontos ou ajuste **Entrada** e **Saída** para remapear os tons. Com um ponto em foco, use as setas para mover de um em um, ou `Shift` para mover de dez em dez.
- Em **Níveis**, ajuste os extremos e o gama. **Amostrar preto** e **Amostrar branco** mostram o original enquanto você escolhe no papel o que deve virar preto ou branco.
- **Matiz, saturação e luminosidade** controla as cores e o brilho. **Preto e branco** permite misturar os canais. **Sépia**, **Limiar** e **Posterizar** convertem as cores com a intensidade, o limite ou a quantidade de níveis escolhidos.
- Em **Desfoque**, ajuste o raio do gaussiano ou o raio e o ângulo do desfoque de movimento. Em **Detalhes**, use **Nitidez**, **Adicionar ruído**, **Reduzir ruído (mediana)**, **Detectar bordas (Sobel)** ou **Relevo**. Os pixels vizinhos ajudam no cálculo das bordas sem ampliar a seleção.

## Estilos artísticos (0.5)

- Em **Início › Imagem › Filtros › Estilos**, escolha **Dithering** para limitar a imagem a 2–16 cores. Floyd–Steinberg e Atkinson espalham o erro de cor. Bayer faz um padrão regular de 2 × 2, 4 × 4 ou 8 × 8.
- **Meio-tom** cria uma trama de pontos com ângulo e tamanho ajustáveis em uma cor ou em CMYK. **Mosaico**, **Pontilhismo** e **Vitral** dão formas diferentes às áreas de cor. **CRT** acrescenta linhas e separação de canais.

## ASCII (0.5)

- Abra **Início › Imagem › Filtros › Converter em ASCII**. Se houver uma seleção, o conversor usa a região selecionada. Ajuste as **Colunas**, escolha o conjunto de caracteres e use **Inverter** ou **Colorido** para comparar o resultado na prévia.
- **Criar camada de texto** mantém os caracteres para editar. Selecione a nova camada e clique em **Editar ASCII** no painel de camadas. O texto editável vai junto no arquivo `.rabisco`.
- **Rasterizar em camada** cria pixels para as ferramentas de desenho. **Copiar texto** leva os caracteres à área de transferência. **Exportar** oferece `.txt`, HTML com as cores da prévia e PNG.

## Pixel art (0.5)

- Abra **Início › Imagem › Filtros › Pixelizar** para trocar cada bloco por uma cor. **Reduzir paleta** usa Game Boy, NES, PICO-8, CGA ou uma paleta com as cores do desenho. Marque **Dithering** para distribuir o erro de cor.
- Em **Exibir › Pixel art**, ligue **Modo pixel art** e escolha a grade de 8, 16 ou 32 px. O lápis desenha pixels inteiros de 1 px. A simetria espelha o traço, e o conta-gotas lê um pixel exato.
- Em **Salvar como**, escolha um formato de imagem e **Ampliação** de 2×, 4× ou 8×. A exportação mantém os pixels quadrados.

## Camadas de ajuste (0.5)

- Em **Camadas**, clique em **Nova camada de ajuste**. Escolha **Brilho e contraste**, **Matiz, saturação e luminosidade**, **Curvas** ou **Preto e branco**. Confira a prévia no papel e clique em **Aplicar ajuste**.
- Use **Editar ajuste** ou dê duplo clique no nome da camada para mudar os parâmetros. Controle o efeito com a opacidade e a máscara. Dentro de um grupo, o ajuste atua no conteúdo daquele grupo.
- Salve em **.rabisco** para editar os parâmetros depois. O formato v3 guarda os ajustes, e o Rabisco lê os arquivos v1 e v2. Para PSD, ORA ou o ZIP de PNGs, o diálogo avisa que a exportação de um documento com ajuste gera uma imagem achatada.

## Ferramentas clássicas

- Escolha lápis, pincel, borracha, balde, linha, retângulo, elipse, seleção ou conta-gotas.
- Abra **Pincéis** para escolher entre redondo, duas caligrafias, aerógrafo, óleo, giz de cera, marcador, lápis natural e aquarela. Ajuste a espessura entre 1 e 100 px pelo campo numérico ou pelas teclas `[` e `]`.
- Pressione `A` para usar o **Aerógrafo / Spray**. Escolha o tamanho e a densidade e mantenha o botão do mouse pressionado para acumular tinta. A pressão da caneta muda a espessura ou a opacidade, conforme o pincel.
- Abra **Mais formas** para escolher entre formas básicas, setas, estrelas, balões e símbolos. Arraste para desenhar. Use as oito alças para ajustar o tamanho, a alça externa para girar e o interior da área para mover. Altere contorno (Cor 1), preenchimento (Cor 2) ou espessura enquanto a forma está selecionada. `Enter` confirma, `Esc` descarta. Um clique fora da forma no papel ou a troca de ferramenta também confirma.
- Em **Mais formas → Criar forma…**, ajuste um modelo paramétrico, desenhe um contorno com pontos ou use a forma ativa, a última forma ou a silhueta aproximada da seleção no papel. Salve com um nome, uma pasta e estilo opcional. Para rever a geometria de uma predefinição salva, abra seus pontos e curvas no editor.
- Em **Gerenciar formas**, renomeie, duplique, edite, exclua, reordene ou marque suas favoritas. As favoritas aparecem primeiro na galeria. Exporte e importe a biblioteca em arquivos `.rabisco-formas.json` para levá-la a outro navegador. A biblioteca local comporta 100 formas e a importação aceita arquivos de até 1 MiB.
- Para desenhar uma **Curva**, arraste a linha inicial e depois indique até dois pontos de controle. No **Polígono livre**, clique nos vértices e feche com um clique no primeiro ponto ou com duplo clique. Use `Shift` para restringir o ângulo.
- Clique na paleta para escolher a cor ativa. Cor 1 usa o botão esquerdo; Cor 2 usa o direito. A tecla `X` troca as duas cores.
- Arraste no papel para desenhar ou selecionar. Use `Shift` para restringir formas.
- Em **Opções de seleção**, escolha o laço (`L`), selecione tudo, inverta, exclua ou ative **Seleção transparente** para ignorar a Cor 2. Arraste por dentro da seleção para movê-la e pelas alças para redimensioná-la. `Shift` mantém a proporção ao redimensionar. `Ctrl` e arraste duplica. As setas movem 1 px, ou 10 px com `Shift`.
- Pressione `T` para digitar no papel. A aba **Texto** reúne fontes do sistema e Selawik, tamanho, estilos e fundo. Arraste a caixa pela alça e clique fora para confirmar. `Esc` abandona o rascunho.
- A borracha (`E`) mostra o contorno da área apagada. O botão esquerdo usa a Cor 2 e o direito substitui apenas a Cor 1 pela Cor 2. O balde (`F`) tem ajuste de tolerância e modo de preencher toda a imagem. O conta-gotas (`I`) usa o botão esquerdo para Cor 1 e o direito para Cor 2.
- Use `Ctrl` e a roda para aproximar no ponto do cursor, a pinça no touchpad ou tela sensível ao toque e a lupa (`Z`) com clique esquerdo para ampliar e direito para reduzir. A barra de status oferece níveis de 12,5% a 800%. A grade por pixel aparece a partir de 400%.
- Para deslocar o papel, segure `Espaço` e arraste, use o botão do meio, dois dedos ou a miniatura da aba **Exibir**. Alterne réguas com `Ctrl+R`, grade com `Ctrl+'` e tela inteira com `F11`. Pressione `Esc` para voltar da tela inteira.
- Arraste a alça da direita, da base ou do canto para aumentar ou cortar o papel. A área nova recebe a Cor 2. Use `Shift` para manter a proporção e `Esc` para cancelar.
- Abra **Propriedades da imagem** (`Ctrl+E`) para definir o tamanho em pixels, centímetros ou polegadas e ajustar a resolução (96 DPI por padrão). O diálogo mostra a memória ocupada pelos pixels e permite escolher a cor da área nova.
- Abra **Redimensionar e inclinar** (`Ctrl+W`) para reamostrar em pixels ou porcentagem e inclinar até 89° em cada eixo. Use **Girar** para girar 90° ou 180° ou inverter em um dos eixos. Essas operações se aplicam à seleção quando ela está ativa, ou à imagem inteira.
- Em **Arquivo**, abra PNG, JPEG, BMP, GIF (primeiro quadro), WebP ou ICO. Use `Ctrl+S` para salvar o `.rabisco` com suas camadas. Em **Salvar como** (`Ctrl+Shift+S`), escolha PNG, JPEG, BMP de 24 bits, GIF ou WebP. JPEG e WebP têm controle de qualidade. O diálogo indica perdas de transparência ou cores.
- Use `Ctrl+V`, **Colar** ou **Colar de…** para inserir uma imagem. Você também pode arrastar um arquivo para a janela. Reposicione a imagem pela seleção e confirme com `Enter`. Quando a imagem for maior que o papel, escolha se deseja ampliar o papel.
- Em **Editar cores**, use o espectro, HSL, RGB ou hexadecimal. Salve até 16 cores personalizadas neste navegador.
- Pressione `Ctrl+P` para imprimir. Escolha orientação, ajuste à página e centralização. A aba de ajuda **Uma ajudinha?** lista os atalhos.
- O trabalho é salvo automaticamente neste navegador, em IndexedDB. Aguarde a indicação de salvamento antes de fechar a aba. O tamanho e a resolução também são guardados no autosave e no PNG.

## Roteiro manual de 10 minutos

1. Trace com o pincel, desfaça e refaça. Confira a edição única no histórico.
2. Aumente o papel pela alça do canto com `Shift`. Confira a Cor 2 na área nova e desfaça.
3. Altere o DPI em **Propriedades da imagem**, gire a folha e teste **Redimensionar e inclinar**.
4. Teste um pincel texturizado e mantenha o aerógrafo pressionado por um segundo.
5. Desenhe uma estrela da galeria. Mova, redimensione e gire antes de apertar `Enter`.
6. Salve uma estrela própria de sete pontas. Recarregue, desenhe com ela e exporte a biblioteca.
7. Contorne parte de um desenho com o laço. Mova a seleção com as setas e duplique com `Ctrl` e arraste.
8. Ative **Seleção transparente** e mova uma região com fundo da Cor 2 sobre outra tinta.
9. Digite “Café” e “Ação” em duas linhas. Mova a caixa, formate e clique fora.
10. Passe a borracha sobre duas cores. Confira o contorno, mude a espessura e apague pela Cor 1 com o botão direito.
11. Ajuste a tolerância do balde, preencha áreas separadas e capture uma cor com o conta-gotas.
12. Faça zoom com `Ctrl` e a roda. Use `Espaço` e arraste, ative a régua e mova a miniatura. Entre e saia da tela inteira.
13. Cole uma imagem maior que o papel. Escolha **Sim**, mova a prévia e confirme a colagem.
14. Salve uma cor personalizada. Exporte um arquivo JPEG ou GIF, abra-o e confira o desenho recuperado.
15. Abra a impressão em paisagem e verifique a prévia. Feche-a, aguarde o autosave e recarregue o editor.

Use `npm run perf` para medir o custo dos eventos, da pintura e dos comandos no Edge. O ensaio usa papéis de três tamanhos. A metodologia e os resultados ficam em [Desempenho do Rabisco](docs/desempenho.md).

## Limites

- Imagens de 1 a 8192 px por lado, com até 40 milhões de pixels. A importação PNG aceita arquivos de até 20 MiB. JPEG, GIF, WebP e ICO aceitam até 64 MiB. O limite do BMP considera o tamanho do bitmap sem compressão.
- O histórico guarda os pixels da área afetada e descarta comandos antigos ao atingir 128 MiB. Quando uma única edição ultrapassa esse orçamento, ela permanece disponível para desfazer.
- O autosave guarda o último documento neste navegador, em blocos de 256 × 256 px: grava só o que mudou, 800 ms depois da última edição, e na hora quando a aba é ocultada ou fechada. Limpar os dados do site também remove desenho, formas próprias e cores personalizadas.
- A primeira pincelada depois de criar ou abrir um papel grande tem um atraso único (127 ms em 4000 × 4000), e o balde no papel inteiro leva cerca de 1 s em 4000 × 4000. Os dois estão registrados como pendências em [docs/desempenho.md](docs/desempenho.md).
- A leitura e a escrita diretas na área de transferência do sistema exigem HTTPS ou localhost e permissão do navegador. Na prévia HTTP da rede, use `Ctrl+V`, **Colar de…** ou arraste o arquivo. O botão **Colar** também usa a cópia interna.
- Instalação PWA, camadas múltiplas, IA, efeitos e Tauri estão no roteiro. A área de texto é editável até a confirmação, quando vira pixels no papel.

## Roteiro manual da 0.3 (10 minutos)

1. Crie três camadas (Ctrl+Shift+N), pinte em cada uma e renomeie com duplo clique.
2. Oculte e mostre uma camada; Alt+clique no olho para ver só ela.
3. Mude o modo de uma camada para Multiplicar e a opacidade para 50%.
4. Arraste uma camada para baixo de outra na lista e desfaça.
5. Faça uma seleção com o laço e clique em **Máscara**; pinte de preto na máscara e veja sumir.
6. Arraste três fotos de uma vez para a janela: cada uma vira uma camada.
7. Numa foto, **✨ Virar adesivo**; noutra, Ctrl+T para escalar, girar e, com Ctrl, distorcer um canto. Veja a linha magenta ao passar pelo centro.
8. Agrupe duas camadas (Ctrl+G), recolha o grupo e oculte-o pelo olho do cabeçalho.
9. Digite um texto e confira que ele ganhou uma camada própria.
10. **Alinhar ao papel › Ao centro** na camada ativa.
11. Ctrl+S: salve o `.rabisco`. Crie um desenho novo e reabra pelo menu **Arquivo › Recentes**.
12. Em **Salvar como**, salve em PSD e em ORA e abra os dois de novo (ou no Photopea / Krita).
13. Exporte **Cada camada em PNG** e confira o `.zip`.
14. Mescle duas camadas (Ctrl+Shift+M) e desfaça.
15. Recarregue a página: as camadas voltam do autosave.

## Roteiro manual da 0.4 (10 minutos)

1. No cartão "Seu traço", ponha **Estabilizar** em 40 e faça uma linha tremida: ela sai lisa, com a corda tracejada.
2. Ligue **Simular pressão pela velocidade** e **Afinar pontas**: um traço rápido sai fino, com pontas finas.
3. `Shift+S` liga a simetria; na aba Exibir, escolha **Radial**, 8 fatias e **Caleidoscópio**, e desenhe uma mandala. Um `Ctrl+Z` desfaz todas as cópias.
4. Arraste a bolinha roxa do centro da simetria e use **Centralizar no papel**.
5. Com o lápis, desenhe um círculo torto e **segure parado** no fim: vira um círculo certinho. `Esc` volta ao traço; refaça e confirme com `Enter`.
6. Faça um retângulo e uma seta à mão, segurando no fim.
7. `Shift+R` mostra a régua; gire pela ponta e desenhe começando perto da borda: o traço sai reto.
8. `Ctrl+R` e arraste da régua de cima uma guia; desenhe um retângulo perto dela e veja encaixar.
9. Segure `R` e arraste no papel para girar a vista; desenhe; `5` volta a 0°. `H` espelha a vista.
10. Numa camada de baixo, pinte embaixo de uma camada de cima: a prévia já aparece atrás dela.
11. `G`: arraste um gradiente radial dentro de uma seleção elíptica (menu Seleção).
12. `W`: clique numa cor com a varinha; `Shift`+clique em outra área para somar, `Alt` para tirar; `Delete`.
13. Na galeria de pincéis, escolha **Dedo (borrar)** e esfume uma borda.
14. Crie três camadas com um desenho em cada, escolha as três com `Ctrl`+clique e **Distribuir ↔**.
15. Num papel 4000 × 4000, use o balde. Se a operação demorar, confira o indicador **Preenchendo…**. Depois de concluir, desfaça com `Ctrl+Z`.

## Roteiro manual da 0.5

Use uma imagem colorida, uma camada com transparência e um desenho que possa salvar e reabrir. Use `Ctrl+Z` entre verificações para recuperar a imagem original.

1. Abra **Início › Imagem › Filtros › Inverter cores**. Segure **Antes/depois**, solte e aplique. Confira que a aplicação gera uma edição no histórico. Desfaça com `Ctrl+Z` e repita com `Ctrl+F`.
2. Faça uma seleção com a varinha. Aplique um filtro de cor e confira os pixels fora da seleção. Teste com **Travar transparência** ligado e aplique outro filtro à máscara de uma camada.
3. Compare **Brilho e contraste** com **Matiz, saturação e luminosidade**. Zere a saturação para obter cinza. Em **Preto e branco**, altere os pesos dos canais. Veja também **Sépia**, **Limiar** e **Posterizar**.
4. Em **Curvas**, adicione e mova um ponto para mudar os meios-tons. Desfaça e abra **Níveis**. Use **Amostrar preto** e **Amostrar branco** para escolher os extremos no papel.
5. Aplique desfoque gaussiano na borda de um objeto em camada transparente. A borda deve preservar a cor conforme o alfa cai. Em um papel grande, inicie um cálculo e pressione `Esc` durante o processamento. Confira a imagem e o histórico após cancelar.
6. Mude o ângulo do desfoque de movimento. Compare **Nitidez**, **Reduzir ruído (mediana)**, **Detectar bordas (Sobel)** e **Relevo**. Depois de aplicar **Adicionar ruído**, desfaça e repita para conferir a mesma distribuição de ruído.
7. Abra **Pixelizar** e mude o tamanho dos blocos. Em **Reduzir paleta**, compare **Game Boy**, **NES**, **PICO-8**, **CGA** e a paleta do desenho. Veja o efeito de **Dithering** com a mesma paleta.
8. Abra **Exibir › Pixel art** e ligue **Modo pixel art**. Alterne a grade entre 8, 16 e 32 px. Com zoom alto, desenhe com o lápis de 1 px, ative a simetria e amostre um pixel com o conta-gotas.
9. Em **Salvar como**, exporte PNG com ampliações de 2×, 4× e 8×. Confira as dimensões e amplie uma borda para verificar que os pixels mantêm as cores do original.
10. Com uma camada ou seleção ativa, use **Filtros › Converter em ASCII**. Mude **Colunas**, compare os quatro conjuntos de caracteres e alterne **Inverter** e **Colorido**. Use **Copiar texto** e abra os arquivos `.txt`, `.html` e `.png` exportados.
11. Crie uma camada de texto ASCII e altere um caractere com **Editar ASCII** no painel Camadas. Salve e reabra o `.rabisco`. Faça outra conversão com **Rasterizar em camada** e confira os pixels na camada criada.
12. Aplique **Dithering** em um gradiente. Compare Floyd–Steinberg, Atkinson e Bayer com a mesma paleta. Varie a matriz Bayer e confira que as cores usadas pertencem à paleta escolhida.
13. Ajuste o tamanho dos pontos e o ângulo em **Meio-tom**. Compare o mesmo desenho em **Mosaico**, **Pontilhismo**, **Vitral** e **CRT**, desfazendo cada aplicação entre estilos.
14. Crie uma camada de ajuste em **Camadas**. Use duplo clique no nome para editar, alterne a visibilidade, teste opacidade e máscara. Salve em `.rabisco`, reabra e edite os parâmetros. Confira o aviso ao salvar como PSD ou ORA e reabra a imagem achatada.
15. Some e subtraia nas seleções retangular, elíptica e de laço. Use o dedo e reconheça uma forma com simetria ligada. Gire a vista com réguas e miniatura visíveis. Crie, mova e desfaça uma guia. Em um papel grande, aplique o balde e desfaça depois de concluir.
