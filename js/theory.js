// ChordSketch - theory.js 音楽理論エンジン
const Theory = (() => {
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

  const DIATONIC = {
    major: ["maj", "m", "m", "maj", "maj", "m", "dim"],
    minor: ["m", "dim", "maj", "m", "m", "maj", "maj"],
    major7th: ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"],
    minor7th: ["m7", "m7b5", "maj7", "m7", "m7", "maj7", "7"]
  };

  // コードタイプ → ルートからの半音配列（全タイプ。STEP2以降で使用）
  const CHORD_FORMULAS = {
    maj: [0,4,7], m: [0,3,7], dim: [0,3,6], aug: [0,4,8],
    sus4: [0,5,7], sus2: [0,2,7], "7sus4": [0,5,7,10], "5": [0,7],
    "7": [0,4,7,10], maj7: [0,4,7,11], m7: [0,3,7,10],
    m7b5: [0,3,6,10], dim7: [0,3,6,9], mM7: [0,3,7,11],
    "6": [0,4,7,9], m6: [0,3,7,9], add9: [0,4,7,14], madd9: [0,3,7,14],
    "9": [0,4,7,10,14], maj9: [0,4,7,11,14], m9: [0,3,7,10,14],
    "11": [0,4,7,10,14,17], "13": [0,4,7,10,14,21],
    "7b9": [0,4,7,10,13], "7s9": [0,4,7,10,15], "7b5": [0,4,6,10], "7s5": [0,4,8,10]
  };

  const TYPE_LABELS = {
    maj: "", m: "m", dim: "dim", aug: "aug",
    sus4: "sus4", sus2: "sus2", "7sus4": "7sus4", "5": "5",
    "7": "7", maj7: "maj7", m7: "m7",
    m7b5: "m7(♭5)", dim7: "dim7", mM7: "mM7",
    "6": "6", m6: "m6", add9: "add9", madd9: "m(add9)",
    "9": "9", maj9: "maj9", m9: "m9",
    "11": "11", "13": "13",
    "7b9": "7(♭9)", "7s9": "7(♯9)", "7b5": "7(♭5)", "7s5": "7(♯5)"
  };

  // 編集UI用のカテゴリ分け
  const TYPE_CATEGORIES = {
    "基本": ["maj", "m", "dim", "aug"],
    "セブンス": ["7", "maj7", "m7", "m7b5", "dim7", "mM7"],
    "sus・パワー": ["sus4", "sus2", "7sus4", "5"],
    "6・add9": ["6", "m6", "add9", "madd9"],
    "テンション": ["9", "maj9", "m9", "11", "13"],
    "オルタード": ["7b9", "7s9", "7b5", "7s5"]
  };

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const TONICS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const PC = { "C": 0, "C♯": 1, "D♭": 1, "D": 2, "D♯": 3, "E♭": 3, "E": 4, "F": 5,
               "F♯": 6, "G♭": 6, "G": 7, "G♯": 8, "A♭": 8, "A": 9, "A♯": 10, "B♭": 10, "B": 11 };
  const NAMES_SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const NAMES_FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];
  // ♭系表記を使うキー（それ以外は♯系）
  const FLAT_KEYS = {
    major: ["F", "B♭", "E♭", "A♭", "D♭", "G♭"],
    minor: ["C", "D", "F", "G", "B♭", "E♭", "A♭"]
  };

  function noteName(pc, tonic, mode) {
    const names = FLAT_KEYS[mode].includes(tonic) ? NAMES_FLAT : NAMES_SHARP;
    return names[((pc % 12) + 12) % 12];
  }

  function degreeLabel(item) {
    const accMark = item.acc === 1 ? "♯" : item.acc === -1 ? "♭" : "";
    return accMark + ROMAN[item.degree - 1] +
           (item.type === "maj" ? "" : TYPE_LABELS[item.type]);
  }

  // 進行アイテム { degree, acc?, type, bass?, beats } → 表示・発音情報
  function buildChord(tonic, mode, item) {
    const tonicPc = PC[tonic];
    const acc = item.acc || 0;
    const root = tonicPc + SCALES[mode][item.degree - 1] + acc;  // トニックからの上行配置
    const rootName = noteName(root, tonic, mode);
    let label = rootName + TYPE_LABELS[item.type];
    let bassPc = null;
    if (item.bass !== null && item.bass !== undefined) {
      bassPc = tonicPc + item.bass;
      const bassName = noteName(bassPc, tonic, mode);
      if (bassName !== rootName) label += "/" + bassName;  // 分数コード表記
    }
    return {
      degree: item.degree,
      type: item.type,
      rootName,
      label,
      degreeLabel: degreeLabel(item),
      notes: CHORD_FORMULAS[item.type].map(iv => root + iv),  // C基準の半音配列
      bassPc
    };
  }

  function getDiatonicChords(tonic, mode, seventh) {
    const types = DIATONIC[seventh ? mode + "7th" : mode];
    return SCALES[mode].map((offset, i) => {
      const item = { degree: i + 1, acc: 0, type: types[i], bass: null };
      return Object.assign({ item }, buildChord(tonic, mode, item));
    });
  }

  // 発音用: 半音配列 → MIDIノート番号（C3 = 48 を基準に配置）
  function chordMidis(chord) {
    const midis = chord.notes.map(n => 48 + n);
    if (chord.bassPc !== null && chord.bassPc !== undefined) {
      midis.unshift(36 + ((chord.bassPc % 12) + 12) % 12);  // ベースは低いオクターブで追加
    }
    return midis;
  }

  return { SCALES, DIATONIC, CHORD_FORMULAS, TYPE_LABELS, TYPE_CATEGORIES, TONICS, PC,
           noteName, getDiatonicChords, buildChord, chordMidis };
})();