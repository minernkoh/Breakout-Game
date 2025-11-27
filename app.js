/*-------------------------------- Game Configuration --------------------------------*/
const GAME_STATES = {
  START: "START",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  LIFE_LOST: "LIFE_LOST",
  GAME_OVER: "GAME_OVER",
  WIN: "WIN",
};

const rows = 4; // brick rows
const cols = 8; // brick columns
const brickHeight = 20;
const ballSpeed = 4.5;
const paddleSpeed = 6;
const maxLives = 3;
const maxLivesCap = 5;

const powerUpTypes = {
  bigPaddle: "BIG_PADDLE",
  multiBall: "MULTI_BALL",
  extraLife: "EXTRA_LIFE",
};

const powerUpChance = 0.2; // 20% chance
const powerUpSpeed = 2;

/*-------------------------------- DOM Elements --------------------------------*/
const game = document.getElementById("game");
const paddle = document.getElementById("paddle");
const bricksContainer = document.getElementById("bricks");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const highScoreEl = document.getElementById("highScore");

const messageOverlay = document.getElementById("message");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restart");

const BGM = document.getElementById("bgm");
const SFX_brickHit = document.getElementById("brickHit");
const SFX_hit = document.getElementById("hit");
const SFX_lifeLost = document.getElementById("lifeLost");
const SFX_gameOver = document.getElementById("gameOver");
const SFX_gameWin = document.getElementById("gameWin");
const SFX_buttonHover = document.getElementById("buttonHover");
const SFX_buttonClick = document.getElementById("buttonClick");
const SFX_powerUp = document.getElementById("powerUp");

/*-------------------------------- Variables --------------------------------*/
let gameState = GAME_STATES.START;

let bricks = []; // array of brick DOM elements
let score = 0;
let highScore = Number(localStorage.getItem("breakout_highscore")) || 0;
let lives = maxLives;

highScoreEl.textContent = highScore;

// balls array: { element, x, y, vx, vy }
let balls = [];
let ballWidth = 18; // default, updated on init
let ballHeight = 18;

let paddleX; // paddle position

let animationId = null; // requestAnimationFrame id

let powerUps = []; // array of active power-ups

// keyboard input tracking
let keys = {
  ArrowLeft: false,
  ArrowRight: false,
  a: false,
  d: false,
};

/*-------------------------------- Helper Functions --------------------------------*/
// returns colour for a brick based on row index
function getBrickColor(row) {
  const colors = ["#ef4444", "#eab308", "#22c55e", "#22d3ee"];
  return colors[row % colors.length];
}
// create all bricks and add to DOM
function createBricks() {
  // build the brick grid
  console.log("creating bricks grid");
  bricksContainer.innerHTML = "";
  bricks = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const brick = document.createElement("div");
      brick.classList.add("brick", `row-${row}`);
      brick.dataset.row = row;
      brick.dataset.col = col;

      bricksContainer.appendChild(brick);
      bricks.push(brick);
    }
  }
}

// center paddle at bottom of screen
function centerPaddle() {
  const gameRect = game.getBoundingClientRect();
  const paddleRect = paddle.getBoundingClientRect();

  paddleX = (gameRect.width - paddleRect.width) / 2;
  paddle.style.left = `${paddleX}px`;
}
// creates a new ball DOM element, adds it to the game container, and returns it
function createBallElement() {
  const ballEl = document.createElement("div");
  ballEl.classList.add("ball");
  game.appendChild(ballEl);
  return ballEl;
}

