# Continuar depois da 0.6

A aba **IA** envia gerações e transformações ao AI Horde por ação explícita. O resultado aguarda **Inserir em nova camada**. A integração, a origem da camada no `.rabisco` v4 e a configuração da chave estão no [guia de uso](../docs/guia-de-uso.md#ia-06) e no [plano da 0.6](PROMPT_0.6.md).

## Planejar a 0.7

- Escrever `prompts/PROMPT_0.7.md` para os recursos de IA local. Verificar licenças, tamanho dos modelos e execução no navegador antes de escolher a primeira integração.
- Começar pelo roteiro atual, com remoção de fundo, seleção inteligente, apagar objeto e ampliação. Definir uma primeira tarefa que possa ser medida sem travar o traço.
- Reaproveitar os limites de documento, os comandos JSON e o histórico. Testar transparência, cancelamento, memória, papéis grandes e recuperação do desenho.

Outros provedores de imagem continuam no roteiro de melhorias. A 0.6 tem um provedor inicial com acesso anônimo e com chave própria. [Roteiro](../ROADMAP.md) · [Lista de melhorias](../docs/MELHORIAS.md)

## Em outro computador

```powershell
git clone https://github.com/ViniciusNoetzold/Rabisco.git
cd Rabisco
npm install
npm run dev
```

Para servir na rede local, use `npm run dev -- --host 0.0.0.0`. Valide mudanças com `npm test`, `npm run build` e `npm run test:e2e`. A suíte de IA simula as chamadas externas.
