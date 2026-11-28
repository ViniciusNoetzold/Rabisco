# Rabisco 0.6 — Gerar e transformar imagens com IA

O editor envia um pedido explícito a um provedor de imagens e insere o resultado em uma nova camada. O ponto de partida é a versão 0.5.0. A geração, a transformação e a configuração ficam na aba **IA**.

## Decisões

- **AI Horde** é o provedor inicial, com acesso anônimo por padrão e opção de chave da própria conta. A fila anônima tem menor prioridade e depende dos modelos e workers ativos. [Como funciona o AI Horde](https://aihorde.net/docs/image/learn/concepts_horde/)
- Chame a API diretamente do navegador, sem servidor intermediário ou dependência nova. Envie a chave exclusivamente ao AI Horde e só a guarde neste navegador por escolha explícita. [Referência da API](https://aihorde.net/api/)
- Comece com geração por descrição e transformação por imagem (`img2img`). Mostre o destinatário e os dados que serão enviados antes da confirmação. A transformação usa a seleção ou o papel visível inteiro, reduzido para o envio. A rede do Horde usa máquinas voluntárias. Os termos preveem compartilhamento de gerações anônimas por texto e seus metadados. [Modos de imagem de referência](https://aihorde.net/docs/image/settings/source/) · [Termos](https://aihorde.net/terms/)
- Guarde descrição, provedor, operação, modelo e semente disponível junto da camada de resultado. Salve no `.rabisco` v4 e preserve a leitura dos formatos anteriores.
- Avalie outros provedores em uma integração própria com disponibilidade, custo, CORS e cancelamento verificados. O preflight da rota REST da Cloudflare falhou a partir da origem da rede local. A geração de imagens do Gemini consultada usa camada paga. [API da Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) · [Preços do Gemini](https://ai.google.dev/gemini-api/docs/pricing) · [Provedores do Hugging Face](https://huggingface.co/docs/inference-providers/)

## Etapas

1. **Provedor e fila**. Implementar envio, consulta de andamento com intervalo, recuperação da imagem e cancelamento no provedor. Tratar ausência de worker, falha, limite de requisições e cancelamento durante o envio. Testar com respostas simuladas.
2. **Aba IA**. Mostrar descrição, modo, tamanho, semente opcional e força de transformação. Permitir conferir a chave por ação explícita. Mostrar fila, tempo estimado quando disponível e cancelamento. Permitir esconder a janela para continuar desenhando.
3. **Integração com o documento**. Capturar a origem no envio e só aplicar resultados ao documento que iniciou o pedido. Inserir uma camada em um comando reversível. Preservar a origem da geração no autosave e no `.rabisco` sem incluir credenciais.
4. **Validação e entrega**. Testar geração e transformação com o provedor simulado, gravação e reabertura do documento, cancelamento e mudança de documento. Rodar `npm test`, `npm run build` e a suíte completa `npm run test:e2e`. Atualizar o guia de uso, o histórico de alterações e o ponto de continuação com o estado observado.

Uma verificação manual do provedor pode usar um pedido de texto sem conteúdo pessoal. Quando a rede ou a fila impedirem a verificação, registre o que foi validado com respostas simuladas.
