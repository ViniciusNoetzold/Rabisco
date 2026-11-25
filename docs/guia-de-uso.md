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
- Em **Arquivo**, abra PNG, JPEG, BMP, GIF (primeiro quadro), WebP ou ICO. Use `Ctrl+S` para salvar PNG. Em **Salvar como** (`Ctrl+Shift+S`), escolha PNG, JPEG, BMP de 24 bits, GIF ou WebP. JPEG e WebP têm controle de qualidade. O diálogo indica perdas de transparência ou cores.
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