// reset to a single ball above paddle
function resetBall() {
  // clear existing balls from DOM and array
  balls.forEach((b) => b.element.remove());
  balls = [];

  const gameRect = game.getBoundingClientRect();
  const paddleRect = paddle.getBoundingClientRect();

  // create new ball
  const ballEl = createBallElement();

  const rect = ballEl.getBoundingClientRect();
  ballWidth = rect.width || 18;
  ballHeight = rect.height || 18;

  // place ball above paddle center
  const startX = paddleX + paddleRect.width / 2 - ballWidth / 2; // left edge of paddle + half of paddle width - half of ball width
  const startY = gameRect.height - 32 - paddleRect.height - ballHeight - 4; // height of game area - hud area - paddle height - ball height - gap

  // apply to DOM
  ballEl.style.left = `${startX}px`;
  ballEl.style.top = `${startY}px`;

  const maxAngle = Math.PI / 6; // 180/6 = 30 degrees in radians
  const angle = (Math.random() * 2 - 1) * maxAngle; // sets angle +- 30 degrees

  const vx = ballSpeed * Math.sin(angle);
  const vy = -Math.abs(ballSpeed * Math.cos(angle)); // negative value = move upwards

  // creates ball object and store in balls array
  balls.push({
    element: ballEl,
    x: startX,
    y: startY,
    vx: vx,
    vy: vy,
  });

  console.log("ball reset", { startX, startY, vx, vy });
}

function showMessage(title, text, showStartBtn = true) {
  const h2 = messageOverlay.querySelector("h2");
  const body = messageOverlay.querySelector(".message-body");

  h2.textContent = title;
  body.innerHTML = text;

  startButton.classList.toggle("hidden", !showStartBtn);
  messageOverlay.classList.toggle("no-button", !showStartBtn);
  messageOverlay.classList.remove("hidden");
}

function hideMessage() {
  messageOverlay.classList.add("hidden");
}

// returns true when two rectangles overlap on both axes
function rectsOverlap(rect1, rect2) {
  // AABB (Axis-Aligned Bounding Box) Collision
  return (
    rect1.left < rect2.right && // check rect1 is not completely right of rect2
    rect1.right > rect2.left && // check rect1 is not completely left of rect2
    rect1.top < rect2.bottom && // check rect1 is not completely below rect2
    rect1.bottom > rect2.top // check rect1 is not completely above rect2
  );
}

// helper to pulse css effects
function playEffects(classNames, duration = 300) {
  const classes = Array.isArray(classNames) ? classNames : [classNames]; // normalizes input into array
  game.classList.remove(...classes); // clear classes first so re-adding retriggers animation
  void game.offsetWidth; // forces browser to recalculate layout, void discards value.
  game.classList.add(...classes); // adds effect class(es) back
  setTimeout(() => game.classList.remove(...classes), duration); // after specified duration, animation classes are removed again
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("breakout_highscore", highScore);
    highScoreEl.textContent = highScore;
    console.log("new high score", highScore);
  }
}

function playSound(audio, volume = 1) {
  if (!audio) return;
  audio.currentTime = 0; // rewinds audio to the start before playing
  audio.volume = volume;
  audio.play().catch(() => {}); // if browser blocks it and sounds dont play, game doesnt crash
}

function createPowerUp(x, y) {
  if (Math.random() > powerUpChance) return; // 80% chance no power up, return

  let availableTypes = Object.keys(powerUpTypes); // array of power ups

  // don't spawn extra life power up if cap reached
  if (lives >= maxLivesCap) {
    availableTypes = availableTypes.filter((t) => t !== powerUpTypes.extraLife);
  }

  // safety guard: if no power ups left, return
  if (availableTypes.length === 0) return;

  // pick random power up
  const type =
    powerUpTypes[
      availableTypes[Math.floor(Math.random() * availableTypes.length)]
    ];

  const powerUp = document.createElement("div");
  powerUp.classList.add("powerup");

  let symbol = "";
  switch (type) {
    case powerUpTypes.bigPaddle:
      symbol = "↔️";
      break;
    case powerUpTypes.multiBall:
      symbol = "🎱";
      break;
    case powerUpTypes.extraLife:
      symbol = "❤️";
      break;
  }

  // stores emoji in data-symbol HTML attribute, for identifying power up is being used
  powerUp.dataset.symbol = symbol;

  // sets horizontal and vertical position
  powerUp.style.left = `${x}px`;
  powerUp.style.top = `${y}px`;

  game.appendChild(powerUp);

  // add power up to the powerUps array
  powerUps.push({ element: powerUp, x, y, type });
}

