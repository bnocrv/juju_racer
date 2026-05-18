# Juju Racer

Juju Racer é um endless runner lateral feito em HTML, CSS e JavaScript puro. O jogo acompanha Juliana levando Heloísa para a escola em uma scooter, correndo por uma avenida costeira ao pôr do sol, com visual arcade/anime, moedas, obstáculos, turbo, efeitos sonoros e ranking final.

## Demo local

Abra o projeto com um servidor estático:

```bash
python3 -m http.server 4173
```

Depois acesse:

```text
http://127.0.0.1:4173/
```

## Gameplay

- Juliana e Heloísa correm para a direita em uma estrada reta.
- O jogador deve pular obstáculos, coletar moedas e usar turbo.
- A pontuação aumenta com distância e moedas.
- Ao perder todas as vidas, aparece a tela final com ranking.

## Controles

### Teclado

- `Espaço`, `W` ou `Seta para cima`: pular.
- `T`, `Shift`, `S` ou `Seta para baixo`: turbo.
- `P`: pausar/continuar.
- `R`: recomeçar.
- `H`: mostrar/ocultar hitboxes.

### Mobile

- Toque no botão `Pular` para pular.
- Toque no botão `Turbo` para ativar o turbo.
- Também é possível tocar na tela para iniciar/recomeçar.

## Áudio

Os sons ficam em `assets/audio`:

- `theme.mp3`: trilha sonora.
- `coin.mp3`: moeda coletada.
- `jump.mp3`: pulo.
- `lose.wav`: dano.
- `turbo.mp3`: turbo.

Os volumes são ajustados no topo de `src/game.js`, no bloco:

```js
const SOUND_VOLUME = {
  theme: 0.22,
  coin: 0.58,
  jump: 0.46,
  lose: 0.48,
  turbo: 0.42,
};
```

Use valores de `0.0` a `1.0`.

## Assets visuais

Os principais assets gerados estão em `assets/generated`:

- `juju-cover-v4.png`: capa/tela inicial.
- `juju-straight-bg-v3.png`: cenário lateral com rua reta.
- `juju-moto-sprites-v2-chroma.png`: sprite sheet da moto com Juliana e Heloísa.
- `juju-obstacles-v3-chroma.png`: sprite sheet de obstáculos.
- `juju-coin-v4-chroma.png`: moeda personalizada.
- `juju-avatar-v4.png`: avatar do HUD.

Alguns assets usam fundo chroma key verde e são recortados em tempo real pelo canvas.

## Estrutura

```text
.
├── assets/
│   ├── audio/
│   └── generated/
├── index.html
├── src/
│   ├── game.js
│   └── styles.css
└── README.md
```

## Desenvolvimento

Não há etapa de build. O jogo roda direto no navegador.

Arquivos principais:

- `src/game.js`: loop do jogo, física, colisões, HUD, áudio, ranking e renderização.
- `src/styles.css`: layout responsivo desktop/mobile.
- `index.html`: canvas e botões mobile.

## Debug

A tecla `H` mostra hitboxes:

- verde: Juliana/moto.
- vermelho: obstáculos.
- amarelo: moedas.

Isso ajuda a ajustar dificuldade e colisões.

## Publicação

Por ser um projeto estático, pode ser publicado no GitHub Pages, Netlify, Vercel ou qualquer servidor HTTP simples.
