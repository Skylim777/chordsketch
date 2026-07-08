// ChordSketch - presets.js 有名コード進行プリセット
const PRESETS = (() => {
  const p = (degree, type, beats = 4) => ({ degree, acc: 0, type, bass: null, beats });
  return [
    { name: "王道進行", desc: "IV → V → iii → vi",
      items: [p(4, "maj"), p(5, "maj"), p(3, "m"), p(6, "m")] },
    { name: "カノン進行", desc: "I → V → vi → iii → IV → I → IV → V",
      items: [p(1, "maj"), p(5, "maj"), p(6, "m"), p(3, "m"),
              p(4, "maj"), p(1, "maj"), p(4, "maj"), p(5, "maj")] },
    { name: "小室進行", desc: "vi → IV → V → I",
      items: [p(6, "m"), p(4, "maj"), p(5, "maj"), p(1, "maj")] },
    { name: "丸サ進行", desc: "IVM7 → III7 → VIm7 → I7",
      items: [p(4, "maj7"), p(3, "7"), p(6, "m7"), p(1, "7")] },
    { name: "Let It Be進行", desc: "I → V → vi → IV",
      items: [p(1, "maj"), p(5, "maj"), p(6, "m"), p(4, "maj")] },
    { name: "小悪魔進行", desc: "vi → IV → I → V",
      items: [p(6, "m"), p(4, "maj"), p(1, "maj"), p(5, "maj")] },
    { name: "ツーファイブワン", desc: "IIm7 → V7 → IM7",
      items: [p(2, "m7"), p(5, "7"), p(1, "maj7", 8)] },
    { name: "スタンダード進行", desc: "IM7 → VIm7 → IIm7 → V7",
      items: [p(1, "maj7"), p(6, "m7"), p(2, "m7"), p(5, "7")] }
  ];
})();