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

/*-------------------------------- DOM Elements --------------------------------*/
const game = document.getElementById("game");
const paddle = document.getElementById("paddle");
const ball = document.getElementById("ball");
const bricksContainer = document.getElementById("bricks");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const highScoreEl = document.getElementById("highScore");

const messageOverlay = document.getElementById("message");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restart");

/*-------------------------------- Variables --------------------------------*/
let gameState = GAME_STATES.START;

let bricks = []; // array of brick DOM elements
let score = 0;
let highScore = Number(localStorage.getItem("breakout_highscore")) || 0;
let lives = maxLives;

highScoreEl.textContent = highScore;

let ballX, ballY, ballVX, ballVY; // ball position and velocity per frame
let ballWidth, ballHeight; // cached ball size

let paddleX; // paddle position

let animationId = null; // requestAnimationFrame id

// keyboard input tracking
let keys = {
  ArrowLeft: false,
  ArrowRight: false,
  a: false,
  d: false,
};

/*-------------------------------- Functions --------------------------------*/
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
      brick.style.backgroundColor = getBrickColor(row);

      bricksContainer.appendChild(brick);
      bricks.push(brick);
    }
  }
}

// center paddle at bottom of screen
function centerPaddle() {
  // place paddle in the middle
  const gameRect = game.getBoundingClientRect();
  const paddleRect = paddle.getBoundingClientRect();

  paddleX = (gameRect.width - paddleRect.width) / 2;
  paddle.style.left = `${paddleX}px`;
}

// reset ball above paddle
function resetBall() {
  const gameRect = game.getBoundingClientRect();
  const paddleRect = paddle.getBoundingClientRect();

  const w = ballWidth || ball.getBoundingClientRect().width;
  const h = ballHeight || ball.getBoundingClientRect().height;

  // place ball above paddle center
  ballX = paddleX + paddleRect.width / 2 - w / 2;
  ballY = gameRect.height - 32 - paddleRect.height - h - 4;

  ball.style.left = `${ballX}px`;
  ball.style.top = `${ballY}px`;

  // limit angle to ±30 degrees from vertical
  const maxAngle = Math.PI / 6; // 30 degrees

  // pick random angle between -maxAngle and +maxAngle
  const angle = (Math.random() * 2 - 1) * maxAngle;

  // convert angle into velocity
  ballVX = ballSpeed * Math.sin(angle);
  ballVY = -Math.abs(ballSpeed * Math.cos(angle));

  console.log("ball reset", { ballX, ballY, ballVX, ballVY });
}

function showMessage(title, text, showStartBtn = true) {
  const h2 = messageOverlay.querySelector("h2");
  const p = messageOverlay.querySelector("p");

  h2.textContent = title;
  p.innerHTML = text;

  startButton.classList.toggle("hidden", !showStartBtn);
  messageOverlay.classList.toggle("no-button", !showStartBtn);
  messageOverlay.classList.remove("hidden");
}

function hideMessage() {
  messageOverlay.classList.add("hidden");
}

// returns true when two rectangles overlap on both axes
function rectsOverlap(rect1, rect2) {
  return (
    rect1.left < rect2.right &&
    rect1.right > rect2.left &&
    rect1.top < rect2.bottom &&
    rect1.bottom > rect2.top
  );
}

// helper to pulse css effects
function playEffects(classNames, duration = 300) {
  const classes = Array.isArray(classNames) ? classNames : [classNames];
  game.classList.remove(...classes);
  void game.offsetWidth; // restart animation
  game.classList.add(...classes);
  setTimeout(() => game.classList.remove(...classes), duration);
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("breakout_highscore", highScore);
    highScoreEl.textContent = highScore;
    console.log("new high score", highScore);
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

  scoreEl.textContent = score;
  livesEl.textContent = "❤️".repeat(lives);

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  showMessage(
    "Breakout",
    "Press <strong>Space</strong> or click <strong>Start</strong> to begin.",
    true
  );
}

// start or resume active gameplay
function startPlaying() {
  hideMessage();
  gameState = GAME_STATES.PLAYING;
  animationId = requestAnimationFrame(update);
}

function pauseGame() {
  if (gameState !== GAME_STATES.PLAYING) return;
  console.log("pauseGame()");
  gameState = GAME_STATES.PAUSED;
  showMessage("Paused", "Press <strong>Space</strong> to resume.", false);
}

function resumeGame() {
  if (gameState !== GAME_STATES.PAUSED) return;
  console.log("resumeGame()");
  hideMessage();
  gameState = GAME_STATES.PLAYING;
  animationId = requestAnimationFrame(update);
}

function handleLifeLost() {
  console.log("handleLifeLost()");
  gameState = GAME_STATES.LIFE_LOST;
  showMessage(
    "Life Lost",
    "Press <strong>Space</strong> or <strong>Start</strong> to continue.",
    true
  );
}

function handleGameOver(finalScore) {
  console.log("handleGameOver()");
  gameState = GAME_STATES.GAME_OVER;
  showMessage(
    "Game Over 💥",
    `Final Score: <strong>${finalScore}</strong><br/>Press <strong>Space</strong> or click <strong>Start</strong> to play again.`,
    true
  );
}

