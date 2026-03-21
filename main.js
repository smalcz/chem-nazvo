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

function handleAnswer(userInput) {
  return quiz.checkAnswer(userInput);
}

function handleNext() {
  const result = quiz.nextExample();
  if (!result) {
    ui.renderEmpty();
    return;
  }
  ui.renderQuestion(result.example, result.isRetry);
}

function handleModeChange(mode) {
  quiz.setMode(mode);
  ui.render();
  handleNext();
}

function handleGroupToggle(group) {
  quiz.toggleGroup(group);
  ui.render();
  handleNext();
}

function handleReset() {
  quiz.resetSession();
  ui.render();
  handleNext();
}

ui.render();
handleNext();
