# Continuar o Rabisco 0.5

## Ponto de parada

A branch `main` está publicada e validada até o **Passo 4 (Pixel art)**, no commit `e156f64`. Confira `git log -5 --oneline` ao retomar. O **Passo 5 (ASCII)** estava em integração na hora deste checkpoint. O plano completo e as decisões ficam no [PROMPT_0.5.md](PROMPT_0.5.md).

## Em outro computador

```powershell
git clone https://github.com/ViniciusNoetzold/Rabisco.git
cd Rabisco
npm install
npm run dev
```

Para abrir em outro aparelho conectado à mesma rede, execute `npm run dev -- --host 0.0.0.0` e use o endereço **Network** mostrado pelo Vite.

## O que falta

1. Validar o Passo 5 e confirmar a conversão, a edição de texto ASCII e as exportações. A inclusão de `figlet` depende da aprovação da dependência.
2. Integrar o dithering e os estilos artísticos no Passo 6.
3. Integrar as camadas de ajuste, compatibilidade de arquivos e exportações no Passo 7.
4. Fechar as pendências da 0.4, medir balde, desfoque e dithering, atualizar as capturas e publicar a versão 0.5.0 no Passo 8.

O [CHANGELOG](../CHANGELOG.md) registra a validação de cada passo publicado. O [guia de desempenho](../docs/desempenho.md) contém as medições feitas no Edge.
