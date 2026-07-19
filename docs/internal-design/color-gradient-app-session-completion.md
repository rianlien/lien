# 色グラデーションアプリ — 内部設計（発起人による「完成」確定）

<internal_design status="unrealized" name="session_completion_design" requirements="session_completion">

実装本体（想定、新規追加/変更）:
- `app/mesh-gradient/lib/participants.js` — `completeSession`関数の追加。既存の`addParticipant`/
  `patchParticipant`/`deleteParticipant`に、セッション完成後のロストロック判定を追加。
- `app/mesh-gradient/lib/file-store.js` / `lib/kv-store.js` — 完成版アート（画像バイナリ）を、セッション本体
  とは別のキー/ファイルとして読み書きする関数を追加（`loadArtwork`/`saveArtwork`）。
- `app/mesh-gradient/server.js`、`api/sessions/[sid]/complete.js`（新規）、
  `api/sessions/[sid]/participants/[pid]/artwork.js`（新規） — ローカル/Vercel両方に
  `POST /api/sessions/:sid/complete`と`GET /api/sessions/:sid/participants/:pid/artwork`を追加。
- `public/index.html` — 「完成」ボタン、固定解像度オフスクリーンcanvasでの完成版アート生成。
- `public/reply.html` — 完成後、完成版アート（`<img>`＋ダウンロードリンク）を表示する分岐。

各判断はfable-advisorへの相談を踏まえて決定した（相談内容: 完成フラグの表現と、完成版アートの生成・保存方式）。

## セッションレベルの不可逆ロックは、既存のロック機構に1枚ガードを足すだけで表現する

`respondedAt`（参加者レベル）と同型のパターンで、セッションオブジェクトに`completedAt`（ISO文字列、
既定null）を持たせる。ただしこれは参加者ロックとは独立した「2階層目のロック機構」を新設するのではなく、
`addParticipant` / `patchParticipant` / `deleteParticipant`という既存の書き込み系関数の先頭に
`if (session.completedAt) return { status: 409, ... }`を足すだけ、という単純な実装にとどめる
（新しいロック用語・新しい判定軸を増やさない）。

## ロスターの凍結範囲: 未回答枠のpatchだけでなく、追加・削除もcompletedAt後は全面凍結する

requirements（session_completion）が明示するのは「新規追加・新規招待リンク発行の禁止」と「未回答枠の
自動締切」だが、削除については明示がない。ここはIntentとして、**「完成」はセッション全体のスナップショット
確定である**という要件の趣旨から、削除も含めてロスター変更を全面凍結すると決める（完成後に友達を削除できて
しまうと、完成版アートに使われた参加者構成と、その後のロスターが食い違い、「スナップショット」の意味が
崩れるため）。

## 「完成」の前提条件: 発起人自身の`respondedAt`（決定済み）を必須にする

requirementsに明記はないが、発起人自身の色がまだ`respondedAt`で確定していない状態で完成版アートを焼くと、
「決定する」前の試行錯誤中の色がスナップショットに固定されてしまい、既存の「決定するまで色を選び直せる」
という発起人向け要件と矛盾する。そのためIntentとして、**発起人自身の`respondedAt`が立っていることを
「完成」操作の前提条件にする**（`completeSession`は、発起人の`respondedAt`が未設定なら400を返す）。

## 完成確定と完成版アート保存を1つのAPIリクエストに束ね、中間状態を作らない

`POST /api/sessions/:sid/complete`は、リクエストボディに完成版アートのJPEG（base64）を含み、サーバー側で
「画像保存 → `completedAt`スタンプ → セッション保存」の順に処理する。完成確定（フラグ）と画像保存を別々の
リクエストに分けると、「`completedAt`は立ったが画像がまだ保存されていない」という中間状態
（例: 発起人が「完成」を押した直後にブラウザを閉じた場合）が生まれ、それを検知・復旧する仕組みが別途
必要になる。1リクエストに束ねることで、この操作は「両方成功」か「どちらも未完成（＝再試行可能）」の
どちらかにしかならず、中間状態そのものが存在しなくなる。

## 完成版アートは固定解像度のオフスクリーンcanvas＋JPEGで生成する（PNGは採用しない）

描画は既存どおり完全にクライアントサイド（発起人のブラウザ）で行う。「完成」ボタン押下時、画面表示用の
canvasではなく、新たに生成する固定解像度（例: 1200×1800、既存の2:3比率を維持）のオフスクリーンcanvasに
`MeshRender.render`で全参加者の点を描画し、そこから画像を書き出す。画面表示用canvasをそのまま使わない
理由は、発起人のウィンドウサイズ・devicePixelRatioに完成版アートの画質が左右されるのを避けるため。

