/* global Sat */

const State = {
  PLAYING: 'PLAYING',
  WIN: 'WIN',
  DEAD: 'DEAD',
};

const Hint = {
  MINE: 'MINE',
  UNKNOWN: 'UNKNOWN',
  SAFE: 'SAFE',
};

class Game {
  constructor(width, height, numMines) {
    this.width = width;
    this.height = height;
    this.numMines = numMines;
    this.map = new LabelMap(this.width, this.height);
    //this.mines = makeGrid(this.width, this.height, false);
    this.flags = makeGrid(this.width, this.height, false);
    this.numRevealed = 0;
    this.numFlags = 0;

    this.state = State.PLAYING;

    this.debug = false;
    this.allowOutside = false;

    this.recalc();
  }

  mount(gameElement) {
    const boardElement = document.createElement('div');
    boardElement.className = 'board';
    gameElement.appendChild(boardElement);

    this.cells = [];

    for (let y = 0; y < this.height; y++) {
      this.cells.push([]);
      const row = document.createElement('div');
      row.className = 'board-row';
      for (let x = 0; x < this.width; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell clickable unknown';
        cell.onclick = e => this.cellClick(e, x, y);
        cell.onmousedown = e => this.cellMouseDown(e, x, y);
        cell.ondblclick = e => this.cellAltClick(e, x, y);
        cell.oncontextmenu = e => this.cellRightClick(e, x, y);
        row.appendChild(cell);
        this.cells[y].push(cell);
      }
      boardElement.appendChild(row);
    }

    this.stateElement = document.createElement('div');
    gameElement.appendChild(this.stateElement);

    this.refresh();
  }

  setDebug(debug) {
    this.debug = debug;
    this.refresh();
  }

  setAllowOutside(allowOutside) {
    this.allowOutside = allowOutside;
  }

  cellClick(e, x, y) {
    e.preventDefault();
    this.reveal(x, y);
  }

  cellMouseDown(e, x, y) {
    if (e.button === 1) {
      e.preventDefault();
      this.revealAround(x, y);
    }
  }

  cellAltClick(e, x, y) {
    e.preventDefault();
    this.revealAround(x, y);
  }

  cellRightClick(e, x, y) {
    e.preventDefault();
    if (this.state === State.PLAYING) {
      this.toggleFlag(x, y);
      this.refresh();
    }
  }

  revealAround(x, y) {
    if (!(this.state === State.PLAYING && this.map.labels[y][x] !== null)) {
      return;
    }
    let flags = 0;
    for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
      if (this.flags[y0][x0]) {
        flags++;
      }
    }
    if (this.map.labels[y][x] > flags) {
      return;
    }

