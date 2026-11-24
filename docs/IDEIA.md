# A ideia do Rabisco

> Documento-âncora: antes de decidir algo grande, releia isto. O roteiro técnico está em
> [ROADMAP.md](../ROADMAP.md), as ferramentas pesquisadas em [FERRAMENTAS.md](FERRAMENTAS.md)
> e a lista de melhorias em [MELHORIAS.md](MELHORIAS.md). O prompt mestre original, usado para
> começar o projeto, está em [prompts/RABISCO_prompt_mestre.md](../prompts/RABISCO_prompt_mestre.md).

## O pedido original (24/11/2026)

Em resumo, nas palavras de quem idealizou:

- Um **paint estilo o do Windows 7**, com a mesma pegada, os mesmos "gráficos de paint" e as mecânicas originais.
- **Mais fácil de desenhar** que o original.
- **Várias ferramentas** e **motores de geração e transformação de imagem**.
- Poder colocar uma **chave de API gratuita** para gerar imagens **usando as ferramentas do próprio paint**.
- **Importar e exportar** imagens para **colagens** e para **desenhar por cima**.
- **Camadas editáveis**.
- **Outros estilos**, como **ASCII**, entre outros.
- Uma **IA interna**, e de preferência **uma IA que ensina** a desenhar.
- Tudo **muito completo**.

## Em uma frase

Um editor de desenho com a simplicidade e a cara do paint da era Windows 7, mais camadas, colagens e estilos (ASCII, pixel art), e uma IA que gera e transforma imagens usando as próprias ferramentas do app, além de ensinar a desenhar.

**Nome:** Rabisco · **Mascote e tutor:** Rabi · **Frase:** _"O paint de sempre, com uma IA no pincel."_

## Os seis pilares e onde estamos

| Pilar                          | O que significa                                                                                                      | Situação                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **1. Nostalgia funcional**     | Parece o paint do Win7 (ribbon, paleta, janela Aero), com arte própria e sem nada da Microsoft                       | ✅ Feito (0.1–0.2.1)                                                                     |
| **2. Fácil de desenhar**       | Estabilizador, pressão de caneta, simetria, formas que se ajeitam, desfazer ilimitado                                | 🟡 Pressão e desfazer prontos; estabilizador, simetria e formas inteligentes na **0.4**  |
| **3. Camadas e colagem**       | Importar, recortar, sobrepor, desenhar por cima, transformar, adesivos                                               | 🟡 Quase pronto (**0.3**); falta salvar com camadas (.rabisco, PSD, ORA)                 |
| **4. IA com chave do usuário** | Colar uma chave gratuita (ou usar o AI Horde sem chave) para gerar e editar; o resultado sempre vem numa camada nova | 🔜 **0.6** (IA local na **0.7**; "Desenhe pra mim" com as ferramentas do app na **0.8**) |
| **5. IA que ensina**           | O tutor Rabi olha o desenho, dá dicas, propõe lições e modo "traçar por cima"                                        | 🔜 **0.9**                                                                               |
| **6. Local e privado**         | Funciona sem internet, salva no navegador, a chave nunca sai do dispositivo (só vai ao provedor escolhido)           | ✅ Base feita (autosave local, sem telemetria); PWA e desktop na **1.0**                 |

E os **estilos alternativos** (ASCII, pixel art, dithering, meio-tom, mosaico) entram na **0.5**.

## Decisões que já tomamos (e por quê)

- **Web primeiro (TypeScript, React, Vite), desktop depois (Tauri):** o mesmo código serve para o navegador, o celular na rede e o app instalado.
- **Visual inspirado, nunca copiado:** 7.css (MIT), ícones Fugue (CC BY) e a fonte Selawik (OFL). Nada de ícones, sons, fontes ou nomes da Microsoft.
- **Só dependências com licença permissiva** (MIT, Apache-2.0, BSD, ISC, OFL, CC BY). Ferramentas GPL/AGPL (ComfyUI, por exemplo) só como serviço externo opcional. Modelos não comerciais ficam fora do padrão.
- **Toda edição é um comando JSON** (`{ "tipo": "NovaCamada", ... }`). Isso dá o desfazer preciso e é a porta que a IA vai usar para desenhar com as ferramentas do app (0.8).
- **Resultado de IA sempre em camada nova:** a IA nunca apaga o desenho de ninguém.
- **Testes de verdade a cada passo:** unitários e E2E, sem números inventados no CHANGELOG.

## O que ainda decidir

- **Licença do código** do Rabisco (MIT para atrair contribuidores? outra?).
- **Público infantil?** Se sim, o modo infantil vira obrigatório (LGPD e cuidados com a IA).
- **Marca:** verificar "Rabisco" no INPI e os domínios (.com, .com.br, .app).
