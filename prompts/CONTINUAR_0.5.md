# Continuar o Rabisco 0.5

## Ponto de parada

A branch `main` está publicada até o **Passo 7 (camadas de ajuste)**. Confira `git log -5 --oneline` ao retomar. O **próximo passo é o 8 (pendências e fechamento da 0.5)**. O plano completo e as decisões ficam no [PROMPT_0.5.md](PROMPT_0.5.md).

O [README da retomada](retomada-0.5/README.md) explica a sequência dos rascunhos do Passo 8. Ao integrar trechos de arquivos compartilhados, preserve a edição de ASCII e o `.rabisco` v3, que guarda as camadas de ajuste. Os títulos ASCII com `figlet` seguem condicionados à aprovação da dependência.

## Em outro computador

```powershell
git clone https://github.com/ViniciusNoetzold/Rabisco.git
cd Rabisco
npm install
npm run dev
```

Para abrir em outro aparelho conectado à mesma rede, execute `npm run dev -- --host 0.0.0.0` e use o endereço **Network** mostrado pelo Vite.

## O que falta

1. Integrar seleções, simetria no Dedo e formas inteligentes, balde em faixas, réguas e miniatura na vista girada e histórico de guias.
2. Medir balde, desfoque e dithering, atualizar as capturas e publicar a versão 0.5.0.

O [CHANGELOG](../CHANGELOG.md) registra a validação de cada passo publicado. O [guia de desempenho](../docs/desempenho.md) contém as medições feitas no Edge.
