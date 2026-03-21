// Vstupní bod aplikace — inicializace a propojení Quiz + UI

import { Quiz } from './quiz.js';
import { UI } from './ui.js';

const quiz = new Quiz();

const ui = new UI(
  quiz,
  handleAnswer,
  handleNext,
  handleModeChange,
  handleGroupToggle,
  handleReset,
);

// ─── Handlery ─────────────────────────────────────────────────────────────

function handleAnswer(userInput) {
  return quiz.checkAnswer(userInput);
}

function handleNext() {
  const example = quiz.nextExample();
  if (!example) {
    ui.renderEmpty();
    return;
  }
  ui.renderQuestion(example);
}

function handleModeChange(mode) {
  quiz.setMode(mode);
  ui.render();
  // Automaticky načíst novou otázku
  handleNext();
}

function handleGroupToggle(group) {
  quiz.toggleGroup(group);
  ui.render();
  // Pokud je aktuální příklad v odfiltrované skupině, načíst nový
  handleNext();
}

function handleReset() {
  quiz.resetSession();
  ui.render();
  handleNext();
}

// ─── Start ─────────────────────────────────────────────────────────────────

ui.render();
handleNext();