フォーマットはPNGではなくJPEG（同等の画質でファイルサイズが大幅に小さい）を採用する。理由:
なめらかなグラデーションはPNG圧縮と相性が悪く数MBに達しうるが、後述のとおり永続化先（Upstash Redis）の
1リクエストあたりの値サイズ上限（無料枠は特に小さい）に収める必要があり、base64化による約1.33倍の
サイズ増も踏まえるとPNGでは超過リスクが現実的だった。要件定義（session_completion内部設計委任事項）が
例示していた「PNG」はあくまで例示であり、「画像ファイルとしてダウンロードできる」という外部要件は
JPEGでも満たす。

## 完成版アートはセッション本体と別キー/別ファイルに分離して保存する

セッションオブジェクト（1セッション=1キー/1ファイルの既存方式）に完成版アートのbase64をそのまま
混ぜ込まない。理由は2つ:
1. 発起人画面は既存の3秒間隔ポーリングで`GET /api/sessions/:sid`を叩き続けており、ここに巨大なbase64
   文字列が乗ると、完成後もポーリングのたびに毎回それを運ぶことになり、既存の「軽量なポーリング」という
   設計判断（[async_invite_response_flow_design](./color-gradient-app-async-flow.md)参照）を裏切る。
2. 参加者一覧の取得・更新という既存の頻繁な読み書き経路と、完成版アートという読み出し頻度も性質も異なる
   データを、同じキーに同居させる理由がない。

具体的には、kv-storeは`session:{sid}:artwork`という別キー、file-storeは`{sid}.artwork.jpg`という別
実ファイル（デバッグ時に画像ビューアでそのまま開けるようにするため、JSONに埋め込まない）に保存する。
ただし完成版アートのライフサイクルはセッションと同一（セッションが存在する限り存在し、セッションが
削除されればアートも削除される）ものとして扱い、将来セッションの削除・TTL処理を実装する際は、この
2キー/2ファイルを必ずセットで扱う（同期漏れが起きやすい設計であることをここに明記しておく）。

外部Blobストレージサービス（Vercel Blob等）の新規導入は行わない。発起人1人＋友達数人程度という
利用規模で、依存を1つ増やすコストに見合う利点がないと判断した。

## 配信・認可: 画像バイトを直接返す専用エンドポイントに、閲覧可否の判定を集約する

`GET /api/sessions/:sid/participants/:pid/artwork`は、JSONでbase64を返すのではなく、画像バイトを
`Content-Type: image/jpeg`で直接返す（`<img src>`にそのまま指定できる／ブラウザの「画像を保存」でも
ダウンロードできる）。クエリパラメータ`?download=1`が付いた場合のみ`Content-Disposition: attachment`を
追加で付与し、明示的なダウンロードボタンからの遷移に使う。「ダウンロードできる」という別要件のために
別のエンドポイントや別の保存形式を用意しない。

認可判定はこのエンドポイント1箇所に集約する: `session.completedAt`が立っており、かつ
（対象participantが`isSelf`（発起人自身）である、または対象participantに`respondedAt`が立っている
（＝回答済みの友達である））の場合のみ200を返す。それ以外（未回答のまま締め切られた枠、完成前）は404
として扱う。**未回答のまま締め切られた枠に完成版アートを公開しない**という要件は、この認可判定が唯一の
実装箇所であり、ここを見落とすと要件違反に直結する。

既存の`GET /api/sessions/:sid/participants/:pid`（`getForRespondent`）には、参加者個別の生データ
（色・位置・reach）を追加で返すのではなく、`completed: true/false`という真偽値だけを追加する
（`session.completedAt`の有無をそのまま反映）。回答者ページ（reply.html）は、この真偽値を見て
「完成版アートを見るリンク」を出し分けるが、完成版アートの実データはartworkエンドポイントからのみ
取得する。

## 未定義のまま残す項目（internal-designでも今回は決めない）

- 締め切られた枠の招待リンクを開いたときの表示文言そのもの（requirements側で
  [async_invite_response_flow](./color-gradient-app-async-flow.md)のUXライティング課題に委譲済み）。
- 完成版アートの解像度の具体的な最終値（1200×1800は暫定案。実装時の見た目・ファイルサイズを見て調整可）。

</internal_design>
