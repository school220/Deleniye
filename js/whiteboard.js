/**
 * Интерактивная доска (черновик/холст) для решения задач на электронной доске, ПК и планшете.
 * Оптимизирована для высокой частоты кадров (60 FPS), без лагов на слабых устройствах.
 */

class Whiteboard {
  constructor(canvasElement, containerElement) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = this.canvas.getContext('2d');

    // Состояние инструмента
    this.currentTool = 'pen'; // 'pen' | 'eraser'
    this.currentColor = '#1d4ed8'; // Классический цвет чернил школьной тетради
    this.lineWidth = 4; // Пиксели
    this.isDrawing = false;
    this.activePointerId = null; // Для надёжного отслеживания пассивного пластикового стилуса
    this.lastPoint = null;
    this.points = [];

    // Стек отмены (Undo) — хранит GPU-холсты для мгновенного отката без задержек CPU
    this.history = [];
    this.maxHistory = 15;

    // Инициализация
    this._initCanvasSize();
    this._bindEvents();
    this.saveState(); // Начальное чистое состояние

    // Слушатель изменения размера окна
    window.addEventListener('resize', () => this.handleResize());
  }

  _initCanvasSize() {
    const rect = this.container.getBoundingClientRect();
    // Ограничиваем DPR=1.5 для гарантированного отсутствия лагов на 4K/2K досках со слабыми чипами (Celeron, Intel HD)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const displayWidth = Math.max(rect.width, 280);
    const displayHeight = Math.max(rect.height, 220);

    // Запоминаем текущий рисунок перед изменением размера, если холст уже имел размер
    let tempCanvas = null;
    if (this.canvas.width > 0 && this.canvas.height > 0) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this.canvas, 0, 0);
    }

    this.canvas.width = Math.round(displayWidth * dpr);
    this.canvas.height = Math.round(displayHeight * dpr);
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    this.dpr = dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Восстанавливаем рисунок
    if (tempCanvas) {
      this.ctx.drawImage(
        tempCanvas,
        0, 0, tempCanvas.width, tempCanvas.height,
        0, 0, displayWidth, displayHeight
      );
    }
  }

  handleResize() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this._initCanvasSize();
    }, 100);
  }

  _bindEvents() {
    // 1. Блокируем встроенные жесты прокрутки и задержки сенсорного ввода на досках
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => e.preventDefault(), { passive: false });

    // 2. Pointer Events работают универсально с пассивным стилусом-указкой, пальцем и мышью
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: false });
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerCancel(e), { passive: false });
    this.canvas.addEventListener('pointerleave', (e) => this.onPointerLeave(e), { passive: false });

    // Предотвращение контекстного меню и выделения
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5
    };
  }

  onPointerDown(e) {
    // Если уже идёт рисование (например, пассивным стилусом), игнорируем второе касание (ладонь/рукав)
    if (this.isDrawing && this.activePointerId !== null) return;

    e.preventDefault();
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    this.isDrawing = true;
    const pt = this._getCoordinates(e);
    this.points = [pt];
    this.lastPoint = pt;

    // Рисуем точку на случай одиночного клика/касания
    this._drawDot(pt, e);
  }

  onPointerMove(e) {
    if (!this.isDrawing) return;
    // Только то касание, которое начало линию (пассивный пластиковый стилус)
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    e.preventDefault();

    // Поддержка аппаратных промежуточных точек стилуса (до 120-240 Гц на ИК/P-Cap досках)
    const events = (e.getCoalescedEvents && typeof e.getCoalescedEvents === 'function')
      ? e.getCoalescedEvents()
      : [e];

    this._applyBrushSettings(events[0] || e);

    for (let i = 0; i < events.length; i++) {
      const pt = this._getCoordinates(events[i]);
      this.points.push(pt);

      // Сглаживание линии через кривые Безье между средними точками
      if (this.points.length >= 3) {
        const p0 = this.points[this.points.length - 3];
        const p1 = this.points[this.points.length - 2];
        const p2 = this.points[this.points.length - 1];

        const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        this.ctx.beginPath();
        this.ctx.moveTo(mid1.x, mid1.y);
        this.ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
        this.ctx.stroke();
      } else if (this.lastPoint) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
        this.ctx.lineTo(pt.x, pt.y);
        this.ctx.stroke();
      }

      this.lastPoint = pt;
    }
  }

  _drawDot(pt, e) {
    this._applyBrushSettings(e);
    this.ctx.beginPath();
    const isHardwareEraser = e && (Boolean(e.buttons & 32) || e.button === 5);
    const isErasing = this.currentTool === 'eraser' || isHardwareEraser;
    const radius = Math.max(1, (isErasing ? this.lineWidth * 2.5 : this.lineWidth) / 2);
    this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  _applyBrushSettings(e) {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Поддержка аппаратного ластика на стилусах (Promethean / SMART / Wacom / Surface):
    // если ученик перевернул стилус обратной стороной (eraser tip)
    const isHardwareEraser = e && (Boolean(e.buttons & 32) || e.button === 5);
    const isErasing = this.currentTool === 'eraser' || isHardwareEraser;

    if (isErasing) {
      // Режим стирания: очищает пиксели до фона (клетка остаётся под холстом)
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = this.lineWidth * 3.5;
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.lineWidth = this.lineWidth;
    }
  }

  onPointerUp(e) {
    if (!this.isDrawing) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    this.isDrawing = false;
    this.activePointerId = null;
    this.points = [];
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    this.saveState();
  }

  onPointerCancel(e) {
    if (this.activePointerId !== null && e.pointerId === this.activePointerId) {
      this.onPointerUp(e);
    }
  }

  onPointerLeave(e) {
    if (this.isDrawing && this.activePointerId !== null && e.pointerId === this.activePointerId) {
      try {
        if (!this.canvas.hasPointerCapture(e.pointerId)) {
          this.onPointerUp(e);
        }
      } catch (err) {
        this.onPointerUp(e);
      }
    }
  }

  /**
   * Сохранение состояния в стек Undo через GPU-снапшот (без чтения пикселей на CPU)
   */
  saveState() {
    if (this.history.length >= this.maxHistory) {
      this.history.shift();
    }
    const snapshot = document.createElement('canvas');
    snapshot.width = this.canvas.width;
    snapshot.height = this.canvas.height;
    const snapCtx = snapshot.getContext('2d');
    if (snapCtx) {
      snapCtx.drawImage(this.canvas, 0, 0);
      this.history.push(snapshot);
    }
    this._notifyStateChange();
  }

  /**
   * Шаг назад (Отменить) — мгновенно восстанавливает GPU-текстуру
   */
  undo() {
    if (this.history.length > 1) {
      this.history.pop(); // Удаляем текущее состояние
      const prevState = this.history[this.history.length - 1];
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(prevState, 0, 0);
      this.ctx.restore();
      this._notifyStateChange();
      return true;
    }
    return false;
  }

  canUndo() {
    return this.history.length > 1;
  }

  /**
   * Полная очистка поля
   */
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.saveState();
  }

  /**
   * Очистить историю для нового задания
   */
  resetForNextQuestion() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.history = [];
    this.saveState();
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
    if (this.currentTool === 'eraser') {
      this.currentTool = 'pen';
    }
  }

  setLineWidth(width) {
    this.lineWidth = width;
  }

  onStateChange(cb) {
    this._stateChangeCallback = cb;
  }

  _notifyStateChange() {
    if (this._stateChangeCallback) {
      this._stateChangeCallback({
        canUndo: this.canUndo(),
        tool: this.currentTool,
        color: this.currentColor
      });
    }
  }
}

// Экспорт глобально
window.Whiteboard = Whiteboard;
