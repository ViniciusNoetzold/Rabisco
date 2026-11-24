# Roteiro do Rabisco

Cada etapa deve ser utilizável, documentada e validada antes de iniciar a seguinte. A presença de uma etapa neste roteiro não indica implementação.

| Versão | Entrega                                                                                                                                        | Estado               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 0.1    | Shell Aero com 7.css, canvas único, lápis, pincel, borracha, balde, formas básicas, Cor 1/Cor 2, seleção retangular, histórico, PNG e autosave | Concluída e validada |
| 0.2    | Paridade das ferramentas clássicas, texto editável durante inserção, zoom/pan e atalhos completos                                              | Passo 4 concluído    |
| 0.3    | Camadas, importar/colar imagem, transformação livre, formato .rabisco, PSD e ORA                                                               | Planejada            |
| 0.4    | Estabilizador, pressão, simetria e reconhecimento de formas                                                                                    | Planejada            |
| 0.5    | Filtros, arquitetura de estilos, ASCII, pixel art e dithering                                                                                  | Planejada            |
| 0.6    | Configuração BYOK, AI Horde, fila cancelável e geração/edição em nova camada                                                                   | Planejada            |
| 0.7    | Modelos locais sob demanda, seleção inteligente, remoção de fundo, apagar objeto e ampliar                                                     | Planejada            |
| 0.8    | Agente “Desenhe pra mim” usando comandos tipados, com execução visível e desfazer                                                              | Planejada            |
| 0.9    | Tutor Rabi, lições e modo de traçar por cima                                                                                                   | Planejada            |
| 1.0    | PWA, Tauri, i18n, acessibilidade ampliada, testes visuais, performance e documentação final                                                    | Planejada            |

O próximo passo da 0.2 é criar, salvar, importar e gerenciar formas próprias.

## Próximos critérios de validação

- Garantir que cada resultado de IA entre em nova camada e possa ser desfeito.
- Auditar licenças de bibliotecas e modelos antes de incorporá-los.
- Não enviar desenhos para provedores sem ação explícita e identificação do destinatário.
- Validar o fluxo de desenhar, importar foto, remover fundo, adicionar texto e exportar em menos de três minutos quando essas funções estiverem disponíveis.
- Medir desempenho do compositor com 20 camadas em 4000 × 4000; manter tarefas pesadas fora da thread de interface.
- Completar testes de camadas, ASCII, provedores simulados e agente com dez comandos conforme as etapas correspondentes.

## Decisões pendentes da pessoa responsável

- Licença do código-fonte do projeto.
