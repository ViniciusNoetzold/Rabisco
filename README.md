# Rabisco

Editor de desenho local em português, com interface inspirada nos editores gráficos da era Aero. Esta entrega implementa a etapa **MVP 0.1** do roteiro em [ROADMAP.md](ROADMAP.md).

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

## Usar

- Escolha lápis, pincel, borracha, balde, linha, retângulo, elipse, seleção ou conta-gotas.
- Clique na paleta para escolher a cor ativa. Cor 1 usa o botão esquerdo; Cor 2 usa o direito. A tecla `X` troca as duas cores.
- Arraste no papel para desenhar ou selecionar. Use `Shift` para restringir formas.
- Use **Arquivo** para criar um desenho, abrir um PNG e salvar uma cópia em PNG.
- O trabalho é salvo automaticamente neste navegador, em IndexedDB. Aguarde a indicação de salvamento antes de fechar a aba.

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

## Organização

```text
src/
  app/        Interface, estado, diálogos e atalhos
  canvas/     Superfície de desenho e coordenadas
  commands/   Histórico desfazer/refazer
  io/         Importação e exportação PNG
  layers/     Tipos do documento
  storage/    Persistência local em IndexedDB
  tools/      Operações de pixels
tests/
  unit/       Testes do núcleo
  e2e/        Fluxos no navegador
public/
  fonts/      Selawik e licença OFL
  icons/      Subconjunto Fugue e licença CC BY 3.0
```

O documento raster tem uma superfície nesta etapa. A interface e os comandos estão separados das operações de pixels para permitir evolução do motor nas próximas versões.

## Limites desta entrega

- Importação PNG com até 20 MiB, dimensões de até 4096 × 4096 e limite de aproximadamente 16 milhões de pixels.
- Histórico com orçamento de 128 MiB, guardando retângulos alterados; comandos antigos são descartados quando esse orçamento é atingido.
- O autosave é uma recuperação local do último documento, não um backup. Limpar dados do navegador também remove o trabalho salvo.
- Depois de carregado, desenhar, salvar PNG e recuperar dados locais dispensam conexão. Instalação PWA e abertura offline garantida após fechar o navegador ficam para a versão 1.0.
- Camadas múltiplas, texto, IA, efeitos e Tauri ainda não fazem parte do MVP. O alvo de desempenho de 4000 × 4000 com 20 camadas será medido nas etapas do motor e de performance; não é uma garantia desta versão.

## Créditos e licença

Veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e a tela **Sobre**. Selawik é uma fonte livre sob OFL; os ícones Fugue são de Yusuke Kamiyamane, sob CC BY 3.0. O logotipo do Rabisco é original.

A licença do código do projeto será escolhida pela pessoa responsável. Nenhuma licença de código foi presumida nesta entrega.