function activatePowerUp(type) {
  console.log("activate powerup", type);
  playSound(SFX_powerUp, 0.5);
  playEffects("glow-green", 450); // highlight the board when a power-up is caught

  switch (type) {
    case powerUpTypes.bigPaddle:
      // center the paddle as it grows so it expands both left and right
      {
        const gameRect = game.getBoundingClientRect();
        const prevWidth = paddle.offsetWidth; // stores the current paddle width before growing
        const centerX = paddleX + prevWidth / 2; // horizontal center of paddle

        paddle.classList.add("paddle-big");
        const newWidth = paddle.getBoundingClientRect().width;
        const newLeft = Math.max(
          0,
          Math.min(gameRect.width - newWidth, centerX - newWidth / 2) // clamp new left position to fit game area
        );
        paddleX = newLeft;
        paddle.style.left = `${paddleX}px`;
        paddle.classList.add("paddle-hit"); // pulse on grow
        setTimeout(() => paddle.classList.remove("paddle-hit"), 180);
      }
      setTimeout(() => {
        const gameRect = game.getBoundingClientRect();
        const currentWidth = paddle.offsetWidth; // width while big
        const centerX = paddleX + currentWidth / 2;
        paddle.classList.remove("paddle-big");
        const newWidth = paddle.getBoundingClientRect().width; // back to normal
        const newLeft = Math.max(
          0,
          Math.min(gameRect.width - newWidth, centerX - newWidth / 2)
        );
        paddleX = newLeft;
        paddle.style.left = `${paddleX}px`;
      }, 5000); // 5 seconds
      break;
    case powerUpTypes.multiBall:
      // spawn 2 new balls from the first existing ball
      if (balls.length > 0) {
        const sourceBall = balls[0];
        for (let i = 0; i < 2; i++) {
          const ballEl = createBallElement();
          const angle = (Math.random() * Math.PI) / 2 - Math.PI / 4; // random angle upward
          const speed = ballSpeed;

          balls.push({
            element: ballEl,
            x: sourceBall.x,
            y: sourceBall.y,
            vx: speed * Math.sin(angle),
            vy: -Math.abs(speed * Math.cos(angle)),
          });
        }
      }
      break;
    case powerUpTypes.extraLife:
      if (lives < maxLivesCap) {
        lives++;
        livesEl.textContent = "❤️".repeat(lives);
      }
      break;
  }
}

function updatePowerUps() {
  const paddleRect = paddle.getBoundingClientRect();
  const gameRect = game.getBoundingClientRect();

  // loop backwards through the powerUps array
  /* why loop backwards? power ups removed in the middle of array causes gaps, causing skipped elements. 
  looping backwards = safer becauses indexes of unvisited elements dont change */
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.y += powerUpSpeed; // move it down
    p.element.style.top = `${p.y}px`; // apply to DOM element

    const pRect = p.element.getBoundingClientRect();

    // collision with paddle
    if (rectsOverlap(pRect, paddleRect)) {
      activatePowerUp(p.type);
      p.element.remove();
      powerUps.splice(i, 1);
      continue;
    }

    // out of bounds
    if (p.y > gameRect.height) {
      p.element.remove();
      powerUps.splice(i, 1);
    }
  }
}

/*-------------------------------- State Transition --------------------------------*/
function resetGame() {
  console.log("resetGame()");
  score = 0;
  lives = maxLives;
  gameState = GAME_STATES.START;

  createBricks();
  centerPaddle();
  resetBall();

  // clear powerups
  powerUps.forEach((p) => p.element.remove());
  powerUps = [];

  // reset HUD
  scoreEl.textContent = score;
  livesEl.textContent = "❤️".repeat(lives);

  // check if a game loop is currently running
  if (animationId !== null) {
    cancelAnimationFrame(animationId); // stop the game loop, prevents multiple loops
    animationId = null;
  }

  startButton.textContent = "Start";

  showMessage(
    "",
    "Press <strong>Space</strong> or click <strong>Start</strong> to begin.",
    true
  );
}

