
const State = {
  PLAYING: 'PLAYING',
  WIN: 'WIN',
  DEAD: 'DEAD',
}

class Game {
  constructor() {
    this.width = 5;
    this.height = 5;
    this.numMines = 5;
    this.labels = [];
    this.mines = [];
    this.flags = [];
    this.numRevealed = 0;
    for (let y = 0; y < this.height; y++) {
      this.labels.push(new Array(this.width).fill(null));
      this.mines.push(new Array(this.width).fill(false));
      this.flags.push(new Array(this.width).fill(false));
    }
    this.fillMines();

    this.state = State.PLAYING;
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
    for (let y0 = y - 1; y0 <= y + 1; y0++) {
      for (let x0 = x - 1; x0 <= x + 1; x0++) {
        if (0 <= x0 && x0 < this.width &&
          0 <= y0 && y0 < this.height &&
          this.mines[y0][x0]) {
            n++;
          }
      }
    }

    this.labels[y][x] = n;
    this.numRevealed++;
    if (this.numRevealed + this.numMines === this.width * this.height) {
      this.state = State.WIN;
      return;
    }

    if (n == 0) {
      for (let y0 = y - 1; y0 <= y + 1; y0++) {
        for (let x0 = x - 1; x0 <= x + 1; x0++) {
          if (0 <= x0 && x0 < this.width &&
            0 <= y0 && y0 < this.height &&
            (y0 != y || x0 != x)) {
              this.reveal(x0, y0);
            }
        }
      }
    }
  }

  toggleFlag(x, y) {
    if (!(this.state == State.PLAYING && this.labels[y][x] === null)) {
      return;
    }
    this.flags[y][x] = !this.flags[y][x];
  }

  refresh() {
    for (let y = 0; y < this.width; y++) {
      for (let x = 0; x < this.height; x++) {
        const label = this.labels[y][x];
        const mine = this.mines[y][x];

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
        } else if (this.flags[y][x]) {
          className = 'clickable unknown';
          content = '&#9873;';
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

const game = new Game();
game.mount(document.getElementById('board'), document.getElementById('state'));
