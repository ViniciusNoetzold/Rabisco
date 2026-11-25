# Desempenho do Rabisco

Execute o ensaio sem outras suítes em andamento. Ele abre o Edge sem janela visível e usa uma instância do Vite em `127.0.0.1:5174`.

```powershell
npm run perf -- --rotulo=meu-ensaio
```

O terminal imprime uma tabela por tamanho de papel. O relatório JSON fica em `output/perf/meu-ensaio.json`. Cada tamanho usa um contexto novo do navegador e um papel preparado pela interface normal do Rabisco.

## Como ler

- O ensaio move o pincel 300 vezes e repete a trajetória com o spray, a 100% de zoom em todos os tamanhos. A trajetória tem 168 px de largura e oscila 40 px na vertical. Um papel em branco de cada tamanho recebe o balde, o desfazer e o refazer.
- Os tempos de início, movimento e fim cobrem o trabalho síncrono dos manipuladores de ponteiro, incluindo a conversão de coordenadas e as chamadas ao Canvas 2D. O spray tem uma linha separada para o cálculo e o desenho que ocorrem no callback agendado entre movimentos.
- A medição interna do histórico cobre a aplicação na camada e o registro dos pixels para recuperação. As linhas externas cobrem também a atualização da tela e o trabalho síncrono de preparação do autosave iniciado naquela chamada.
- P50 é a mediana. P95 é o menor tempo que cobre pelo menos 95% das amostras. Quando a operação ocorre uma vez, os dois percentis e o máximo são a duração dessa execução.
- `PerformanceObserver` registra tarefas da thread principal de 50 ms ou mais. A janela de observação de cada fase vai do começo da ação ao fim do autosave. O relatório informa quantas tarefas excederam 100 ms e a maior duração.
- O heap JS é amostrado em repouso. O protocolo de depuração do Edge, quando disponível, coleta o heap e a memória de apoio de ArrayBuffers e strings externas após uma coleta de lixo. A coluna do espelho conta os bytes do buffer residente mantido pelo documento. Essas medidas tratam de memória JavaScript. O raster de um canvas também pode ocupar memória em outras partes do navegador.
- A coluna de gravação soma os bytes do conteúdo efetivamente salvo. Antes do autosave por blocos, ela registra os bytes do buffer RGBA. Com os blocos, a comparação usa o tamanho dos PNGs gravados. Metadados e índices do IndexedDB ficam fora dessa contagem.

## Resultados

Máquina: Intel Core i7-8700 (12 núcleos lógicos), 16 GB de RAM, Windows 11, Edge 158. Tempos em ms (p95), zoom 100%. Relatório completo em `output/perf/passo-2.json`.

### Passo 2 — 24/11/2026 (linha de base)

| Operação (p95)                             | 1024 × 640 |  4000 × 4000 |      8192 × 4096 |
| ------------------------------------------ | ---------: | -----------: | ---------------: |
| Pincel, cada movimento                     |        0,4 |          0,4 |              0,5 |
| Pincel, histórico — 1ª pincelada           |       31,1 |        126,7 |            262,8 |
| Pincel, histórico — 3ª pincelada           |        4,3 |          6,6 |             12,3 |
| Pincel, soltar o botão — 3ª (com autosave) |        8,3 |         85,0 |        12,8 (\*) |
| Spray, cada quadro                         |        0,1 |          0,2 |              0,3 |
| Spray, histórico                           |        8,6 |          7,5 |             10,0 |
| Balde no papel todo                        |       48,9 |        862,3 |          1.588,2 |
| Desfazer (histórico / total)               |  0,9 / 4,7 | 16,6 / 105,0 | 35,0 / 35,3 (\*) |
| Refazer (histórico / total)                |  0,8 / 4,7 | 18,7 / 104,3 | 48,1 / 48,7 (\*) |
| Espelho do documento (MiB)                 |        2,5 |         61,0 |            128,0 |

