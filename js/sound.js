/**
 * Синтезатор звуков на Web Audio API
 * Работает 100% автономно без внешних mp3/wav файлов.
 */

class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      const saved = localStorage.getItem('math_sound_enabled');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch (e) {
      this.enabled = true;
    }
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('math_sound_enabled', this.enabled.toString());
    } catch (e) {}
    return this.enabled;
  }

  /**
   * Звук правильного ответа: приятный мажорный аккорд/перелив
   */
  playCorrect() {
    if (!this.enabled) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0, now + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.36);
      });
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  /**
   * Звук неверного ответа: мягкий, не пугающий и не раздражающий
   */
  playIncorrect() {
    if (!this.enabled) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const tones = [311.13, 277.18]; // Eb4 -> Db4

      tones.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.29);
      });
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  /**
   * Легкий щелчок на кнопках
   */
  playClick() {
    if (!this.enabled) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.03);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch (e) {}
  }

  /**
   * Праздничный аккорд завершения тренировки
   */
  playComplete() {
    if (!this.enabled) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99],          // C-E-G
        [587.33, 739.99, 880.00],          // D-F#-A
        [659.25, 830.61, 987.77],          // E-G#-B
        [783.99, 987.77, 1174.66, 1567.98] // G-B-D-G
      ];

      chords.forEach((chord, cIdx) => {
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          const start = now + cIdx * 0.14;
          const dur = cIdx === 3 ? 0.7 : 0.25;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.08, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(start);
          osc.stop(start + dur + 0.05);
        });
      });
    } catch (e) {}
  }
}

// Экспорт глобально
window.soundCtrl = new SoundController();
