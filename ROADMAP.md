# Roteiro do Rabisco

Cada etapa deve ser utilizável, documentada e validada antes de iniciar a seguinte. A presença de uma etapa neste roteiro não indica implementação.

| Versão | Entrega                                                                                                                                                       | Estado                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 0.1    | Shell Aero com 7.css, canvas único, lápis, pincel, borracha, balde, formas básicas, Cor 1/Cor 2, seleção retangular, histórico, PNG e autosave                | Concluída e validada               |
| 0.2    | Paridade das ferramentas clássicas, texto editável durante inserção, zoom/pan e atalhos completos                                                             | Concluída e validada em 24/11/2026 |
| 0.2.1  | Estabilização: testes confiáveis, desempenho medido, pixels só no canvas, autosave por blocos, editor em módulos, ribbon adaptável e carregamento sob demanda | Concluída e validada em 24/11/2026 |
| 0.3    | Camadas, importar/colar imagem, transformação livre, formato .rabisco, PSD e ORA                                                                              | Concluída e validada em 25/11/2026 |
| 0.4    | Estabilizador, pressão, simetria, formas inteligentes, régua e guias, rotação da vista, gradiente e varinha (prompt em prompts/PROMPT_0.4.md)                 | Concluída e validada em 26/11/2026 |
| 0.5    | Filtros, ASCII, pixel art, dithering, meio-tom, camadas de ajuste e melhorias de desenho (prompt em prompts/PROMPT_0.5.md)                                      | Concluída (0.5.0)                  |
| 0.6    | AI Horde anônimo ou com chave própria, fila cancelável e geração e transformação em nova camada                                                             | Implementada (0.6.0)               |
| 0.7    | Modelos locais sob demanda, seleção inteligente, remoção de fundo, apagar objeto e ampliar                                                                    | Planejada                          |
| 0.8    | Agente “Desenhe pra mim” usando comandos tipados, com execução visível e desfazer                                                                             | Planejada                          |
| 0.9    | Tutor Rabi, lições e modo de traçar por cima                                                                                                                  | Planejada                          |
| 1.0    | PWA, Tauri, i18n, acessibilidade ampliada, testes visuais, performance e documentação final                                                                   | Planejada                          |

O [plano da 0.6](prompts/PROMPT_0.6.md) registra as decisões da integração. O [ponto de retomada](prompts/CONTINUAR_0.6.md) indica a próxima etapa.

## Próximos critérios de validação

- Garantir que cada resultado de IA entre em nova camada e possa ser desfeito.
- Auditar licenças de bibliotecas e modelos antes de incorporá-los.
- Não enviar desenhos para provedores sem ação explícita e identificação do destinatário.
- Validar o fluxo de desenhar, importar foto, remover fundo, adicionar texto e exportar em menos de três minutos quando essas funções estiverem disponíveis.
- Medir desempenho do compositor com 20 camadas em 4000 × 4000; manter tarefas pesadas fora da thread de interface.
- Completar testes de camadas, ASCII, provedores simulados e agente com dez comandos conforme as etapas correspondentes.

## Decisões pendentes da pessoa responsável

- Licença do código-fonte do projeto.
