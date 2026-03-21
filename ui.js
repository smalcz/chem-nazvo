import { GROUPS } from './data.js';

const POSITIVE_MESSAGES = [
  'Správně!',
  'Výborně!',
  'Přesně tak!',
  'Perfektní!',
  'Super!',
  'Ano, přesně!',
  'Skvělá práce!',
  'Correct!',
];

const STREAK_5_MESSAGES = [
  '🔥 5 v řadě! Jsi na vlně, pokračuj!',
  '⭐ Pět správně za sebou! Výborný výkon!',
  '🚀 Série 5! Chemické názvosloví ti jde skvěle!',
];

const STREAK_10_MESSAGES = [
  '🏆 NEUVĚŘITELNÉ! 10 správně v řadě! Jsi mistr chemického názvosloví!',
  '🎉 FANTASTICKÉ! 10 v řadě! Tohle je na jedničku s hvězdičkou!',
  '🌟 10 ZA SEBOU! Gratuluji — to je špičkový výkon!',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFormula(formula) {
  return escapeHtml(formula)
    .replace(/(\d+)/g, '<sub>$1</sub>')
    .replace(/·/g, ' · ');
}

// ─────────────────────────────────────────────────────────────────────────────

export class UI {
  constructor(quiz, onAnswer, onNext, onModeChange, onGroupToggle, onReset) {
    this.quiz = quiz;
    this.onAnswer = onAnswer;
    this.onNext = onNext;
    this.onModeChange = onModeChange;
    this.onGroupToggle = onGroupToggle;
    this.onReset = onReset;
    this._currentChoices = [];

    this._buildShell();
    this._attachStaticListeners();
  }

  // ─── Shell ────────────────────────────────────────────────────────────────

  _buildShell() {
    document.body.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.innerHTML = `
      <header class="app-header">
        <div class="app-title">Soli <span>— chemické názvosloví</span></div>
        <div class="header-right">
          <button class="errors-btn" id="errorsBtn" title="Zobrazit záznamy chyb">Chyby <span class="errors-count" id="errorsCount">0</span></button>
          <div class="stats-bar" id="statsBar"></div>
        </div>
      </header>

      <div class="mode-switcher">
        <button class="mode-btn active" data-mode="A">Vzorec → Název</button>
        <button class="mode-btn" data-mode="B">Název → Vzorec</button>
      </div>

      <section class="groups-section">
        <div class="groups-label">Procvičované skupiny</div>
        <div class="groups-list" id="groupsList"></div>
      </section>

      <main class="question-card" id="questionCard">
        <div class="empty-state"><h2>Připrav se!</h2><p>Klikni na „Další úloha".</p></div>
      </main>

      <button class="next-btn" id="nextBtn">Další úloha →</button>

      <!-- Panel chyb -->
      <div class="errors-overlay hidden" id="errorsOverlay">
        <div class="errors-panel">
          <div class="errors-panel-header">
            <h2>Záznamy chyb</h2>
            <button class="close-btn" id="closeErrorsBtn">✕</button>
          </div>
          <div class="errors-list" id="errorsList"></div>
        </div>
      </div>

      <!-- Oslava streaku -->
      <div class="celebration-overlay hidden" id="celebrationOverlay">
        <div class="celebration-box" id="celebrationBox"></div>
      </div>
    `;
    document.body.appendChild(wrapper);

    this.els = {
      statsBar: wrapper.querySelector('#statsBar'),
      groupsList: wrapper.querySelector('#groupsList'),
      questionCard: wrapper.querySelector('#questionCard'),
      nextBtn: wrapper.querySelector('#nextBtn'),
      modeBtns: wrapper.querySelectorAll('.mode-btn'),
      errorsBtn: wrapper.querySelector('#errorsBtn'),
      errorsCount: wrapper.querySelector('#errorsCount'),
      errorsOverlay: wrapper.querySelector('#errorsOverlay'),
      errorsList: wrapper.querySelector('#errorsList'),
      closeErrorsBtn: wrapper.querySelector('#closeErrorsBtn'),
      celebrationOverlay: wrapper.querySelector('#celebrationOverlay'),
      celebrationBox: wrapper.querySelector('#celebrationBox'),
    };
  }

  _attachStaticListeners() {
    this.els.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.onModeChange(btn.dataset.mode));
    });
    this.els.nextBtn.addEventListener('click', () => this.onNext());
    this.els.errorsBtn.addEventListener('click', () => this._showErrorsPanel());
    this.els.closeErrorsBtn.addEventListener('click', () => this._hideErrorsPanel());
    this.els.errorsOverlay.addEventListener('click', e => {
      if (e.target === this.els.errorsOverlay) this._hideErrorsPanel();
    });
    this.els.celebrationOverlay.addEventListener('click', () => this._hideCelebration());
  }

  // ─── Panel chyb ───────────────────────────────────────────────────────────

  _showErrorsPanel() {
    const log = this.quiz.errorLog;
    if (log.length === 0) {
      this.els.errorsList.innerHTML = '<p class="errors-empty">Zatím žádné chyby — skvělá práce! 🎉</p>';
    } else {
      // Seskupit podle id příkladu, zobrazit unikátní (nejnovější chybu)
      const seen = new Map();
      [...log].reverse().forEach(entry => {
        if (!seen.has(entry.example.id)) seen.set(entry.example.id, entry);
      });

      this.els.errorsList.innerHTML = [...seen.values()].map(entry => {
        const isFormula = entry.mode === 'B';
        const questionLabel = entry.mode === 'A' ? 'Vzorec' : 'Název';
        const questionValue = entry.mode === 'A' ? entry.example.formula : entry.example.name;
        const correctLabel = entry.mode === 'A' ? 'Správný název' : 'Správný vzorec';

        return `
          <div class="error-entry">
            <div class="error-meta">
              <span class="error-group">${escapeHtml(entry.example.group)}</span>
              <span class="error-time">${entry.timestamp.toLocaleTimeString('cs-CZ', {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="error-question"><span class="error-label">${questionLabel}:</span> <strong>${isFormula ? entry.example.name : formatFormula(questionValue)}</strong></div>
            <div class="error-your"><span class="error-label">Tvá odpověď:</span> <span class="wrong-answer">${escapeHtml(entry.userInput)}</span></div>
            <div class="error-correct"><span class="error-label">${correctLabel}:</span> <strong>${isFormula ? formatFormula(entry.correctAnswer) : escapeHtml(entry.correctAnswer)}</strong></div>
            <div class="error-explanation">${escapeHtml(entry.example.explanation)}</div>
          </div>
        `;
      }).join('');
    }
    this.els.errorsOverlay.classList.remove('hidden');
  }

  _hideErrorsPanel() {
    this.els.errorsOverlay.classList.add('hidden');
  }

  // ─── Oslava ───────────────────────────────────────────────────────────────

  showCelebration(streak) {
    const msg = streak >= 10
      ? randomFrom(STREAK_10_MESSAGES)
      : randomFrom(STREAK_5_MESSAGES);

    const isEpic = streak >= 10;
    this.els.celebrationBox.innerHTML = `
      <div class="celebration-inner ${isEpic ? 'epic' : ''}">
        <div class="celebration-msg">${escapeHtml(msg)}</div>
        <div class="celebration-streak">${streak} v řadě!</div>
        <button class="celebration-close">Díky, pokračuji! →</button>
      </div>
    `;
    this.els.celebrationOverlay.classList.remove('hidden');
    this.els.celebrationBox.querySelector('.celebration-close')
      .addEventListener('click', () => this._hideCelebration());

    if (isEpic) this._launchConfetti();
  }

  _hideCelebration() {
    this.els.celebrationOverlay.classList.add('hidden');
  }

  _launchConfetti() {
    const colors = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#db2777'];
    const overlay = this.els.celebrationOverlay;
    for (let i = 0; i < 60; i++) {
      const dot = document.createElement('div');
      dot.className = 'confetti-dot';
      dot.style.cssText = `
        left:${Math.random()*100}%;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        animation-delay:${Math.random()*1}s;
        animation-duration:${1.5 + Math.random()}s;
        width:${6 + Math.random()*8}px;
        height:${6 + Math.random()*8}px;
      `;
      overlay.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    }
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
      <span class="stat-chip correct" title="Správně">✓ ${s.correct}</span>
      <span class="stat-chip wrong" title="Špatně">✗ ${s.wrong}</span>
      <span class="stat-chip total" title="Úspěšnost">${s.accuracy}%</span>
      ${s.streak >= 2 ? `<span class="stat-chip streak" title="Série správných odpovědí">🔥 ${s.streak}</span>` : ''}
      <button class="reset-btn" id="resetBtn" title="Resetovat session">↺</button>
    `;
    this.els.statsBar.querySelector('#resetBtn').addEventListener('click', () => {
      if (confirm('Opravdu chceš resetovat statistiky a chyby?')) this.onReset();
    });
    // Počet chyb na tlačítku
    this.els.errorsCount.textContent = s.errorCount;
    this.els.errorsBtn.classList.toggle('has-errors', s.errorCount > 0);
  }

  // ─── Přepínač režimu ─────────────────────────────────────────────────────

  renderModeSwitch() {
    this.els.modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.quiz.mode);
    });
  }

  // ─── Otázka ───────────────────────────────────────────────────────────────

  renderQuestion(example, isRetry = false) {
    const isMultipleChoice = this.quiz.isMultipleChoicePhase();
    const isModeA = this.quiz.mode === 'A';

    const promptLabel = isModeA ? 'Vzorec' : 'Název';
    const promptValue = isModeA ? example.formula : example.name;
    const answerLabel = isModeA ? 'Napiš název soli:' : 'Napiš vzorec soli:';

    const retryBadge = isRetry
      ? `<span class="retry-badge">🔁 Opakování</span>`
      : '';
    const phaseBadge = isMultipleChoice
      ? `<span class="phase-badge">výběr z možností</span>`
      : '';

    let answerHtml;
    if (isMultipleChoice) {
      const { choices } = this.quiz.generateChoices(example);
      this._currentChoices = choices;
      const items = choices.map((c, i) =>
        `<button class="choice-btn" data-index="${i}">${escapeHtml(c)}</button>`
      ).join('');
      answerHtml = `
        <div class="answer-label">${escapeHtml(answerLabel)}</div>
        <div class="choices-list" id="choicesList">${items}</div>
      `;
    } else {
      answerHtml = `
        <div class="answer-label">${escapeHtml(answerLabel)}</div>
        <div class="answer-input-wrap">
          <input class="answer-input" id="answerInput" type="text"
            placeholder="Tvoje odpověď..."
            autocomplete="off" autocorrect="off" spellcheck="false" />
          <button class="submit-btn" id="submitBtn">Zkontrolovat</button>
        </div>
      `;
    }

    const displayValue = isModeA
      ? `<span class="question-value formula">${formatFormula(promptValue)}</span>`
      : `<span class="question-value">${escapeHtml(promptValue)}</span>`;

    const progress = Math.min(this.quiz.sessionAnswered / 30, 1) * 100;
    const stars = '★'.repeat(example.difficulty) + '☆'.repeat(3 - example.difficulty);

    this.els.questionCard.innerHTML = `
      <div class="question-meta">
        <span class="question-group-badge">${escapeHtml(example.group)}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${retryBadge}${phaseBadge}
          <span class="question-mode-label">${stars}</span>
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

    this._attachAnswerListeners(example, isMultipleChoice);
    this.els.nextBtn.style.display = 'none';
  }

  _attachAnswerListeners(example, isMultipleChoice) {
    if (isMultipleChoice) {
      const list = this.els.questionCard.querySelector('#choicesList');
      if (!list) return;
      const choices = this._currentChoices;
      list.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          this._submit(choices[idx] ?? btn.textContent.trim(), example, true);
        });
      });
    } else {
      const input = this.els.questionCard.querySelector('#answerInput');
      const submitBtn = this.els.questionCard.querySelector('#submitBtn');
      if (!input || !submitBtn) return;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !submitBtn.disabled) {
          e.preventDefault();
          this._submit(input.value, example, false);
        }
      });
      submitBtn.addEventListener('click', () => this._submit(input.value, example, false));
      setTimeout(() => input.focus(), 50);
    }
  }

  _submit(userInput, example, wasMultipleChoice) {
    if (!userInput.trim()) return;
    const result = this.onAnswer(userInput);
    if (result) this.renderResult(result, example, wasMultipleChoice);
  }

  // ─── Výsledek ─────────────────────────────────────────────────────────────

  renderResult(result, example, wasMultipleChoice) {
    const { isCorrect, correctAnswer } = result;
    const choices = this._currentChoices;

    if (wasMultipleChoice) {
      const list = this.els.questionCard.querySelector('#choicesList');
      if (list) {
        list.querySelectorAll('.choice-btn').forEach(btn => {
          btn.disabled = true;
          const val = choices[parseInt(btn.dataset.index, 10)];
          if (val === correctAnswer) btn.classList.add('correct');
          else if (val === result.userInput && !isCorrect) btn.classList.add('wrong');
        });
      }
    } else {
      const input = this.els.questionCard.querySelector('#answerInput');
      const submitBtn = this.els.questionCard.querySelector('#submitBtn');
      if (input) { input.classList.add(isCorrect ? 'correct' : 'wrong'); input.disabled = true; }
      if (submitBtn) submitBtn.disabled = true;
    }

    const resultSection = this.els.questionCard.querySelector('#resultSection');
    if (!resultSection) return;

    const isFormula = this.quiz.mode === 'B';
    const formattedCorrect = isFormula
      ? `<strong>${formatFormula(correctAnswer)}</strong>`
      : `<em>${escapeHtml(correctAnswer)}</em>`;

    if (isCorrect) {
      resultSection.innerHTML = `
        <div class="result-section correct">
          <div class="result-title">✓ ${escapeHtml(randomFrom(POSITIVE_MESSAGES))}</div>
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

    this.els.nextBtn.style.display = '';
    this.renderStats();

    // Oslava streaku
    const streak = this.quiz.streak;
    if (isCorrect && (streak === 5 || streak === 10 || (streak > 10 && streak % 10 === 0))) {
      setTimeout(() => this.showCelebration(streak), 400);
    }

    setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
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
