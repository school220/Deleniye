/**
 * Главный координатор приложения тренажёра по математике для 5 класса
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // СОСТОЯНИЕ ПРИЛОЖЕНИЯ
  // =========================================================================
  const state = {
    currentScreen: 'start',
    selectedTopic: 'all',
    selectedCount: 10,
    tasks: [],
    currentIndex: 0,
    isAnswered: false,
    autoTimer: null,
    results: [],
    whiteboard: null
  };

  // =========================================================================
  // ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
  // =========================================================================
  const elements = {
    // Экраны
    screenStart: document.getElementById('screen-start'),
    screenQuiz: document.getElementById('screen-quiz'),
    screenResults: document.getElementById('screen-results'),

    // Навигация
    btnHome: document.getElementById('btn-home'),
    btnSound: document.getElementById('btn-toggle-sound'),
    soundIcon: document.getElementById('sound-icon'),
    soundLabel: document.getElementById('sound-label'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    navProgressGroup: document.getElementById('nav-progress-group'),
    navTopicName: document.getElementById('nav-topic-name'),
    navStepText: document.getElementById('nav-step-text'),
    navProgressFill: document.getElementById('nav-progress-fill'),

    // Стартовый экран
    topicCards: document.querySelectorAll('.topic-card'),
    countPills: document.querySelectorAll('.count-pill'),
    btnStartQuiz: document.getElementById('btn-start-quiz'),

    // Экран занятия
    quizTopicBadge: document.getElementById('quiz-topic-badge'),
    quizStepBadge: document.getElementById('quiz-step-badge'),
    questionText: document.getElementById('question-text'),
    optionsGrid: document.getElementById('options-grid'),

    // Обратная связь
    feedbackBanner: document.getElementById('feedback-banner'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackStatus: document.getElementById('feedback-status'),
    feedbackSubtext: document.getElementById('feedback-subtext'),
    feedbackExplanation: document.getElementById('feedback-explanation'),
    btnNextQuestion: document.getElementById('btn-next-question'),
    btnNextText: document.getElementById('btn-next-text'),
    btnNextTimer: document.getElementById('btn-next-timer'),

    // Холст и инструменты доски
    whiteboardWrapper: document.getElementById('whiteboard-wrapper'),
    whiteboardCanvas: document.getElementById('whiteboard-canvas'),
    toolPen: document.getElementById('tool-pen'),
    toolEraser: document.getElementById('tool-eraser'),
    colorDots: document.querySelectorAll('.color-dot'),
    sizeBtns: document.querySelectorAll('.size-btn'),
    btnUndo: document.getElementById('btn-undo'),
    btnClearBoard: document.getElementById('btn-clear-board'),
    btnToggleGrid: document.getElementById('btn-toggle-grid'),

    // Экран итогов
    resultsBadgeIcon: document.getElementById('results-badge-icon'),
    resultsMessage: document.getElementById('results-message'),
    statTotal: document.getElementById('stat-total'),
    statCorrect: document.getElementById('stat-correct'),
    statErrors: document.getElementById('stat-errors'),
    statPercent: document.getElementById('stat-percent'),
    reviewList: document.getElementById('review-list'),
    btnRestartSame: document.getElementById('btn-restart-same'),
    btnChooseTopic: document.getElementById('btn-choose-topic')
  };

  // =========================================================================
  // ИНИЦИАЛИЗАЦИЯ ИНТЕРАКТИВНОЙ ДОСКИ (WHITEBOARD)
  // =========================================================================
  if (elements.whiteboardCanvas && elements.whiteboardWrapper) {
    state.whiteboard = new Whiteboard(elements.whiteboardCanvas, elements.whiteboardWrapper);

    state.whiteboard.onStateChange((wbState) => {
      elements.btnUndo.disabled = !wbState.canUndo;
    });
  }

  // =========================================================================
  // ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
  // =========================================================================
  function showScreen(screenName) {
    state.currentScreen = screenName;
    elements.screenStart.classList.toggle('active', screenName === 'start');
    elements.screenQuiz.classList.toggle('active', screenName === 'quiz');
    elements.screenResults.classList.toggle('active', screenName === 'results');

    // Индикатор прогресса в шапке показываем только во время занятия
    if (screenName === 'quiz') {
      elements.navProgressGroup.classList.remove('hidden');
      if (state.whiteboard) {
        // Подгоняем размер холста под контейнер
        setTimeout(() => state.whiteboard.handleResize(), 50);
      }
    } else {
      elements.navProgressGroup.classList.add('hidden');
    }

    // Скролл вверх при смене экрана
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // =========================================================================
  // СТАРТ ТРЕНИРОВКИ
  // =========================================================================
  function startQuiz() {
    window.soundCtrl.playClick();

    // Формируем список заданий
    state.tasks = prepareTasksForSession(state.selectedTopic, state.selectedCount);
    state.currentIndex = 0;
    state.results = [];
    state.isAnswered = false;

    if (state.tasks.length === 0) {
      alert('Не удалось загрузить задания для выбранной темы.');
      return;
    }

    // Очищаем доску перед первым заданием
    if (state.whiteboard) {
      state.whiteboard.resetForNextQuestion();
    }

    showScreen('quiz');
    renderCurrentQuestion();
  }

  // =========================================================================
  // ОТОБРАЖЕНИЕ ТЕКУЩЕГО ВОПРОСА
  // =========================================================================
  function renderCurrentQuestion() {
    clearAutoAdvanceTimer();
    state.isAnswered = false;

    const task = state.tasks[state.currentIndex];
    const total = state.tasks.length;
    const currentNum = state.currentIndex + 1;

    // Обновляем верхний статус
    elements.navTopicName.textContent = TOPIC_NAMES[state.selectedTopic] || task.topicName;
    elements.navStepText.textContent = `Задание ${currentNum} из ${total}`;
    const progressPercent = Math.round(((currentNum - 1) / total) * 100);
    elements.navProgressFill.style.width = `${progressPercent}%`;

    // Метаданные карточки вопроса
    elements.quizTopicBadge.textContent = task.topicName;
    elements.quizStepBadge.textContent = `Задание ${currentNum} из ${total}`;
    elements.questionText.innerHTML = formatMath(task.question);

    // Скрываем плашку обратной связи
    elements.feedbackBanner.classList.add('hidden');
    elements.feedbackBanner.classList.remove('correct', 'incorrect');
    elements.feedbackExplanation.classList.add('hidden');
    elements.btnNextTimer.classList.remove('animating');

    // Очищаем доску для вычислений к новому заданию
    if (state.whiteboard) {
      state.whiteboard.resetForNextQuestion();
    }

    // Отрисовка 4 вариантов ответа в сетке 2 × 2
    elements.optionsGrid.innerHTML = '';
    const letters = ['А', 'Б', 'В', 'Г'];

    task.shuffledOptions.forEach((optionText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.dataset.index = idx.toString();
      btn.setAttribute('aria-label', `Вариант ${letters[idx]}: ${optionText}`);

      btn.innerHTML = `
        <span class="option-letter">${letters[idx]}</span>
        <span class="option-value">${formatMath(optionText)}</span>
      `;

      btn.addEventListener('click', () => handleOptionSelect(idx));
      elements.optionsGrid.appendChild(btn);
    });
  }

  // =========================================================================
  // ОБРАБОТКА ВЫБОРА ОТВЕТА
  // =========================================================================
  function handleOptionSelect(selectedIndex) {
    if (state.isAnswered) return; // Защита от повторного клика
    state.isAnswered = true;

    const task = state.tasks[state.currentIndex];
    const isCorrect = selectedIndex === task.correctIndex;
    const selectedAnswerText = task.shuffledOptions[selectedIndex];

    // Запоминаем результат
    state.results.push({
      task,
      selectedAnswer: selectedAnswerText,
      isCorrect
    });

    // Блокируем все кнопки вариантов и подсвечиваем результат
    const optionButtons = elements.optionsGrid.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, idx) => {
      btn.disabled = true;

      if (idx === selectedIndex) {
        btn.classList.add('selected');
        if (isCorrect) {
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-incorrect');
        }
      } else if (idx === task.correctIndex) {
        // Если выбран неверный — подсвечиваем верный
        btn.classList.add('is-correct');
      } else {
        btn.classList.add('dimmed');
      }
    });

    // Обновляем полосу прогресса
    const total = state.tasks.length;
    const currentNum = state.currentIndex + 1;
    elements.navProgressFill.style.width = `${Math.round((currentNum / total) * 100)}%`;

    // Показываем плашку обратной связи
    elements.feedbackBanner.classList.remove('hidden');

    if (isCorrect) {
      window.soundCtrl.playCorrect();
      elements.feedbackBanner.classList.add('correct');
      elements.feedbackIcon.textContent = '✓';
      elements.feedbackStatus.textContent = 'Правильно!';
      elements.feedbackSubtext.textContent = 'Отличная работа! Переходим к следующему заданию...';
      elements.feedbackExplanation.classList.add('hidden');

      elements.btnNextText.textContent = isLastQuestion() ? 'Завершить' : 'Дальше';

      // Анимированный индикатор паузы
      elements.btnNextTimer.classList.remove('animating');
      void elements.btnNextTimer.offsetWidth; // Trigger reflow
      elements.btnNextTimer.classList.add('animating');

      // Автопереход через 2.5 секунды
      state.autoTimer = setTimeout(() => {
        advanceToNextQuestion();
      }, 2500);

    } else {
      window.soundCtrl.playIncorrect();
      elements.feedbackBanner.classList.add('incorrect');
      elements.feedbackIcon.textContent = '✗';
      elements.feedbackStatus.textContent = 'Пока неверно';
      elements.feedbackSubtext.innerHTML = `Правильный ответ: <strong>${formatMath(task.correct)}</strong>`;

      if (task.hint) {
        elements.feedbackExplanation.innerHTML = `💡 Пояснение: ${formatMath(task.hint)}`;
        elements.feedbackExplanation.classList.remove('hidden');
      } else {
        elements.feedbackExplanation.classList.add('hidden');
      }

      elements.btnNextText.textContent = isLastQuestion() ? 'Посмотреть результаты' : 'Следующее задание';
      elements.btnNextTimer.classList.remove('animating');

      // При ошибке автоперехода НЕТ — ученик сам нажимает кнопку
    }

    // Фокус на кнопку перехода для удобства работы с клавиатуры и доски
    elements.btnNextQuestion.focus();
  }

  function isLastQuestion() {
    return state.currentIndex >= state.tasks.length - 1;
  }

  function clearAutoAdvanceTimer() {
    if (state.autoTimer) {
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
    }
    if (elements.btnNextTimer) {
      elements.btnNextTimer.classList.remove('animating');
    }
  }

  // =========================================================================
  // ПЕРЕХОД К СЛЕДУЮЩЕМУ ЗАДАНИЮ
  // =========================================================================
  function advanceToNextQuestion() {
    clearAutoAdvanceTimer();
    window.soundCtrl.playClick();

    if (isLastQuestion()) {
      finishQuiz();
    } else {
      state.currentIndex++;
      renderCurrentQuestion();
    }
  }

  // =========================================================================
  // ЗАВЕРШЕНИЕ ЗАНЯТИЯ (ЭКРАН ИТОГОВ)
  // =========================================================================
  function finishQuiz() {
    clearAutoAdvanceTimer();
    window.soundCtrl.playComplete();

    const total = state.results.length;
    const correctCount = state.results.filter(r => r.isCorrect).length;
    const errorCount = total - correctCount;
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    elements.statTotal.textContent = total.toString();
    elements.statCorrect.textContent = correctCount.toString();
    elements.statErrors.textContent = errorCount.toString();
    elements.statPercent.textContent = `${percent}%`;

    // Мотивирующее сообщение и иконка
    if (percent === 100) {
      elements.resultsBadgeIcon.textContent = '🌟';
      elements.resultsMessage.textContent = 'Блестяще! Абсолютно верное решение всех задач!';
    } else if (percent >= 80) {
      elements.resultsBadgeIcon.textContent = '🎉';
      elements.resultsMessage.textContent = 'Отличный результат! Большинство заданий решено верно.';
    } else if (percent >= 50) {
      elements.resultsBadgeIcon.textContent = '👍';
      elements.resultsMessage.textContent = 'Хорошая тренировка! Повтори правила и попробуй ещё раз.';
    } else {
      elements.resultsBadgeIcon.textContent = '💪';
      elements.resultsMessage.textContent = 'Не унывай! Решай на доске не торопясь, всё обязательно получится!';
    }

    // Заполнение списка разбора заданий
    elements.reviewList.innerHTML = '';
    state.results.forEach((res, idx) => {
      const item = document.createElement('div');
      item.className = `review-item ${res.isCorrect ? 'is-correct' : 'is-incorrect'}`;

      const icon = res.isCorrect ? '✓' : '✗';
      const cleanQ = res.task.question.replace(/\n/g, ' ');

      item.innerHTML = `
        <span class="review-status">${icon} #${idx + 1}</span>
        <span class="review-q">${formatMath(cleanQ)}</span>
        <span class="review-ans">
          ${res.isCorrect ? `Ответ: <strong>${formatMath(res.selectedAnswer)}</strong>` : `Ваш: <span style="text-decoration:line-through">${formatMath(res.selectedAnswer)}</span> | Правильно: <strong>${formatMath(res.task.correct)}</strong>`}
        </span>
      `;
      elements.reviewList.appendChild(item);
    });

    showScreen('results');
  }

  // =========================================================================
  // СОБЫТИЯ ПОЛЬЗОВАТЕЛЬСКОГО ИНТЕРФЕЙСА
  // =========================================================================

  // Выбор темы на стартовом экране
  elements.topicCards.forEach(card => {
    card.addEventListener('click', () => {
      window.soundCtrl.playClick();
      elements.topicCards.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
      state.selectedTopic = card.dataset.topic;
    });
  });

  // Выбор количества заданий
  elements.countPills.forEach(pill => {
    pill.addEventListener('click', () => {
      window.soundCtrl.playClick();
      elements.countPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-checked', 'true');
      state.selectedCount = parseInt(pill.dataset.count, 10);
    });
  });

  // Кнопка старта занятия
  elements.btnStartQuiz.addEventListener('click', startQuiz);

  // Кнопка "Дальше" / "Следующее задание"
  elements.btnNextQuestion.addEventListener('click', advanceToNextQuestion);

  // Кнопки на экране результатов
  elements.btnRestartSame.addEventListener('click', startQuiz);
  elements.btnChooseTopic.addEventListener('click', () => {
    window.soundCtrl.playClick();
    showScreen('start');
  });

  // Кнопка выхода в главное меню
  elements.btnHome.addEventListener('click', () => {
    if (state.currentScreen === 'quiz') {
      if (confirm('Прервать текущее занятие и вернуться в меню выбора темы?')) {
        clearAutoAdvanceTimer();
        showScreen('start');
      }
    } else {
      showScreen('start');
    }
  });

  // Переключение звука
  elements.btnSound.addEventListener('click', () => {
    const enabled = window.soundCtrl.toggle();
    elements.soundIcon.textContent = enabled ? '🔊' : '🔇';
    elements.soundLabel.textContent = enabled ? 'Звук' : 'Без звука';
  });

  // =========================================================================
  // РЕЖИМ ПОЛНОГО ЭКРАНА (ЭЛЕКТРОННАЯ ДОСКА)
  // Поддерживает нативный Fullscreen API и надёжный CSS-fallback
  // =========================================================================
  function isFullscreenActive() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      document.body.classList.contains('pseudo-fullscreen')
    );
  }

  function updateFullscreenUI(active) {
    const icon = elements.btnFullscreen.querySelector('.btn-icon');
    const text = elements.btnFullscreen.querySelector('.nav-btn-text');

    if (active) {
      if (icon) icon.textContent = '🗗';
      if (text) text.textContent = 'Свернуть';
      elements.btnFullscreen.title = 'Выйти из полноэкранного режима (Esc)';
      elements.btnFullscreen.setAttribute('aria-label', 'Выйти из полноэкранного режима');
      elements.btnFullscreen.classList.add('active');
    } else {
      if (icon) icon.textContent = '⛶';
      if (text) text.textContent = 'Экран';
      elements.btnFullscreen.title = 'На весь экран (режим электронной доски)';
      elements.btnFullscreen.setAttribute('aria-label', 'Развернуть на весь экран');
      elements.btnFullscreen.classList.remove('active');
    }

    // Обновляем размер холста после изменения размеров экрана
    if (state.whiteboard) {
      setTimeout(() => state.whiteboard.handleResize(), 120);
    }
  }

  async function toggleFullscreen() {
    window.soundCtrl.playClick();
    const isFull = isFullscreenActive();

    if (!isFull) {
      // 1. Пробуем нативный Fullscreen API
      const docEl = document.documentElement;
      const requestMethod =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      let nativeSucceeded = false;
      if (requestMethod && (document.fullscreenEnabled || document.webkitFullscreenEnabled || true)) {
        try {
          await requestMethod.call(docEl);
          nativeSucceeded = true;
        } catch (err) {
          console.warn('Native fullscreen not permitted, activating CSS fullscreen mode:', err);
          nativeSucceeded = false;
        }
      }

      // 2. Если нативный метод не сработал (iframe, ограничения безопасности, iOS) — включаем CSS режим
      if (!nativeSucceeded) {
        document.body.classList.add('pseudo-fullscreen');
        document.getElementById('app').classList.add('is-fullscreen');
        updateFullscreenUI(true);
      }
    } else {
      // Выход из полноэкранного режима
      if (document.body.classList.contains('pseudo-fullscreen')) {
        document.body.classList.remove('pseudo-fullscreen');
        document.getElementById('app').classList.remove('is-fullscreen');
        updateFullscreenUI(false);
      }

      const exitMethod =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (exitMethod && (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)) {
        try {
          await exitMethod.call(document);
        } catch (err) {}
      }
    }
  }

  // Слушатели системных изменений полноэкранного режима
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
    document.addEventListener(evtName, () => {
      const isNative = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      updateFullscreenUI(isNative || document.body.classList.contains('pseudo-fullscreen'));
    });
  });

  elements.btnFullscreen.addEventListener('click', toggleFullscreen);

  // =========================================================================
  // УПРАВЛЕНИЕ ИНСТРУМЕНТАМИ ДОСКИ
  // =========================================================================
  if (state.whiteboard) {
    // Выбор инструмента: Маркер
    elements.toolPen.addEventListener('click', () => {
      elements.toolPen.classList.add('active');
      elements.toolEraser.classList.remove('active');
      state.whiteboard.setTool('pen');
    });

    // Выбор инструмента: Ластик
    elements.toolEraser.addEventListener('click', () => {
      elements.toolEraser.classList.add('active');
      elements.toolPen.classList.remove('active');
      state.whiteboard.setTool('eraser');
    });

    // Палитра цветов
    elements.colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        elements.colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        state.whiteboard.setColor(dot.dataset.color);
        elements.toolPen.classList.add('active');
        elements.toolEraser.classList.remove('active');
      });
    });

    // Толщина линии
    elements.sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.whiteboard.setLineWidth(parseInt(btn.dataset.size, 10));
      });
    });

    // Отменить (Undo)
    elements.btnUndo.addEventListener('click', () => {
      state.whiteboard.undo();
    });

    // Очистить поле (Clear)
    elements.btnClearBoard.addEventListener('click', () => {
      state.whiteboard.clear();
    });

    // Включение / выключение клетки
    elements.btnToggleGrid.addEventListener('click', () => {
      const isGrid = elements.whiteboardWrapper.classList.toggle('grid-enabled');
      elements.btnToggleGrid.classList.toggle('active', isGrid);
    });
  }

  // =========================================================================
  // ГОРЯЧИЕ КЛАВИШИ (КЛАВИАТУРА)
  // =========================================================================
  window.addEventListener('keydown', (e) => {
    // Игнорируем нажатия, если фокус в инпуте
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    // F11: универсальное переключение полноэкранного режима
    if (e.code === 'F11') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    // Escape: закрытие CSS-полноэкранного режима
    if (e.code === 'Escape' && isFullscreenActive()) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (state.currentScreen === 'quiz') {
      // 1, 2, 3, 4 для выбора вариантов ответа
      if (['Digit1', 'Numpad1', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        handleOptionSelect(0);
      } else if (['Digit2', 'Numpad2', 'KeyB'].includes(e.code)) {
        e.preventDefault();
        handleOptionSelect(1);
      } else if (['Digit3', 'Numpad3'].includes(e.code)) {
        e.preventDefault();
        handleOptionSelect(2);
      } else if (['Digit4', 'Numpad4'].includes(e.code)) {
        e.preventDefault();
        handleOptionSelect(3);
      }

      // Enter или Space для перехода к следующему вопросу (когда ответ дан)
      if (['Enter', 'Space'].includes(e.code) && state.isAnswered) {
        e.preventDefault();
        advanceToNextQuestion();
      }

      // 'Z' или Ctrl+Z для отмены на доске
      if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') {
        if (state.whiteboard) {
          e.preventDefault();
          state.whiteboard.undo();
        }
      }

      // 'C' для очистки доски
      if (e.code === 'KeyC') {
        if (state.whiteboard) {
          state.whiteboard.clear();
        }
      }

      // 'P' для ручки, 'E' для ластика
      if (e.code === 'KeyP' && state.whiteboard) {
        elements.toolPen.click();
      }
      if (e.code === 'KeyE' && state.whiteboard) {
        elements.toolEraser.click();
      }
    }
  });

  // Утилита экранирования HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =========================================================================
  // ФОРМАТИРОВАНИЕ МАТЕМАТИЧЕСКИХ ДРОБЕЙ И ВЫРАЖЕНИЙ
  // Превращает обыкновенные дроби (a/b) и смешанные (w a/b) в вертикальные
  // двухэтажные дроби с горизонтальной чертой, как на фото и в учебниках.
  // =========================================================================
  function formatMath(rawText) {
    if (rawText === null || rawText === undefined) return '';
    let text = escapeHtml(String(rawText));

    // 1. Нормализация Unicode-индексов дробей (если есть)
    const superMap = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
    const subMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\/([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, num, denom) => {
      const n = num.split('').map(c => superMap[c] || c).join('');
      const d = denom.split('').map(c => subMap[c] || c).join('');
      return `${n}/${d}`;
    });

    // 2. Смешанные числа: например, "4 5/6", "3 4/7", "1 5/7", "2 11/7"
    text = text.replace(/\b(\d+)\s+(\d+)\/(\d+)\b/g, (_, whole, num, denom) => {
      return `<span class="math-mixed"><span class="whole">${whole}</span><span class="math-frac"><span class="num">${num}</span><span class="denom">${denom}</span></span></span>`;
    });

    // 3. Обыкновенные дроби: например, "3/4", "7/19", "12/38", "2/19", "13/19", "29/6"
    text = text.replace(/(^|[^0-9/])(\d+)\/(\d+)(?![0-9/])/g, (_, prefix, num, denom) => {
      return `${prefix}<span class="math-frac"><span class="num">${num}</span><span class="denom">${denom}</span></span>`;
    });

    // 4. Степени чисел: 2³ -> 2², 5² -> 5²
    text = text.replace(/(\d+)²/g, '$1<sup>2</sup>');
    text = text.replace(/(\d+)³/g, '$1<sup>3</sup>');

    // 5. Единицы измерения: см², см³, дм²
    text = text.replace(/см²/g, 'см<sup>2</sup>');
    text = text.replace(/см³/g, 'см<sup>3</sup>');
    text = text.replace(/дм²/g, 'дм<sup>2</sup>');

    // 6. Переносы строк
    text = text.replace(/\n/g, '<br>');

    return text;
  }
});
