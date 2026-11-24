# Rabisco

Editor de desenho local em português, com interface inspirada nos editores gráficos da era Aero. A versão 0.2 foi concluída e validada em 24 de novembro de 2026. O [roteiro](ROADMAP.md) acompanha as próximas versões.

## Executar

Requer Node.js 20.19+ ou 22.12+ e npm.

```powershell
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite. Para gerar e servir a distribuição:

```powershell
npm run build
npm run preview
```

Para acompanhar mudanças em um servidor estático que já serve `dist/`, execute `npm run preview:rede:atualizar` em outro terminal. O observador publica cada build concluído. A aba já aberta pode precisar de uma primeira atualização para habilitar a recarga automática. Cada recarga recupera o último desenho salvo no navegador. O histórico da sessão recomeça.

## Usar

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
- Para deslocar o papel, segure `Espaço` e arraste, use o botão do meio, dois dedos ou a miniatura da aba **Exibir**. Alterne réguas com `Ctrl+R`, grade com `Ctrl+G` e tela inteira com `F11`. Pressione `Esc` para voltar da tela inteira.
- Arraste a alça da direita, da base ou do canto para aumentar ou cortar o papel. A área nova recebe a Cor 2. Use `Shift` para manter a proporção e `Esc` para cancelar.
- Abra **Propriedades da imagem** (`Ctrl+E`) para definir o tamanho em pixels, centímetros ou polegadas e ajustar a resolução (96 DPI por padrão). O diálogo mostra a memória ocupada pelos pixels e permite escolher a cor da área nova.
- Abra **Redimensionar e inclinar** (`Ctrl+W`) para reamostrar em pixels ou porcentagem e inclinar até 89° em cada eixo. Use **Girar** para girar 90° ou 180° ou inverter em um dos eixos. Essas operações se aplicam à seleção quando ela está ativa, ou à imagem inteira.
- Em **Arquivo**, abra PNG, JPEG, BMP, GIF (primeiro quadro), WebP ou ICO. Use `Ctrl+S` para salvar PNG. Em **Salvar como** (`Ctrl+Shift+S`), escolha PNG, JPEG, BMP de 24 bits, GIF ou WebP. JPEG e WebP têm controle de qualidade. O diálogo indica perdas de transparência ou cores.
- Use `Ctrl+V`, **Colar** ou **Colar de…** para inserir uma imagem. Você também pode arrastar um arquivo para a janela. Reposicione a imagem pela seleção e confirme com `Enter`. Quando a imagem for maior que o papel, escolha se deseja ampliar o papel.
- Em **Editar cores**, use o espectro, HSL, RGB ou hexadecimal. Salve até 16 cores personalizadas neste navegador.
- Pressione `Ctrl+P` para imprimir. Escolha orientação, ajuste à página e centralização. A aba de ajuda **Uma ajudinha?** lista os atalhos.
- O trabalho é salvo automaticamente neste navegador, em IndexedDB. Aguarde a indicação de salvamento antes de fechar a aba. O tamanho e a resolução também são guardados no autosave e no PNG.

Os arquivos e desenhos permanecem no dispositivo. Nesta versão não há chamadas de IA, serviços de nuvem ou telemetria.

## Verificar

```powershell
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam Playwright com o Edge instalado no Windows, como nesta validação.
Para usar o Chromium fornecido pelo Playwright em outra máquina:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run test:e2e
```

### Roteiro manual de 10 minutos

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

No ensaio isolado de uma pincelada em um papel de 4000 × 4000 px, o Edge registrou 179 intervalos entre quadros durante o gesto. A média foi de 16,67 ms, com p95 de 16,80 ms.

## Organização

```text
src/
  app/        Interface, estado, diálogos e atalhos
  canvas/     Superfície, coordenadas e controle dos gestos
  commands/   Comandos serializáveis, execução e histórico por área
  document/   Documento, camada ativa e composição da tela
  io/         Arquivos de imagem, área de transferência e impressão
  layers/     Tipos do documento
  storage/    Persistência local em IndexedDB
  tools/      Ferramentas, registro e operações de pixels
tests/
  unit/       Testes do núcleo
  e2e/        Fluxos no navegador
public/
  fonts/      Selawik e licença OFL
  icons/      Subconjunto Fugue e licença CC BY 3.0
```

O documento tem uma camada raster editável, composta em uma tela separada. O registro fornece as ferramentas e seus atalhos. Cada edição confirmada executa um comando JSON e grava os pixels da área afetada no histórico. O autosave reutiliza o buffer de pixels do documento.

## Limites desta entrega

- Imagens de 1 a 8192 px por lado, com até 40 milhões de pixels. A importação PNG aceita arquivos de até 20 MiB. JPEG, GIF, WebP e ICO aceitam até 64 MiB. O limite do BMP considera o tamanho do bitmap sem compressão.
- O histórico guarda os pixels da área afetada e descarta comandos antigos ao atingir 128 MiB. Quando uma única edição ultrapassa esse orçamento, ela permanece disponível para desfazer.
- O autosave guarda o último documento neste navegador. Limpar os dados do site também remove desenho, formas próprias e cores personalizadas.
- A leitura e a escrita diretas na área de transferência do sistema exigem HTTPS ou localhost e permissão do navegador. Na prévia HTTP da rede, use `Ctrl+V`, **Colar de…** ou arraste o arquivo. O botão **Colar** também usa a cópia interna.
- Instalação PWA, camadas múltiplas, IA, efeitos e Tauri estão no roteiro. A área de texto é editável até a confirmação, quando vira pixels no papel.

## Créditos e licença

Veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e a tela **Sobre**. Selawik é uma fonte livre sob OFL; os ícones Fugue são de Yusuke Kamiyamane, sob CC BY 3.0. O logotipo do Rabisco é original.

A licença do código do projeto será escolhida pela pessoa responsável. Nenhuma licença de código foi presumida nesta entrega.
