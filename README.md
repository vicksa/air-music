# Air Music Vision

Piano e guitarra tocados no ar com a câmera e MediaPipe, com espelhamento consistente, guia ilustrado para as mãos e síntese de corda dedilhada.

## Usar

Abra https://air-music-ashy.vercel.app. No iPhone, use Safari → Compartilhar → Adicionar à Tela de Início. Permita a câmera, consulte **Como posicionar as mãos** e escolha Piano ou Guitarra. O botão **Ouvir guitarra** permite testar o timbre sem câmera.

## Android

O projeto Android e o APK estão em https://github.com/vicksa/Air-music-video.

## Verificar

Execute `node --test tests/engine.test.mjs` para os testes de coordenadas, gestos e síntese de áudio.

## Guitarra na câmera

Escolha Guitarra e mostre duas mãos separadas. O instrumento acompanha a posição delas: a mão à esquerda da tela fica no braço, e a outra sobre o corpo. O indicador escolhe o traste visível. Polegar e indicador próximos são reconhecidos como posição de palheta; a mão cruza as cordas para tocar e as cordas se iluminam. Use **Reposicionar guitarra** para refazer o tamanho e a posição inicial. O instrumento acompanha a posição de repouso devagar para que as cordas não fujam da palhetada. A versão atual toca notas individuais, sem reconhecer acordes reais.

Testes: `node --test tests/*.test.mjs`.
