# Continuar depois da 0.5

## Planejar a 0.6

Escreva `prompts/PROMPT_0.6.md` para a etapa de IA no editor. Use o [roteiro do projeto](../ROADMAP.md) como referência.

- Planeje a configuração de provedores com chave da pessoa e o AI Horde sem cadastro como opção padrão. Confira a documentação oficial de cada provedor ao especificar a integração.
- Desenhe a fila cancelável com indicação de progresso e tratamento de falhas. Mantenha as credenciais no dispositivo e fora dos arquivos `.rabisco`.
- Especifique como cada geração ou edição cria uma camada nova e registra o prompt e a semente quando disponíveis.
- Prepare testes com respostas simuladas para envio, sucesso, falha, cancelamento e gravação do resultado na camada certa.

A documentação da etapa anterior reúne o [plano da 0.5](PROMPT_0.5.md), o [roteiro manual](../docs/guia-de-uso.md#roteiro-manual-da-05), o [changelog](../CHANGELOG.md) e as [medições de desempenho](../docs/desempenho.md). Os títulos ASCII com `figlet` seguem condicionados à aprovação da dependência. [Lista de melhorias](../docs/MELHORIAS.md)

## Em outro computador

```powershell
git clone https://github.com/ViniciusNoetzold/Rabisco.git
cd Rabisco
npm install
npm run dev
```

Para abrir em outro aparelho conectado à mesma rede, execute `npm run dev -- --host 0.0.0.0` e use o endereço **Network** mostrado pelo Vite.

Valide cada etapa com `npm test`, `npm run build` e `npm run test:e2e`. Rode `npm run perf` quando a mudança afetar o desempenho e registre os resultados medidos.
