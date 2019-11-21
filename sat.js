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
