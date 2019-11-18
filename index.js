
const State = {
  PLAYING: 'PLAYING',
  WIN: 'WIN',
  DEAD: 'DEAD',
}

const Hint = {
  MINE: 'MINE',
  UNKNOWN: 'UNKNOWN',
  EMPTY: 'EMPTY',
}

class Game {
  constructor() {
    this.width = 10;
    this.height = 10;
    this.numMines = 20;
    this.labels = makeGrid(this.width, this.height, null);
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
        }
        row.appendChild(cell);
        this.cells[y].push(cell);
      }
      boardElement.appendChild(row);
    }

    this.stateElement = stateElement;

    this.refresh();
  }

  cellClick(x, y) {
    if (this.state == State.PLAYING) {
      this.reveal(x, y);
      this.recalc();
      this.refresh();
    }
  }

  rightClick(x, y) {
    if (this.state == State.PLAYING) {
      this.toggleFlag(x, y);
      this.refresh();
    }
  }

  reveal(x, y) {
    if (!(this.state == State.PLAYING && this.labels[y][x] === null && !this.flags[y][x])) {
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

    this.labels[y][x] = n;
    this.numRevealed++;
    if (this.numRevealed + this.numMines === this.width * this.height) {
      this.state = State.WIN;
      return;
    }

    if (n == 0) {
      for (const [x0, y0] of neighbors(x, y, this.width, this.height)) {
        this.reveal(x0, y0);
      }
    }
  }

  recalc() {
    this.boundary = getBoundary(this.labels, this.width, this.height);
    this.configurations = findConfigurations(this.boundary, this.labels, this.width, this.height, this.numMines);

    this.hints = makeGrid(this.width, this.height, null);
    for (let i = 0; i < this.boundary.length; i++) {
      const [x, y] = this.boundary[i];
      let hasTrue = false, hasFalse = false;
      for (let [config, remaining] of this.configurations) {
        if (config[i]) {
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
        hint = Hint.EMPTY;
      }
      this.hints[y][x] = hint;
    }
  }

  toggleFlag(x, y) {
    if (!(this.state == State.PLAYING && this.labels[y][x] === null)) {
      return;
    }
    this.flags[y][x] = !this.flags[y][x];
  }

  refresh() {
    const HINTS = {
      [Hint.EMPTY]: '.',
      [Hint.UNKNOWN]: '?',
      [Hint.MINE]: '!',
    }

    for (let y = 0; y < this.width; y++) {
      for (let x = 0; x < this.height; x++) {
        const label = this.labels[y][x];
        const mine = this.mines[y][x];
        const flag = this.flags[y][x];
        const hint = this.hints[y][x];

        let className;
        let content;
        if (this.state == State.DEAD && mine) {
          className = 'bomb';
          content = '&#10006;'
        } else if (this.state == State.WIN && mine) {
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
        } else if (this.state == State.PLAYING && hint !== null) {
          className = 'clickable unknown';
          content = HINTS[hint];
        } else if (this.state == State.PLAYING) {
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
        (y0 != y || x0 != x)) {
          yield [x0, y0];
        }
    }
  }
}

function getBoundary(labels, width, height) {
  const boundary = [];
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < height; x++) {
      if (labels[y][x] === null) {
        for (const [x0, y0] of neighbors(x, y, width, height)) {
          if (labels[y0][x0] !== null) {
            boundary.push([x, y]);
            break;
          }
        }
      }
    }
  }
  return boundary;
}

function findConfigurations(boundary, labels, width, height, numMines) {
  const mines = new Array(boundary.length).fill(false);
  let remaining = numMines;
  const results = [];

  const ones = makeGrid(width, height, 0);
  const all = makeGrid(width, height, 0);

  for (const [x, y] of boundary) {
    for (const [x0, y0] of neighbors(x, y, width, height)) {
      all[y0][x0]++;
    }
  }

  function backtrack(i) {
    if (i == boundary.length) {
      results.push([mines.slice(), remaining]);
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

    const [x, y] = boundary[i];
    let failed = false;
    for (const [x0, y0] of neighbors(x, y, width, height)) {
      if (hasMine) {
        ones[y0][x0]++;
      }
      all[y0][x0]--;

      if (labels[y0][x0] !== null) {
        if (ones[y0][x0] > labels[y0][x0] ||
          (all[y0][x0] === 0 && ones[y0][x0] !== labels[y0][x0])) {
            failed = true;
          }
      }
    }

    if (!failed) {
      backtrack(i + 1);
    }

    for (const [x0, y0] of neighbors(x, y, width, height)) {
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
