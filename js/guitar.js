// ChordSketch - guitar.js ギターコードエンジン（フォーム辞書＋SVGダイアグラム）
const Guitar = (() => {
  const TUNING = [40, 45, 50, 55, 59, 64];  // E A D G B E（6弦→1弦）

  // オープンコード辞書 "ルートpc:タイプ" → フレット（6弦→1弦、-1=ミュート）
  const OPEN_FORMS = {
    "0:maj":  [-1, 3, 2, 0, 1, 0],   // C
    "0:maj7": [-1, 3, 2, 0, 0, 0],   // Cmaj7
    "0:7":    [-1, 3, 2, 3, 1, 0],   // C7
    "2:maj":  [-1, -1, 0, 2, 3, 2],  // D
    "2:m":    [-1, -1, 0, 2, 3, 1],  // Dm
    "2:7":    [-1, -1, 0, 2, 1, 2],  // D7
    "2:m7":   [-1, -1, 0, 2, 1, 1],  // Dm7
    "2:maj7": [-1, -1, 0, 2, 2, 2],  // Dmaj7
    "2:sus4": [-1, -1, 0, 2, 3, 3],  // Dsus4
    "4:maj":  [0, 2, 2, 1, 0, 0],    // E
    "4:m":    [0, 2, 2, 0, 0, 0],    // Em
    "4:7":    [0, 2, 0, 1, 0, 0],    // E7
    "4:m7":   [0, 2, 0, 0, 0, 0],    // Em7
    "7:maj":  [3, 2, 0, 0, 0, 3],    // G
    "7:7":    [3, 2, 0, 0, 0, 1],    // G7
    "9:maj":  [-1, 0, 2, 2, 2, 0],   // A
    "9:m":    [-1, 0, 2, 2, 1, 0],   // Am
    "9:7":    [-1, 0, 2, 0, 2, 0],   // A7
    "9:m7":   [-1, 0, 2, 0, 1, 0],   // Am7
    "9:sus2": [-1, 0, 2, 2, 0, 0],   // Asus2
    "11:7":   [-1, 2, 1, 2, 0, 2]    // B7
  };

  // ムーバブルフォーム：E型（6弦ルート）/ A型（5弦ルート）。ルートフレットからの相対値
  const E_SHAPES = {
    maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0],
    maj7: [0, 2, 1, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
    sus4: [0, 2, 2, 2, 0, 0], "7sus4": [0, 2, 0, 2, 0, 0],
    "5": [0, 2, 2, -1, -1, -1]
  };
  const A_SHAPES = {
    maj: [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], "7": [-1, 0, 2, 0, 2, 0],
    maj7: [-1, 0, 2, 1, 2, 0], m7: [-1, 0, 2, 0, 1, 0],
    dim: [-1, 0, 1, 2, 1, -1], dim7: [-1, 0, 1, 2, 1, 2], aug: [-1, 0, 3, 2, 2, 1],
    m7b5: [-1, 0, 1, 0, 1, -1], mM7: [-1, 0, 2, 1, 1, 0],
    sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], "7sus4": [-1, 0, 2, 0, 3, 0],
    "6": [-1, 0, 2, 2, 2, 2], m6: [-1, 0, 2, 2, 1, 2],
    add9: [-1, 0, 2, 4, 2, 0], madd9: [-1, 0, 2, 4, 1, 0]
  };

  // 押さえられないテンション系は近いフォームで代用
  const SUBS = { "9": "7", maj9: "maj7", m9: "m7", "11": "7sus4", "13": "7",
                 "7b9": "7", "7s9": "7", "7b5": "7", "7s5": "7" };

  function voicing(chord) {
    const rootPc = ((chord.notes[0] % 12) + 12) % 12;
    let type = chord.type;
    let approx = false;
    if (!OPEN_FORMS[rootPc + ":" + type] && !E_SHAPES[type] && !A_SHAPES[type]) {
      if (SUBS[type]) { type = SUBS[type]; approx = true; }
    }
    const open = OPEN_FORMS[rootPc + ":" + type];
    if (open) return make(open, chord, approx);

    const eShape = E_SHAPES[type];
    const aShape = A_SHAPES[type];
    const eFret = ((rootPc - 4) + 12) % 12;
    const aFret = ((rootPc - 9) + 12) % 12;
    let shape, fret;
    if (aShape && eShape) {
      if (aFret <= eFret) { shape = aShape; fret = aFret; }
      else { shape = eShape; fret = eFret; }
    } else if (aShape) { shape = aShape; fret = aFret; }
    else { shape = eShape; fret = eFret; }
    const frets = shape.map(f => (f === -1 ? -1 : f + fret));
    return make(frets, chord, approx);
  }

  function make(frets, chord, approx) {
    const used = frets.filter(f => f > 0);
    const maxF = used.length ? Math.max.apply(null, used) : 0;
    const minF = used.length ? Math.min.apply(null, used) : 1;
    const baseFret = maxF <= 5 ? 1 : minF;
    return { frets, baseFret, approx, label: chord.label };
  }

  // フレット → 発音用MIDIノート
  function midis(v) {
    const out = [];
    v.frets.forEach((f, i) => { if (f >= 0) out.push(TUNING[i] + f); });
    return out;
  }

  // ダイアグラムSVG（6弦×5フレット）
  function svg(v) {
    const W = 130, H = 150, left = 22, top = 28, sw = 17.2, fh = 22;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="chord-svg">';
    for (let f = 0; f <= 5; f++) {
      const y = top + f * fh;
      const isNut = f === 0 && v.baseFret === 1;
      s += '<line x1="' + left + '" y1="' + y + '" x2="' + (left + sw * 5) + '" y2="' + y +
           '" stroke="#8b90a3" stroke-width="' + (isNut ? 4 : 1) + '"/>';
    }
    for (let i = 0; i < 6; i++) {
      const x = left + i * sw;
      s += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + fh * 5) +
           '" stroke="#8b90a3" stroke-width="1"/>';
    }
    if (v.baseFret > 1) {
      s += '<text x="' + (left - 18) + '" y="' + (top + fh * 0.7) + '" fill="#8b90a3" font-size="10">' +
           v.baseFret + 'f</text>';
    }
    v.frets.forEach((f, i) => {
      const x = left + i * sw;
      if (f === -1) {
        s += '<text x="' + (x - 4) + '" y="' + (top - 8) + '" fill="#8b90a3" font-size="11">×</text>';
      } else if (f === 0) {
        s += '<circle cx="' + x + '" cy="' + (top - 11) + '" r="4" fill="none" stroke="#8b90a3" stroke-width="1.2"/>';
      } else {
        const y = top + (f - v.baseFret) * fh + fh / 2;
        s += '<circle cx="' + x + '" cy="' + y + '" r="6.5" fill="#5b8cff"/>';
      }
    });
    return s + "</svg>";
  }

  return { voicing, midis, svg };
})();