// transitions from START/LIFE_LOST into active gameplay and starts the game loop
function startPlaying() {
  hideMessage();
  gameState = GAME_STATES.PLAYING;

  if (BGM && BGM.paused) {
    BGM.volume = 0.2;
    BGM.play().catch(() => {});
  }

  animationId = requestAnimationFrame(update);
}

// pauses gameplay, music and shows pause overlay
function pauseGame() {
  if (gameState !== GAME_STATES.PLAYING) return;

  console.log("pauseGame()");
  gameState = GAME_STATES.PAUSED;

  if (BGM && !BGM.paused) {
    BGM.pause();
  }

  startButton.textContent = "Resume";

  showMessage(
    "Game Paused",
    "Press <strong>Space</strong> or <strong>Click</strong> to resume.",
    false
  );
}

// resumes game from PAUSED state and restarts the loop
function resumeGame() {
  if (gameState !== GAME_STATES.PAUSED) return;
  console.log("resumeGame()");
  hideMessage();
  gameState = GAME_STATES.PLAYING;

  if (BGM && BGM.paused) {
    BGM.play().catch(() => {});
  }

  animationId = requestAnimationFrame(update);
}

// handles transition after losing a life (with remaining lives left)
function handleLifeLost() {
  console.log("handleLifeLost()");
  gameState = GAME_STATES.LIFE_LOST;

  startButton.textContent = "Start";

  showMessage(
    "You lost a life!",
    "Press <strong>Space</strong> or <strong>Click</strong> to resume.",
    false
  );
}

// stop music, show final score, switch to GAME_OVER
function handleGameOver(finalScore) {
  console.log("handleGameOver()");

  if (BGM) {
    BGM.pause();
    BGM.currentTime = 0;
  }
  playSound(SFX_gameOver, 0.9);

  gameState = GAME_STATES.GAME_OVER;

  startButton.textContent = "Play Again";

  showMessage(
    "Game Over 💥",
    `Final Score: <strong>${finalScore}</strong><br/>Press <strong>Space</strong> or click <strong>Start</strong> to play again.`,
    true
  );
}

// applies life bonus, updates high score, shows score table
function handleWin(finalScore) {
  console.log("handleWin()");

  if (BGM) {
    BGM.pause();
    BGM.currentTime = 0;
  }
  playSound(SFX_gameWin, 0.9);

  const baseScore = finalScore ?? score; // if finalScore exists (not null, not undefined) use it, otherwise use score

  const bonus = lives * 50;
  const totalScore = baseScore + bonus;

  score = totalScore;
  scoreEl.textContent = totalScore;

  updateHighScore();

  gameState = GAME_STATES.WIN;

  startButton.textContent = "Play Again";

  const messageHtml = `
  <div class="score-table">
    <div class="row">
      <span class="label">Bricks Score</span>
      <span class="value">${baseScore}</span>
    </div>
    <div class="row">
      <span class="label">Lives Bonus</span>
      <span class="value">+${bonus}</span>
    </div>
    <div class="row total">
      <span class="label">Total</span>
      <span class="value">${totalScore}</span>
    </div>
  </div>
`;

  startButton.textContent = "Play Again";
  showMessage("You Win! 🎉", messageHtml, true);
}

// maps primary action (space/start) to correct behaviour by game state
function handlePrimaryAction() {
  switch (gameState) {
    case GAME_STATES.START:
    case GAME_STATES.LIFE_LOST:
      startPlaying();
      break;
    case GAME_STATES.PLAYING:
      pauseGame();
      break;
    case GAME_STATES.PAUSED:
      resumeGame();
      break;
    case GAME_STATES.GAME_OVER:
    case GAME_STATES.WIN:
      resetGame();
      break;
    default:
      break;
  }
}

