(() => {
  'use strict';

  // ---------- Config ----------
  const COLS = 20, ROWS = 20;
  const BASE_DELAY = 150;       // ms per move at level 1
  const MIN_DELAY = 60;         // fastest allowed speed
  const SPEEDUP = 4;            // ms faster for every food eaten
  const FOODS_PER_LEVEL = 5;
  const STORAGE_KEY = 'snake-best-score';

  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
  };
  const KEYS = {
    arrowup: 'up', w: 'up',
    arrowdown: 'down', s: 'down',
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right',
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const boardWrap = $('boardWrap');
  const overlay = $('overlay'), overlayTitle = $('overlayTitle'), overlayText = $('overlayText');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level');
  const startBtn = $('startBtn'), pauseBtn = $('pauseBtn'), restartBtn = $('restartBtn');
  const CELL = canvas.width / COLS;

  // ---------- State ----------
  let snake, dir, queue, food, score, foodsEaten, best, status, timer, colors;
  // status: 'idle' | 'running' | 'paused' | 'over'

  // ---------- Storage (guarded: may be blocked in private mode) ----------
  function loadBest() {
    try { return parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0; }
    catch { return 0; }
  }
  function saveBest(value) {
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
  }

  // ---------- Setup ----------
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    colors = {
      a: v('--board-a'), b: v('--board-b'),
      snake: v('--snake'), head: v('--snake-head'), food: v('--food'),
    };
  }

  function reset() {
    clearTimeout(timer);
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; // head first
    dir = DIRS.right;
    queue = [];                // buffered turns so quick key presses aren't lost
    score = 0;
    foodsEaten = 0;
    placeFood();
    boardWrap.classList.remove('shake');
    updateHud();
  }

  function placeFood() {
    const free = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // ---------- Game flow ----------
  const level = () => Math.floor(foodsEaten / FOODS_PER_LEVEL) + 1;
  const delay = () => Math.max(MIN_DELAY, BASE_DELAY - foodsEaten * SPEEDUP);

  function start() {
    if (status === 'running') return;
    if (status === 'over') reset();
    if (status === 'paused' || status === 'idle' || status === 'over') {
      status = 'running';
      hideOverlay();
      syncButtons();
      timer = setTimeout(tick, delay());
    }
  }

  function togglePause() {
    if (status === 'running') {
      status = 'paused';
      clearTimeout(timer);
      showOverlay('Paused', 'Press Resume or Space to continue.');
    } else if (status === 'paused') {
      start();
    }
    syncButtons();
  }

  function restart() {
    reset();
    status = 'idle';
    start();
  }

  function gameOver() {
    status = 'over';
    clearTimeout(timer);
    if (score > best) { best = score; saveBest(best); }
    updateHud();
    boardWrap.classList.add('shake');
    showOverlay('Game Over', `Score: ${score} · Best: ${best}. Press Start to play again.`);
    syncButtons();
  }

  function tick() {
    if (status !== 'running') return;
    if (queue.length) dir = queue.shift();

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const ate = food && head.x === food.x && head.y === food.y;

    // Wall collision
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return gameOver();

    // Self collision (the tail cell frees up this move unless we're growing)
    const body = ate ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);
    if (ate) {
      score++;
      foodsEaten++;
      placeFood();
      if (score > best) { best = score; saveBest(best); }
      updateHud();
    } else {
      snake.pop();
    }

    draw();
    timer = setTimeout(tick, delay()); // delay shrinks as the snake eats
  }

  // ---------- Input ----------
  function turn(name) {
    const next = DIRS[name];
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (next === last) return;                              // already heading that way
    if (next.x === -last.x && next.y === -last.y) return;   // block direct reversal
    if (queue.length < 2) queue.push(next);
  }

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (KEYS[key]) {
      e.preventDefault(); // stop arrow keys from scrolling the page
      if (status === 'idle') start();
      turn(KEYS[key]);
    } else if (e.key === ' ' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      status === 'running' || status === 'paused' ? togglePause() : start();
    }
  });

  document.querySelectorAll('.dir').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (status === 'idle') start();
      turn(btn.dataset.dir);
    })
  );

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', restart);

  // ---------- UI helpers ----------
  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    levelEl.textContent = level();
  }

  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.hidden = false;
  }
  const hideOverlay = () => { overlay.hidden = true; };

  function syncButtons() {
    startBtn.disabled = status === 'running';
    startBtn.textContent = status === 'paused' ? 'Resume' : status === 'over' ? 'Play Again' : 'Start';
    pauseBtn.disabled = status !== 'running' && status !== 'paused';
    pauseBtn.textContent = status === 'paused' ? 'Resume' : 'Pause';
  }

  // ---------- Rendering ----------
  function cell(x, y, color, inset = 1.5, radius = 6) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const px = x * CELL + inset, py = y * CELL + inset, size = CELL - inset * 2;
    if (ctx.roundRect) ctx.roundRect(px, py, size, size, radius);
    else ctx.rect(px, py, size, size);
    ctx.fill();
  }

  function draw() {
    // Checkerboard background
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.fillStyle = (x + y) % 2 ? colors.b : colors.a;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    if (food) cell(food.x, food.y, colors.food, 4, CELL / 2);
    snake.forEach((s, i) => cell(s.x, s.y, i === 0 ? colors.head : colors.snake));
  }

  // ---------- Init ----------
  best = loadBest();
  readColors();
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { readColors(); draw(); });
  reset();
  status = 'idle';
  syncButtons();
  draw();
})();