    for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
      this.reveal(x0, y0);
    }
  }

  reveal(x, y) {
    if (!(this.state === State.PLAYING && this.map.labels[y][x] === null && !this.flags[y][x])) {
      return;
    }

    const hasSafeCells = this.solver.hasSafeCells();
    const hasNonDeadlyCells = this.solver.hasNonDeadlyCells();

    let mineGrid;
    if (this.map.boundaryGrid[y][x] === null) {
      // Clicked somewhere outside of boundary.

      let outsideIsSafe;
      if (this.allowOutside) {
        outsideIsSafe = this.map.boundary.length === 0 || (!hasSafeCells && this.solver.outsideCanBeSafe());
      } else {
        outsideIsSafe = this.map.boundary.length === 0 || this.solver.outsideIsSafe() || !hasNonDeadlyCells;
      }

      if (outsideIsSafe) {
        const shape = this.solver.anyShape();
        mineGrid = shape.mineGridWithEmpty(x, y);
      } else {
        const shape = this.solver.anyShapeWithRemaining();
        mineGrid = shape.mineGridWithMine(x, y);
      }
    } else {
      // Clicked on boundary.

      const idx = this.map.boundaryGrid[y][x];

      let shape;
      if (this.solver.canBeSafe(idx) && (
        !this.solver.canBeDangerous(idx) || !hasSafeCells)) {
        shape = this.solver.anySafeShape(idx);
      } else {
        shape = this.solver.anyDangerousShape(idx);
      }
      mineGrid = shape.mineGrid();
    }

    if (mineGrid[y][x]) {
      this.state = State.DEAD;
      this.deathX = x;
      this.deathY = y;
      this.mineGrid = mineGrid;
    } else {
      this.floodReveal(x, y, mineGrid);
    }

    this.recalc();
    this.refresh();
  }

  floodReveal(x, y, mineGrid) {
    let n = 0;
    for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
      if (mineGrid[y0][x0]) {
        n++;
      }
    }

    if (this.flags[y][x]) {
      this.flags[y][x] = false;
      this.numFlags--;
    }

    this.map.labels[y][x] = n;
    this.numRevealed++;
    if (this.numRevealed + this.numMines === this.width * this.height) {
      this.state = State.WIN;
      this.mineGrid = mineGrid;
      return;
    }

    if (n === 0) {
      for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
        if (this.map.labels[y0][x0] === null) {
          this.floodReveal(x0, y0, mineGrid);
        }
      }
    }
  }

  recalc() {
    this.map.recalc();
    this.solver = makeSolver(this.map, this.numMines);
    this.shapes = this.solver.shapes;

    this.hints = makeGrid(this.width, this.height, null);
    for (let i = 0; i < this.map.boundary.length; i++) {
      const [x, y] = this.map.boundary[i];
      const hasTrue = this.solver.canBeDangerous(i);
      const hasFalse = this.solver.canBeSafe(i);

      let hint = null;
      if (hasTrue && hasFalse) {
        hint = Hint.UNKNOWN;
      } else if (hasTrue && !hasFalse) {
        hint = Hint.MINE;
      } else if (!hasTrue && hasFalse) {
        hint = Hint.SAFE;
      }
      this.hints[y][x] = hint;
    }
  }

  toggleFlag(x, y) {
    if (!(this.state === State.PLAYING && this.map.labels[y][x] === null)) {
      return;
    }
    if (this.flags[y][x]) {
      this.flags[y][x] = false;
      this.numFlags--;
    } else {
      this.flags[y][x] = true;
      this.numFlags++;
    }
  }

  refresh() {
    const HINTS = {
      [Hint.SAFE]: '.',
      [Hint.UNKNOWN]: '?',
      [Hint.MINE]: '!',
    };

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const label = this.map.labels[y][x];
        const mine = this.mineGrid && this.mineGrid[y][x];
        const flag = this.flags[y][x];
        const hint = this.hints[y][x];

        let className;
        let content;
        if (this.state === State.DEAD && mine && x === this.deathX && y === this.deathY) {
          className = 'label';
          content = '&#10006;';
        } else if (this.state === State.DEAD && mine) {
          className = 'bomb';
          content = '&#10006;';
        } else if (this.state === State.WIN && mine) {
          className = 'bomb';
          content = '&#11044';
        } else if (label !== null && label > 0) {
          className = `label label-${label}`;
          content = `${label}`;
        } else if (label === 0) {
          className = 'label';
          content = '&nbsp;';
        } else if (flag) {
          className = 'clickable unknown';
          content = '&#9873;';
        } else if (this.debug && this.state === State.PLAYING && hint !== null) {
          className = 'clickable unknown hint';
          content = HINTS[hint];
        } else if (this.debug && hint !== null) {
          className = 'unknown hint';
          content = HINTS[hint];
        } else if (this.state === State.PLAYING) {
          className = 'clickable unknown';
          content = '&nbsp;';
        } else {
          className = 'unknown';
          content = '&nbsp;';
        }
        this.cells[y][x].className = 'cell ' + className;
        this.cells[y][x].innerHTML = content;
      }
    }

    let message;
    switch (this.state) {
      case State.PLAYING:
        message = `Mines: ${this.numFlags}/${this.numMines}`;
        if (this.debug) {
          message += ', ' + this.solver.debugMessage();
        }

        break;
      case State.WIN:
        message = 'You win!';
        break;
      case State.DEAD:
        message = 'You lose!';
        break;
    }
    this.stateElement.textContent = message;
  }
}

function* neighbors(x, y, width, height) {
  for (let y0 = y - 1; y0 <= y + 1; y0++) {
    for (let x0 = x - 1; x0 <= x + 1; x0++) {
      if (0 <= x0 && x0 < width &&
        0 <= y0 && y0 < height &&
        (y0 !== y || x0 !== x)) {
          yield [x0, y0];
        }
    }
  }
}

class LabelMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.labels = makeGrid(width, height, null);
    this.cache = makeGrid(width, height, null);
    this.recalc();
  }

  recalc() {
    this.boundary = [];
    this.boundaryGrid = makeGrid(this.width, this.height, null);
    this.numOutside = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.labels[y][x] === null) {
          for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
            if (this.labels[y0][x0] !== null) {
              this.boundaryGrid[y][x] = this.boundary.length;
              this.boundary.push([x, y]);
              break;
            }
          }

          if (this.boundaryGrid[y][x] === null) {
            this.numOutside++;
          }
        }
      }
    }
  }

  setCache(i, val) {
    const [x, y] = this.boundary[i];
    this.cache[y][x] = val;
  }

  getCache(i) {
    const [x, y] = this.boundary[i];
    return this.cache[y][x];
  }
}