/*-------------------------------- Input Handling --------------------------------*/
document.addEventListener("keydown", (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
  }

  if (e.code === "Space") {
    console.log("space button pressed");
    e.preventDefault();
    playSound(SFX_buttonClick, 0.9);
    handlePrimaryAction();
  }

  // cheat code: 0 to destroy all bricks & force win
  if (e.key === "0") {
    console.log("cheat activated: clear all bricks");
    const maxScore = rows * cols * 10; // adds score from all bricks
    score = maxScore;
    scoreEl.textContent = score;

    // hides active bricks
    bricks.forEach((brick, index) => {
      if (brick) {
        brick.style.visibility = "hidden";
        bricks[index] = null;
      }
    });

    const finalScore = score;
    updateHighScore();
    handleWin(finalScore);
  }

  // clear high score with 8
  if (e.key === "8") {
    console.log("high score cleared");
    highScore = 0;
    localStorage.setItem("breakout_highscore", highScore);
    highScoreEl.textContent = highScore;
  }

  // quick restart with 9
  if (e.key === "9") {
    console.log("manual restart");
    resetGame();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
  }
});

// mouse control for paddle
document.addEventListener("mousemove", (e) => {
  if (gameState !== GAME_STATES.PLAYING) return; // only works during gameplay

  const gameRect = game.getBoundingClientRect();
  const paddleWidth = paddle.offsetWidth; // reads current width from DOM (needed because of powerup, centering paddle under mouse and correct boundaries)

  const relativeX = e.clientX - gameRect.left; // .clientX = mouse position relative to whole browser window
  paddleX = relativeX - paddleWidth / 2; // centers paddle under mouse

  const maxPaddleX = gameRect.width - paddleWidth; // computes furthest right that paddle is allowed to go
  paddleX = Math.max(0, Math.min(maxPaddleX, paddleX)); // clamps paddle so that it never leaves the game area

  paddle.style.left = `${paddleX}px`;
});

// start button does same as Space
startButton.addEventListener("click", () => {
  console.log("start button clicked");
  playSound(SFX_buttonClick, 0.9);
  handlePrimaryAction();
});

// restart button always full reset
restartButton.addEventListener("click", () => {
  console.log("restart button clicked");
  playSound(SFX_buttonClick, 0.9);
  resetGame();
});

// button hover
// loops through array of two DOM elements
[startButton, restartButton].forEach((btn) => {
  btn.addEventListener("mouseenter", () => {
    playSound(SFX_buttonHover, 0.6);
  });
});

messageOverlay.addEventListener("click", () => {
  if (gameState === GAME_STATES.PAUSED) {
    console.log("resume via overlay click (paused)");
    playSound(SFX_buttonClick, 0.8);
    resumeGame();
  } else if (gameState === GAME_STATES.LIFE_LOST) {
    console.log("resume via overlay click (life lost)");
    playSound(SFX_buttonClick, 0.8);
    startPlaying();
  }
});

/*-------------------------------- Game Loop --------------------------------*/
function movePaddle() {
  const gameRect = game.getBoundingClientRect();
  let moveDir = 0; // -1 move left, +1 move right, 0 no movement
  if (keys.ArrowLeft || keys.a) moveDir -= 1;
  if (keys.ArrowRight || keys.d) moveDir += 1;

  // read paddle's width from DOM
  const paddleWidth = paddle.offsetWidth;

  // multiply direction by speed and add to current position
  paddleX += moveDir * paddleSpeed;

  // calculates furthest right position the paddle is allowed to be
  const maxPaddleX = gameRect.width - paddleWidth;
  // clamps paddle position to stay between 0 (left wall) and maxPaddleX (right wall)
  paddleX = Math.max(0, Math.min(maxPaddleX, paddleX));

  paddle.style.left = `${paddleX}px`;
}