(\*) Em 8192 × 4096 o autosave do papel inteiro ainda estava gravando a criação do papel durante o ensaio. As edições seguintes esperaram na fila e não pagaram a cópia de 128 MiB dentro da medição.

O que os números mostram:

- **Movimento do traço:** abaixo de 1 ms em todos os tamanhos. Meta de 4 ms atingida.
- **Primeira pincelada:** custa 127 ms em 4000 × 4000 e 263 ms em 8192 × 4096. A máscara do pincel é desenhada na GPU e a camada fica na memória comum (`willReadFrequently`). A primeira cópia da GPU para a camada paga uma sincronização que cresce com o papel. As seguintes custam de 4 a 16 ms. Criar a máscara na memória comum eliminaria o atraso, mas a suavização muda: o centro do traço sai 1 ponto mais escuro (47,130,196 em vez de 48,131,197), e o conta-gotas devolveria uma cor diferente da escolhida. A mudança foi descartada. A solução fica para a arquitetura de camadas da 0.3.
- **Desfazer e refazer:** o histórico gasta 17 a 48 ms. Meta de 50 ms atingida. O total passa de 100 ms em 4000 × 4000 porque o autosave copia o papel inteiro (Passo 4).
- **Tarefas acima de 100 ms:** ainda acontecem ao soltar o botão em 4000 × 4000 por causa do autosave, e na primeira pincelada.
- **Balde:** um preenchimento do papel inteiro leva 0,9 s em 4000 × 4000 e 1,6 s em 8192 × 4096. A varredura roda em JavaScript na thread principal. Pendência: levar o preenchimento para um Web Worker.

### Passo 3 — 24/11/2026 (sem a cópia dos pixels)

| Medida                                     | 1024 × 640 | 4000 × 4000 | 8192 × 4096 |
| ------------------------------------------ | ---------: | ----------: | ----------: |
| Heap JS em repouso (MiB) — Passo 2         |       13,7 |        72,2 |       139,1 |
| Heap JS em repouso (MiB) — Passo 3         |       11,2 |        11,2 |        11,1 |
| ArrayBuffers (MiB) — Passo 2 → Passo 3     |  6,1 → 3,6 |  64,6 → 3,6 | 131,6 → 3,6 |
| Pincel, histórico — 3ª pincelada           |        5,4 |        10,9 |        14,4 |
| Pincel, soltar o botão — 3ª (com autosave) |       13,9 |       210,0 |        14,6 |
| Desfazer (histórico / total)               | 0,4 / 10,2 | 8,1 / 210,0 | 17,7 / 18,1 |
| Balde no papel todo                        |         64 |       1.185 |       2.047 |

Sem a cópia, o papel ocupa memória só no canvas. Até o Passo 4 o autosave lê o papel inteiro do canvas a cada edição, o que encarece soltar o botão e desfazer em 4000 × 4000. Pelo mesmo motivo, o teste `fundacao.spec.ts` (uma pincelada não lê o papel inteiro) fica vermelho entre os Passos 3 e 4.

### Passo 4 — 24/11/2026 (autosave por blocos)

| Medida                                         |       1024 × 640 |      4000 × 4000 |      8192 × 4096 |
| ---------------------------------------------- | ---------------: | ---------------: | ---------------: |
| Gravado por pincelada — Passo 3                |        2.560 KiB |       62.500 KiB |    não terminava |
| Gravado por pincelada — Passo 4                | 19 KiB, 2 blocos | 18 KiB, 2 blocos | 18 KiB, 2 blocos |
| Pincel, soltar o botão — 3ª (Passo 3 → 4)      |       13,9 → 8,7 |     210,0 → 10,7 |      14,6 → 15,8 |
| Spray, soltar o botão (Passo 3 → 4)            |       15,3 → 7,2 |     240,2 → 14,2 |      13,6 → 16,0 |
| Desfazer, total (Passo 3 → 4)                  |       10,2 → 0,5 |      210,0 → 8,2 |      18,1 → 13,7 |
| Tarefas > 100 ms na 3ª pincelada e no desfazer |                0 |                0 |                0 |
| Autosave concluído no ensaio                   |              sim |              sim | sim (antes: não) |
| Pincel, soltar o botão — 1ª pincelada          |             39,7 |            144,8 |            286,1 |
| Balde no papel todo                            |               56 |            1.068 |            2.040 |

