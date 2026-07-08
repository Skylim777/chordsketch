// ChordSketch - sequencer.js ループ再生エンジン（コード＋ドラム）
const Sequencer = (() => {
  const LOOKAHEAD_MS = 25;   // スケジューラの起動間隔
  const AHEAD_SEC = 0.1;     // 先読みしてスケジュールする長さ

  // 1小節 = 16分音符×16 のグリッド。comp = コードを弾き直す位置
  const RHYTHMS = {
    "ベタ弾き": { comp: [0], kick: [0], snare: [8], hat: [0, 4, 8, 12] },
    "バラード": { comp: [0, 8], kick: [0, 10], snare: [8],
                  hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    "8ビート":  { comp: [0, 4, 8, 12], kick: [0, 8, 10], snare: [4, 12],
                  hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    "16ビート": { comp: [0, 4, 7, 10, 12, 14], kick: [0, 6, 8], snare: [4, 12],
                  hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    "4つ打ち":  { comp: [0, 8], kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }
  };

  let playing = false;
  let timer = null;
  let bpm = 120;
  let rhythm = "8ビート";
  let drums = true;
  let getSong = () => [];
  let getMelody = () => null;
  let onChord = null;

  let itemIndex = 0;
  let stepInItem = 0;
  let barStep = 0;
  let songStep = 0;   // 曲頭からの通し16分カウント（メロディ用・STEP5）
  let nextTime = 0;
  let noise = null;

  function start() {
    const song = getSong();
    if (!song || song.length === 0) return;
    const ctx = AudioEngine.ensureCtx();
    itemIndex = 0; stepInItem = 0; barStep = 0; songStep = 0;
    nextTime = ctx.currentTime + 0.06;
    playing = true;
    timer = setInterval(tick, LOOKAHEAD_MS);
    tick();
  }

  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (onChord) onChord(-1);
  }

  function tick() {
    const ctx = AudioEngine.ensureCtx();
    while (playing && nextTime < ctx.currentTime + AHEAD_SEC) {
      schedule16th(ctx);
      if (!playing) break;
      nextTime += 60 / bpm / 4;
    }
  }

  function schedule16th(ctx) {
    const song = getSong();  // 毎回最新を参照（編集・移調が再生に即反映される）
    if (!song || song.length === 0) { stop(); return; }
    if (itemIndex >= song.length) { itemIndex = 0; stepInItem = 0; }
    if (stepInItem >= song[itemIndex].beats * 4) {
      stepInItem = 0;
      itemIndex = (itemIndex + 1) % song.length;
      // メロディは自分の小節数でループするので、進行の頭ではリセットしない
      // （例：4小節の進行×8小節のメロディ→バッキングが2周で1セクション）
    }
    const entry = song[itemIndex];
    const pat = RHYTHMS[rhythm];
    const sec16 = 60 / bpm / 4;
    const midis = Theory.chordMidis(entry.chord);

    if (stepInItem === 0) {
      // コードの頭は必ず鳴らす
      const dur = Math.min(entry.beats * 4 * sec16, 2.2);
      AudioEngine.playChordAt(midis, nextTime, dur);
      notifyChord(itemIndex, ctx);
    } else if (pat.comp.includes(barStep)) {
      // リズムパターンに合わせて弾き直し
      AudioEngine.playChordAt(midis, nextTime, Math.min(4 * sec16, 1.0));
    }

    if (drums) {
      if (pat.kick.includes(barStep)) playKick(ctx, nextTime);
      if (pat.snare.includes(barStep)) playSnare(ctx, nextTime);
      if (pat.hat.includes(barStep)) playHat(ctx, nextTime);
    }

    // メロディ（STEP5）：音符ごとの長さで鳴らす。選んだ小節数で独立してループ
    const melData = getMelody();
    if (melData && melData.total > 0 && songStep >= melData.total) songStep = 0;
    const melNote = melData && melData.notes[songStep];
    if (melNote) {
      // リード音で音符の長さどおりに鳴らす
      AudioEngine.playLead(melNote.midi, nextTime, melNote.len * sec16);
    }

    stepInItem++;
    songStep++;
    barStep = (barStep + 1) % 16;
  }

  function notifyChord(index, ctx) {
    if (!onChord) return;
    const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
    setTimeout(() => { if (playing) onChord(index); }, delay);
  }

  // ---- ドラム音源（シンセ） ----
  function noiseBuffer(ctx) {
    if (!noise) {
      const len = Math.floor(ctx.sampleRate * 0.3);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function playKick(ctx, t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.18);
  }

  function playSnare(ctx, t) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t); src.stop(t + 0.14);
  }

  function playHat(ctx, t) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t); src.stop(t + 0.06);
  }

  return {
    RHYTHMS,
    configure(opts) {
      if (opts.getSong) getSong = opts.getSong;
      if (opts.getMelody) getMelody = opts.getMelody;
      if (opts.onChord) onChord = opts.onChord;
    },
    start, stop,
    isPlaying: () => playing,
    // いま鳴っている曲頭からの16分ステップ位置（再生中でなければ null。リアルタイム録音用）
    getSongPos: () => {
      if (!playing) return null;
      const ctx = AudioEngine.ensureCtx();
      const sec16 = 60 / bpm / 4;
      // songStep は「nextTime に鳴る予定のステップ」なので、現在時刻へ巻き戻す
      return songStep - (nextTime - ctx.currentTime) / sec16;
    },
    setBpm: v => { bpm = Math.min(240, Math.max(40, v)); },
    getBpm: () => bpm,
    setRhythm: r => { if (RHYTHMS[r]) rhythm = r; },
    setDrums: v => { drums = !!v; }
  };
})();