function handleWin(finalScore) {
  console.log("handleWin()");
  gameState = GAME_STATES.WIN;
  showMessage(
    "You Win! 🎉",
    `Score: <strong>${finalScore}</strong><br/>Press <strong>Space</strong> or click <strong>Start</strong> to play again.`,
    true
  );
}

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
    handlePrimaryAction();
  }

  // cheat code: 0 to destroy all bricks & force win
  if (e.key === "0") {
    console.log("cheat activated: clear all bricks");
    const maxScore = rows * cols * 10;
    score = maxScore;
    scoreEl.textContent = score;

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
  if (gameState !== GAME_STATES.PLAYING) return;

  const gameRect = game.getBoundingClientRect();
  const paddleWidth = paddle.offsetWidth;

  const relativeX = e.clientX - gameRect.left;
  paddleX = relativeX - paddleWidth / 2;

  const maxPaddleX = gameRect.width - paddleWidth;
  paddleX = Math.max(0, Math.min(maxPaddleX, paddleX));

  paddle.style.left = `${paddleX}px`;
});

// Start button does same as Space
startButton.addEventListener("click", () => {
  console.log("start button clicked");
  handlePrimaryAction();
});

// Restart button always full reset
restartButton.addEventListener("click", () => {
  console.log("restart button clicked");
  resetGame();
});

// allow click on overlay to resume when paused
messageOverlay.addEventListener("click", () => {
  if (gameState === GAME_STATES.PAUSED) {
    console.log("resume via overlay click");
    resumeGame();
  }
});

/*-------------------------------- Game Loop --------------------------------*/
function movePaddle() {
  const gameRect = game.getBoundingClientRect();
  let moveDir = 0;
  if (keys.ArrowLeft || keys.a) moveDir -= 1;
  if (keys.ArrowRight || keys.d) moveDir += 1;

  const paddleWidth = paddle.offsetWidth;
  paddleX += moveDir * paddleSpeed;

  const maxPaddleX = gameRect.width - paddleWidth;
  paddleX = Math.max(0, Math.min(maxPaddleX, paddleX));

  paddle.style.left = `${paddleX}px`;
}

function moveBall() {
  ballX += ballVX;
  ballY += ballVY;

  ball.style.left = `${ballX}px`;
  ball.style.top = `${ballY}px`;
}

function checkWallCollisions(gameRect) {
  // left wall
  if (ballX <= 0) {
    ballX = 0;
    ballVX *= -1;
  }
  // right wall
  else if (ballX + ballWidth >= gameRect.width) {
    ballX = gameRect.width - ballWidth;
    ballVX *= -1;
  }

  const hudHeight = 48; // prevents hitting HUD area at the top
  if (ballY <= hudHeight) {
    ballY = hudHeight;
    ballVY *= -1;
  }

  // bottom (lose a life)
  if (ballY + ballHeight >= gameRect.height) {
    console.log("life lost");
    lives -= 1;
    livesEl.textContent = "❤️".repeat(lives);
    playEffects(["shake-hard", "glow-red"], 600);

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

function checkPaddleCollision(paddleRect, ballRect) {
  if (
    ballRect.bottom >= paddleRect.top &&
    ballRect.top <= paddleRect.bottom &&
    ballRect.right >= paddleRect.left &&
    ballRect.left <= paddleRect.right &&
    ballVY > 0
  ) {
    console.log("paddle hit");
    // bounce upward
    ballVY = -Math.abs(ballVY);

    // hit position (0 = left, 1 = right)
    const hitPos =
      (ballRect.left + ballRect.width / 2 - paddleRect.left) / paddleRect.width;

    const angle = (hitPos - 0.5) * (Math.PI / 2);
    const speed = Math.sqrt(ballVX * ballVX + ballVY * ballVY);

    ballVX = speed * Math.sin(angle) * 1.5;
    ballVY = -Math.abs(speed * Math.cos(angle));
  }
}

function checkBrickCollisions(ballRect, gameRect) {
  let hitBrick = null;

  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i];
    if (!brick) continue;

    const brickRect = brick.getBoundingClientRect();

    if (rectsOverlap(ballRect, brickRect)) {
      hitBrick = { brick, index: i, brickRect };
      break;
    }
  }

  if (hitBrick) {
    const { brick, index, brickRect } = hitBrick;

    const overlapLeft = ballRect.right - brickRect.left;
    const overlapRight = brickRect.right - ballRect.left;
    const overlapTop = ballRect.bottom - brickRect.top;
    const overlapBottom = brickRect.bottom - ballRect.top;

    const minOverlap = Math.min(
      overlapLeft,
      overlapRight,
      overlapTop,
      overlapBottom
    );

    if (minOverlap === overlapLeft) {
      ballX -= overlapLeft;
      ballVX = -Math.abs(ballVX);
    } else if (minOverlap === overlapRight) {
      ballX += overlapRight;
      ballVX = Math.abs(ballVX);
    } else if (minOverlap === overlapTop) {
      ballY -= overlapTop;
      ballVY = -Math.abs(ballVY);
    } else {
      ballY += overlapBottom;
      ballVY = Math.abs(ballVY);
    }

    // remove brick from DOM and array
    brick.style.visibility = "hidden";
    bricks[index] = null;
    playEffects("shake-soft", 250);
    console.log("brick destroyed", brick.dataset);

    score += 10;
    scoreEl.textContent = score;

    const remaining = bricks.filter(Boolean).length;

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
  moveBall();

  if (checkWallCollisions(gameRect)) return;

  const ballRect = ball.getBoundingClientRect();
  const freshPaddleRect = paddle.getBoundingClientRect();

  checkPaddleCollision(freshPaddleRect, ballRect);

  if (checkBrickCollisions(ballRect, gameRect)) return;

  if (gameState === GAME_STATES.PLAYING) {
    animationId = requestAnimationFrame(update);
  }
}

/*-------------------------------- Init --------------------------------*/
window.addEventListener("load", () => {
  // cache ball size once
  const rect = ball.getBoundingClientRect();
  ballWidth = rect.width;
  ballHeight = rect.height;

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