Pendências que continuam: a primeira pincelada depois de criar o papel (sincronização GPU → camada) e o balde em papel grande, que roda na thread principal.

### Passo 7 — 24/11/2026 (tamanho para abrir)

| Arquivo JavaScript                   | Antes (0.2)           | Depois (0.2.1)        |
| ------------------------------------ | --------------------- | --------------------- |
| Inicial do Rabisco                   | 516,7 KB (gzip 167,2) | 185,6 KB (gzip 62,0)  |
| React (arquivo próprio, em cache)    | dentro do inicial     | 223,4 KB (gzip 69,3)  |
| Banco local (Dexie), logo após abrir | dentro do inicial     | 101,4 KB (gzip 33,4)  |
| Total baixado para abrir a janela    | 516,7 KB              | 409,0 KB (gzip 131,3) |
| Aviso de tamanho do Vite             | sim                   | não                   |

Diálogos, editor e biblioteca de formas, editor de cores, codificadores de imagem e impressão continuam em arquivos carregados só quando usados.

### 0.3 — 25/11/2026 (20 camadas de 4000 × 4000)

`PERF_SO_CAMADAS=1 npm run perf -- --rotulo=camadas-03` cria um papel de 4000 × 4000, 19 camadas novas com um traço e modos variados (multiplicar, tela, sobrepor, normal, luz suave), e então mede uma pincelada na camada 10, ocultar uma camada, subir uma camada e desfazer.

| Medida                                                                 |          Resultado | Meta da 0.3 |
| ---------------------------------------------------------------------- | -----------------: | ----------- |
| Montar as 20 camadas (19 × nova camada + traço + modo, pela interface) |            7459 ms | —           |
| Pincel, cada movimento (p95)                                           |             0,2 ms | < 8 ms ✅   |
| Pincel, histórico ao soltar                                            |            10,1 ms | —           |
| Ocultar camada: trabalho do JavaScript                                 |             0,9 ms | —           |
| Ocultar camada: até a tela atualizar (mediana de 6, dois quadros)      |            34,1 ms | < 100 ms ✅ |
| Ocultar camada: até a tela atualizar (pior caso, a primeira vez)       |           148,7 ms | < 100 ms ❌ |
| Subir camada (Ctrl+]): trabalho do JavaScript                          |             1,3 ms | —           |
| Desfazer                                                               |             0,8 ms | —           |
| Tarefas acima de 200 ms                                                |                  0 | nenhuma ✅  |
| Autosave da pincelada                                                  | 2 blocos (0 bytes) | —           |
| Heap JS em repouso                                                     |          135,0 MiB | —           |

Como ler: o "trabalho do JavaScript" é o tempo síncrono do comando; o Canvas 2D adia o desenho das camadas para o quadro seguinte, por isso a coluna "até a tela atualizar" mede do clique até dois quadros depois (o piso, num monitor de 60 Hz, é ~33 ms). A primeira troca de visibilidade depois de montar as camadas é a mais lenta; as seguintes ficam no piso. As camadas ocupam ~1,2 GB de memória de canvas (fora do heap JS), que é o limite prático indicado no README.

### 0.4, Passo 1 — 25/11/2026 (estabilizador ligado)

`PERF_ESTABILIZAR=40 npm run perf -- --rotulo=passo-1-04`: cada movimento do pincel custa 0,2 ms (p95) em 1024 × 640 e 0,3 ms em 4000 × 4000 e 8192 × 4096 com o estabilizador em 40 — igual a sem ele. O histórico ao soltar segue os números da 0.3 (a primeira pincelada num papel grande ainda tem o atraso único, pendência do Passo 8).
