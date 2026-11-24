# Rabisco

Editor de desenho local em português, com interface inspirada nos editores gráficos da era Aero. O MVP 0.1 está concluído. O [roteiro](ROADMAP.md) acompanha os passos da versão 0.2.

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
- Arraste a alça da direita, da base ou do canto para aumentar ou cortar o papel. A área nova recebe a Cor 2. Use `Shift` para manter a proporção e `Esc` para cancelar.
- Abra **Propriedades da imagem** (`Ctrl+E`) para definir o tamanho em pixels, centímetros ou polegadas e ajustar a resolução (96 DPI por padrão). O diálogo mostra a memória ocupada pelos pixels e permite escolher a cor da área nova.
- Abra **Redimensionar e inclinar** (`Ctrl+W`) para reamostrar em pixels ou porcentagem e inclinar até 89° em cada eixo. Use **Girar** para girar 90° ou 180° ou inverter em um dos eixos. Essas operações se aplicam à seleção quando ela está ativa, ou à imagem inteira.
- Use **Arquivo** para criar um desenho, abrir um PNG e salvar uma cópia em PNG.
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

Verificação manual recomendada:

1. Faça um traço, uma forma fechada e preencha seu interior com o balde.
2. Troque Cor 1 e Cor 2; faça um traço com cada botão do mouse.
3. Desfaça e refaça. Faça uma seleção, recorte e confira o histórico.
4. Salve PNG, abra esse arquivo e confira o resultado.
5. Desenhe novamente, aguarde o salvamento automático e recarregue a página.
6. Navegue pelas ferramentas usando o teclado e confira o foco visível.
7. Aumente o papel pela alça do canto, confira a Cor 2 na área nova e desfaça a edição.
8. Em **Propriedades da imagem**, altere o tamanho e a resolução. Faça uma seleção e experimente **Redimensionar e inclinar** e **Girar**. Recarregue após o autosave e confira as dimensões e o DPI.

## Organização

```text
src/
  app/        Interface, estado, diálogos e atalhos
  canvas/     Superfície, coordenadas e controle dos gestos
  commands/   Comandos serializáveis, execução e histórico por área
  document/   Documento, camada ativa e composição da tela
  io/         Importação e exportação PNG
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

- Imagens de 1 a 8192 px por lado, com até 40 milhões de pixels. A importação PNG aceita arquivos de até 20 MiB.
- O histórico guarda os pixels da área afetada e descarta comandos antigos ao atingir 128 MiB. Quando uma única edição ultrapassa esse orçamento, ela permanece disponível para desfazer.
- O autosave é uma recuperação local do último documento, não um backup. Limpar dados do navegador também remove o trabalho salvo.
- Depois de carregado, desenhar, salvar PNG e recuperar dados locais dispensam conexão. Instalação PWA e abertura offline garantida após fechar o navegador ficam para a versão 1.0.
- Camadas múltiplas, texto, IA, efeitos e Tauri ainda não fazem parte do MVP. O alvo de desempenho de 4000 × 4000 com 20 camadas será medido nas etapas do motor e de performance; não é uma garantia desta versão.

## Créditos e licença

Veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e a tela **Sobre**. Selawik é uma fonte livre sob OFL; os ícones Fugue são de Yusuke Kamiyamane, sob CC BY 3.0. O logotipo do Rabisco é original.

A licença do código do projeto será escolhida pela pessoa responsável. Nenhuma licença de código foi presumida nesta entrega.
