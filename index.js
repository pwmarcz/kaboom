
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
        cell.onclick = () => this.cellClick(x, y);
        cell.oncontextmenu = e => {
          e.preventDefault();
          this.rightClick(x, y);
        };
        row.appendChild(cell);
        this.cells[y].push(cell);
      }
      boardElement.appendChild(row);
    }

    this.stateElement = document.createElement('div');
    gameElement.appendChild(this.stateElement);

    this.refresh();
  }

  toggleDebug() {
    this.debug = !this.debug;
    this.refresh();
  }

  cellClick(x, y) {
    if (this.state === State.PLAYING) {
      this.reveal(x, y);
      this.recalc();
      this.refresh();
    }
  }

  rightClick(x, y) {
    if (this.state === State.PLAYING) {
      this.toggleFlag(x, y);
      this.refresh();
    }
  }

  reveal(x, y) {
    if (!(this.state === State.PLAYING && this.map.labels[y][x] === null && !this.flags[y][x])) {
      return;
    }

    let hasSafeCells = false;
    for (let i = 0; i < this.map.boundary.length; i++) {
      const dangerousShapes = this.shapes.filter(shape => shape.mines[i]);
      if (dangerousShapes.length === 0) {
        hasSafeCells = true;
        break;
      }
    }

    let outsideIsSafe = true;
    for (const shape of this.shapes) {
      if (shape.remaining > 0) {
        outsideIsSafe = false;
      }
    }

    let mineGrid;
    if (this.map.boundaryGrid[y][x] === null) {
      // Clicked somewhere outside of boundary.

      if (outsideIsSafe || !hasSafeCells) {
        const shape = choice(this.shapes);
        mineGrid = shape.mineGridWithEmpty(x, y);
      } else {
        const dangerousShapes = this.shapes.filter(shape => shape.remaining > 0);
        const shape = choice(dangerousShapes);
        mineGrid = shape.mineGridWithMine(x, y);
      }
    } else {
      // Clicked on boundary.

      const idx = this.map.boundaryGrid[y][x];
      const safeShapes = this.shapes.filter(shape => !shape.mines[idx]);
      const dangerousShapes = this.shapes.filter(shape => shape.mines[idx]);

      let shape;
      if (safeShapes.length > 0 && (dangerousShapes.length === 0 || !hasSafeCells)) {
        shape = choice(safeShapes);
      } else {
        shape = choice(dangerousShapes);
      }
      mineGrid = shape.mineGrid();
    }

    if (mineGrid[y][x]) {
      this.state = State.DEAD;
      this.mineGrid = mineGrid;
      return;
    }

    this.floodReveal(x, y, mineGrid);
    this.map.recalc();
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
    this.shapes = findShapes(this.map, this.numMines);

    this.hints = makeGrid(this.width, this.height, null);
    for (let i = 0; i < this.map.boundary.length; i++) {
      const [x, y] = this.map.boundary[i];
      let hasTrue = false, hasFalse = false;
      for (const shape of this.shapes) {
        if (shape.mines[i]) {
          hasTrue = true;
        } else {
          hasFalse = true;
        }
      }

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

    for (let y = 0; y < this.width; y++) {
      for (let x = 0; x < this.height; x++) {
        const label = this.map.labels[y][x];
        const mine = this.mineGrid && this.mineGrid[y][x];
        const flag = this.flags[y][x];
        const hint = this.hints[y][x];

        let className;
        let content;
        if (this.state === State.DEAD && mine) {
          className = 'bomb';
          content = '&#10006;';
        } else if (this.state === State.WIN && mine) {
          className = 'bomb';
          content = '&#11044';
        } else if (label !== null && label > 0) {
          className = 'label';
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
          message += `, possibilities: ${this.shapes.length}`;
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
    this.boundary = [];
    this.labels = makeGrid(width, height, null);
    this.boundaryGrid = makeGrid(width, height, null);
  }

  recalc() {
    this.boundary = [];
    this.boundaryGrid = makeGrid(this.width, this.height, null);
    for (let y = 0; y < this.width; y++) {
      for (let x = 0; x < this.height; x++) {
        if (this.labels[y][x] === null) {
          for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
            if (this.labels[y0][x0] !== null) {
              this.boundaryGrid[y][x] = this.boundary.length;
              this.boundary.push([x, y]);
              break;
            }
          }
        }
      }
    }
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

function findShapes(map, numMines) {
  const mines = new Array(map.boundary.length).fill(false);
  let remaining = numMines;
  const results = [];

  const ones = makeGrid(map.width, map.height, 0);
  const all = makeGrid(map.width, map.height, 0);

  for (const [x, y] of map.boundary) {
    for (const [x0, y0] of neighbors(x, y, map.width, map.height)) {
      all[y0][x0]++;
    }
  }

  function backtrack(i) {
    if (i === map.boundary.length) {
      results.push(new Shape(map, mines.slice(), remaining));
      return;
    }

    backtrackGo(i, false);
    if (remaining > 0) {
      remaining--;
      backtrackGo(i, true);
      remaining++;
    }
  }

  function backtrackGo(i, hasMine) {
    mines[i] = hasMine;

    const [x, y] = map.boundary[i];
    let failed = false;
    for (const [x0, y0] of neighbors(x, y, map.width, map.height)) {
      if (hasMine) {
        ones[y0][x0]++;
      }
      all[y0][x0]--;

      if (map.labels[y0][x0] !== null) {
        if (ones[y0][x0] > map.labels[y0][x0] ||
          (all[y0][x0] === 0 && ones[y0][x0] !== map.labels[y0][x0])) {
            failed = true;
          }
      }
    }

    if (!failed) {
      backtrack(i + 1);
    }

    for (const [x0, y0] of neighbors(x, y, map.width, map.height)) {
      if (hasMine) {
        ones[y0][x0]--;
      }
      all[y0][x0]++;
    }
  }

  backtrack(0);
  return results;
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

function choice(a) {
  const i = Math.floor(Math.random() * a.length);
  return a[i];
}

let game;

function newGame(width, height, numMines) {
  const gameElement = document.getElementById('game');
  gameElement.innerHTML = '';
  game = new Game(width, height, numMines);
  game.mount(gameElement);
}

newGame(10, 10, 20);
