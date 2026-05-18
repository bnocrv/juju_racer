const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const W = 800;
const H = 400;
const GROUND_Y = 350;
const GRAVITY = 0.76;
const JUMP_FORCE = -18.1;
const MAX_FALL = 16;
const FONT_FAMILY = '"Arial Black", "Trebuchet MS", Arial, sans-serif';

// AJUSTE DE VOLUMES: mexa aqui para balancear os sons do jogo.
// Valores de 0.0 a 1.0.
const SOUND_VOLUME = {
  theme: 0.22,
  coin: 0.58,
  jump: 0.46,
  lose: 0.48,
  turbo: 0.42,
};

const audioPaths = {
  theme: "assets/audio/theme.mp3",
  coin: "assets/audio/coin.mp3",
  jump: "assets/audio/jump.mp3",
  lose: "assets/audio/lose.wav",
  turbo: "assets/audio/turbo.mp3",
};

const imagePaths = {
  background: "assets/generated/juju-straight-bg-v3.png",
  moto: "assets/generated/juju-moto-sprites-v2-chroma.png",
  obstacles: "assets/generated/juju-obstacles-v3-chroma.png",
  coin: "assets/generated/juju-coin-v4-chroma.png",
  avatar: "assets/generated/juju-avatar-v4.png",
  cover: "assets/generated/juju-cover-v4.png",
};

const images = {};
const motoFrames = [
  [58, 60, 455, 365],
  [650, 75, 468, 345],
  [1246, 70, 452, 350],
  [58, 482, 468, 360],
  [650, 488, 482, 350],
  [1246, 482, 452, 360],
];
let cleanMotoSheet;
let cleanObstacleSheet;
let cleanCoinIcon;
let assetsReady = false;
const obstacleSprites = {
  cone: [68, 78, 312, 332],
  barrier: [500, 96, 420, 280],
  schoolbag: [1048, 74, 334, 350],
  puddle: [52, 610, 368, 250],
  bump: [506, 620, 430, 210],
  sign: [1072, 538, 350, 360],
};

const game = {
  state: "start",
  time: 0,
  speed: 5.2,
  score: 0,
  distance: 0,
  coins: 0,
  lives: 3,
  best: Number(localStorage.getItem("juju-racer-best") || 0),
  scroll: 0,
  shake: 0,
  spawnTimer: 70,
  coinTimer: 22,
  turbo: 64,
  boostTime: 0,
  invincible: 0,
  showHitboxes: false,
};

const player = {
  x: 54,
  y: GROUND_Y - 146,
  width: 242,
  height: 146,
  vy: 0,
  grounded: true,
  jumpBuffer: 0,
  coyote: 0,
  anim: 0,
};

let obstacles = [];
let coins = [];
let clouds = [];
const sounds = {};
let audioUnlocked = false;

Promise.all(Object.entries(imagePaths).map(([key, src]) => loadImage(src).then((image) => {
  images[key] = image;
}))).then(() => {
  cleanMotoSheet = makeChromaTransparent(images.moto);
  cleanObstacleSheet = makeChromaTransparent(images.obstacles);
  cleanCoinIcon = makeChromaTransparent(images.coin);
  assetsReady = true;
});

Object.entries(audioPaths).forEach(([key, src]) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = SOUND_VOLUME[key];
  if (key === "theme") audio.loop = true;
  sounds[key] = audio;
});

resetClouds();
resize();
requestAnimationFrame(loop);

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.code === "Space" || key === "arrowup" || key === "w") {
    event.preventDefault();
    jump();
  }
  if (key === "shift" || key === "arrowdown" || key === "s" || key === "t") boost();
  if (key === "p") game.state = game.state === "playing" ? "paused" : "playing";
  if (key === "r") startGame();
  if (key === "h") game.showHitboxes = !game.showHitboxes;
});

canvas.addEventListener("pointerdown", (event) => {
  beginAudio();
  if (game.state !== "playing") {
    startGame();
    return;
  }
  canvas.dataset.touchY = event.clientY;
  canvas.dataset.touchX = event.clientX;
});

canvas.addEventListener("pointerup", (event) => {
  if (game.state !== "playing") return;
  const startY = Number(canvas.dataset.touchY || event.clientY);
  const startX = Number(canvas.dataset.touchX || event.clientX);
  const dy = event.clientY - startY;
  const dx = event.clientX - startX;
  if (dy > 28 && Math.abs(dy) > Math.abs(dx)) boost();
  else jump();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    beginAudio();
    if (game.state !== "playing") startGame();
    if (button.dataset.action === "jump") jump();
    if (button.dataset.action === "boost") boost();
  });
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}

