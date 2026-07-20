# 色グラデーションアプリ — 背景知識（色科学・Mesh Gradient技術）

`docs/internal-design/color-gradient-app.md` が「この要件をなぜこの技術で満たしたか」という**このプロジェクト固有の設計判断**を記録しているのに対し、本ドキュメントは各技術要素そのものの**一般的な背景知識**（他プロジェクトでも通用する reference）を独立してまとめる。実装本体は
[app/mesh-gradient/public/mesh-render.js](../../app/mesh-gradient/public/mesh-render.js)。

## Oklab色空間

Björn Ottossonが2020年12月に発表した、知覚均一性（perceptual uniformity）を目的とした色空間。L（明度）・a・b（色相・彩度を表す直交座標）の3軸からなり、CSS Color Level 4/5でも`oklab()`/`oklch()`として採用されている。

先行する CIELAB は、青系统で色相が一直線に保たれない（明度や彩度だけを変えたつもりでも色相がずれる）という欠陥が知られていた。Oklabはこれを、人間の色弁別実験データ（MacAdam楕円・Luo-Riggデータセット）に変換行列をフィットさせることで改善している。

実装（[mesh-render.js:22-54](../../app/mesh-gradient/public/mesh-render.js#L22-L54)）はOttosson氏の標準式（sRGB→線形RGB→LMS→立方根→Oklab、およびその逆変換）をそのまま使っている。

- [Oklab color space - Wikipedia](https://en.wikipedia.org/wiki/Oklab_color_space)
- [Interview With Björn Ottosson, Creator Of The Oklab Color Space — Smashing Magazine](https://www.smashingmagazine.com/2024/10/interview-bjorn-ottosson-creator-oklab-color-space/)

### なぜ「知覚均一」な空間で混色すると平均が崩れないか

HSLの色相は角度（極座標）なので、彩度がゼロに近い（無彩色に近い）色同士を混ぜようとすると角度が数学的に不定になり、色の組み合わせによって混色結果が破綻しうる特異点がある。Oklabのa/bは直交座標（デカルト座標）なので、この種の特異点が存在しない。どんな2色の組み合わせでも、a/b平面上のベクトル加重平均として常になめらかに定義できる。

## 複数色の加重平均でも彩度が落ちる問題（一般的な現象）

知覚均一な空間を使っても、「色を平均すると彩度・鮮やかさが失われる」問題は原理的に残る。これはOklabの欠陥ではなく、ユークリッド空間でベクトルを加重平均するときに常に起こる幾何的な事実である。

a/b平面上で、ある色は原点からの距離（彩度=chroma）と原点からの向き（色相）を持つベクトルとして表現される。方向の異なる複数のベクトルを加重平均すると、結果のベクトルの長さ（三角不等式により）は各ベクトルの長さの加重平均**以下**にしかならない。方向が完全に一致する場合のみ等号が成立する。つまり、色相が異なる色を混ぜるほど、平均後の彩度は元の彩度の平均よりも小さくなる——これが「色を混ぜるとくすむ（灰色に近づく）」現象の数学的な理由。

実装（[mesh-render.js:232-246](../../app/mesh-gradient/public/mesh-render.js#L232-L246)）はこれに対し、加重平均後のベクトル長（`mixedChroma`）と、各色の彩度をそのまま加重平均した値（`chromaSum`）を比較し、`mixedChroma`が小さければその比率（最大2.2倍）でa/bベクトルを引き伸ばして彩度を補正している。色相（方向）はそのままに、長さだけを戻す近似的な補正であり、厳密な知覚モデルではないが「くすまない」という要件（raw-rfpの「色を平均しない」）を実用的に満たす簡便な方法として選んでいる。

## ドメインワープ（domain warping）

手続き型テクスチャ生成で使われる技法。計算対象の関数`f(p)`をそのまま評価するのではなく、先に座標`p`自体を別の関数`g(p)`で歪めてから評価する：`f(g(p))`。Inigo Quilezが2002年の記事で広く紹介し、`g(p) = p + h(p)`（恒等変換＋小さな歪み）という形で、`h`にfBmノイズを使うことで「有機的」に見える歪みを作れることを示した。

- [Domain warping — Inigo Quilez](https://iquilezles.org/articles/warp/)
- [Domain warping: an interactive introduction](https://st4yho.me/domain-warping-an-interactive-introduction/)

実装（[mesh-render.js:196-201](../../app/mesh-gradient/public/mesh-render.js#L196-L201)）は描画する各ピクセル座標`(x,y)`を、fBmノイズで生成したベクトル`(nx,ny)`だけずらした`(wx,wy)`を使って全ての井戸（color well）との距離を計算している。**空間そのものを歪めてから同じ距離計算をする**ため、複数の井戸の輪郭が同じ歪みフィールドを共有し、輪郭同士の歪み方に一貫性が出る。井戸ごとに独立したノイズを輪郭に加える方式（個別に歪ませる）だと、この一貫性は出ない。

### fBm（fractal Brownian motion）ノイズ

複数の周波数のノイズ（実装ではvalue noise）を、周波数を上げながら振幅を下げて重ね合わせたもの。単一周波数のノイズより自然な（自己相似的な）テクスチャになる。実装（[mesh-render.js:76-85](../../app/mesh-gradient/public/mesh-render.js#L76-L85)）では3オクターブを重ね、ドメインワープの歪みフィールドと、垂れ（drip）のふらつきの両方に共通して使っている。

## Mesh Gradient（デザイン用語としての定義）

複数の色の制御点（アンカー）をメッシュ状に配置し、各点間を滑らかに補間して色を作るグラデーション技法。線形グラデーション（1方向への直線的な遷移）や放射グラデーション（1点を中心とした同心円状の遷移）とは異なり、複数の点から多方向へ有機的に色が流れる見え方になる。

- [What is a Mesh Gradient? (And Why Designers Love It)](https://geekflux.vercel.app/posts/what-is-a-mesh-gradient-and-why-designers-love-it)
- [Mesh Gradients vs CSS Gradients: What's the Difference?](https://instantgradient.com/vs/css-gradient)

このプロジェクトの実装は、メッシュの制御点を格子状に固定するのではなく、各友達の色を「井戸（ガウシアン距離減衰の中心）」として自由な2D位置に置き、井戸同士の重みをOklab加重平均で混ぜる方式（[docs/internal-design/color-gradient-app.md](../internal-design/color-gradient-app.md)参照）。一般的な「グリッド上の制御点」によるメッシュグラデーション実装とは異なる、井戸ベースの独自方式である点に注意。

## 絵の具/インクの滲みの表現（このプロジェクト固有の組み合わせ）

上記の技術要素（Oklab加重平均・ドメインワープ・fBm・垂れ軌跡の追加ガウシアン）をどう重ねて「絵の具/インクらしさ」を作ったかという設計判断そのものは一般知識ではなく、このプロジェクト固有の内部設計。詳細は[docs/internal-design/color-gradient-app.md](../internal-design/color-gradient-app.md)を参照。
