
// ─── Normalizace ─────────────────────────────────────────────────────────────

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[-–—]/g, '-');
}

function removeDiacritics(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function textsMatch(input, target) {
  const a = normalizeText(input);
  const b = normalizeText(target);
  if (a === b) return true;
  if (removeDiacritics(a) === removeDiacritics(b)) return true;
  return false;
}

function normalizeFormula(formula) {
  return formula
    .trim()
    .replace(/\s*[·•.]\s*/g, '·')
    .replace(/₀/g,'0').replace(/₁/g,'1').replace(/₂/g,'2').replace(/₃/g,'3')
    .replace(/₄/g,'4').replace(/₅/g,'5').replace(/₆/g,'6').replace(/₇/g,'7')
    .replace(/₈/g,'8').replace(/₉/g,'9')
    .replace(/\s+/g, '');
}

function formulasMatch(input, target) {
  return normalizeFormula(input) === normalizeFormula(target);
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export class Quiz {
  constructor(data) {
    this._examples = data.examples;
    this._groups = data.GROUPS;
    this._mcA = data.MULTIPLE_CHOICE_COUNT_MODE_A;
    this._mcB = data.MULTIPLE_CHOICE_COUNT_MODE_B;

    this.mode = 'A';
    this.activeGroups = new Set(Object.values(this._groups));
    if (data.DEFAULT_INACTIVE_GROUPS) {
      data.DEFAULT_INACTIVE_GROUPS.forEach(g => this.activeGroups.delete(g));
    }

    // Statistiky
    this.sessionAnswered = 0;
    this.sessionCorrect = 0;
    this.modeAnswered = 0;
    this.streak = 0;          // počet správných za sebou
    this.maxStreak = 0;

    // Stav
    this.currentExample = null;
    this.usedIds = new Set();
    this.lastAnswerResult = null;

    // Opakování chyb: po N správných se vrátí chybný příklad
    this.retryQueue = [];           // [{example, wrongAnswer}]
    this.correctSinceRetry = 0;     // kolik správných od posledního přidání do retry
    this.RETRY_AFTER = 4;           // za kolik správných se zopakuje chybný příklad

    // Záznamy chyb pro panel
    this.errorLog = [];             // [{example, userInput, correctAnswer, mode, timestamp}]
  }

  // ─── Výběr příkladu ───────────────────────────────────────────────────────

  getFilteredExamples() {
    return this._examples.filter(e => this.activeGroups.has(e.group));
  }

  nextExample() {
    // Nabídnout retry, pokud je ve frontě a uběhlo dost správných
    if (this.retryQueue.length > 0 && this.correctSinceRetry >= this.RETRY_AFTER) {
      const item = this.retryQueue.shift();
      this.correctSinceRetry = 0;
      this.currentExample = item.example;
      this.lastAnswerResult = null;
      return { example: item.example, isRetry: true };
    }

    const retryIds = new Set(this.retryQueue.map(r => r.example.id));
    const pool = this.getFilteredExamples().filter(e => !retryIds.has(e.id));
    if (pool.length === 0) return null;

    const unusedPool = pool.filter(e => !this.usedIds.has(e.id));
    if (unusedPool.length === 0) this.usedIds.clear();

    const source = unusedPool.length > 0 ? unusedPool : pool;
    const weighted = this._weightedShuffle(source);
    this.currentExample = weighted[0];
    this.usedIds.add(this.currentExample.id);
    this.lastAnswerResult = null;
    return { example: this.currentExample, isRetry: false };
  }

  _weightedShuffle(pool) {
    const progress = Math.min(this.sessionAnswered / 15, 1);
    return [...pool].sort((a, b) => {
      const wA = (4 - a.difficulty) * (1 - progress * 0.5) + Math.random();
      const wB = (4 - b.difficulty) * (1 - progress * 0.5) + Math.random();
      return wB - wA;
    });
  }

  // ─── Multiple choice ──────────────────────────────────────────────────────

  isMultipleChoicePhase() {
    const limit = this.mode === 'A' ? this._mcA : this._mcB;
    return this.modeAnswered < limit;
  }

  generateChoices(example) {
    const pool = this.getFilteredExamples().filter(e => e.id !== example.id);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
    const correctAnswer = this.mode === 'A' ? example.name : example.formula;
    const wrongAnswers = shuffled.map(e => this.mode === 'A' ? e.name : e.formula);

    while (wrongAnswers.length < 2) {
      wrongAnswers.push(this._generateFakeAnswer(example));
    }

    const choices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    return { choices, correctAnswer };
  }

  _generateFakeAnswer(example) {
    if (this.mode === 'A') {
      const words = example.name.split(' ');
      return words.length > 1 ? words[0] + 'an ' + words[1] : example.name + 'an';
    }
    return example.formula.replace(/\d/, m => String(Number(m) + 1));
  }

  // ─── Vyhodnocení odpovědi ─────────────────────────────────────────────────

  checkAnswer(userInput) {
    const example = this.currentExample;
    if (!example) return null;

    let isCorrect = false;
    if (this.mode === 'A') {
      const accepted = [example.name, ...(example.acceptedNames || [])];
      const short = accepted
        .filter(a => /^kyselina\s+/i.test(a))
        .map(a => a.replace(/^kyselina\s+/i, ''));
      isCorrect = [...accepted, ...short].some(a => textsMatch(userInput, a));
    } else {
      const accepted = [example.formula, ...(example.acceptedFormulas || [])];
      isCorrect = accepted.some(a => formulasMatch(userInput, a));
    }

    this.sessionAnswered++;
    this.modeAnswered++;

    const correctAnswer = this.mode === 'A' ? example.name : example.formula;

    if (isCorrect) {
      this.sessionCorrect++;
      this.streak++;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
      this.correctSinceRetry++;
    } else {
      this.streak = 0;
      // Přidat do retry fronty (ne duplikát)
      const alreadyQueued = this.retryQueue.some(r => r.example.id === example.id);
      if (!alreadyQueued) {
        this.retryQueue.push({ example, wrongAnswer: userInput });
      }
      // Zaznamenat chybu
      this.errorLog.push({
        example,
        userInput,
        correctAnswer,
        mode: this.mode,
        timestamp: new Date(),
      });
    }

    this.lastAnswerResult = { isCorrect, example, userInput, correctAnswer };
    return this.lastAnswerResult;
  }

  // ─── Přepínání ────────────────────────────────────────────────────────────

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.modeAnswered = 0;
      this.currentExample = null;
      this.lastAnswerResult = null;
    }
  }

  toggleGroup(group) {
    if (this.activeGroups.has(group)) {
      if (this.activeGroups.size > 1) this.activeGroups.delete(group);
    } else {
      this.activeGroups.add(group);
    }
    this.usedIds.clear();
    this.currentExample = null;
  }

  isGroupActive(group) {
    return this.activeGroups.has(group);
  }

  // ─── Statistiky ───────────────────────────────────────────────────────────

  getStats() {
    return {
      answered: this.sessionAnswered,
      correct: this.sessionCorrect,
      wrong: this.sessionAnswered - this.sessionCorrect,
      accuracy: this.sessionAnswered > 0
        ? Math.round((this.sessionCorrect / this.sessionAnswered) * 100)
        : 0,
      streak: this.streak,
      errorCount: this.errorLog.length,
    };
  }

  resetSession() {
    this.sessionAnswered = 0;
    this.sessionCorrect = 0;
    this.modeAnswered = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.usedIds.clear();
    this.currentExample = null;
    this.lastAnswerResult = null;
    this.retryQueue = [];
    this.correctSinceRetry = 0;
    this.errorLog = [];
  }
}
