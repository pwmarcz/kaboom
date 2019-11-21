/* global Module */
const solveString = Module.cwrap('solve_string', 'string', ['string', 'int']);

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

    const hasSafeCells = this.solver.hasSafeCells();

    const outsideIsSafe = this.solver.outsideIsSafe();

    let mineGrid;
    if (this.map.boundaryGrid[y][x] === null) {
      // Clicked somewhere outside of boundary.

      if (outsideIsSafe || !hasSafeCells) {
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

class Solver {
  constructor(numMines, maxMines) {
    this.numMines = numMines;
    this.labels = [];
    this.mineToLabel = new Array(numMines);
    this.labelToMine = [];
    this.maxMines = maxMines;
    this.shapes = [];

    for (let i = 0; i < numMines; i++) {
      this.mineToLabel[i] = [];
    }
  }

  addLabel(label, mineList) {
    const labelIdx = this.labels.length;

    this.labels.push(label);
    this.labelToMine.push(mineList);

    for (const m of mineList) {
      this.mineToLabel[m].push(labelIdx);
    }
  }

  run(map) {
    this.clauses = [];
    for (let i = 0; i < this.labels.length; i++) {
      const label = this.labels[i];
      const mineList = this.labelToMine[i];

      const posSize = mineList.length - label + 1;
      const negSize = label + 1;
      for (const comb of combinations(mineList, posSize)) {
        this.clauses.push(comb.map(n => n + 1));
      }
      for (const comb of combinations(mineList, negSize)) {
        this.clauses.push(comb.map(n => -(n + 1)));
      }
    }
    if (this.numMines > 0) {
      const range = new Array(this.numMines);
      for (let i = 0; i < this.numMines; i++) {
        range[i] = i;
      }
      const negSize = this.maxMines + 1;
      for (const comb of combinations(range, negSize)) {
        this.clauses.push(comb.map(n => -(n + 1)));
      }
    }
    console.log(this.clauses.length);

    const mines = new Array(this.numMines);
    const ones = new Array(this.labels.length).fill(0);
    const all = this.labelToMine.map(mineList => mineList.length);
    let remaining = this.maxMines;

    const backtrack = i => {
      if (i === mines.length) {
        this.shapes.push(new Shape(map, mines.slice(), remaining));
        return;
      }

      backtrackGo(i, false);
      if (remaining > 0) {
        remaining--;
        backtrackGo(i, true);
        remaining++;
      }
    };

    const backtrackGo = (i, hasMine) => {
      mines[i] = hasMine;

      let failed = false;
      for (const labelIdx of this.mineToLabel[i]) {
        if (hasMine) {
          ones[labelIdx]++;
        }
        all[labelIdx]--;

        if (ones[labelIdx] > this.labels[labelIdx] ||
          all[labelIdx] === 0 && ones[labelIdx] !== this.labels[labelIdx]) {
            failed = true;
          }
      }

      if (!failed) {
        backtrack(i + 1);
      }

      for (const labelIdx of this.mineToLabel[i]) {
        if (hasMine) {
          ones[labelIdx]--;
        }
        all[labelIdx]++;
      }
    };

    backtrack(0);
  }

  anyShape() {
    return choice(this.shapes);
  }

  anyShapeWithRemaining() {
    return choice(this.shapes.filter(shape => shape.remaining > 0));
  }

  anySafeShape(idx) {
    return choice(this.shapes.filter(shape => !shape.mines[idx]));
  }

  anyDangerousShape(idx) {
    return choice(this.shapes.filter(shape => shape.mines[idx]));
  }

  canBeSafe(idx) {
    const clauses = this.clauses.slice();
    clauses.push([-(idx + 1)]);
    return !!solveSat(this.labels.length, clauses);
  }

  canBeDangerous(idx) {
    const clauses = this.clauses.slice();
    clauses.push([idx + 1]);
    return !!solveSat(this.labels.length, clauses);
  }

  hasSafeCells() {
    for (let i = 0; i < this.numMines; i++) {
      const dangerousShapes = this.shapes.filter(shape => shape.mines[i]);
      if (dangerousShapes.length === 0) {
        return true;
      }
    }
    return false;
  }

  outsideIsSafe() {
    return this.shapes.filter(shape => shape.remaining > 0).length === 0;
  }
}

function makeSolver(map, maxMines) {
  const solver = new Solver(map.boundary.length, maxMines);

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

  solver.run(map);
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

function choice(a) {
  const i = Math.floor(Math.random() * a.length);
  return a[i];
}

function combinations(list, n) {
  const result = [];
  const current = [];

  function go(i, n) {
    if (i === list.length) {
      if (n === 0) {
        result.push(current.slice());
      }
    } else {
      if (n > 0) {
        current.push(list[i]);
        go(i+1, n-1);
        current.pop();
      }
      go(i+1, n);
    }
  }

  go(0, n);
  return result;
}

/*
  Example, for "a1 & (a2 | ~a3)" formula:

  > solveSat(3, [[1], [2, -3]])
  [ null, true, false, false ]

  Variables are numbered starting from 1, result is too.
*/
function solveSat(numVars, clauses) {
  const lines = [`p cnf ${numVars} ${clauses.length}`];
  for (const clause of clauses) {
    lines.push(clause.join(' ') + ' 0');
  }

  const input = lines.join('\n');
  const output = solveString(input, input.length);
  if (output.slice(0, 3) !== 'SAT') {
    return null;
  }

  const result = new Array(numVars+1).fill(null);
  for (const s of output.slice(4).split(' ')) {
    const n = parseInt(s, 10);
    if (n > 0) {
      result[n] = true;
    } else {
      result[-n] = false;
    }
  }
  return result;
}

let game;

function newGame(width, height, numMines) {
  const gameElement = document.getElementById('game');
  gameElement.innerHTML = '';
  game = new Game(width, height, numMines);
  game.mount(gameElement);
}

newGame(10, 10, 20);