function moveBalls(gameRect) {
  // loop backwards, avoids skipping or breaking indexing
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.element.style.left = `${ball.x}px`;
    ball.element.style.top = `${ball.y}px`;

    // check bottom boundary (loss)
    if (ball.y + ballHeight >= gameRect.height) {
      // remove DOM element so it disappears instantly
      ball.element.remove();
      balls.splice(i, 1);
    }
  }
}

function createCollisionEffect(x, y) {
  const effect = document.createElement("div");
  effect.classList.add("collision-effect");
  effect.style.left = `${x}px`; // positions effect horiontally at collision point
  effect.style.top = `${y}px`; // positions it vertically
  game.appendChild(effect); // adds effect to game board
  setTimeout(() => effect.remove(), 300); // remove after 300ms
}

function checkWallCollisions(gameRect) {
  // loops through every active ball in the balls array
  balls.forEach((ball) => {
    // left wall
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx *= -1;
      playSound(SFX_hit, 0.9);
      createCollisionEffect(0, ball.y);
    }
    // right wall
    else if (ball.x + ballWidth >= gameRect.width) {
      ball.x = gameRect.width - ballWidth;
      ball.vx *= -1;
      playSound(SFX_hit, 0.9);
      createCollisionEffect(gameRect.width, ball.y);
    }

    const hudHeight = 48; // prevents hitting HUD area at the top
    if (ball.y <= hudHeight) {
      ball.y = hudHeight;
      ball.vy *= -1;
      createCollisionEffect(ball.x, hudHeight);
    }
  });

  // check if all balls are lost (life loss or game over handled here)
  if (balls.length === 0) {
    console.log("life lost");
    lives -= 1;
    livesEl.textContent = "❤️".repeat(lives);
    playEffects(["shake-hard", "glow-red"], 600);

    playSound(SFX_lifeLost, 0.9);

    if (lives <= 0) {
      console.log("game over");
      updateHighScore();
      const finalScore = score;
      handleGameOver(finalScore);
      return true; // stop update loop
    } else {
      // lost a life, reset paddle/ball and wait for player
      centerPaddle();
      resetBall();
      handleLifeLost();
      return true; // stop update loop
    }
  }
  return false;
}

function checkPaddleCollision(paddleRect) {
  // loops through each active ball
  balls.forEach((ball) => {
    const ballRect = ball.element.getBoundingClientRect();

    if (
      ballRect.bottom >= paddleRect.top && // bottom of ball below top of paddle
      ballRect.top <= paddleRect.bottom && // top of ball above bottom of paddle
      ballRect.right >= paddleRect.left && // ball right side intersecting with paddle's left edge
      ballRect.left <= paddleRect.right && // ball right side intersecting with paddle's right edge
      ball.vy > 0 // ball moving downwards,
    ) {
      console.log("paddle hit");

      playSound(SFX_hit, 0.9);
      paddle.classList.add("paddle-hit");

      // removes paddle-hit class after 150ms
      setTimeout(() => {
        paddle.classList.remove("paddle-hit");
      }, 150);

      // bounce upward, make value negative
      ball.vy = -Math.abs(ball.vy);

      // (center X of ball - how far center is from ledt edge of paddle) / normalize paddle width into value between 0 to 1
      // hit position (0 = left, 1 = right)
      const hitPos =
        (ballRect.left + ballRect.width / 2 - paddleRect.left) /
        paddleRect.width;

      // convert hitPos into angle: hit left/right = angle negative/positive > ball goes left/right, hit center = 0 degrees = straight up
      const angle = (hitPos - 0.5) * (Math.PI / 2); // ranges from +- 0.5 multiply by 90 degrees = angles ranges +- 45 degrees
      // gets current speed using pythagoras
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

      // apply new bounce angle
      ball.vx = speed * Math.sin(angle) * 1.5; // 1.5 makes paddles hit faster because angle is sharper
      ball.vy = -Math.abs(speed * Math.cos(angle)); // ball always moves upwards
    }
  });
}

