// Logika kvízu: správa stavu, výběr příkladů, vyhodnocování odpovědí

import {
  examples,
  GROUPS,
  MULTIPLE_CHOICE_COUNT_MODE_A,
  MULTIPLE_CHOICE_COUNT_MODE_B,
} from './data.js';

// ─── Normalizace textu pro porovnání ────────────────────────────────────────

function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    // Sjednocení mezer (více mezer → jedna)
    .replace(/\s+/g, ' ')
    // Sjednocení pomlček
    .replace(/[-–—]/g, '-');
}

function removeDiacritics(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Porovnání: přesné nebo bez diakritiky
function textsMatch(input, target) {
  const normInput = normalizeText(input);
  const normTarget = normalizeText(target);
  if (normInput === normTarget) return true;
  // Fuzzy: bez diakritiky
  if (removeDiacritics(normInput) === removeDiacritics(normTarget)) return true;
  return false;
}

// Normalizace chemického vzorce: odstraní mezery okolo závorek a tečky hydrátu
function normalizeFormula(formula) {
  return formula
    .trim()
    // Normalizace tečky hydrátu: ' · ' nebo '·' → '·'
    .replace(/\s*[·•]\s*/g, '·')
    // Odstranění subscriptových unicode číslic → ASCII
    .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
    .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
    .replace(/₈/g, '8').replace(/₉/g, '9')
    // Sjednocení mezer
    .replace(/\s+/g, '');
}

function formulasMatch(input, target) {
  return normalizeFormula(input) === normalizeFormula(target);
}

// ─── Stav kvízu ─────────────────────────────────────────────────────────────

export class Quiz {
  constructor() {
    this.mode = 'A'; // 'A' = vzorec → název, 'B' = název → vzorec
    this.activeGroups = new Set(Object.values(GROUPS));
    this.sessionAnswered = 0;    // počet zodpovězených v session
    this.sessionCorrect = 0;     // počet správných v session
    this.modeAnswered = 0;       // počet zodpovězených v aktuálním režimu (pro multiple choice práh)
    this.currentExample = null;
    this.usedIds = new Set();    // pro shuffle bez opakování
    this.lastAnswerResult = null; // výsledek poslední odpovědi
  }

  // ─── Filtrování a výběr příkladů ──────────────────────────────────────────

  getFilteredExamples() {
    return examples.filter(e => this.activeGroups.has(e.group));
  }

  nextExample() {
    const pool = this.getFilteredExamples();
    if (pool.length === 0) return null;

    // Resetovat použité, pokud jsme prošli vše
    const unusedPool = pool.filter(e => !this.usedIds.has(e.id));
    const sourcePool = unusedPool.length > 0 ? unusedPool : pool;

    if (unusedPool.length === 0) this.usedIds.clear();

    // Výběr s váhami: obtížnost 1 má vyšší váhu na začátku session
    const weighted = this._weightedShuffle(sourcePool);
    this.currentExample = weighted[0];
    this.usedIds.add(this.currentExample.id);
    this.lastAnswerResult = null;
    return this.currentExample;
  }

  _weightedShuffle(pool) {
    // Nižší obtížnost = vyšší váha (poměrná ke skóre session)
    const progress = Math.min(this.sessionAnswered / 10, 1); // 0..1 jak session roste
    return [...pool].sort((a, b) => {
      const weightA = (4 - a.difficulty) * (1 - progress * 0.5) + Math.random();
      const weightB = (4 - b.difficulty) * (1 - progress * 0.5) + Math.random();
      return weightB - weightA;
    });
  }

  // ─── Multiple choice ───────────────────────────────────────────────────────

  isMultipleChoicePhase() {
    const limit = this.mode === 'A'
      ? MULTIPLE_CHOICE_COUNT_MODE_A
      : MULTIPLE_CHOICE_COUNT_MODE_B;
    return this.modeAnswered < limit;
  }

  generateChoices(example) {
    const pool = this.getFilteredExamples().filter(e => e.id !== example.id);
    // Zamíchej a vezmi 2 špatné odpovědi
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 2);
    const correctAnswer = this.mode === 'A' ? example.name : example.formula;
    const wrongAnswers = shuffled.map(e => this.mode === 'A' ? e.name : e.formula);

    // Pokud nemáme dost špatných, doplníme podobné varianty
    while (wrongAnswers.length < 2) {
      wrongAnswers.push(this._generateFakeAnswer(example));
    }

    const choices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    return { choices, correctAnswer };
  }

  _generateFakeAnswer(example) {
    // Fallback: trochu upravená správná odpověď (jako záchrana, když je málo příkladů)
    if (this.mode === 'A') {
      const words = example.name.split(' ');
      if (words.length > 1) {
        return words[0] + ' ' + (words[1] + 'ový').replace('ýový', 'ový');
      }
      return example.name + 'an';
    } else {
      return example.formula.replace(/\d/, m => String(Number(m) + 1));
    }
  }

  // ─── Vyhodnocení odpovědi ──────────────────────────────────────────────────

  checkAnswer(userInput) {
    const example = this.currentExample;
    if (!example) return null;

    let isCorrect = false;

    if (this.mode === 'A') {
      // Vzorec → název: porovnáváme textově
      const accepted = [example.name, ...(example.acceptedNames || [])];
      isCorrect = accepted.some(a => textsMatch(userInput, a));
    } else {
      // Název → vzorec: porovnáváme vzorce
      const accepted = [example.formula, ...(example.acceptedFormulas || [])];
      isCorrect = accepted.some(a => formulasMatch(userInput, a));
    }

    this.sessionAnswered++;
    this.modeAnswered++;
    if (isCorrect) this.sessionCorrect++;

    this.lastAnswerResult = {
      isCorrect,
      example,
      userInput,
      correctAnswer: this.mode === 'A' ? example.name : example.formula,
    };

    return this.lastAnswerResult;
  }

  // ─── Přepínání režimu ─────────────────────────────────────────────────────

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.modeAnswered = 0;
      this.currentExample = null;
      this.lastAnswerResult = null;
    }
  }

  // ─── Skupiny ──────────────────────────────────────────────────────────────

  toggleGroup(group) {
    if (this.activeGroups.has(group)) {
      if (this.activeGroups.size > 1) {
        this.activeGroups.delete(group);
      }
    } else {
      this.activeGroups.add(group);
    }
    // Resetovat příklady při změně skupin
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
    };
  }

  resetSession() {
    this.sessionAnswered = 0;
    this.sessionCorrect = 0;
    this.modeAnswered = 0;
    this.usedIds.clear();
    this.currentExample = null;
    this.lastAnswerResult = null;
  }
}
