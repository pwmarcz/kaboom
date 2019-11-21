/* global Module */
const solveString = Module.cwrap('solve_string', 'string', ['string', 'int']);

class Sat {
  constructor(numVars) {
    this.numVars = numVars;
    this.clauses = [];
  }

  assert(vars) {
    this.clauses.push(vars);
  }

  assertAtLeast(vars, k) {
    const size = vars.length - k + 1;
    for (const comb of combinations(vars, size)) {
      this.clauses.push(comb);
    }
  }

  assertAtMost(vars, k) {
    const size = k + 1;
    for (const comb of combinations(vars, size)) {
      this.clauses.push(comb.map(n => -n));
    }
  }

  addCounter(vars) {
    this.counter = this._addCounter(vars);
  }

  assertCounterAtLeast(k) {
    for (let i = 0; i < k && i < this.counter.length; i++) {
      this.assert([this.counter[i]]);
    }
  }

  assertCounterAtMost(k) {
    for (let i = k; i < this.counter.length; i++) {
      this.assert([-this.counter[i]]);
    }
  }

  /*
    See:
    https://cs.stackexchange.com/questions/6521/reduce-the-following-problem-to-sat/6522#6522
    http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.458.7676&rep=rep1&type=pdf
    Efficient CNF encoding of Boolean cardinality constraints - Olivier Bailleux and Yacine Boufkhad
   */

  _addCounter(vars) {
    if (vars.length <= 1) {
      return vars;
    }

    const mid = Math.floor(vars.length/2);
    const left = this._addCounter(vars.slice(0, mid));
    const right = this._addCounter(vars.slice(mid));

    const counter = [];
    for (let i = 0; i < vars.length; i++) {
      counter.push(++this.numVars);
    }

    for (let a = 0; a <= left.length; a++) {
      for (let b = 0; b <= right.length; b++) {
        if (a > 0 && b > 0) {
          this.assert([-left[a-1], -right[b-1], counter[a+b-1]]);
        } else if (a > 0) {
          this.assert([-left[a-1], counter[a-1]]);
        } else if (b > 0) {
          this.assert([-right[b-1], counter[b-1]]);
        }

        if (a < left.length && b < right.length) {
          this.assert([left[a], right[b], -counter[a+b]]);
        } else if (a < left.length) {
          this.assert([left[a], -counter[a+b]]);
        } else if (b < right.length) {
          this.assert([right[b], -counter[a+b]]);
        }
      }
    }

    return counter;
  }

  solveWith(func) {
    const saved = this.clauses;
    try {
      this.clauses = this.clauses.slice();
      func();
      return this.solve();
    } finally {
      this.clauses = saved;
    }
  }

  solve() {
    const lines = [`p cnf ${this.numVars} ${this.clauses.length}`];
    for (const clause of this.clauses) {
      lines.push(clause.join(' ') + ' 0');
    }

    const input = lines.join('\n');
    const output = solveString(input, input.length);
    if (output.slice(0, 3) !== 'SAT') {
      return null;
    }

    const result = new Array(this.numVars+1).fill(null);
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