function startGame() {
  game.state = "playing";
  game.time = 0;
  game.speed = 5.2;
  game.score = 0;
  game.distance = 0;
  game.coins = 0;
  game.lives = 3;
  game.scroll = 0;
  game.shake = 0;
  game.spawnTimer = 60;
  game.coinTimer = 14;
  game.turbo = 64;
  game.boostTime = 0;
  game.invincible = 0;
  player.y = GROUND_Y - player.height;
  player.vy = 0;
  player.grounded = true;
  player.jumpBuffer = 0;
  player.coyote = 0;
  player.anim = 0;
  obstacles = [];
  coins = [];
  playTheme();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function update() {
  if (game.state !== "playing") return;

  const boostActive = game.boostTime > 0 && game.turbo > 0;
  const speed = game.speed + (boostActive ? 2.4 : 0);
  game.time += 1;
  game.distance += speed * 0.17;
  game.score += Math.ceil(speed * 0.25);
  game.speed = Math.min(9.2, 5.2 + game.distance / 900);
  game.scroll += speed;
  game.spawnTimer -= 1;
  game.coinTimer -= 1;
  game.shake = Math.max(0, game.shake - 1);
  game.invincible = Math.max(0, game.invincible - 1);
  game.boostTime = Math.max(0, game.boostTime - 1);
  game.turbo = Math.max(0, Math.min(100, game.turbo + (boostActive ? -0.78 : 0.12)));

  player.anim += speed * 0.02;
  player.jumpBuffer = Math.max(0, player.jumpBuffer - 1);
  player.coyote = player.grounded ? 8 : Math.max(0, player.coyote - 1);
  applyJumpIfPossible();
  updatePlayerPhysics();

  if (game.spawnTimer <= 0) spawnObstacle();
  if (game.coinTimer <= 0) spawnCoinLine();

  obstacles.forEach((item) => item.x -= speed);
  coins.forEach((coin) => {
    coin.x -= speed;
    coin.float += 0.12;
    coin.spin += 0.1;
  });
  clouds.forEach((cloud) => {
    cloud.x -= cloud.speed + speed * cloud.depth;
    if (cloud.x < -cloud.w) {
      cloud.x = W + Math.random() * 260;
      cloud.y = 28 + Math.random() * 120;
    }
  });

  handleCollisions();
  obstacles = obstacles.filter((item) => item.x + item.w > -20);
  coins = coins.filter((coin) => coin.x > -40 && !coin.collected);
}

function updatePlayerPhysics() {
  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);
  player.y += player.vy;
  if (player.y >= GROUND_Y - player.height) {
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
}

function jump() {
  beginAudio();
  if (game.state !== "playing") {
    startGame();
    return;
  }
  player.jumpBuffer = 8;
  applyJumpIfPossible();
}

function applyJumpIfPossible() {
  if (player.jumpBuffer <= 0 || player.coyote <= 0) return;
  player.vy = JUMP_FORCE;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  playSound("jump");
}

function boost() {
  beginAudio();
  if (game.state !== "playing") {
    startGame();
    return;
  }
  if (game.turbo < 12) return;
  game.boostTime = 42;
  playSound("turbo");
}

function spawnObstacle() {
  const pattern = Math.random();
  if (pattern < 0.74) {
    addObstacle(randomObstacleType(), 0);
  } else if (pattern < 0.90) {
    addObstacle(Math.random() > 0.5 ? "puddle" : "bump", 0);
    addObstacle(Math.random() > 0.5 ? "coin-gap" : randomObstacleType(), 190);
  } else {
    addObstacle("sign", 0);
  }

  const minGap = Math.max(92, 146 - game.distance / 95);
  game.spawnTimer = minGap + Math.random() * 56;
}

function randomObstacleType() {
  const roll = Math.random();
  return roll < 0.28 ? "cone" : roll < 0.52 ? "barrier" : roll < 0.70 ? "schoolbag" : roll < 0.86 ? "puddle" : "bump";
}

function addObstacle(type, offset) {
  if (type === "coin-gap") {
    coins.push({
      x: W + 28 + offset,
      y: GROUND_Y - 145,
      r: 15,
      float: Math.random() * 6,
      spin: Math.random() * Math.PI * 2,
      collected: false,
    });
    return;
  }
  const data = {
    cone: { w: 62, h: 66, y: GROUND_Y - 66, hit: [18, 24, 26, 34] },
    barrier: { w: 98, h: 66, y: GROUND_Y - 66, hit: [18, 19, 62, 34] },
    schoolbag: { w: 62, h: 64, y: GROUND_Y - 64, hit: [18, 18, 30, 34] },
    puddle: { w: 94, h: 34, y: GROUND_Y - 28, hit: [18, 10, 58, 14] },
    bump: { w: 94, h: 34, y: GROUND_Y - 32, hit: [18, 10, 58, 14] },
    sign: { w: 78, h: 82, y: GROUND_Y - 82, hit: [20, 22, 38, 42] },
  }[type];

  obstacles.push({
    type,
    x: W + 28 + offset,
    y: data.y,
    w: data.w,
    h: data.h,
    hit: data.hit,
  });
}

function spawnCoinLine() {
  const pattern = Math.floor(Math.random() * 5);
  const count = pattern === 3 ? 8 : 3 + Math.floor(Math.random() * 5);
  const startX = W + 18 + Math.random() * 120;
  for (let i = 0; i < count; i += 1) {
    let y = GROUND_Y - 108;
    if (pattern === 0) y = GROUND_Y - 116 - Math.sin(i / Math.max(1, count - 1) * Math.PI) * 46;
    if (pattern === 1) y = GROUND_Y - 92 - (i % 2) * 34;
    if (pattern === 2) y = GROUND_Y - 162 + i * 12;
    if (pattern === 3) y = GROUND_Y - 78 - Math.sin(i * 0.9) * 18;
    if (pattern === 4) y = GROUND_Y - 118 + Math.sin((i + game.time) * 1.35) * 54;
    y = Math.max(GROUND_Y - 178, Math.min(GROUND_Y - 70, y));
    coins.push({
      x: startX + i * (pattern === 3 ? 32 : 40) + Math.random() * 12,
      y,
      r: 15,
      float: Math.random() * 6,
      spin: Math.random() * Math.PI * 2,
      collected: false,
    });
  }
  game.coinTimer = 58 + Math.random() * 44;
}

function handleCollisions() {
  const playerBox = getPlayerBox();

  for (const coin of coins) {
    if (circleRect(coin.x, coin.y, coin.r, playerBox)) {
      coin.collected = true;
      game.coins += 1;
      game.score += 90;
      game.turbo = Math.min(100, game.turbo + 2.5);
      playSound("coin");
    }
  }

  if (game.invincible > 0) return;

  for (const obstacle of obstacles) {
    const box = getObstacleBox(obstacle);
    if (!rectsOverlap(playerBox, box)) continue;
    game.lives -= 1;
    game.invincible = 64;
    game.shake = 5;
    game.score = Math.max(0, game.score - 180);
    playSound("lose");
    if (game.lives <= 0) {
      game.state = "over";
      game.best = Math.max(game.best, game.score);
      localStorage.setItem("juju-racer-best", String(game.best));
    }
    break;
  }
}

function getPlayerBox() {
  return {
    x: player.x + 42,
    y: player.y + 42,
    w: player.width - 78,
    h: player.height - 58,
  };
}

function getObstacleBox(obstacle) {
  return {
    x: obstacle.x + obstacle.hit[0],
    y: obstacle.y + obstacle.hit[1],
    w: obstacle.hit[2],
    h: obstacle.hit[3],
  };
}

function draw() {
  ctx.save();
  if (game.state === "playing" && game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake * 0.45);
  }
  drawBackground();
  drawRoadMotion();
  coins.forEach(drawCoin);
  obstacles.forEach(drawObstacle);
  drawPlayer();
  if (game.showHitboxes) drawHitboxes();
  drawHud();
  if (!assetsReady) drawOverlay("CARREGANDO", "preparando sprites e cenário", "");
  if (game.state === "start") drawStartScreen();
  if (game.state === "paused") drawOverlay("PAUSADO", "aperte P para voltar", "");
  if (game.state === "over") drawGameOver();
  ctx.restore();
}

