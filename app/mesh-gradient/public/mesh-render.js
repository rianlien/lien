// Mesh Gradient 描画エンジン（発起人ページ・回答者ページの両方から使う共通モジュール）。
// 依存なし。window.MeshRender として公開する。
(function (global) {
  "use strict";

  var DEFAULT_REACH = 0.38;
  var PAPER_RGB = [240, 240, 236];
  var WARP_FREQ = 0.05;
  var WARP_AMP = 9; // RESピクセル単位の歪み量
  var INK_GAIN = 1.5; // 総重み→インク濃度への変換係数。大きいほど早く紙が見えなくなる
  var RES_W = 150, RES_H = 225; // 実描画解像度（2:3を維持）

  // ---- color conversion ----
  function hexToRgb(hex) {
    var m = hex.replace("#", "");
    var r = parseInt(m.substring(0, 2), 16);
    var g = parseInt(m.substring(2, 4), 16);
    var b = parseInt(m.substring(4, 6), 16);
    return [r, g, b];
  }

  // Oklab変換（Björn Ottosson氏の標準式）。L,a,bはすべてCartesian座標であり、
  // HSLの「色相の角度」のような、彩度ゼロで角度が不定になる特異点が存在しない。
  // そのため複数色を混ぜても、どんな組み合わせでも常になめらかに変化する。
  function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(c) {
    var v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  function rgbToOklab(r, g, b) {
    var lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
    var l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    var m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    var s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
  }
  function oklabToRgb(L, a, b2) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b2;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b2;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b2;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    var lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
  }

  // ---- noise（ドメインワープ／垂れのふらつきに使う。決定論的で、レンダー毎に再構築しても揺れない） ----
  function hash2(x, y, seed) {
    var s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function hash01(n) {
    var s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  }
  function valueNoise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed);
    var b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed);
    var d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed) {
    var total = 0, amp = 0.5, freq = 1, maxAmp = 0;
    for (var i = 0; i < 3; i++) {
      total += valueNoise(x * freq, y * freq, seed + i * 17) * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return total / maxAmp; // 0..1
  }
  function hashStringToNum(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h % 10000;
  }

  // ---- 垂れ（drip trail）：各点から重力方向（下）へ、絵の具/インクが垂れる軌跡を作る ----
  function computeDrip(px, py, reachPx, seed) {
    var segs = 10; // 区間を細かくして垂れを途切れさせない（reachの減衰より間隔を狭く保つのが連続性の鍵）
    var lenScale = 1.6 + hash01(seed * 0.013) * 1.6; // reachの1.6〜3.2倍まで垂れる
    var dripLen = reachPx * lenScale;
    var wobbleAmp = reachPx * 0.55;
    var trail = [];
    for (var i = 1; i <= segs; i++) {
      var t = i / segs;
      var wobble = fbm(t * 4 + seed * 0.011, seed * 0.7, seed) - 0.5;
      var xx = px + wobble * wobbleAmp * (0.4 + t);
      var yy = py + dripLen * t;
      var rr = Math.max(reachPx * (1 - t * 0.5), reachPx * 0.25); // 先端に向かって細くなるが、隣接区間と重なる太さは保つ
      var ws = Math.pow(1 - t, 1.3); // 先端に向かって薄くなる
      trail.push({ x: xx, y: yy, reach: rr, weightScale: ws });
    }
    return trail;
  }

  // ---- 紙の粒状テクスチャ＋ビネット（一度だけ生成し、毎回乗算合成する） ----
  function buildGrainTexture(w, h) {
    var gc = document.createElement("canvas");
    gc.width = w;
    gc.height = h;
    var gctx = gc.getContext("2d");
    gctx.fillStyle = "#ffffff";
    gctx.fillRect(0, 0, w, h);

    var speckleCount = Math.floor(w * h * 0.05);
    for (var i = 0; i < speckleCount; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var v = 190 + Math.random() * 55;
      var a = 0.03 + Math.random() * 0.05;
      gctx.fillStyle = "rgba(" + (v * 0.62 | 0) + "," + (v * 0.62 | 0) + "," + (v * 0.6 | 0) + "," + a + ")";
      gctx.fillRect(x, y, 1, 1);
    }

    var fiberCount = Math.floor((w + h) * 0.35);
    for (i = 0; i < fiberCount; i++) {
      var fx = Math.random() * w, fy = Math.random() * h;
      var len = 4 + Math.random() * 10;
      var ang = Math.random() * Math.PI;
      gctx.strokeStyle = "rgba(120,120,118," + (0.02 + Math.random() * 0.04) + ")";
      gctx.lineWidth = 1;
      gctx.beginPath();
      gctx.moveTo(fx, fy);
      gctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      gctx.stroke();
    }

    var grad = gctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(206,207,202,1)");
    gctx.globalCompositeOperation = "multiply";
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, w, h);
    return gc;
  }

  // canvas要素ごとに、オフスクリーンcanvasと紙テクスチャを一度だけ作って使い回す
  var stateByCanvas = new WeakMap();
  function getState(canvas) {
    var st = stateByCanvas.get(canvas);
    if (!st) {
      var off = document.createElement("canvas");
      off.width = RES_W;
      off.height = RES_H;
      st = {
        offCtx: off.getContext("2d"),
        ctx: canvas.getContext("2d", { willReadFrequently: true }),
        off: off,
        grainCanvas: buildGrainTexture(canvas.width, canvas.height)
      };
      stateByCanvas.set(canvas, st);
    }
    return st;
  }

  // points: [{ id, x, y, color, reach }]（colorがnullの点は無視する）
  function render(canvas, points, blendMode) {
    var st = getState(canvas);
    var ctx = st.ctx, offCtx = st.offCtx, off = st.off, grainCanvas = st.grainCanvas;

    var confirmed = points.filter(function (p) { return !!p.color; });
    var n = confirmed.length;
    var colorsRgb = confirmed.map(function (p) { return hexToRgb(p.color); });
    var colorsOklab = colorsRgb.map(function (c) {
      var lab = rgbToOklab(c[0], c[1], c[2]);
      return { L: lab[0], a: lab[1], b: lab[2], chroma: Math.hypot(lab[1], lab[2]) };
    });
    var minRes = Math.min(RES_W, RES_H);
    var px = confirmed.map(function (p) { return p.x * RES_W; });
    var py = confirmed.map(function (p) { return p.y * RES_H; });
    var reachPx = confirmed.map(function (p) { return (p.reach || DEFAULT_REACH) * minRes; });
    var drips = confirmed.map(function (p, i) {
      return computeDrip(px[i], py[i], reachPx[i], hashStringToNum(String(p.id)));
    });

    var imgData = offCtx.createImageData(RES_W, RES_H);
    var data = imgData.data;

    for (var y = 0; y < RES_H; y++) {
      for (var x = 0; x < RES_W; x++) {
        var nx = fbm(x * WARP_FREQ, y * WARP_FREQ, 11) - 0.5;
        var ny = fbm(x * WARP_FREQ + 40.7, y * WARP_FREQ + 19.3, 23) - 0.5;
        var wx = x + nx * WARP_AMP;
        var wy = y + ny * WARP_AMP;

        var rgb = PAPER_RGB;
        if (n > 0) {
          var weights = new Array(n);
          var totalWeight = 0;
          for (var i = 0; i < n; i++) {
            var dx = wx - px[i], dy = wy - py[i];
            var g = Math.exp(-(dx * dx + dy * dy) / (2 * reachPx[i] * reachPx[i]));
            var trail = drips[i];
            for (var k = 0; k < trail.length; k++) {
              var t = trail[k];
              var tdx = wx - t.x, tdy = wy - t.y;
              g += Math.exp(-(tdx * tdx + tdy * tdy) / (2 * t.reach * t.reach)) * t.weightScale;
            }
            weights[i] = g;
            totalWeight += g;
          }
          var wsum = totalWeight > 0 ? totalWeight : 1;
          var blendRgb;
          if (n === 1) {
            blendRgb = colorsRgb[0];
          } else if (blendMode === "naive") {
            var r = 0, gg = 0, bch = 0;
            for (i = 0; i < n; i++) {
              var w = weights[i] / wsum;
              r += colorsRgb[i][0] * w;
              gg += colorsRgb[i][1] * w;
              bch += colorsRgb[i][2] * w;
            }
            blendRgb = [r, gg, bch];
          } else {
            var L = 0, a = 0, bb = 0, chromaSum = 0;
            for (i = 0; i < n; i++) {
              var w2 = weights[i] / wsum;
              var lab = colorsOklab[i];
              L += lab.L * w2;
              a += lab.a * w2;
              bb += lab.b * w2;
              chromaSum += lab.chroma * w2;
            }
            var mixedChroma = Math.hypot(a, bb);
            if (mixedChroma > 0.0001 && chromaSum > mixedChroma) {
              var stretch = Math.min(2.2, chromaSum / mixedChroma);
              a *= stretch;
              bb *= stretch;
            }
            blendRgb = oklabToRgb(L, a, bb);
          }
          var ink = 1 - Math.exp(-totalWeight * INK_GAIN);
          rgb = [
            PAPER_RGB[0] * (1 - ink) + blendRgb[0] * ink,
            PAPER_RGB[1] * (1 - ink) + blendRgb[1] * ink,
            PAPER_RGB[2] * (1 - ink) + blendRgb[2] * ink
          ];
        }
        var idx = (y * RES_W + x) * 4;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(grainCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  global.MeshRender = {
    render: render,
    DEFAULT_REACH: DEFAULT_REACH
  };
})(window);
