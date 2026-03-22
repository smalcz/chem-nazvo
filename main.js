import { Quiz } from './quiz.js';
import { UI } from './ui.js';
import * as dataSoli from './data.js';
import * as dataOxidy from './data-oxidy.js';
import * as dataKyseliny from './data-kyseliny.js';
import * as dataHalogenidy from './data-halogenidy.js';

const MODULES = [
  { id: 'soli',        label: 'Soli',        noun: 'soli',        data: dataSoli },
  { id: 'oxidy',       label: 'Oxidy',        noun: 'oxidu',       data: dataOxidy },
  { id: 'kyseliny',    label: 'Kyseliny',     noun: 'kyseliny',    data: dataKyseliny },
  { id: 'halogenidy',  label: 'Halogenidy',   noun: 'halogenidu',  data: dataHalogenidy },
];

let quiz = new Quiz(MODULES[0].data);

const ui = new UI(
  quiz,
  handleAnswer,
  handleNext,
  handleModeChange,
  handleGroupToggle,
  handleReset,
  MODULES,
  handleModuleChange,
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

function handleModuleChange(moduleId) {
  const mod = MODULES.find(m => m.id === moduleId);
  quiz = new Quiz(mod.data);
  ui.quiz = quiz;
  ui.render();
  handleNext();
}

ui.render();
handleNext();