class Shape {
  constructor(map, mines, remaining) {
    this.map = map;
    this.mines = mines;
    this.remaining = remaining;
  }

  baseMineGrid() {
    const mineGrid = makeGrid(this.map.width, this.map.height, false);
    for (let i = 0; i < this.mines.length; i++) {
      if (this.mines[i]) {
        const [x, y] = this.map.boundary[i];
        mineGrid[y][x] = true;
      }
    }
    return mineGrid;
  }

  addRandom(mineGrid, remaining, exceptX, exceptY) {
    if (remaining > 0) {
      const toSelect = [];
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          if (this.map.labels[y][x] === null && this.map.boundaryGrid[y][x] === null
            && !(x === exceptX && y === exceptY)) {
              toSelect.push([x, y]);
          }
        }
      }
      shuffle(toSelect);
      for (let i = 0; i < remaining; i++) {
        const [x, y] = toSelect[i];
        mineGrid[y][x] = true;
      }
    }

    return mineGrid;
  }

  mineGrid() {
    const mineGrid = this.baseMineGrid();
    this.addRandom(mineGrid, this.remaining);
    return mineGrid;
  }

  mineGridWithMine(x, y) {
    const mineGrid = this.baseMineGrid();
    mineGrid[y][x] = true;
    this.addRandom(mineGrid, this.remaining - 1, x, y);
    return mineGrid;
  }

  mineGridWithEmpty(x, y) {
    const mineGrid = this.baseMineGrid();
    this.addRandom(mineGrid, this.remaining, x, y);
    return mineGrid;
  }
}

class Solver {
  constructor(map, numMines, minMines, maxMines) {
    this.map = map;

    this.numMines = numMines;
    this.minMines = minMines;
    this.maxMines = maxMines;

    this.labels = [];
    this.labelToMine = [];
    this.cache = new Array(numMines).fill(null);

    this.sat = new Sat(this.numMines);

    this._canBeSafe = new Array(numMines).fill(null);
    this._canBeDangerous = new Array(numMines).fill(null);

    this.uncachedMines = [];
    this.numCachedTrue = 0;
    for (let i = 0; i < this.numMines; i++) {
      const c = map.getCache(i);
      this.cache[i] = c;
      if (c === null) {
        this.uncachedMines.push(i);
      } else if (c) {
        this.numCachedTrue++;
      }
    }
  }

  addLabel(label, mineList) {
    const uncachedMineList = [];
    for (const m of mineList) {
      if (this.cache[m] === null) {
        uncachedMineList.push(m);
      } else if (this.cache[m]) {
        label--;
      }
    }

    this.labels.push(label);
    this.labelToMine.push(uncachedMineList);
  }

  run() {
    for (let i = 0; i < this.labels.length; i++) {
      const label = this.labels[i];
      const vars = this.labelToMine[i].map(n => n+1);

      this.sat.assertAtLeast(vars, label);
      this.sat.assertAtMost(vars, label);
    }
    for (let i = 0; i < this.numMines; i++) {
      if (this.cache[i] === true) {
        this.sat.assert([i+1]);
      } else if (this.cache[i] === false) {
        this.sat.assert([-(i+1)]);
      }
    }

    this.sat.addCounter(this.uncachedMines.map(m => m+1));
    this.sat.assertCounterAtLeast(Math.max(0, this.minMines - this.numCachedTrue));
    this.sat.assertCounterAtMost(Math.max(0, this.maxMines - this.numCachedTrue));

    for (let i = 0; i < this.numMines; i++) {
      if (this.cache[i] !== null) {
        if (this.cache[i]) {
          this._canBeSafe[i] = false;
          this._canBeDangerous[i] = true;
        } else {
          this._canBeSafe[i] = true;
          this._canBeDangerous[i] = false;
        }
        continue;
      }

      if (this._canBeSafe[i] === null) {
        const solution = this.sat.solveWith(() => this.sat.assert([-(i+1)]));
        if (solution !== null) {
          this.update(solution);
        } else {
          this._canBeSafe[i] = false;
        }
      }

      if (this._canBeDangerous[i] === null) {
        const solution = this.sat.solveWith(() => this.sat.assert([i+1]));
        if (solution !== null) {
          this.update(solution);
        } else {
          this._canBeDangerous[i] = false;
        }
      }

      if (this._canBeDangerous[i] && !this._canBeSafe[i]) {
        this.map.setCache(i, true);
      } else if (this._canBeSafe[i] && !this._canBeDangerous[i]) {
        this.map.setCache(i, false);
      }
    }
  }