function drawBackground() {
  if (!images.background) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#25124a");
    sky.addColorStop(0.55, "#f06d52");
    sky.addColorStop(1, "#151722");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.drawImage(images.background, 0, 0, W, H);
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillRect(0, 0, W, H);
}

function drawRoadMotion() {
  const offset = game.scroll % 140;
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 5;
  for (let x = -120 - offset; x < W + 160; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, 332);
    ctx.lineTo(x + 72, 332);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#ffcf5a";
  ctx.lineWidth = 2;
  for (let x = -80 - (game.scroll * 1.8) % 110; x < W + 120; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 374);
    ctx.lineTo(x + 82, 374);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  if (cleanMotoSheet) {
    drawMotoSprite();
    return;
  }

  const blink = game.invincible > 0 && Math.floor(game.time / 5) % 2 === 0;
  if (blink) return;

  const bob = player.grounded ? Math.sin(player.anim * Math.PI * 2) * 2.5 : 0;
  const boostFlame = game.boostTime > 0 && game.turbo > 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob);

  if (boostFlame) {
    ctx.fillStyle = "rgba(88, 231, 255, 0.75)";
    ctx.beginPath();
    ctx.moveTo(6, 54);
    ctx.lineTo(-42 - Math.random() * 16, 42);
    ctx.lineTo(4, 34);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(66, 94, 62, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  drawWheel(24, 70, 18, game.scroll * 0.08);
  drawWheel(98, 70, 19, game.scroll * 0.08);
  ctx.fillStyle = "#232935";
  roundRect(22, 42, 92, 28, 12);
  ctx.fill();
  ctx.fillStyle = "#4d5361";
  roundRect(42, 24, 70, 22, 9);
  ctx.fill();
  ctx.fillStyle = "#ff9d2e";
  ctx.fillRect(88, 52, 20, 5);
  ctx.fillStyle = "#fff5bc";
  ctx.beginPath();
  ctx.moveTo(106, 42);
  ctx.lineTo(124, 48);
  ctx.lineTo(106, 54);
  ctx.closePath();
  ctx.fill();

  drawRider(66, 16, "#f6d4bd", "#f7efe4", "#1b1016", true);
  drawRider(31, 18, "#d99a6a", "#f3f1f6", "#24131a", false);
  ctx.restore();
}

function drawMotoSprite() {
  const blink = game.invincible > 0 && Math.floor(game.time / 5) % 2 === 0;
  if (blink) return;

  const boostActive = game.boostTime > 0 && game.turbo > 0;
  const airborne = !player.grounded;
  let frame = Math.floor(player.anim * 5) % 2;
  if (airborne) frame = 2;
  if (boostActive) frame = 3;
  if (game.invincible > 0) frame = 5;

  const [sx, sy, sw, sh] = motoFrames[frame];
  const bob = player.grounded ? Math.sin(player.anim * Math.PI * 2) * 2.5 : 0;
  const drawW = player.width;
  const drawH = player.height;
  const drawX = player.x - 12;
  const drawY = player.y + 8 + bob;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
  ctx.beginPath();
  ctx.ellipse(player.x + 126, GROUND_Y + 8, airborne ? 82 : 118, airborne ? 10 : 15, 0, 0, Math.PI * 2);
  ctx.fill();
  if (boostActive) {
    ctx.shadowColor = "#58e7ff";
    ctx.shadowBlur = 24;
  }
  ctx.drawImage(cleanMotoSheet, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawWheel(x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#080910";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7d8595";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "#d7dbe2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r + 5, 0);
  ctx.lineTo(r - 5, 0);
  ctx.moveTo(0, -r + 5);
  ctx.lineTo(0, r - 5);
  ctx.stroke();
  ctx.restore();
}

function drawRider(x, y, skin, shirt, hair, driver) {
  const lean = driver ? -0.2 : 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = shirt;
  roundRect(-13, 22, 27, 28, 7);
  ctx.fill();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(driver ? 8 : -8, 33);
  ctx.lineTo(driver ? 38 : 16, 42);
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, 10, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(-3, 5, 16, Math.PI * 0.85, Math.PI * 2.08);
  ctx.arc(8, 8, 14, Math.PI * 1.1, Math.PI * 2.2);
  ctx.fill();
  ctx.fillStyle = "#13131a";
  ctx.beginPath();
  ctx.arc(4, 9, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObstacle(obstacle) {
  if (cleanObstacleSheet && obstacleSprites[obstacle.type]) {
    drawObstacleSprite(obstacle);
    return;
  }
  if (obstacle.type === "cone") drawCone(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  if (obstacle.type === "barrier") drawBarrier(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  if (obstacle.type === "schoolbag") drawSchoolbag(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  if (obstacle.type === "puddle") drawPuddle(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  if (obstacle.type === "bump") drawBarrier(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
}

function drawObstacleSprite(obstacle) {
  const [sx, sy, sw, sh] = obstacleSprites[obstacle.type];
  const scale = Math.min(obstacle.w / sw, obstacle.h / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const x = obstacle.x + (obstacle.w - drawW) / 2;
  const y = obstacle.y + obstacle.h - drawH;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
  ctx.beginPath();
  ctx.ellipse(obstacle.x + obstacle.w / 2, GROUND_Y + 5, obstacle.w * 0.48, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(cleanObstacleSheet, sx, sy, sw, sh, x, y, drawW, drawH);
  ctx.restore();
}

function drawCone(x, y, w, h) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, GROUND_Y + 6, w * 0.55, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff7a1f";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff2d6";
  ctx.fillRect(x + w * 0.2, y + h * 0.55, w * 0.6, h * 0.12);
}

function drawBarrier(x, y, w, h) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, GROUND_Y + 6, w * 0.58, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b2030";
  roundRect(x, y + 8, w, h - 12, 8);
  ctx.fill();
  ctx.fillStyle = "#ffdc4e";
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.translate(x + 16 + i * 22, y + h / 2);
    ctx.rotate(-0.45);
    ctx.fillRect(-5, -21, 10, 42);
    ctx.restore();
  }
}

function drawSchoolbag(x, y, w, h) {
  ctx.fillStyle = "#ff4b8b";
  roundRect(x + 5, y + 8, w - 10, h - 6, 10);
  ctx.fill();
  ctx.strokeStyle = "#7a123e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 12, 15, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffd45a";
  ctx.fillRect(x + 17, y + 25, w - 34, 6);
}

function drawPuddle(x, y, w, h) {
  ctx.fillStyle = "rgba(65, 207, 255, 0.84)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(224, 251, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCoin(coin) {
  const y = coin.y + Math.sin(coin.float) * 4;
  if (cleanCoinIcon) {
    const pulse = Math.sin(coin.float) * 2;
    const size = 36 + pulse;
    ctx.save();
    ctx.shadowColor = "rgba(255, 210, 40, 0.8)";
    ctx.shadowBlur = 16;
    ctx.translate(coin.x, y);
    ctx.scale(0.78 + Math.sin(coin.spin) * 0.1, 1);
    ctx.drawImage(cleanCoinIcon, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "rgba(255, 214, 70, 0.3)";
  ctx.beginPath();
  ctx.arc(coin.x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd447";
  ctx.beginPath();
  ctx.arc(coin.x, y, coin.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff1a2";
  ctx.fillRect(coin.x - 2, y - 7, 4, 14);
}

function drawHud() {
  ctx.fillStyle = "rgba(5, 8, 16, 0.72)";
  roundRect(14, 12, 206, 54, 8);
  ctx.fill();
  if (images.avatar) {
    ctx.save();
    roundRect(22, 18, 40, 40, 8);
    ctx.clip();
    ctx.drawImage(images.avatar, 22, 18, 40, 40);
    ctx.restore();
    ctx.strokeStyle = "#ffdd44";
    ctx.lineWidth = 2.5;
    roundRect(22, 18, 40, 40, 8);
    ctx.stroke();
  }
  drawOutlinedText("JULIANA", 72, 34, gameFont(18), "#fff", 3);
  drawOutlinedText(`♥ ${game.lives}`, 72, 56, gameFont(18), "#ff5570", 3);
  if (cleanCoinIcon) ctx.drawImage(cleanCoinIcon, 586, 16, 28, 28);
  drawOutlinedText(`MOEDAS ${game.coins}`, 620, 38, gameFont(18), "#ffdc44", 3);
  drawOutlinedText(`SCORE ${String(game.score).padStart(5, "0")}`, 620, 66, gameFont(18), "#fff", 3);
  ctx.fillStyle = "rgba(8, 12, 22, 0.72)";
  roundRect(26, 75, 152, 14, 7);
  ctx.fill();
  ctx.fillStyle = game.boostTime > 0 ? "#58e7ff" : "#2fd5ec";
  roundRect(29, 78, 146 * game.turbo / 100, 8, 5);
  ctx.fill();
  if (game.showHitboxes) drawOutlinedText("HITBOX ON", 28, 112, gameFont(15), "#61ff83", 3);
}

function drawOverlay(title, subtitle, hint) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffdd3f";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 8;
  ctx.font = gameFont(58);
  ctx.strokeText(title, W / 2, 158);
  ctx.fillText(title, W / 2, 158);
  ctx.fillStyle = "#fff";
  ctx.font = gameFont(22);
  ctx.fillText(subtitle, W / 2, 204);
  ctx.fillStyle = "#dbe8ff";
  ctx.font = gameFont(17, 800);
  ctx.fillText(hint || "Toque para continuar", W / 2, 242);
  ctx.textAlign = "left";
}

function drawStartScreen() {
  if (images.cover) {
    ctx.drawImage(images.cover, 0, 0, W, H);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(0, 0, 0, 0.05)");
    shade.addColorStop(0.55, "rgba(0, 0, 0, 0.05)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.58)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  } else {
    drawBackground();
  }
  ctx.textAlign = "center";
  drawOutlinedText("TOQUE OU APERTE ESPAÇO PARA COMEÇAR", W / 2, 330, gameFont(24), "#ffdd42", 4);
  drawOutlinedText("Espaço/toque pula  •  T usa turbo  •  H mostra hitboxes", W / 2, 362, gameFont(15, 800), "#fff", 3);
  ctx.textAlign = "left";
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.64)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  drawOutlinedText("FIM DA CORRIDA", W / 2, 78, gameFont(38), "#ffdd3f", 5);
  drawOutlinedText(`SEU SCORE ${game.score}  •  MOEDAS ${game.coins}`, W / 2, 118, gameFont(19), "#fff", 3);

  const ranking = [
    ["BRUNO", 987650],
    ["HELOÍSA", 876420],
    ["JULIANA", 765310],
  ];
  ctx.fillStyle = "rgba(7, 10, 20, 0.82)";
  roundRect(220, 145, 360, 150, 10);
  ctx.fill();
  drawOutlinedText("RANKING", W / 2, 178, gameFont(24), "#ff65aa", 4);
  ranking.forEach(([name, score], index) => {
    const y = 212 + index * 34;
    drawOutlinedText(`${index + 1}. ${name}`, 270, y, gameFont(20), "#fff", 3, "left");
    drawOutlinedText(String(score), 530, y, gameFont(20), "#ffdd42", 3, "right");
  });
  drawOutlinedText("Toque ou aperte R para recomeçar", W / 2, 337, gameFont(17, 800), "#dbe8ff", 3);
  ctx.textAlign = "left";
}

function drawHitboxes() {
  drawBox(getPlayerBox(), "#55ff77");
  obstacles.forEach((obstacle) => drawBox(getObstacleBox(obstacle), "#ff4545"));
  coins.forEach((coin) => {
    ctx.save();
    ctx.strokeStyle = "#ffdd42";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + Math.sin(coin.float) * 4, coin.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBox(box, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function drawOutlinedText(text, x, y, font, fill, lineWidth = 5, align = "left") {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = "#04050a";
  ctx.lineWidth = lineWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function gameFont(size, weight = 900) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

function resetClouds() {
  clouds = Array.from({ length: 7 }, (_, i) => ({
    x: Math.random() * W,
    y: 24 + Math.random() * 120,
    w: 60 + Math.random() * 88,
    h: 16 + Math.random() * 16,
    speed: 0.12 + Math.random() * 0.16,
    depth: i % 2 ? 0.018 : 0.03,
    color: i % 2 ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 210, 178, 0.18)",
  }));
}

function beginAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  Object.entries(sounds).forEach(([key, audio]) => {
    audio.volume = SOUND_VOLUME[key];
  });
}

function playTheme() {
  if (!audioUnlocked || !sounds.theme) return;
  sounds.theme.volume = SOUND_VOLUME.theme;
  sounds.theme.play().catch(() => {});
}

function playSound(name) {
  if (!audioUnlocked || !sounds[name]) return;
  const audio = sounds[name];
  audio.pause();
  audio.currentTime = 0;
  audio.volume = SOUND_VOLUME[name];
  audio.play().catch(() => {});
}

function makeChromaTransparent(image) {
  const off = document.createElement("canvas");
  off.width = image.width;
  off.height = image.height;
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(image, 0, 0);
  const data = offCtx.getImageData(0, 0, off.width, off.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const greenScore = g - Math.max(r, b);
    if (g > 120 && greenScore > 42) {
      const alpha = Math.max(0, 255 - greenScore * 5.2);
      data.data[i + 3] = Math.min(data.data[i + 3], alpha);
      if (alpha < 90) {
        data.data[i] = 0;
        data.data[i + 1] = 0;
        data.data[i + 2] = 0;
      } else {
        data.data[i + 1] = Math.min(data.data[i + 1], Math.max(data.data[i], data.data[i + 2]) + 18);
      }
    }
  }
  offCtx.putImageData(data, 0, 0);
  return off;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, r, rect) {
  const x = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - x) ** 2 + (cy - y) ** 2 <= r ** 2;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
