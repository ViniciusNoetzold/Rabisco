# Continuar o Rabisco 0.5

## Ponto de parada

A branch `main` está publicada até o **Passo 6 (dithering, meio-tom e estilos artísticos)**. Confira `git log -5 --oneline` ao retomar. O **próximo passo é o 7 (camadas de ajuste)**. O plano completo e as decisões ficam no [PROMPT_0.5.md](PROMPT_0.5.md).

O [README da retomada](retomada-0.5/README.md) explica a sequência dos rascunhos dos Passos 7 e 8 e aponta as integrações e verificações que faltam. Os títulos ASCII com `figlet` seguem condicionados à aprovação da dependência.

## Em outro computador

```powershell
git clone https://github.com/ViniciusNoetzold/Rabisco.git
cd Rabisco
npm install
npm run dev
```

Para abrir em outro aparelho conectado à mesma rede, execute `npm run dev -- --host 0.0.0.0` e use o endereço **Network** mostrado pelo Vite.

## O que falta

1. Integrar as camadas de ajuste, compatibilidade de arquivos e exportações no Passo 7.
2. Fechar as pendências da 0.4, medir balde, desfoque e dithering, atualizar as capturas e publicar a versão 0.5.0 no Passo 8.

O [CHANGELOG](../CHANGELOG.md) registra a validação de cada passo publicado. O [guia de desempenho](../docs/desempenho.md) contém as medições feitas no Edge.
