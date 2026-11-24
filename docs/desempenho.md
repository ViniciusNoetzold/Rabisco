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
