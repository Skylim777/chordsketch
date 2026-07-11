// ChordSketch - app.js 画面制御
(() => {
  const keySelect = document.getElementById("key-select");
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
  const seventhToggle = document.getElementById("seventh-toggle");
  const palette = document.getElementById("palette");
  const progressionEl = document.getElementById("progression");

  // 編集ポップアップの要素
  const editor = document.getElementById("chord-editor");
  const editorTitle = document.getElementById("editor-title");
  const editorCats = document.getElementById("editor-cats");
  const editorTypes = document.getElementById("editor-types");
  const editorBass = document.getElementById("editor-bass");
  const beatsValue = document.getElementById("beats-value");

  // 再生まわりの要素（STEP3）
  const playToggle = document.getElementById("play-toggle");
  const bpmValue = document.getElementById("bpm-value");
  const rhythmSelect = document.getElementById("rhythm-select");
  const drumsToggle = document.getElementById("drums-toggle");
  const presetsEl = document.getElementById("presets");

  // ギタータブ・楽器切替の要素（STEP4）
  const guitarGrid = document.getElementById("guitar-grid");
  const guitarNote = document.getElementById("guitar-note");
  const instToggle = document.getElementById("inst-toggle");

  // メロディの要素（STEP5）
  const pianoroll = document.getElementById("pianoroll");

  const state = {
    tonic: "C",
    mode: "major",
    seventh: false,
    progression: [],   // { degree, acc, type, bass, beats }
    melody: {},        // 開始ステップ → { row, len }（rowはトニックからの半音。キー変更で自動移調）
    melodyBars: 8,     // メロディの長さ（小節）。8小節＝Aメロ・Bメロ・サビの標準サイズ
    editIndex: -1,
    editCat: "基本"
  };

  // ---- 初期化 ----
  Theory.TONICS.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    keySelect.appendChild(opt);
  });
  keySelect.value = state.tonic;

  keySelect.addEventListener("change", () => {
    state.tonic = keySelect.value;
    renderAll();  // 進行は度数保持なので描画し直すだけで移調される
  });

  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      modeButtons.forEach(b => b.classList.toggle("active", b === btn));
      renderAll();
    });
  });

  seventhToggle.addEventListener("click", () => {
    state.seventh = !state.seventh;
    seventhToggle.classList.toggle("active", state.seventh);
    renderPalette();
    renderGuitar();
  });

  function play(chord) {
    AudioEngine.playChord(Theory.chordMidis(chord));
  }

  // ---- ダイアトニックパレット ----
  function renderPalette() {
    palette.innerHTML = "";
    Theory.getDiatonicChords(state.tonic, state.mode, state.seventh).forEach(chord => {
      const cell = document.createElement("div");
      cell.className = "chord-btn";
      const name = document.createElement("span");
      name.className = "chord-name";
      name.textContent = chord.label;
      const deg = document.createElement("span");
      deg.className = "chord-degree";
      deg.textContent = chord.degreeLabel;
      const add = document.createElement("button");
      add.className = "add-btn";
      add.textContent = "＋";
      add.addEventListener("click", e => {
        e.stopPropagation();
        state.progression.push({ degree: chord.item.degree, acc: 0,
                                 type: chord.item.type, bass: null, beats: 4 });
        renderProgression();
        play(chord);
      });
      cell.append(name, deg, add);
      cell.addEventListener("click", () => play(chord));
      palette.appendChild(cell);
    });
  }

  // ---- コード進行 ----
  function renderProgression() {
    renderGuitar();  // ギタータブも進行に追従（STEP4）
    renderMelody();  // ピアノロールの長さ・キーも進行に追従（STEP5）
    progressionEl.innerHTML = "";
    if (state.progression.length === 0) {
      const p = document.createElement("span");
      p.className = "prog-empty";
      p.textContent = "パレットの「＋」でコードを追加";
      progressionEl.appendChild(p);
      return;
    }
    state.progression.forEach((item, i) => {
      const chord = Theory.buildChord(state.tonic, state.mode, item);
      const chip = document.createElement("button");
      chip.className = "prog-chip";
      const name = document.createElement("span");
      name.className = "chip-name";
      name.textContent = chord.label;
      const sub = document.createElement("span");
      sub.className = "chip-sub";
      sub.textContent = chord.degreeLabel + "・" + item.beats + "拍";
      chip.append(name, sub);
      chip.addEventListener("click", () => openEditor(i));
      progressionEl.appendChild(chip);
    });
  }

  function renderAll() {
    renderPalette();
    renderProgression();
  }

  // ---- 編集ポップアップ ----
  function currentItem() { return state.progression[state.editIndex]; }

  function openEditor(index) {
    state.editIndex = index;
    const type = currentItem().type;
    for (const [cat, types] of Object.entries(Theory.TYPE_CATEGORIES)) {
      if (types.includes(type)) { state.editCat = cat; break; }
    }
    renderEditor();
    editor.classList.remove("hidden");
  }

  function closeEditor() {
    editor.classList.add("hidden");
    state.editIndex = -1;
  }

  function renderEditor() {
    const item = currentItem();
    if (!item) { closeEditor(); return; }
    const chord = Theory.buildChord(state.tonic, state.mode, item);
    editorTitle.textContent = chord.label + "（" + chord.degreeLabel + "）";

    // カテゴリタブ
    editorCats.innerHTML = "";
    Object.keys(Theory.TYPE_CATEGORIES).forEach(cat => {
      const b = document.createElement("button");
      b.className = "cat-btn" + (cat === state.editCat ? " active" : "");
      b.textContent = cat;
      b.addEventListener("click", () => { state.editCat = cat; renderEditor(); });
      editorCats.appendChild(b);
    });

    // タイプボタン
    editorTypes.innerHTML = "";
    Theory.TYPE_CATEGORIES[state.editCat].forEach(type => {
      const b = document.createElement("button");
      b.className = "type-btn" + (type === item.type ? " active" : "");
      b.textContent = Theory.TYPE_LABELS[type] === "" ? "メジャー" : Theory.TYPE_LABELS[type];
      b.addEventListener("click", () => {
        item.type = type;
        renderEditor();
        renderProgression();
        play(Theory.buildChord(state.tonic, state.mode, item));
      });
      editorTypes.appendChild(b);
    });

    // ベース音（分数コード。トニックからの半音オフセットで保持）
    editorBass.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "なし";
    editorBass.appendChild(none);
    for (let i = 0; i < 12; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = Theory.noteName(Theory.PC[state.tonic] + i, state.tonic, state.mode);
      editorBass.appendChild(opt);
    }
    editorBass.value = (item.bass === null || item.bass === undefined) ? "" : String(item.bass);

    beatsValue.textContent = item.beats;
  }

  editorBass.addEventListener("change", () => {
    const item = currentItem();
    if (!item) return;
    item.bass = editorBass.value === "" ? null : Number(editorBass.value);
    renderEditor();
    renderProgression();
    play(Theory.buildChord(state.tonic, state.mode, item));
  });

  document.getElementById("beats-minus").addEventListener("click", () => {
    const item = currentItem();
    if (item && item.beats > 1) { item.beats--; renderEditor(); renderProgression(); }
  });
  document.getElementById("beats-plus").addEventListener("click", () => {
    const item = currentItem();
    if (item && item.beats < 8) { item.beats++; renderEditor(); renderProgression(); }
  });

  function moveItem(dir) {
    const i = state.editIndex;
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.progression.length) return;
    const arr = state.progression;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    state.editIndex = j;
    renderEditor();
    renderProgression();
  }
  document.getElementById("editor-left").addEventListener("click", () => moveItem(-1));
  document.getElementById("editor-right").addEventListener("click", () => moveItem(1));

  document.getElementById("editor-play").addEventListener("click", () => {
    const item = currentItem();
    if (item) play(Theory.buildChord(state.tonic, state.mode, item));
  });

  document.getElementById("editor-delete").addEventListener("click", () => {
    if (state.editIndex < 0) return;
    state.progression.splice(state.editIndex, 1);
    closeEditor();
    renderProgression();
  });

  // 進行チップの一括削除
  document.getElementById("prog-clear").addEventListener("click", () => {
    if (state.progression.length === 0) return;
    if (!confirm("コード進行のチップをすべて削除しますか？")) return;
    state.progression = [];
    closeEditor();
    renderProgression();
  });

  document.getElementById("editor-close").addEventListener("click", closeEditor);
  editor.addEventListener("click", e => { if (e.target === editor) closeEditor(); });

  // ---- 再生（STEP3） ----
  Sequencer.configure({
    getSong: () => state.progression.map(item => ({
      chord: Theory.buildChord(state.tonic, state.mode, item),
      beats: item.beats
    })),
    getMelody: () => {
      const base = melodyBase();
      const notes = {};
      for (const step in state.melody) {
        notes[step] = { midi: base + state.melody[step].row,
                        len: state.melody[step].len };
      }
      return { notes, total: melodySteps() };
    },
    onChord: index => {
      Array.from(progressionEl.children).forEach((el, i) =>
        el.classList.toggle("playing", i === index));
      updatePlayBtn();
    }
  });

  function updatePlayBtn() {
    playToggle.textContent = Sequencer.isPlaying() ? "■ 停止" : "▶ 再生";
    playToggle.classList.toggle("playing", Sequencer.isPlaying());
  }

  playToggle.addEventListener("click", () => {
    if (Sequencer.isPlaying()) Sequencer.stop();
    else { previewPause(); preview.step = 0; Sequencer.start(); }  // 試聴とは同時に鳴らさない
    updatePlayBtn();
  });

  // BPMは1ずつ変更。押しっぱなしで連続変更（長押しでスルスル動く）
  function bindBpmHold(id, delta) {
    const btn = document.getElementById(id);
    let repeatTimer = null, holdDelay = null;
    const apply = () => {
      Sequencer.setBpm(Sequencer.getBpm() + delta);
      bpmValue.textContent = Sequencer.getBpm();
    };
    btn.addEventListener("pointerdown", e => {
      e.preventDefault();
      apply();  // まず1回
      holdDelay = setTimeout(() => {
        repeatTimer = setInterval(apply, 60);  // 長押しで連続変更
      }, 400);
    });
    const end = () => {
      if (holdDelay) { clearTimeout(holdDelay); holdDelay = null; }
      if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", end);
    btn.addEventListener("pointercancel", end);
  }
  bindBpmHold("bpm-minus", -1);
  bindBpmHold("bpm-plus", 1);

  Object.keys(Sequencer.RHYTHMS).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    rhythmSelect.appendChild(opt);
  });
  rhythmSelect.value = "8ビート";
  rhythmSelect.addEventListener("change", () => Sequencer.setRhythm(rhythmSelect.value));

  drumsToggle.addEventListener("click", () => {
    drumsToggle.classList.toggle("active");
    Sequencer.setDrums(drumsToggle.classList.contains("active"));
  });

  // ---- 楽器切替・ギタータブ（STEP4） ----
  instToggle.addEventListener("click", () => {
    const guitar = AudioEngine.getInstrument() !== "guitar";
    AudioEngine.setInstrument(guitar ? "guitar" : "piano");
    instToggle.classList.toggle("active", guitar);
    instToggle.textContent = guitar ? "🎸 ギター音" : "🎹 ピアノ音";
  });

  function renderGuitar() {
    guitarGrid.innerHTML = "";
    const hasProg = state.progression.length > 0;
    guitarNote.textContent = hasProg
      ? "いまのコード進行のフォーム（タップで試し弾き）"
      : "進行が空なので、いまのキーのダイアトニックコードを表示中（タップで試し弾き）";
    const source = hasProg
      ? state.progression
      : Theory.getDiatonicChords(state.tonic, state.mode, state.seventh).map(c => c.item);
    source.forEach((item, idx) => {
      const chord = Theory.buildChord(state.tonic, state.mode, item);
      const v = Guitar.voicing(chord);
      const card = document.createElement("div");
      card.className = "guitar-card";
      let sub = v.approx ? "近いフォームで代用" : "";
      if (chord.label.includes("/")) {
        sub += (sub ? "・" : "") + "ベース音 " + chord.label.split("/")[1] + " は低音弦で";
      }
      card.innerHTML =
        (hasProg ? '<span class="guitar-order">' + (idx + 1) + '</span>' : "") +
        '<span class="guitar-name">' + chord.label + "</span>" +
        Guitar.svg(v) +
        (sub ? '<span class="guitar-sub">' + sub + "</span>" : "");
      card.addEventListener("click", () => AudioEngine.playStrum(Guitar.midis(v)));
      guitarGrid.appendChild(card);
    });
  }

  // ---- メロディ：鍵盤入力＋ピアノロール（STEP5） ----
  const melEdit = {
    cursor: 0,   // 入力位置（16分ステップ）
    len: 2,      // 入力する音の長さ（16分単位。2＝8分音符）
    sel: null    // 選択中の音の開始ステップ
  };

  function melodySteps() {
    return state.melodyBars * 16;  // 選んだ小節数（4/4拍想定：1小節＝16ステップ）
  }

  // 行＝トニックからの半音（0〜24の2オクターブ）。キー変更で自動移調
  function melodyBase() {
    const pc = Theory.PC[state.tonic];
    return 60 + pc - (pc > 6 ? 12 : 0);  // トニックが C4 付近に来るように
  }

  function noteLabel(midi) {
    return Theory.noteName(midi % 12, state.tonic, state.mode) + (Math.floor(midi / 12) - 1);
  }

  function scaleSet() {
    const pc = Theory.PC[state.tonic];
    const set = {};
    Theory.SCALES[state.mode].forEach(iv => { set[(pc + iv) % 12] = true; });
    return set;
  }

  // そのマスを含む音の開始ステップを返す（無ければ null）
  function noteAt(step, row) {
    for (const key in state.melody) {
      const s = Number(key);
      const n = state.melody[key];
      if (n.row === row && s <= step && step < s + n.len) return s;
    }
    return null;
  }

  // 重なりの整理：前の音はトリム。
  // overwrite＝鍵盤録音：かぶる先の音は消して押した長さを優先。
  // それ以外（グリッドタップ）：次の音の頭までで新しい音を切る。
  function clearOverlap(step, len, overwrite) {
    for (const key in state.melody) {
      const s = Number(key);
      const n = state.melody[key];
      if (s === step) delete state.melody[key];
      else if (s < step && s + n.len > step) n.len = step - s;
      else if (s > step && s < step + len) {
        if (overwrite) delete state.melody[key];
        else len = s - step;
      }
    }
    return len;
  }

  function placeNote(step, row, len, quiet, overwrite) {
    const use = Math.max(1, clearOverlap(step, Math.min(len, melodySteps() - step), overwrite));
    state.melody[step] = { row, len: use };
    melEdit.sel = step;
    if (!quiet) {
      const c = AudioEngine.ensureCtx();
      AudioEngine.playLead(melodyBase() + row, c.currentTime + 0.02,
                           use * (60 / Sequencer.getBpm() / 4));
    }
    return use;
  }

  function setNoteLen(startStep, newLen) {
    const n = state.melody[startStep];
    if (!n) return;
    let len = Math.max(1, Math.min(newLen, melodySteps() - startStep));
    for (const key in state.melody) {
      const s = Number(key);
      if (s > startStep && s - startStep < len) len = s - startStep;  // 次の音の頭まで
    }
    n.len = len;
    renderMelody();
  }

  function onCellTap(step, row) {
    const startStep = noteAt(step, row);
    if (startStep === null) {
      placeNote(step, row, melEdit.len);       // 空きマス：いまの長さで置く
    } else if (melEdit.sel === startStep) {
      delete state.melody[startStep];          // 選択中をもう一度タップ：削除
      melEdit.sel = null;
    } else {
      melEdit.sel = startStep;                 // まず選択（＋/－や長さボタンで伸び縮み）
    }
    renderMelody();
  }

  // ---- ピアノロールのドラッグ編集：本体を動かす／右端をつまんで伸び縮み ----
  let rollDrag = null;  // { pointerId, mode, x, y, s, r, start, row, len, grabOff, moved }
  function rollDown(e, s, r) {
    const start = noteAt(s, r);
    if (start === null) {
      // 空きマス：動かさず離したらタップ扱い（スクロールと両立）
      rollDrag = { pointerId: e.pointerId, mode: "tap", x: e.clientX, y: e.clientY, s, r };
      return;
    }
    const n = state.melody[start];
    const resize = n.len > 1 && s === start + n.len - 1;  // 最後のマス＝右端をつまむ
    rollDrag = { pointerId: e.pointerId, mode: resize ? "resize" : "move",
                 x: e.clientX, y: e.clientY, s, r,
                 start, row: n.row, len: n.len, grabOff: s - start, moved: false };
  }

  function rollCellAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.dataset && el.dataset.s !== undefined) {
      return { s: Number(el.dataset.s), r: Number(el.dataset.r) };
    }
    return null;
  }

  pianoroll.addEventListener("pointerdown", e => {
    const t = e.target;
    if (!t.dataset || t.dataset.s === undefined) return;
    pianoroll.setPointerCapture(e.pointerId);  // 再描画してもイベントを受け続ける
    rollDown(e, Number(t.dataset.s), Number(t.dataset.r));
  });

  document.addEventListener("pointermove", e => {
    if (!rollDrag || e.pointerId !== rollDrag.pointerId || rollDrag.mode === "tap") return;
    const c = rollCellAt(e);
    if (!c) return;
    if (rollDrag.mode === "move") {
      const total = melodySteps();
      const ns = Math.max(0, Math.min(c.s - rollDrag.grabOff, total - rollDrag.len));
      const nr = Math.max(0, Math.min(c.r, 24));
      if (ns === rollDrag.start && nr === rollDrag.row) return;
      delete state.melody[rollDrag.start];     // つかんだ位置を保ったまま移動
      rollDrag.start = ns;
      rollDrag.row = nr;
      state.melody[ns] = { row: nr, len: rollDrag.len };
      melEdit.sel = ns;
      rollDrag.moved = true;
      renderMelody();
    } else {
      const nl = Math.max(1, Math.min(c.s - rollDrag.start + 1,
                                      melodySteps() - rollDrag.start));
      if (nl === rollDrag.len) return;
      rollDrag.len = nl;
      state.melody[rollDrag.start].len = nl;
      rollDrag.moved = true;
      renderMelody();
    }
  });

  document.addEventListener("pointerup", e => {
    if (!rollDrag || e.pointerId !== rollDrag.pointerId) return;
    const d = rollDrag;
    rollDrag = null;
    if (d.mode === "tap") {
      // ほとんど動いていなければタップ（置く）、動いていたらスクロールとみなす
      if (Math.abs(e.clientX - d.x) < 8 && Math.abs(e.clientY - d.y) < 8) onCellTap(d.s, d.r);
      return;
    }
    if (!d.moved) { onCellTap(d.s, d.r); return; }
    // ドロップで確定：重なりを整理して音を鳴らす
    placeNote(d.start, d.row, d.len, false, true);
    renderMelody();
  });
  document.addEventListener("pointercancel", e => {
    if (rollDrag && e.pointerId === rollDrag.pointerId) rollDrag = null;
  });

  function updateCursorInfo() {
    const bar = Math.floor(melEdit.cursor / 16) + 1;
    const beat = Math.floor((melEdit.cursor % 16) / 4) + 1;
    document.getElementById("cursor-info").textContent =
      "入力位置：" + bar + "小節目・" + beat + "拍目";
  }

  function renderMelody() {
    pianoroll.innerHTML = "";
    const total = melodySteps();
    const base = melodyBase();
    const inScale = scaleSet();
    if (melEdit.cursor >= total) melEdit.cursor = 0;
    if (melEdit.sel !== null && !state.melody[melEdit.sel]) melEdit.sel = null;

    // 上部ルーラー：タップで入力位置（▼）を移動
    const ruler = document.createElement("div");
    ruler.className = "roll-ruler";
    const pad = document.createElement("span");
    pad.className = "roll-label";
    ruler.appendChild(pad);
    for (let s = 0; s < total; s++) {
      const rc = document.createElement("span");
      rc.className = "ruler-cell" + (s % 16 === 0 ? " bar" : "") +
                     (s === melEdit.cursor ? " cursor" : "");
      rc.textContent = s === melEdit.cursor ? "▼"
        : s % 16 === 0 ? String(s / 16 + 1) : s % 4 === 0 ? "・" : "";
      rc.addEventListener("click", () => { melEdit.cursor = s; lastReleaseAt = null; renderMelody(); });
      ruler.appendChild(rc);
    }
    pianoroll.appendChild(ruler);

    for (let r = 24; r >= 0; r--) {
      const midi = base + r;
      const rowEl = document.createElement("div");
      rowEl.className = "roll-row" + (inScale[midi % 12] ? "" : " offscale");
      const label = document.createElement("span");
      label.className = "roll-label" +
        (r % 12 === 0 ? " tonic" : inScale[midi % 12] ? " inscale" : "");
      label.textContent = noteLabel(midi);
      rowEl.appendChild(label);
      for (let s = 0; s < total; s++) {
        const cell = document.createElement("div");
        let cls = "roll-cell" + (s % 16 === 0 ? " bar" : s % 4 === 0 ? " beat" : "");
        const startStep = noteAt(s, r);
        if (startStep !== null) {
          const n = state.melody[startStep];
          cls += s === startStep ? " on" : " tail";
          if (n.len > 1 && s === startStep + n.len - 1) cls += " tail-end";
          if (startStep === melEdit.sel) cls += " selected";
        }
        if (s === melEdit.cursor) cls += " cursor";
        cell.className = cls;
        cell.dataset.s = s;   // ドラッグ編集用の座標
        cell.dataset.r = r;
        rowEl.appendChild(cell);
      }
      pianoroll.appendChild(rowEl);
    }
    // 再生ライン（試聴・▶再生中に動く）
    const ph = document.createElement("div");
    ph.id = "playhead";
    ph.className = "playhead";
    pianoroll.appendChild(ph);
    updateCursorInfo();
    renderKeys();
  }

  // 画面下の鍵盤（2オクターブ）。押すとその音が入力位置に置かれる
  let keysBuiltFor = "";
  function renderKeys() {
    const sig = state.tonic + state.mode;
    if (keysBuiltFor === sig) return;
    keysBuiltFor = sig;
    const keys = document.getElementById("melody-keys");
    keys.innerHTML = "";
    const base = melodyBase();
    const inner = document.createElement("div");
    inner.className = "mkeys-inner";
    const BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };
    let x = 0;
    const blacks = [];
    for (let r = 0; r <= 24; r++) {
      const midi = base + r;
      if (BLACK[midi % 12]) {
        blacks.push({ r, left: x - 13 });
      } else {
        const k = document.createElement("button");
        k.className = "mkey-w" + (r % 12 === 0 ? " tonic" : "");
        k.style.left = x + "px";
        k.textContent = noteLabel(midi);
        k.addEventListener("pointerdown", e => keyDown(r, e));
        inner.appendChild(k);
        x += 38;
      }
    }
    blacks.forEach(b => {
      const k = document.createElement("button");
      k.className = "mkey-b";
      k.style.left = b.left + "px";
      k.addEventListener("pointerdown", e => keyDown(b.r, e));
      inner.appendChild(k);
    });
    inner.style.width = x + "px";
    keys.appendChild(inner);
  }

  // 鍵盤：押している間鳴り続け、離すと止まる。押していた長さが音符の長さになる
  let heldKey = null;  // { row, handle, at, pointerId, liveStep }
  let lastReleaseAt = null;  // 直前に鍵盤を離した時刻（休符の自動記録用）
  function keyDown(row, e) {
    commitHeld();  // 前の音が残っていたら先に確定させる（レガート対応）
    // ▶ 再生中はバッキングの「いま鳴っている拍」に合わせて置く（リアルタイム録音）
    let liveStep = null;
    const pos = Sequencer.getSongPos();
    if (pos !== null) {
      const total = melodySteps();
      liveStep = ((Math.round(pos) % total) + total) % total;
      lastReleaseAt = null;
    } else if (lastReleaseAt !== null) {
      // 停止中：離してから次を押すまでの「間」を休符として反映（4秒以上は考え中とみなして無視）
      const gapMs = performance.now() - lastReleaseAt;
      lastReleaseAt = null;
      if (gapMs < 4000) {
        const sec16 = 60 / Sequencer.getBpm() / 4;
        const rest = Math.round(gapMs / 1000 / sec16);
        melEdit.cursor = Math.min(melodySteps() - 1, melEdit.cursor + rest);
      }
    }
    heldKey = { row, handle: AudioEngine.holdNote(melodyBase() + row),
                at: performance.now(), pointerId: e.pointerId, liveStep };
  }

  // 押していた音を確定してピアノロールに置く
  function commitHeld() {
    if (!heldKey) return;
    heldKey.handle.stop();
    const sec16 = 60 / Sequencer.getBpm() / 4;
    const heldSteps = Math.round((performance.now() - heldKey.at) / 1000 / sec16);
    // 短いタップは「音の長さ」ボタンの長さ、長押しは押していた長さ（16分単位）
    const len = Math.min(16, heldSteps > 1 ? heldSteps : melEdit.len);
    // ▶ 再生中に押した音は、押した瞬間にバッキングが鳴っていた拍の位置に置く
    if (heldKey.liveStep !== null) melEdit.cursor = heldKey.liveStep;
    // 上書き録音：先にある音にぶつかっても押した長さを優先する
    const used = placeNote(melEdit.cursor, heldKey.row, len, true, true);
    heldKey = null;
    lastReleaseAt = performance.now();         // ここから次を押すまでが休符になる
    melEdit.cursor += used;                    // 入力位置を音の長さぶん進める
    if (melEdit.cursor >= melodySteps()) { melEdit.cursor = 0; lastReleaseAt = null; }
    renderMelody();
  }

  // 取り消し：音だけ止めて音符は置かない
  function cancelKey() {
    if (!heldKey) return;
    heldKey.handle.stop();
    heldKey = null;
    lastReleaseAt = null;
  }
  // 押した指（ポインタ）以外では確定しない：
  // 別の指のタップや手のひらの接触で勝手に音が確定・発音されるのを防ぐ
  document.addEventListener("pointerup", e => {
    if (heldKey && e.pointerId === heldKey.pointerId) commitHeld();
  });
  document.addEventListener("pointercancel", e => {
    if (heldKey && e.pointerId === heldKey.pointerId) cancelKey();  // スクロール開始は取り消し
  });

  // メロディの長さ（小節数）切替。標準的なセクションの長さに合わせた目安付き
  const barsHint = document.getElementById("bars-hint");
  const BARS_HINTS = {
    2: "2小節＝短いフレーズスケッチ用",
    4: "4小節＝ワンフレーズ（イントロなど）",
    8: "8小節＝Aメロ・Bメロ・サビの標準",
    16: "16小節＝長いセクション（サビ×2など）"
  };
  document.querySelectorAll("#bars-group button").forEach(btn => {
    btn.addEventListener("click", () => {
      const bars = Number(btn.dataset.bars);
      const total = bars * 16;
      if (total < melodySteps()) {
        // 短くするとき、はみ出す音符があれば確認
        const over = Object.keys(state.melody).map(Number)
          .some(s => s + state.melody[s].len > total);
        if (over && !confirm(bars + "小節に短くすると、はみ出す音符は削除・カットされます。よろしいですか？")) return;
      }
      state.melodyBars = bars;
      for (const key in state.melody) {
        const s = Number(key);
        const n = state.melody[key];
        if (s >= total) delete state.melody[key];
        else if (s + n.len > total) n.len = total - s;
      }
      if (melEdit.cursor >= total) melEdit.cursor = 0;
      document.querySelectorAll("#bars-group button").forEach(b =>
        b.classList.toggle("active", b === btn));
      if (barsHint) barsHint.textContent = BARS_HINTS[bars];
      renderMelody();
    });
  });

  document.querySelectorAll("#len-group button").forEach(btn => {
    btn.addEventListener("click", () => {
      melEdit.len = Number(btn.dataset.len);
      document.querySelectorAll("#len-group button").forEach(b =>
        b.classList.toggle("active", b === btn));
      if (melEdit.sel !== null) setNoteLen(melEdit.sel, melEdit.len);  // 選択中の音にも適用
    });
  });
  document.getElementById("len-minus").addEventListener("click", () => {
    if (melEdit.sel !== null) setNoteLen(melEdit.sel, state.melody[melEdit.sel].len - 1);
  });
  document.getElementById("len-plus").addEventListener("click", () => {
    if (melEdit.sel !== null) setNoteLen(melEdit.sel, state.melody[melEdit.sel].len + 1);
  });
  document.getElementById("cursor-back").addEventListener("click", () => {
    melEdit.cursor = Math.max(0, melEdit.cursor - melEdit.len);
    lastReleaseAt = null;
    renderMelody();
  });
  document.getElementById("cursor-rest").addEventListener("click", () => {
    melEdit.cursor = Math.min(melodySteps() - 1, melEdit.cursor + melEdit.len);
    lastReleaseAt = null;
    renderMelody();
  });

  document.getElementById("melody-clear").addEventListener("click", () => {
    if (Object.keys(state.melody).length === 0) return;
    if (!confirm("メロディをすべて削除しますか？")) return;
    state.melody = {};
    melEdit.sel = null;
    melEdit.cursor = 0;
    lastReleaseAt = null;
    preview.step = 0;
    previewPause();
    renderMelody();
  });

  // ---- メロディ試聴：一時停止できるミニプレーヤー ----
  const previewBtn = document.getElementById("melody-preview");
  const preview = { playing: false, step: 0, nextTime: 0, timer: null };

  function previewTick() {
    const c = AudioEngine.ensureCtx();
    const sec16 = 60 / Sequencer.getBpm() / 4;
    while (preview.playing && preview.nextTime < c.currentTime + 0.1) {
      const n = state.melody[preview.step];
      if (n) AudioEngine.playLead(melodyBase() + n.row, preview.nextTime, n.len * sec16);
      preview.step = (preview.step + 1) % melodySteps();  // 末尾までいったら頭に戻ってループ
      preview.nextTime += sec16;
    }
  }

  function previewPause() {
    preview.playing = false;
    if (preview.timer) { clearInterval(preview.timer); preview.timer = null; }
    previewBtn.textContent = preview.step > 0 ? "▶ つづきから" : "🔊 メロディ試聴";
    previewBtn.classList.remove("playing");
  }

  function previewStart() {
    if (Object.keys(state.melody).length === 0) return;
    if (Sequencer.isPlaying()) { Sequencer.stop(); updatePlayBtn(); }  // 全体再生とは同時に鳴らさない
    const c = AudioEngine.ensureCtx();
    preview.nextTime = c.currentTime + 0.06;
    preview.playing = true;
    preview.timer = setInterval(previewTick, 25);
    previewTick();
    previewBtn.textContent = "⏸ 一時停止";
    previewBtn.classList.add("playing");
  }

  previewBtn.addEventListener("click", () => {
    if (preview.playing) previewPause();
    else previewStart();
  });

  // ---- 再生ライン：いま鳴っている位置に赤いラインを動かす ----
  function playheadPos() {
    const sec16 = 60 / Sequencer.getBpm() / 4;
    if (preview.playing) {
      const c = AudioEngine.ensureCtx();
      return preview.step - (preview.nextTime - c.currentTime) / sec16;
    }
    const pos = Sequencer.getSongPos();
    if (pos === null) return null;
    return pos % melodySteps();
  }

  // 手でスクロール・タップした直後は自動追従を少し休む（操作の取り合いを防ぐ）
  let manualScrollAt = 0;
  pianoroll.addEventListener("pointerdown", () => { manualScrollAt = performance.now(); });
  pianoroll.addEventListener("wheel", () => { manualScrollAt = performance.now(); });

  function playheadLoop() {
    try {
      const ph = document.getElementById("playhead");
      if (ph) {
        const pos = playheadPos();
        if (pos === null) {
          ph.style.display = "none";
        } else {
          const p = Math.max(0, pos) % melodySteps();
          const x = 8 + 44 + p * 22;  // 左padding 8px＋ラベル44px＋1マス22px
          ph.style.display = "block";
          ph.style.left = x + "px";
          ph.style.top = "8px";
          ph.style.height = (pianoroll.scrollHeight - 16) + "px";
          // ラインが見えている範囲の外に出たら、ページをめくるように自動スクロールで追いかける
          if (performance.now() - manualScrollAt > 1500) {
            const view = pianoroll.clientWidth;
            if (x > pianoroll.scrollLeft + view - 30 || x < pianoroll.scrollLeft + 52) {
              pianoroll.scrollLeft = Math.max(0, x - 96);  // ラインが左寄りに見える位置へ
            }
          }
        }
      }
    } catch (err) {
      // 描画エラーでラインの更新ループが止まらないように無視して続行
    }
    requestAnimationFrame(playheadLoop);
  }
  requestAnimationFrame(playheadLoop);

  // ---- コード提案：メロディの構成音とダイアトニックコードの相性を小節ごとに採点 ----
  const suggestList = document.getElementById("suggest-list");

  // 小節ごとに「どの音（ピッチクラス）がどれだけ鳴っているか」を集計
  function barWeights() {
    const total = melodySteps();
    const bars = Math.ceil(total / 16);
    const w = Array.from({ length: bars }, () => ({}));
    const base = melodyBase();
    for (const key in state.melody) {
      const s = Number(key);
      const n = state.melody[key];
      const pc = (base + n.row) % 12;
      for (let b = Math.floor(s / 16); b < bars && b * 16 < s + n.len; b++) {
        if (b * 16 + 16 <= s) continue;
        const from = Math.max(s, b * 16);
        const to = Math.min(s + n.len, b * 16 + 16);
        let add = to - from;
        if (from === b * 16) add += 2;  // 小節頭で鳴っている音を重視
        w[b][pc] = (w[b][pc] || 0) + add;
      }
    }
    return w;
  }

  function chordScore(weights, chord) {
    const tones = {};
    chord.notes.forEach(nn => { tones[((nn % 12) + 12) % 12] = true; });
    const rootPc = ((chord.notes[0] % 12) + 12) % 12;
    let score = 0;
    for (const pc in weights) {
      score += tones[pc] ? weights[pc] : -0.4 * weights[pc];  // コードトーンは加点、外の音は減点
    }
    if (weights[rootPc]) score += 1.5;       // ルート音がメロディにあると好相性
    if (chord.type === "dim") score -= 1.2;  // dimは控えめに
    return score;
  }

  function suggestProgressions() {
    if (Object.keys(state.melody).length === 0) {
      alert("先にメロディを入力してください");
      return;
    }
    const weights = barWeights();
    const dia = Theory.getDiatonicChords(state.tonic, state.mode, false);

    // 提案1：小節ごとにいちばん合うコード（同じコードが続くときは拍をまとめる）
    const fitItems = [];
    let last = dia[0];
    weights.forEach(w => {
      let pick = last;
      if (Object.keys(w).length > 0) {
        let bestScore = -Infinity;
        dia.forEach(chord => {
          const sc = chordScore(w, chord);
          if (sc > bestScore) { bestScore = sc; pick = chord; }
        });
      }
      last = pick;
      const prev = fitItems[fitItems.length - 1];
      if (prev && prev.degree === pick.item.degree && prev.type === pick.item.type && prev.beats < 8) {
        prev.beats += 4;
      } else {
        fitItems.push(Object.assign({}, pick.item, { beats: 4 }));
      }
    });

    // 提案2、3：有名進行を小節に当てはめて相性を採点し、上位2つ
    const ranked = PRESETS.map(preset => {
      const barChords = [];
      preset.items.forEach(it => {
        const chord = Theory.buildChord(state.tonic, state.mode, it);
        const n = Math.max(1, Math.round(it.beats / 4));
        for (let i = 0; i < n; i++) barChords.push(chord);
      });
      let score = 0;
      weights.forEach((w, b) => { score += chordScore(w, barChords[b % barChords.length]); });
      return { preset, score };
    }).sort((a, b) => b.score - a.score);

    renderSuggestions([
      { name: "提案1：メロディにぴったり重視", items: fitItems },
      { name: "提案2：" + ranked[0].preset.name + "（相性のよい有名進行）", items: ranked[0].preset.items },
      { name: "提案3：" + ranked[1].preset.name + "（相性のよい有名進行）", items: ranked[1].preset.items }
    ]);
  }

  function renderSuggestions(suggestions) {
    suggestList.innerHTML = "";
    suggestList.classList.remove("hidden");
    suggestions.forEach(sg => {
      const items = sg.items.map(it => Object.assign({}, it));
      const label = items.map(it =>
        Theory.buildChord(state.tonic, state.mode, it).label).join(" → ");
      const b = document.createElement("button");
      b.className = "suggest-btn";
      const nm = document.createElement("span");
      nm.className = "suggest-name";
      nm.textContent = sg.name + "（タップで進行に反映）";
      const ch = document.createElement("span");
      ch.className = "suggest-chords";
      ch.textContent = label;
      b.append(nm, ch);
      b.addEventListener("click", () => {
        if (state.progression.length > 0 &&
            !confirm("今のコード進行をこの提案に置き換えますか？")) return;
        state.progression = items.map(it => Object.assign({}, it));
        closeEditor();
        renderProgression();
        suggestList.classList.add("hidden");
      });
      suggestList.appendChild(b);
    });
  }

  document.getElementById("chord-suggest").addEventListener("click", () => {
    if (!suggestList.classList.contains("hidden") && suggestList.childElementCount > 0) {
      suggestList.classList.add("hidden");  // もう一度押すと閉じる
      return;
    }
    suggestProgressions();
  });

  // ---- プリセット進行（STEP3） ----
  PRESETS.forEach(preset => {
    const b = document.createElement("button");
    b.className = "preset-btn";
    const nm = document.createElement("span");
    nm.className = "preset-name";
    nm.textContent = preset.name;
    const ds = document.createElement("span");
    ds.className = "preset-desc";
    ds.textContent = preset.desc;
    b.append(nm, ds);
    b.addEventListener("click", () => {
      if (state.progression.length > 0 &&
          !confirm("今の進行を「" + preset.name + "」に置き換えますか？")) return;
      state.progression = preset.items.map(it => Object.assign({}, it));
      closeEditor();
      renderProgression();
    });
    presetsEl.appendChild(b);
  });

  // ---- ライブラリ：保存・読み込み（STEP6。この端末のlocalStorageに保存） ----
  const SONGS_KEY = "chordsketch.songs.v1";
  const WORK_KEY = "chordsketch.working.v1";
  const songListEl = document.getElementById("song-list");

  // いまの作業内容をまるごとデータ化
  function snapshot() {
    return {
      tonic: state.tonic, mode: state.mode, seventh: state.seventh,
      progression: state.progression.map(it => Object.assign({}, it)),
      melody: JSON.parse(JSON.stringify(state.melody)),
      melodyBars: state.melodyBars,
      bpm: Sequencer.getBpm(),
      rhythm: rhythmSelect.value,
      drums: drumsToggle.classList.contains("active"),
      instrument: AudioEngine.getInstrument()
    };
  }

  // データを画面と再生設定に反映
  function applySnapshot(d) {
    if (Sequencer.isPlaying()) { Sequencer.stop(); updatePlayBtn(); }
    preview.step = 0;
    previewPause();
    state.tonic = d.tonic || "C";
    state.mode = d.mode === "minor" ? "minor" : "major";
    state.seventh = !!d.seventh;
    state.progression = (d.progression || []).map(it => Object.assign({}, it));
    state.melody = d.melody || {};
    state.melodyBars = d.melodyBars || 8;
    keySelect.value = state.tonic;
    modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
    seventhToggle.classList.toggle("active", state.seventh);
    Sequencer.setBpm(d.bpm || 120);
    bpmValue.textContent = Sequencer.getBpm();
    if (d.rhythm && Sequencer.RHYTHMS[d.rhythm]) {
      rhythmSelect.value = d.rhythm;
      Sequencer.setRhythm(d.rhythm);
    }
    drumsToggle.classList.toggle("active", d.drums !== false);
    Sequencer.setDrums(d.drums !== false);
    const guitar = d.instrument === "guitar";
    AudioEngine.setInstrument(guitar ? "guitar" : "piano");
    instToggle.classList.toggle("active", guitar);
    instToggle.textContent = guitar ? "🎸 ギター音" : "🎹 ピアノ音";
    document.querySelectorAll("#bars-group button").forEach(b =>
      b.classList.toggle("active", Number(b.dataset.bars) === state.melodyBars));
    melEdit.cursor = 0;
    melEdit.sel = null;
    keysBuiltFor = "";  // 鍵盤を作り直す
    renderAll();
  }

  function loadSongs() {
    try { return JSON.parse(localStorage.getItem(SONGS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveSongs(songs) {
    try { localStorage.setItem(SONGS_KEY, JSON.stringify(songs)); }
    catch (e) { alert("保存に失敗しました（容量オーバーの可能性）"); }
  }

  function renderLibrary() {
    const songs = loadSongs();
    songListEl.innerHTML = "";
    if (songs.length === 0) {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "保存した曲はまだありません。「＋ いまの曲を保存」で保存できます。";
      songListEl.appendChild(p);
      return;
    }
    songs.forEach((song, i) => {
      const card = document.createElement("div");
      card.className = "song-card";
      const info = document.createElement("div");
      info.className = "song-info";
      const nm = document.createElement("span");
      nm.className = "song-name";
      nm.textContent = song.name;
      const meta = document.createElement("span");
      meta.className = "song-meta";
      const d = song.data;
      meta.textContent = (d.tonic || "C") + (d.mode === "minor" ? "m" : "") +
        "・コード" + (d.progression || []).length + "個・♪" +
        Object.keys(d.melody || {}).length + "音・" +
        new Date(song.updatedAt).toLocaleString();
      info.append(nm, meta);
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "開く";
      loadBtn.addEventListener("click", () => {
        if (!confirm("「" + song.name + "」を開きますか？（今の作業内容は置き換わります）")) return;
        applySnapshot(song.data);
      });
      const overBtn = document.createElement("button");
      overBtn.textContent = "上書き";
      overBtn.addEventListener("click", () => {
        if (!confirm("「" + song.name + "」をいまの内容で上書きしますか？")) return;
        song.data = snapshot();
        song.updatedAt = Date.now();
        saveSongs(songs);
        renderLibrary();
      });
      const delBtn = document.createElement("button");
      delBtn.className = "danger";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", () => {
        if (!confirm("「" + song.name + "」を削除しますか？")) return;
        songs.splice(i, 1);
        saveSongs(songs);
        renderLibrary();
      });
      card.append(info, loadBtn, overBtn, delBtn);
      songListEl.appendChild(card);
    });
  }

  document.getElementById("song-save").addEventListener("click", () => {
    const name = prompt("曲の名前を入力してください", "新しい曲");
    if (!name) return;
    const songs = loadSongs();
    songs.unshift({ name: name.trim() || "新しい曲", data: snapshot(),
                    createdAt: Date.now(), updatedAt: Date.now() });
    saveSongs(songs);
    renderLibrary();
  });

  // 作業中の内容を自動保存して、次にアプリを開いたとき復元する
  let workTimer = null;
  function scheduleWorkSave() {
    if (workTimer) clearTimeout(workTimer);
    workTimer = setTimeout(() => {
      try { localStorage.setItem(WORK_KEY, JSON.stringify(snapshot())); } catch (e) {}
    }, 500);
  }
  document.addEventListener("pointerup", scheduleWorkSave);  // 何か操作したら少し後に自動保存

  // ---- 端末間共有（STEP8。GASのウェブアプリ経由でライブラリを同期） ----
  const GAS_KEY = "chordsketch.gasUrl";
  const CODE_KEY = "chordsketch.syncCode";
  const gasUrlInput = document.getElementById("gas-url");
  const syncCodeInput = document.getElementById("sync-code");
  const syncNote = document.getElementById("sync-note");

  gasUrlInput.value = localStorage.getItem(GAS_KEY) || "";
  syncCodeInput.value = localStorage.getItem(CODE_KEY) || "";

  function gasUrl() {
    const url = gasUrlInput.value.trim();
    if (!url.startsWith("https://script.google.com/")) {
      alert("先に「GASのURL」欄に、公開したウェブアプリのURL（https://script.google.com/…/exec）を貼り付けてください");
      return null;
    }
    localStorage.setItem(GAS_KEY, url);  // 1回貼れば端末ごとに記憶
    return url;
  }

  function setSyncNote(msg) { syncNote.textContent = msg; }

  document.getElementById("sync-upload").addEventListener("click", async () => {
    const url = gasUrl();
    if (!url) return;
    const songs = loadSongs();
    if (songs.length === 0) { alert("先にライブラリに曲を保存してください"); return; }
    setSyncNote("アップロード中…");
    try {
      // ヘッダーを付けない（text/plainのまま）ことでGASのCORS制限を回避
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ code: syncCodeInput.value.trim(), data: songs })
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "upload failed");
      syncCodeInput.value = out.code;
      localStorage.setItem(CODE_KEY, out.code);
      setSyncNote("アップロード完了！共有コード「" + out.code + "」を別の端末で入力して「⬇ 取り込む」を押すと同期できます。");
    } catch (err) {
      setSyncNote("アップロードに失敗しました。GASのURLと公開設定（アクセス：全員）を確認してください。");
    }
  });

  document.getElementById("sync-download").addEventListener("click", async () => {
    const url = gasUrl();
    if (!url) return;
    const code = syncCodeInput.value.trim().toUpperCase();
    if (!code) { alert("共有コードを入力してください"); return; }
    setSyncNote("取り込み中…");
    try {
      const res = await fetch(url + "?code=" + encodeURIComponent(code));
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "download failed");
      const remote = typeof out.data === "string" ? JSON.parse(out.data) : (out.data || []);
      // 同じ曲（作成日時が同じ）は新しい方を残し、それ以外は追加
      const songs = loadSongs();
      let added = 0, updated = 0;
      remote.forEach(r => {
        const i = songs.findIndex(s => s.createdAt === r.createdAt);
        if (i < 0) { songs.push(r); added++; }
        else if ((r.updatedAt || 0) > (songs[i].updatedAt || 0)) { songs[i] = r; updated++; }
      });
      songs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      saveSongs(songs);
      renderLibrary();
      localStorage.setItem(CODE_KEY, code);
      setSyncNote("取り込み完了！追加 " + added + "曲・更新 " + updated + "曲。ライブラリタブで確認できます。");
    } catch (err) {
      setSyncNote("取り込みに失敗しました。共有コードとGASのURLを確認してください。");
    }
  });

  // ---- 鼻歌・ギター単音からのメロディ入力（STEP9） ----
  const humToggle = document.getElementById("hum-toggle");
  const humPanel = document.getElementById("hum-panel");
  const humRecord = document.getElementById("hum-record");
  const humNote = document.getElementById("hum-note");
  const hum = { on: false, stream: null, analyser: null, buf: null, timer: null,
                t0: 0, trace: [], noise: 0 };

  humToggle.addEventListener("click", () => {
    humPanel.classList.toggle("hidden");
    if (humPanel.classList.contains("hidden")) humStop(false);
  });

  // 波形から音程（Hz）を推定。YIN方式：倍音につられてオクターブを間違えにくい定番アルゴリズム
  function detectPitch(buf, sampleRate, gate) {
    const SIZE = buf.length;
    let sum0 = 0;
    for (let i = 0; i < SIZE; i++) sum0 += buf[i] * buf[i];
    const rms = Math.sqrt(sum0 / SIZE);
    if (rms < gate) return { rms: rms, hz: -1 };  // 環境ノイズより十分大きな音だけ音程を探す
    const half = SIZE >> 1;
    const minTau = Math.floor(sampleRate / 1000);                    // 1000Hzより高い音は見ない
    const maxTau = Math.min(Math.floor(sampleRate / 70), half - 2);  // 70Hzより低い音も見ない（電源ハム対策）
    // 差分関数：波形をτだけずらして重ねたときの「ズレの大きさ」
    const d = new Float32Array(maxTau + 2);
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      let s = 0;
      for (let i = 0; i < half; i++) {
        const diff = buf[i] - buf[i + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }
    // 累積平均で正規化（小さいτほど有利になる偏りをなくす）
    const cm = new Float32Array(maxTau + 2);
    cm[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      run += d[tau];
      cm[tau] = d[tau] * tau / run;
    }
    // しきい値を最初に下回った谷＝基音の周期（倍音の谷より先に見つかるのがミソ）
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (cm[t] < 0.15) {
        while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // はっきりした谷がなければ、いちばん深い谷がそこそこ深いときだけ採用
      let best = 0.3;
      for (let t = minTau; t <= maxTau; t++) {
        if (cm[t] < best) { best = cm[t]; tau = t; }
      }
      if (tau < 0) return { rms: rms, hz: -1 };
    }
    // となりの値と放物線補間して周期を小数精度に
    const x1 = cm[tau - 1], x2 = cm[tau], x3 = cm[tau + 1];
    const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
    let T0 = tau;
    if (a) T0 = tau - b / (2 * a);
    return { rms: rms, hz: sampleRate / T0 };
  }

  function humTick() {
    const c = AudioEngine.ensureCtx();
    hum.analyser.getFloatTimeDomainData(hum.buf);
    if (c.currentTime < hum.t0) {
      // カウント中はまだ歌っていない前提で、環境ノイズの大きさを測っておく
      const p0 = detectPitch(hum.buf, c.sampleRate, 0.001);
      hum.noise = hum.noise ? hum.noise * 0.8 + p0.rms * 0.2 : p0.rms;
      humRecord.textContent = "🎙 カウント中…";
      return;
    }
    // 録音中は判定せず、音程の軌跡を小数のまま記録するだけ。解析はストップ後にまとめて行う
    // （鳴っている最中は小さな音量まで許して途切れを防ぐ：ヒステリシス）
    const last = hum.trace.length ? hum.trace[hum.trace.length - 1].m : null;
    const gate = Math.max(0.008, hum.noise * 2.5) * (last !== null ? 0.5 : 1);
    const p = detectPitch(hum.buf, c.sampleRate, gate);
    const midi = p.hz > 0 ? 69 + 12 * Math.log2(p.hz / 440) : null;
    const now = c.currentTime;
    hum.trace.push({ t: now, m: midi });
    humNote.textContent = midi === null ? "─" : noteLabel(Math.round(midi));
    const sec16 = 60 / Sequencer.getBpm() / 4;
    const step = Math.floor((now - hum.t0) / sec16);
    if (step >= melodySteps() - melEdit.cursor) { humStop(true); return; }  // 終わりで自動ストップ
    humRecord.textContent = "■ ストップ（" + (Math.floor((melEdit.cursor + step) / 16) + 1) + "小節目を録音中）";
  }

  function humCommit() {
    // 録音した音程の軌跡をストップ後にまとめて解析する（歌の揺れに強い）
    const sec16 = 60 / Sequencer.getBpm() / 4;
    const maxSteps = melodySteps() - melEdit.cursor;
    const tr = hum.trace;
    if (!tr.length) return 0;

    const median = arr => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

    // 1) 軽いメディアンフィルタ（前後1フレーム）：一瞬の誤検出だけ消し、速い音の変化はつぶさない
    const sm = tr.map((f, i) => {
      if (f.m === null) return { t: f.t, m: null };
      const win = [];
      for (let j = Math.max(0, i - 1); j <= Math.min(tr.length - 1, i + 1); j++) {
        if (tr[j].m !== null) win.push(tr[j].m);
      }
      return { t: f.t, m: median(win) };
    });

    // 2) オクターブ飛び補正：直近数フレームの中央値からほぼオクターブ飛んだら読み替える
    //    （1フレームの外れ値に引きずられて全体がズレていくのを防ぐため、中央値を基準にする）
    const recent = [];
    sm.forEach(f => {
      if (f.m === null) return;
      if (recent.length >= 3) {
        const rs = recent.slice().sort((a, b) => a - b);
        const ref = rs[Math.floor(rs.length / 2)];
        while (f.m - ref > 9) f.m -= 12;
        while (ref - f.m > 9) f.m += 12;
      }
      recent.push(f.m);
      if (recent.length > 5) recent.shift();
    });

    // 3) 「音の変わり目」を直接見つけてセグメントに区切る：
    //    いまの音の高さから0.7半音以上離れた状態が2フレーム続いたら新しい音。
    //    細かい上がり下がりをつぶさず、同じ音の揺れは1つにまとめる
    const segs = [];
    let seg = null, cand = null;
    sm.forEach(f => {
      if (f.m === null) {
        if (seg) { segs.push(seg); seg = null; }
        cand = null;
        return;
      }
      if (!seg) { seg = { start: f.t, end: f.t, ms: [f.m] }; cand = null; return; }
      if (Math.abs(f.m - median(seg.ms.slice(-8))) < 0.7) {
        seg.ms.push(f.m);
        seg.end = f.t;
        cand = null;
        return;
      }
      if (cand && Math.abs(f.m - cand.ms[0]) < 0.7) {
        cand.ms.push(f.m);
        seg.end = cand.at;
        segs.push(seg);
        seg = { start: cand.at, end: f.t, ms: cand.ms };
        cand = null;
      } else {
        cand = { at: f.t, ms: [f.m] };
      }
    });
    if (seg) segs.push(seg);
    if (!segs.length) return 0;

    // 4) 歌全体のチューニングのズレ（半音未満）を測って引いてから半音に丸め、
    //    キーのスケール音に半音だけ寄せる（丸めこみで音の動きが消えにくくなる）
    const pitches = segs.map(g => median(g.ms));
    const offset = median(pitches.map(m => m - Math.round(m)));
    const inScale = scaleSet();
    const notes = segs.map((g, i) => {
      let m = Math.round(pitches[i] - offset);
      const pc = ((m % 12) + 12) % 12;
      if (!inScale[pc]) {
        if (inScale[(pc + 1) % 12]) m += 1;
        else if (inScale[(pc + 11) % 12]) m -= 1;
      }
      return { start: g.start, end: g.end, m: m };
    });

    // 5) オクターブ調整は全体で1回だけ：高さの中心が鍵盤2オクターブの真ん中に来るように
    const sortedM = notes.map(n => n.m).sort((a, b) => a - b);
    const center = sortedM[Math.floor(sortedM.length / 2)];
    const shift = Math.round((melodyBase() + 12 - center) / 12) * 12;

    // 6) 16分グリッドに寄せて音符として置く
    let placed = 0, lastStep = 0;
    notes.forEach(n => {
      let s = Math.round((n.start - hum.t0) / sec16);
      let e = Math.round((n.end - hum.t0) / sec16);
      if (e <= s) e = s + 1;               // 短い音も最低16分音符1つぶん
      if (placed > 0 && s - lastStep === 1) s = lastStep;  // 16分音符1つだけの隙間は埋める
      s = Math.max(s, lastStep, 0);        // 前の音符と重ねない
      e = Math.min(e, maxSteps);
      if (s >= maxSteps || e <= s) return;
      let row = n.m + shift - melodyBase();
      if (row < 0) row += 12;
      if (row > 24) row -= 12;
      row = Math.max(0, Math.min(24, row));
      placeNote(melEdit.cursor + s, row, Math.min(16, e - s), true, true);
      lastStep = e;
      placed++;
    });
    if (placed > 0) {
      melEdit.cursor = Math.min(melodySteps() - 1, melEdit.cursor + lastStep);
      renderMelody();
    }
    return placed;
  }

  async function humStart() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("この開き方ではマイクを使えません。公開URL（https）で開いてください");
      return;
    }
    if (Sequencer.isPlaying()) { Sequencer.stop(); updatePlayBtn(); }
    previewPause();  // 録音中は他の音を止める（マイクが拾ってしまうため）
    try {
      hum.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      alert("マイクを使用できませんでした。ブラウザのマイク許可を確認してください");
      return;
    }
    const c = AudioEngine.ensureCtx();
    const src = c.createMediaStreamSource(hum.stream);
    hum.analyser = c.createAnalyser();
    hum.analyser.fftSize = 2048;
    src.connect(hum.analyser);           // スピーカーには出さない（ハウリング防止）
    hum.buf = new Float32Array(hum.analyser.fftSize);
    hum.trace = [];
    hum.noise = 0;
    // カウント4つ（ピッ・ポッポッポッ）のあとに録音開始
    const spb = 60 / Sequencer.getBpm();
    const start = c.currentTime + 0.2;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = i === 0 ? 1200 : 800;
      g.gain.setValueAtTime(0.15, start + i * spb);
      g.gain.exponentialRampToValueAtTime(0.001, start + i * spb + 0.08);
      o.connect(g).connect(c.destination);
      o.start(start + i * spb);
      o.stop(start + i * spb + 0.1);
    }
    hum.t0 = start + 4 * spb;
    hum.on = true;
    hum.timer = setInterval(humTick, 30);
    humRecord.textContent = "🎙 カウント中…";
    humRecord.classList.add("recording");
  }

  function humStop(commit) {
    if (!hum.on) return;
    hum.on = false;
    if (hum.timer) { clearInterval(hum.timer); hum.timer = null; }
    if (hum.stream) { hum.stream.getTracks().forEach(t => t.stop()); hum.stream = null; }
    humRecord.textContent = "⏺ 録音スタート";
    humRecord.classList.remove("recording");
    humNote.textContent = "─";
    if (commit) {
      const n = humCommit();
      if (n === 0) alert("音を検出できませんでした。マイクに近づいて、ゆっくりはっきり歌ってみてください");
    }
  }

  humRecord.addEventListener("click", () => {
    if (hum.on) humStop(true);
    else humStart();
  });

  // ---- ボトムタブ切替 ----
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b =>
        b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach(p =>
        p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
    });
  });

  // 初回操作でAudioContextを有効化（iOS対策）
  document.addEventListener("pointerdown", () => AudioEngine.ensureCtx(), { once: true });

  // 前回の作業内容を復元（STEP6）
  try {
    const w = JSON.parse(localStorage.getItem(WORK_KEY));
    if (w && ((w.progression || []).length > 0 || Object.keys(w.melody || {}).length > 0)) {
      applySnapshot(w);
    }
  } catch (e) { /* 壊れたデータは無視してまっさらな状態で起動 */ }
  renderLibrary();

  AudioEngine.init();  // サンプル読込を試行（無ければシンセにフォールバック）
  renderAll();
})();
