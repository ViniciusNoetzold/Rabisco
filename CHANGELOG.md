# Histórico de alterações

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
