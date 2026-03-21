// Vykreslování UI — řídí DOM na základě stavu kvízu

import { GROUPS } from './data.js';

const POSITIVE_MESSAGES = [
  'Výborně! 🎉',
  'Správně! Jsi na tom skvěle.',
  'Přesně tak! Pokračuj.',
  'Perfektní! Máš to.',
  'Super! Učení jde jako po másle.',
  'Správně! Chytrý chemik.',
  'Ano! Přesná odpověď.',
];

function randomPositive() {
  return POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)];
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Převede chemický vzorec na HTML s horními/dolními indexy
function formatFormula(formula) {
  // Subscript čísla: za písmenem nebo závorkou
  return escapeHtml(formula)
    .replace(/(\d+)/g, '<sub>$1</sub>')
    .replace(/·/g, ' · ');
}

export class UI {
  constructor(quiz, onAnswer, onNext, onModeChange, onGroupToggle, onReset) {
    this.quiz = quiz;
    this.onAnswer = onAnswer;
    this.onNext = onNext;
    this.onModeChange = onModeChange;
    this.onGroupToggle = onGroupToggle;
    this.onReset = onReset;

    this._buildShell();
    this._attachStaticListeners();
  }

  // ─── Sestavení základního HTML ─────────────────────────────────────────────

  _buildShell() {
    document.body.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.innerHTML = `
      <header class="app-header">
        <div>
          <div class="app-title">Soli <span>— chemické názvosloví</span></div>
        </div>
        <div class="stats-bar" id="statsBar"></div>
      </header>

      <div class="mode-switcher">
        <button class="mode-btn active" data-mode="A">
          Vzorec → Název
        </button>
        <button class="mode-btn" data-mode="B">
          Název → Vzorec
        </button>
      </div>

      <section class="groups-section">
        <div class="groups-label">Procvičované skupiny</div>
        <div class="groups-list" id="groupsList"></div>
      </section>

      <main class="question-card" id="questionCard">
        <div class="empty-state">
          <h2>Připrav se!</h2>
          <p>Klikni na „Další úloha" a začni procvičovat.</p>
        </div>
      </main>

      <button class="next-btn" id="nextBtn">
        Další úloha →
      </button>
    `;

    document.body.appendChild(wrapper);

    this.els = {
      statsBar: wrapper.querySelector('#statsBar'),
      groupsList: wrapper.querySelector('#groupsList'),
      questionCard: wrapper.querySelector('#questionCard'),
      nextBtn: wrapper.querySelector('#nextBtn'),
      modeBtns: wrapper.querySelectorAll('.mode-btn'),
    };
  }

