/* ══════════════════════════════
   tts-core.js — 站点级公共基础设施
   与具体版块无关的浏览器朗读能力，供各版块的 xxx-ui.js 调用。
   不包含任何版块专属逻辑（不知道什么是"场景""症状""危险信号"，
   也不包含任何具体产品交互设计——例如"提供哪几种朗读模式按钮"
   这类选择，由各版块自己的 -ui.js 决定，不属于这一层）。

   能力范围：
   - speak()        朗读一段文字，支持语速/音色/音高
   - speakSegments() 依次朗读多段（可各自指定语言/语速/音色/间隔），
                     用于"一句话要分几段读"的场景（如日语→翻译→日语重复）
   - speakQueue()    依次朗读一组独立条目（如列表逐条朗读）
   - pause()/resume() 暂停/继续（区别于 stop 的"取消重来"）
   - stop()          取消当前朗读
   - isSupported()   浏览器是否支持
   - isSpeaking()/isPaused() 状态查询
   - getVoices()     获取可用音色列表（含加载完成回调，因为部分浏览器异步加载音色）

   Living Japanese v4.0 SSG
══════════════════════════════ */

(function () {
  'use strict';

  function isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  let speaking = false;
  let paused = false;

  /**
   * 朗读一段文字。
   * opts: {
   *   lang    — BCP47语言码，默认 'ja-JP'
   *   rate    — 语速，默认 1
   *   pitch   — 音高，默认 1
   *   voice   — SpeechSynthesisVoice 对象，可选
   *   onEnd   — 读完回调
   *   onError — 出错回调
   * }
   * 返回创建的 utterance，供调用方需要时读取/追踪。
   */
  function speak(text, opts) {
    opts = opts || {};
    if (!isSupported() || !text) return null;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = opts.lang || 'ja-JP';
    utterance.rate = typeof opts.rate === 'number' ? opts.rate : 1;
    utterance.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1;
    if (opts.voice) utterance.voice = opts.voice;

    utterance.onstart = function () { speaking = true; paused = false; };
    utterance.onend = function () {
      speaking = false;
      paused = false;
      if (typeof opts.onEnd === 'function') opts.onEnd();
    };
    utterance.onerror = function (e) {
      speaking = false;
      paused = false;
      if (typeof opts.onError === 'function') opts.onError(e);
    };

    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  /**
   * 依次朗读多个"段落"，用于一句话需要拆成几段朗读的场景
   * （例如：先读日语，再读翻译，再重复一遍日语）。
   * segments: [{ text, lang, rate, pitch, voice }]
   * opts: {
   *   gapMs      — 每段之间的停顿毫秒数，默认 350
   *   onSegStart(index) — 每段开始前回调
   *   onAllEnd() — 全部读完回调
   * }
   */
  function speakSegments(segments, opts) {
    opts = opts || {};
    if (!isSupported() || !segments || !segments.length) return;

    const gapMs = typeof opts.gapMs === 'number' ? opts.gapMs : 350;
    let index = 0;

    function playNext() {
      if (index >= segments.length) {
        if (typeof opts.onAllEnd === 'function') opts.onAllEnd();
        return;
      }
      const seg = segments[index];
      if (typeof opts.onSegStart === 'function') opts.onSegStart(index);

      speak(seg.text, {
        lang: seg.lang,
        rate: seg.rate,
        pitch: seg.pitch,
        voice: seg.voice,
        onEnd: function () {
          index += 1;
          setTimeout(playNext, gapMs);
        },
        onError: function () {
          index += 1;
          setTimeout(playNext, gapMs);
        }
      });
    }

    playNext();
  }

  /**
   * 依次朗读一组独立条目（如列表逐条朗读，每条只有一段）。
   * items: [{ text, lang, rate, pitch, voice }]
   * opts: {
   *   gapMs — 条目之间的停顿毫秒数，默认 450
   *   onEachStart(index) — 每条开始前回调
   *   onAllEnd() — 全部读完回调
   * }
   */
  function speakQueue(items, opts) {
    opts = opts || {};
    speakSegments(items, {
      gapMs: typeof opts.gapMs === 'number' ? opts.gapMs : 450,
      onSegStart: opts.onEachStart,
      onAllEnd: opts.onAllEnd
    });
  }

  function pause() {
    if (isSupported() && speaking && !paused) {
      window.speechSynthesis.pause();
      paused = true;
    }
  }

  function resume() {
    if (isSupported() && paused) {
      window.speechSynthesis.resume();
      paused = false;
    }
  }

  function stop() {
    if (isSupported()) {
      window.speechSynthesis.cancel();
    }
    speaking = false;
    paused = false;
  }

  function isSpeaking() {
    return speaking;
  }

  function isPaused() {
    return paused;
  }

  /**
   * 获取可用音色列表。部分浏览器（尤其首次加载）是异步返回的，
   * 所以提供回调形式；若已就绪则同步立即回调。
   */
  function getVoices(callback) {
    if (!isSupported() || typeof callback !== 'function') return;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      callback(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = function () {
      callback(window.speechSynthesis.getVoices());
    };
  }

  window.ttsCore = {
    isSupported: isSupported,
    speak: speak,
    speakSegments: speakSegments,
    speakQueue: speakQueue,
    pause: pause,
    resume: resume,
    stop: stop,
    isSpeaking: isSpeaking,
    isPaused: isPaused,
    getVoices: getVoices
  };
})();
