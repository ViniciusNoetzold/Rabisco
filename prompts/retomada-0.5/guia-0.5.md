## Roteiro manual da 0.5

Use uma imagem colorida, uma camada com transparência e um desenho que possa salvar e reabrir. Use `Ctrl+Z` entre verificações quando precisar recuperar a imagem original.

1. Abra **Início › Imagem › Filtros › Inverter cores**. Segure **Antes/depois**, solte e aplique. Confira que a aplicação gera uma edição no histórico. Desfaça com `Ctrl+Z` e repita com `Ctrl+F`.
2. Faça uma seleção com a varinha. Aplique um filtro de cor e confira que os pixels fora dela ficam iguais. Teste o resultado com **Travar transparência** ligado e aplique outro filtro à máscara de uma camada.
3. Compare **Brilho e contraste** com **Matiz, saturação e luminosidade**. Zere a saturação para obter cinza. Em **Preto e branco**, altere os pesos dos canais. Veja também os controles de **Sépia**, **Limiar** e **Posterizar**.
4. Em **Curvas**, adicione e mova um ponto para mexer nos meios-tons. Desfaça e abra **Níveis**. Use **Amostrar preto** e **Amostrar branco** para escolher os extremos no papel.
5. Aplique desfoque gaussiano junto à borda de um objeto em uma camada transparente. A borda deve preservar a cor do objeto conforme o alfa cai. Em um papel grande, inicie um cálculo pesado e pressione `Esc` durante o processamento. Confira que a imagem e o histórico permanecem iguais após o cancelamento.
6. Mude o ângulo do desfoque de movimento. Compare **Nitidez**, **Reduzir ruído (mediana)**, **Detectar bordas (Sobel)** e **Relevo**. Depois de aplicar **Adicionar ruído**, desfaça e repita para conferir o mesmo resultado com a mesma semente.
7. Abra **Pixelizar** e mude o tamanho dos blocos. Em **Reduzir paleta**, compare **Game Boy**, **NES**, **PICO-8**, **CGA** e a paleta do desenho. Veja o efeito de **Dithering** com a mesma paleta.
8. Abra **Exibir › Pixel art** e ligue **Modo pixel art**. Alterne a grade entre 8, 16 e 32 px. Com zoom alto, desenhe com o lápis de 1 px, ative a simetria e amostre uma célula com o conta-gotas.
9. Em **Salvar como**, exporte PNG com ampliações de 2×, 4× e 8×. Confira as dimensões no arquivo e amplie uma borda para verificar que os blocos têm as mesmas cores do original.
10. Com uma camada ou seleção ativa, use **Filtros › Converter em ASCII**. Mude **Colunas**, compare os quatro conjuntos de caracteres e alterne **Inverter** e **Colorido**. Use **Copiar texto** e abra os arquivos `.txt`, `.html` e `.png` exportados.
11. Crie uma camada de texto ASCII e altere um caractere. Salve e reabra o `.rabisco` para conferir a edição. Faça outra conversão com **Rasterizar em camada** e confira que os pixels entram em uma camada de desenho.
12. Aplique **Dithering** em um gradiente. Compare Floyd–Steinberg, Atkinson e Bayer com a mesma paleta. Varie o tamanho da matriz Bayer e verifique que as cores usadas pertencem à paleta escolhida.
13. Compare os pontos e ângulos de **Meio-tom** com o mesmo desenho em **Mosaico**, **Pontilhismo**, **Vitral** e **CRT**. Desfaça cada aplicação antes de experimentar outro estilo.
14. Crie uma camada de ajuste pelo painel **Camadas**. Edite os parâmetros com duplo clique, oculte a camada, teste opacidade e máscara e salve em `.rabisco`. Reabra o arquivo e edite os parâmetros novamente. Confira o aviso ao salvar como PSD ou ORA e reabra a imagem achatada.
15. Repasse as pendências de desenho. Some e subtraia nas seleções retangular, elíptica e laço. Use o dedo e reconheça uma forma com simetria ligada. Gire a vista com réguas e miniatura visíveis e confira que guias entram no histórico. Em um papel grande, use o balde, confirme o resultado e desfaça.