  _attachStaticListeners() {
    // Přepínač režimu
    this.els.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.onModeChange(mode);
      });
    });

    // Tlačítko Další
    this.els.nextBtn.addEventListener('click', () => this.onNext());
  }

  // ─── Skupiny ──────────────────────────────────────────────────────────────

  renderGroups() {
    const labels = {
      [GROUPS.BEZKYSLICATE]: 'Bezkyslíkaté',
      [GROUPS.KYSLICATE]: 'Kyslíkaté',
      [GROUPS.HYDRATY]: 'Hydráty',
      [GROUPS.PODVOJNE]: 'Podvojné',
      [GROUPS.ZASADITE]: 'Zásadité',
    };

    this.els.groupsList.innerHTML = '';
    Object.values(GROUPS).forEach(group => {
      const chip = document.createElement('button');
      chip.className = 'group-chip' + (this.quiz.isGroupActive(group) ? ' active' : '');
      chip.innerHTML = `<span class="dot"></span>${escapeHtml(labels[group])}`;
      chip.addEventListener('click', () => this.onGroupToggle(group));
      this.els.groupsList.appendChild(chip);
    });
  }

  // ─── Statistiky ───────────────────────────────────────────────────────────

  renderStats() {
    const s = this.quiz.getStats();
    this.els.statsBar.innerHTML = `
      <span class="stat-chip correct">✓ ${s.correct}</span>
      <span class="stat-chip wrong">✗ ${s.wrong}</span>
      <span class="stat-chip total">${s.accuracy}%</span>
      <button class="reset-btn" id="resetBtn" title="Resetovat session">↺ Reset</button>
    `;
    this.els.statsBar.querySelector('#resetBtn').addEventListener('click', () => {
      if (confirm('Opravdu chceš resetovat statistiky?')) this.onReset();
    });
  }

  // ─── Přepínač režimu ─────────────────────────────────────────────────────

  renderModeSwitch() {
    this.els.modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.quiz.mode);
    });
  }

  // ─── Otázka ───────────────────────────────────────────────────────────────

  renderQuestion(example) {
    const isMultipleChoice = this.quiz.isMultipleChoicePhase();
    const isFormulaQuestion = this.quiz.mode === 'A'; // A: vzorec → název

    const promptLabel = isFormulaQuestion ? 'Vzorec' : 'Název';
    const promptValue = isFormulaQuestion ? example.formula : example.name;
    const answerLabel = isFormulaQuestion ? 'Napiš název soli:' : 'Napiš vzorec soli:';

    const phaseHtml = isMultipleChoice
      ? `<span class="phase-badge">výběr z možností</span>`
      : '';

    let answerHtml;

    if (isMultipleChoice) {
      const { choices } = this.quiz.generateChoices(example);
      // Uložit choices na instanci pro přístup z listeneru
      this._currentChoices = choices;
      const choiceItems = choices.map((c, i) =>
        `<button class="choice-btn" data-index="${i}">${escapeHtml(c)}</button>`
      ).join('');
      answerHtml = `
        <div class="answer-label">${escapeHtml(answerLabel)}</div>
        <div class="choices-list" id="choicesList">${choiceItems}</div>
      `;
    } else {
      answerHtml = `
        <div class="answer-label">${escapeHtml(answerLabel)}</div>
        <div class="answer-input-wrap">
          <input
            class="answer-input"
            id="answerInput"
            type="text"
            placeholder="Tvoje odpověď..."
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          />
          <button class="submit-btn" id="submitBtn">Zkontrolovat</button>
        </div>
      `;
    }

    const formulaClass = isFormulaQuestion ? ' formula' : '';
    const displayValue = isFormulaQuestion
      ? `<span class="question-value${formulaClass}">${formatFormula(promptValue)}</span>`
      : `<span class="question-value">${escapeHtml(promptValue)}</span>`;

    // Progres bar (příblíně, 10 = 100 %)
    const progress = Math.min(this.quiz.sessionAnswered / 20, 1) * 100;

    this.els.questionCard.innerHTML = `
      <div class="question-meta">
        <span class="question-group-badge">${escapeHtml(example.group)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${phaseHtml}
          <span class="question-mode-label">Obtížnost ${'★'.repeat(example.difficulty)}${'☆'.repeat(3 - example.difficulty)}</span>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>

      <div>
        <div class="question-prompt-label">${escapeHtml(promptLabel)}:</div>
        ${displayValue}
      </div>

      <div class="answer-section" id="answerSection">
        ${answerHtml}
      </div>

      <div id="resultSection"></div>
    `;

    // Připojit listenery
    this._attachAnswerListeners(example, isMultipleChoice);

    // Skrýt tlačítko Další (ukáže se po odpovědi)
    this.els.nextBtn.style.display = 'none';
  }

  _attachAnswerListeners(example, isMultipleChoice) {
    if (isMultipleChoice) {
      const choicesList = this.els.questionCard.querySelector('#choicesList');
      if (!choicesList) return;
      const choices = this._currentChoices || [];
      choicesList.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          const userInput = choices[idx] ?? btn.textContent.trim();
          this._handleAnswerSubmit(userInput, example);
        });
      });
    } else {
      const input = this.els.questionCard.querySelector('#answerInput');
      const submitBtn = this.els.questionCard.querySelector('#submitBtn');
      if (!input || !submitBtn) return;

      // Odeslat Enterem
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!submitBtn.disabled) this._handleAnswerSubmit(input.value, example);
        }
      });

      submitBtn.addEventListener('click', () => {
        this._handleAnswerSubmit(input.value, example);
      });

      // Fokus na input
      setTimeout(() => input.focus(), 50);
    }
  }

  _handleAnswerSubmit(userInput, example) {
    if (!userInput.trim()) return;
    // Zaznamenat fázi PŘED zpracováním odpovědi (checkAnswer zvýší modeAnswered)
    const wasMultipleChoice = this.quiz.isMultipleChoicePhase();
    const result = this.onAnswer(userInput);
    if (result) {
      this.renderResult(result, example, wasMultipleChoice);
    }
  }

  // ─── Výsledek ─────────────────────────────────────────────────────────────

  renderResult(result, example, wasMultipleChoice) {
    const { isCorrect, correctAnswer } = result;

    // Označit vstup / tlačítka
    if (wasMultipleChoice) {
      // Multiple choice: označit správné a špatné
      const choicesList = this.els.questionCard.querySelector('#choicesList');
      const choices = this._currentChoices || [];
      if (choicesList) {
        choicesList.querySelectorAll('.choice-btn').forEach(btn => {
          btn.disabled = true;
          const idx = parseInt(btn.dataset.index, 10);
          const btnValue = choices[idx];
          if (btnValue === correctAnswer) {
            btn.classList.add('correct');
          } else if (btnValue === result.userInput && !isCorrect) {
            btn.classList.add('wrong');
          }
        });
      }
    } else {
      const input = this.els.questionCard.querySelector('#answerInput');
      const submitBtn = this.els.questionCard.querySelector('#submitBtn');
      if (input) {
        input.classList.add(isCorrect ? 'correct' : 'wrong');
        input.disabled = true;
      }
      if (submitBtn) submitBtn.disabled = true;
    }

    // Zobrazit výsledek
    const resultSection = this.els.questionCard.querySelector('#resultSection');
    if (!resultSection) return;

    const isFormula = this.quiz.mode === 'B';
    const formattedCorrect = isFormula
      ? `<strong>${formatFormula(correctAnswer)}</strong>`
      : `<em>${escapeHtml(correctAnswer)}</em>`;

    if (isCorrect) {
      resultSection.innerHTML = `
        <div class="result-section correct">
          <div class="result-title">✓ ${escapeHtml(randomPositive())}</div>
        </div>
      `;
    } else {
      const tipHtml = example.tip
        ? `<div class="result-tip">💡 ${escapeHtml(example.tip)}</div>`
        : '';
      resultSection.innerHTML = `
        <div class="result-section wrong">
          <div class="result-title">✗ Správná odpověď:</div>
          <div class="result-correct-answer">${formattedCorrect}</div>
          <div class="result-explanation">${escapeHtml(example.explanation)}</div>
          ${tipHtml}
        </div>
      `;
    }

    // Ukázat tlačítko Další
    this.els.nextBtn.style.display = '';
    this.renderStats();

    // Scrollovat k výsledku
    setTimeout(() => {
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  // ─── Prázdný stav ─────────────────────────────────────────────────────────

  renderEmpty() {
    this.els.questionCard.innerHTML = `
      <div class="empty-state">
        <h2>Žádné příklady</h2>
        <p>Vyber alespoň jednu skupinu solí výše.</p>
      </div>
    `;
    this.els.nextBtn.style.display = 'none';
  }

  // ─── Plná aktualizace ─────────────────────────────────────────────────────

  render() {
    this.renderModeSwitch();
    this.renderGroups();
    this.renderStats();
  }
}
