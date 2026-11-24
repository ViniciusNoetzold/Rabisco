# Continuar o Rabisco — onde paramos (24/11/2026, 16h)

Repositório: https://github.com/ViniciusNoetzold/Rabisco (branch `main`).
Validação do último envio: 124 testes unitários, 59 fluxos E2E no Edge e build de produção aprovados.

## O que já está pronto

- **0.1, 0.2 e 0.2.1** completas (ver CHANGELOG.md e docs/desempenho.md).
- **0.3 (camadas e colagem), em andamento:**
  - Passo 1: modelo de camadas, grupos, máscaras, 16 modos de mesclagem, bloqueios, recorte, efeitos, histórico de estrutura, autosave por camada. ✅
  - Passo 2: painel de Camadas (miniaturas, olho, cadeado, renomear, arrastar, opacidade, modo, atalhos). ✅
  - Passo 3: borracha transparente, travar transparência, aviso em camada oculta ou bloqueada, texto em camada própria, amostrar todas as camadas, Copiar mesclado (Ctrl+Shift+C). ✅ (falta: opção "formas em nova camada")
  - Passo 4: efeitos (contorno e sombra) na interface, "Virar adesivo", máscara a partir da seleção, aplicar e excluir máscara. ✅ (falta: UI de grupos — agrupar, desagrupar, recolher; os comandos já existem no executor)
  - Passo 5: colagem vira camada nova, várias imagens soltas viram várias camadas, Mover (V), transformação livre (Ctrl+T: mover, escalar, girar). ✅ (falta: distorcer, perspectiva, guias de encaixe e alinhar/distribuir)
  - Passo 6: formato .rabisco, PSD e ORA. ❌ Não começado.
  - Passo 7: desempenho com 20 camadas, README e roteiro manual. ❌ Não começado.

## Pendências conhecidas

- A primeira pincelada depois de criar ou abrir um papel grande tem um atraso único (127 ms em 4000 × 4000).
- O balde no papel inteiro leva ~1 s em 4000 × 4000 (roda na thread principal; ideal: Web Worker).
- Durante o traço, a prévia aparece por cima de todas as camadas (mesmo as que estão acima da ativa); ao soltar, a composição fica correta.
- Exportar PNG, JPEG etc. achata as camadas; elas só ficam guardadas no autosave do navegador até o Passo 6.

## Prompt para a próxima sessão

```text
Você é um engenheiro sênior de editores gráficos web trabalhando no RABISCO, nesta pasta.
Leia docs/IDEIA.md, docs/FERRAMENTAS.md, docs/MELHORIAS.md, README.md, ROADMAP.md, CHANGELOG.md (seção 0.3), prompts/PROMPT_0.2.1_e_0.3.md e
prompts/CONTINUAR_0.3.md antes de começar. Mesmas regras: um passo por vez, suíte completa
(`npm test`, `npm run build`, `npm run test:e2e`) no fim de cada passo, commit, `git push`, e
números reais no CHANGELOG. Dependências novas só com minha aprovação (sugestões, todas MIT:
fflate ou JSZip para ZIP, ag-psd para PSD).

Termine a 0.3 nesta ordem:
1. Passo 6: formato .rabisco (ZIP com manifest.json, PNG por camada e por máscara, miniatura),
   Salvar (Ctrl+S) em .rabisco, Abrir .rabisco, PSD e ORA (abrir e salvar), exportar camadas
   como PNGs e lista de arquivos recentes. Testes de ida e volta para os três formatos.
2. O que faltou dos Passos 3–5: formas em nova camada (opção no ribbon), UI de grupos no
   painel (agrupar Ctrl+G — mover a grade para Ctrl+' —, desagrupar, recolher, olho do grupo),
   distorcer pelos cantos (Ctrl) e guias de encaixe magenta na transformação livre.
3. Passo 7: `npm run perf` com 20 camadas de 4000 × 4000, README "Camadas e colagem",
   roteiro manual de 10 minutos, ROADMAP marcando a 0.3 como concluída.
Depois disso, o próximo prompt é a 0.4 (estabilizador, simetria, formas inteligentes) e, em
seguida, a 0.5 (filtros, ASCII, pixel art, dithering) e a 0.6 (IA com chave do usuário).
```

## Como rodar e ver na rede

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

Abra o endereço que o Vite mostrar. Para ver de outro aparelho na mesma rede Wi-Fi ou cabo, use o endereço "Network" (por exemplo, `http://192.168.0.188:5173`). Na primeira vez, o Windows pode pedir para liberar o Node.js no firewall.