  update(solution) {
    for (let i = 0; i < this.numMines; i++) {
      if (solution[i+1]) {
        this._canBeDangerous[i] = true;
      } else {
        this._canBeSafe[i] = true;
      }
    }
  }

  shape(solution) {
    if (!solution) {
      return null;
    }
    const mines = solution.slice(1, this.numMines+1);
    let sum = 0;
    for (const m of mines) {
      if (m) {
        sum++;
      }
    }
    return new Shape(this.map, mines, this.maxMines - sum);
  }

  anyShape() {
    return this.shape(this.sat.solve());
  }

  anyShapeWithRemaining() {
    return this.shape(this.sat.solveWith(() => this.sat.assertCounterAtMost(this.maxMines - this.numCachedTrue - 1)));
  }

  anySafeShape(idx) {
    return this.shape(this.sat.solveWith(() => this.sat.assert([-(idx+1)])));
  }

  anyDangerousShape(idx) {
    return this.shape(this.sat.solveWith(() => this.sat.assert([idx+1])));
  }

  canBeSafe(idx) {
    return this._canBeSafe[idx];
  }

  canBeDangerous(idx) {
    return this._canBeDangerous[idx];
  }

  hasSafeCells() {
    for (let i = 0; i < this.numMines; i++) {
      if (!this.canBeDangerous(i)) {
        return true;
      }
    }
    return false;
  }

  hasNonDeadlyCells() {
    for (let i = 0; i < this.numMines; i++) {
      if (this.canBeSafe(i)) {
        return true;
      }
    }
    return false;
  }

  // Check if there is no possibility that outside will contain a mine
  outsideIsSafe() {
    return this.numMines >= this.maxMines &&
            !this.sat.solveWith(() => this.sat.assertCounterAtMost(this.maxMines - this.numCachedTrue - 1));
  }

  // Check if there is a possibility that outside will NOT contain a mine
  outsideCanBeSafe() {
    // we need to have at least minMines+1, if we have minMines that means
    // all the outside squares contain mines.
    return this.minMines < 0 ||
      !!this.sat.solveWith(() => this.sat.assertCounterAtLeast(this.minMines - this.numCachedTrue + 1));
  }

  debugMessage() {
    return `boundary: ${this.numMines}, uncached: ${this.uncachedMines.length}, ` +
      `clauses: ${this.sat.clauses.length}, minMines: ${this.minMines}, maxMines: ${this.maxMines}`;
  }
}

function makeSolver(map, maxMines) {
  const minMines = maxMines - map.numOutside;
  const solver = new Solver(map, map.boundary.length, minMines, maxMines);

  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      const label = map.labels[y][x];
      if (label === null) {
        continue;
      }

      const mineList = [];
      for (const [x0, y0] of neighbors(x, y, map.width, map.height)) {
        const mineIdx = map.boundaryGrid[y0][x0];
        if (mineIdx !== null) {
          mineList.push(mineIdx);
        }
      }
      if (mineList.length > 0) {
        solver.addLabel(label, mineList);
      }
    }
  }

  solver.run();
  return solver;
}

function makeGrid(width, height, value) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill(value));
  }
  return grid;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const x = a[i];
      a[i] = a[j];
      a[j] = x;
  }
  return a;
}

let game;

function newGame() {
  const width = parseInt(document.getElementById('width').value, 10);
  const height = parseInt(document.getElementById('height').value, 10);
  const numMines = parseInt(document.getElementById('numMines').value, 10);
  const debug = document.getElementById('debug').checked;
  const allowOutside = document.getElementById('allowOutside').checked;

  if (isNaN(width) || isNaN(height) || isNaN(numMines)) {
    alert('You need to enter a number!');
    return;
  }

  if (width < 1 || height < 1) {
    alert('Dimensions must be at least 1!');
    return;
  }
  
  if (width * height > 10000) {
    alert("Dimensions too large. Game may crash.");
  }

  if (numMines < 1) {
    alert('Must have at least 1 mine!');
    return;
  }

  if (numMines >= width * height) {
    alert('Too many mines!');
    return;
  }

  const gameElement = document.getElementById('game');
  gameElement.innerHTML = '';
  game = new Game(width, height, numMines);
  game.mount(gameElement);
  game.setDebug(debug);
  game.setAllowOutside(allowOutside);
}

function setParams(width, height, numMines) {
  document.getElementById('width').value = width;
  document.getElementById('height').value = height;
  document.getElementById('numMines').value = numMines;
}

function setDebug(e) {
  game.setDebug(e.target.checked);
}

function setAllowOutside(e) {
  game.setAllowOutside(e.target.checked);
}

newGame();