function checkBrickCollisions(gameRect) {
  let hitOccurred = false;

  balls.forEach((ball) => {
    const ballRect = ball.element.getBoundingClientRect();
    let hitBrick = null;

    for (let i = 0; i < bricks.length; i++) {
      const brick = bricks[i];
      if (!brick) continue; // skip brick if destroyed

      const brickRect = brick.getBoundingClientRect();

      if (rectsOverlap(ballRect, brickRect)) {
        hitBrick = { brick, index: i, brickRect }; // store brick, index and rect
        break;
      }
    }

    if (hitBrick) {
      const { brick, index, brickRect } = hitBrick; // get stored info

      playSound(SFX_brickHit, 0.9);

      // overlap calculations
      const overlapLeft = ballRect.right - brickRect.left;
      const overlapRight = brickRect.right - ballRect.left;
      const overlapTop = ballRect.bottom - brickRect.top;
      const overlapBottom = brickRect.bottom - ballRect.top;

      // get smallest overlap
      const minOverlap = Math.min(
        overlapLeft,
        overlapRight,
        overlapTop,
        overlapBottom
      );

      // determines which side is hit, ball gets pushed in the correct diretion
      if (minOverlap === overlapLeft) {
        ball.x -= overlapLeft;
        ball.vx = -Math.abs(ball.vx);
      } else if (minOverlap === overlapRight) {
        ball.x += overlapRight;
        ball.vx = Math.abs(ball.vx);
      } else if (minOverlap === overlapTop) {
        ball.y -= overlapTop;
        ball.vy = -Math.abs(ball.vy);
      } else {
        ball.y += overlapBottom;
        ball.vy = Math.abs(ball.vy);
      }

      // animation
      brick.classList.add("brick-explode");

      setTimeout(() => {
        brick.style.visibility = "hidden";
        brick.classList.remove("brick-explode");
      }, 250);

      // mark brick as destroyed
      bricks[index] = null;
      playEffects("shake-soft", 250);
      console.log("brick destroyed", brick.dataset);

      // update score
      score += 10;
      scoreEl.textContent = score;

      const gameRect = game.getBoundingClientRect();
      // compute x and y position relative to game container
      const relativeX = brickRect.left - gameRect.left + brickRect.width / 2;
      const relativeY = brickRect.top - gameRect.top;
      // chance to spawn powerup
      createPowerUp(relativeX, relativeY);

      hitOccurred = true;
    }
  });

  if (hitOccurred) {
    // count how many bricks are not null
    const remaining = bricks.filter(Boolean).length;

    // if no bricks remain
    if (remaining === 0) {
      const finalScore = score;
      updateHighScore();
      handleWin(finalScore);
      return true; // stop update loop
    }
  }
  return false;
}

function update() {
  if (gameState !== GAME_STATES.PLAYING) return;

  const gameRect = game.getBoundingClientRect();

  movePaddle();
  moveBalls(gameRect);
  updatePowerUps();

  // if returns true, return
  if (checkWallCollisions(gameRect)) return;

  const paddleRect = paddle.getBoundingClientRect();
  checkPaddleCollision(paddleRect);

  // if returns true, return
  if (checkBrickCollisions(gameRect)) return;

  // schedule next frame if still in playing state
  if (gameState === GAME_STATES.PLAYING) {
    // ask browser to call update() again on next frame
    animationId = requestAnimationFrame(update);
  }
}

/*-------------------------------- Init --------------------------------*/
window.addEventListener("load", () => {
  createBricks();
  centerPaddle();
  resetBall();
  livesEl.textContent = "❤️".repeat(lives);
  showMessage(
    "",
    "Press <strong>Space</strong> or click <strong>Start</strong> to launch the ball.",
    true
  );
});

window.addEventListener("resize", () => {
  if (gameState !== GAME_STATES.PLAYING) {
    centerPaddle();
    resetBall();
  }
});
