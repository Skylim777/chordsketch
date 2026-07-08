// ChordSketch - audio.js 発音エンジン
const AudioEngine = (() => {
  let ctx = null;
  let useSamples = false;
  let buffers = [];  // { midi, buffer }
  let instrument = "piano";  // "piano" | "guitar"（STEP4）

  // samples/piano/ に置くファイル（無ければシンセで代替）
  const SAMPLES = [
    { file: "C2.mp3", midi: 36 }, { file: "Fs2.mp3", midi: 42 },
    { file: "C3.mp3", midi: 48 }, { file: "Fs3.mp3", midi: 54 },
    { file: "C4.mp3", midi: 60 }, { file: "Fs4.mp3", midi: 66 },
    { file: "C5.mp3", midi: 72 }
  ];

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  async function init() {
    // file:// 直開きでは fetch が使えない（CORS）ため、最初からシンセ音で動かす
    if (location.protocol === "file:") {
      useSamples = false;
      console.log("[audio] file:// のためシンセ音で発音します（サンプルは公開後/ローカルサーバーで有効）");
      return;
    }
    try {
      ensureCtx();
      buffers = await Promise.all(SAMPLES.map(async s => {
        const res = await fetch("samples/piano/" + s.file);
        if (!res.ok) throw new Error(s.file + " not found");
        const arr = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arr);
        return { midi: s.midi, buffer };
      }));
      useSamples = true;
      console.log("[audio] ピアノサンプルを読み込みました");
    } catch (e) {
      useSamples = false;
      console.log("[audio] サンプル未配置のためシンセ音で発音します");
    }
  }

  function playNote(midi, time, dur = 1.8, inst = instrument) {
    const c = ensureCtx();
    const gain = c.createGain();
    gain.connect(c.destination);

    if (inst === "guitar") {
      playPluck(c, gain, midi, time, dur);
      return;
    }

    if (useSamples) {
      // 最寄りのサンプルを選んでピッチシフト
      let best = buffers[0];
      for (const b of buffers) {
        if (Math.abs(b.midi - midi) < Math.abs(best.midi - midi)) best = b;
      }
      const src = c.createBufferSource();
      src.buffer = best.buffer;
      src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      src.connect(gain);
      src.start(time);
      src.stop(time + dur);
    } else {
      // フォールバック：triangle波＋エンベロープ
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.35, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + dur);
    }
  }

  // ギター用プラック音源（STEP4）
  function playPluck(c, gain, midi, time, dur) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const osc2 = c.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = freq * 2.003;  // 弦の倍音っぽい揺らぎ
    const og2 = c.createGain();
    og2.gain.value = 0.25;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(freq * 6, 6000), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 400), time + 0.5);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.28, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(dur, 1.6));
    osc.connect(filter);
    osc2.connect(og2).connect(filter);
    filter.connect(gain);
    osc.start(time); osc2.start(time);
    osc.stop(time + dur); osc2.stop(time + dur);
  }

  // 指定時刻に和音（ギターのときはストローク風に少しずらす）
  function playChordAt(midis, time, dur = 1.8) {
    const step = instrument === "guitar" ? 0.016 : 0.004;
    midis.forEach((m, i) => playNote(m, time + i * step, dur));
  }

  function playChord(midis) {
    const c = ensureCtx();
    playChordAt(midis, c.currentTime + 0.02);
  }

  // ダイアグラムの試し弾き（楽器設定に関係なくギター音でジャラーン）
  function playStrum(midis) {
    const c = ensureCtx();
    const t = c.currentTime + 0.02;
    midis.forEach((m, i) => playNote(m, t + i * 0.018, 2.0, "guitar"));
  }

  // メロディ用リード音：音符の長さいっぱい鳴り続けて最後にスッと切れる（STEP5）
  function playLead(midi, time, dur) {
    const c = ensureCtx();
    const gain = c.createGain();
    gain.connect(c.destination);
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const rel = Math.min(0.2, dur * 0.25);  // リリース（音の切れ際）
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.3, time + 0.02);
    gain.gain.setValueAtTime(0.3, time + dur - rel);   // ここまで音量キープ
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  // 鍵盤用：押している間鳴り続けるノート。返り値の stop() で止める（STEP5）
  function holdNote(midi) {
    const c = ensureCtx();
    const gain = c.createGain();
    gain.connect(c.destination);
    const t = c.currentTime;
    let src;
    if (useSamples) {
      let best = buffers[0];
      for (const b of buffers) {
        if (Math.abs(b.midi - midi) < Math.abs(best.midi - midi)) best = b;
      }
      src = c.createBufferSource();
      src.buffer = best.buffer;
      src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
      gain.gain.setValueAtTime(0.5, t);
    } else {
      src = c.createOscillator();
      src.type = "triangle";
      src.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    }
    src.connect(gain);
    src.start(t);
    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        const now = c.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        src.stop(now + 0.2);
      }
    };
  }

  return { init, ensureCtx, playNote, playChord, playChordAt, playStrum, playLead, holdNote,
           setInstrument: v => { instrument = v; },
           getInstrument: () => instrument };
})();