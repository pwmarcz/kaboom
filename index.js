
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
  constructor() {
    this.width = 10;
    this.height = 10;
    this.numMines = 20;
    this.map = new Map(this.width, this.height);
    this.mines = makeGrid(this.width, this.height, false);
    this.flags = makeGrid(this.width, this.height, false);
    this.numRevealed = 0;
    this.fillMines();

    this.state = State.PLAYING;

    this.recalc();
  }

  fillMines() {
    let remaining = this.numMines;
    while (remaining > 0) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      if (!this.mines[y][x]) {
        this.mines[y][x] = true;
        remaining--;
      }
    }
  }

  mount(boardElement, stateElement) {
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

    this.stateElement = stateElement;

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

    if (this.mines[y][x]) {
      this.state = State.DEAD;
      return;
    }

    let n = 0;
    for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
      if (this.mines[y0][x0]) {
        n++;
      }
    }

    this.map.reveal(x, y, n);
    this.numRevealed++;
    if (this.numRevealed + this.numMines === this.width * this.height) {
      this.state = State.WIN;
      return;
    }

    if (n === 0) {
      for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
        this.reveal(x0, y0);
      }
    }
  }

  recalc() {
    this.shapes = findShapes(this.map, this.numMines);
    console.log(this.shapes);

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
    this.flags[y][x] = !this.flags[y][x];
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
        const mine = this.mines[y][x];
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
        } else if (this.state === State.PLAYING && hint !== null) {
          className = 'clickable unknown';
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

    switch (this.state) {
      case State.PLAYING:
        this.stateElement.innerText = '';
        break;
      case State.WIN:
        this.stateElement.innerText = 'You win!';
        break;
      case State.DEAD:
        this.stateElement.innerText = 'You lose!';
        break;
    }
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

class Map {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.boundary = [];
    this.labels = makeGrid(width, height, null);
    this.boundaryGrid = makeGrid(width, height, null);
  }

  reveal(x, y, n) {
    this.labels[y][x] = n;
    this.recalcBoundary();
  }

  recalcBoundary() {
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

const game = new Game();
game.mount(document.getElementById('board'), document.getElementById('state'));
