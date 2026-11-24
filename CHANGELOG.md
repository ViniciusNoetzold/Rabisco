# Histórico de alterações

## 0.2 em desenvolvimento

### Passo 2 — Tamanho e orientação do papel

- As três alças do papel aumentam ou cortam o canvas e mostram o tamanho previsto. `Shift` mantém a proporção, `Esc` cancela e a área nova recebe a Cor 2.
- **Propriedades da imagem** ajusta tamanho, unidade, fundo e DPI. Dimensões e resolução são persistidas no autosave e gravadas no PNG.
- **Redimensionar e inclinar** reamostra em pixels ou porcentagem e inclina nos dois eixos. **Girar** oferece as rotações de 90° e 180° e inversões horizontal e vertical. As operações funcionam para a imagem inteira e para seleções.
- Novo limite de 8192 px por lado e 40 milhões de pixels. Os testes de dimensão de PNG, autosave e comandos foram ajustados ao novo limite.

### Passo 1 — Fundação

- Modelo de documento com camada ativa e composição da tela separada da superfície editável.
- Registro das nove ferramentas existentes, com gestos, prévias e atalhos separados da interface.
- API de comandos serializáveis, histórico por área e autosave a partir do buffer em memória. Uma pincelada curta lê apenas sua região no canvas.
- Testes para o registro das ferramentas, a serialização dos comandos e a área registrada no histórico.

## 0.1.0 — 2026-11-24

MVP 0.1 implementado e validado em 24 de novembro de 2026.

- Estrutura TypeScript, Vite e React, com separação entre interface, canvas, operações, histórico, persistência e arquivos.
- Interface Aero retrô em português com ribbon, paleta de cores e controles acessíveis por teclado.
- Ferramentas raster básicas, formas e seleção retangular.
- Histórico desfazer/refazer com orçamento de memória.
- Importação e exportação PNG com validação de arquivo.
- Recuperação automática do último desenho usando IndexedDB.
- Fonte Selawik e ícones Fugue hospedados junto ao aplicativo, com créditos e licenças.
- Testes de unidade e fluxos de navegador para o escopo do MVP.
- Validação: 28 testes unitários, 9 fluxos E2E no Edge e compilação de produção aprovados.
- E2E verifica pixels de desenho, cores, seleção/cópia/colagem/movimentação/recorte, PNG, autosave, diálogos, zoom, grade, régua e viewport de 390 px.

As versões 0.2 a 1.0 permanecem no [roteiro](ROADMAP.md).
