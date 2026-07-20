# 色グラデーションアプリ — 内部設計（発起人による「完成」確定）

<internal_design status="realized" name="session_completion_design" requirements="session_completion">

実装本体（既存の[async_invite_response_flow_design](./color-gradient-app-async-flow.md)への追加）:
- `app/mesh-gradient/lib/participants.js` — `completeSession`（完成確定）、`serializeSessionForInitiator`
  （発起人向けのセッション全体サマリ）を追加。`patchParticipant`・`addParticipant`・`deleteParticipant`に
  完成後の一律拒否ガードを追加。`serializeForRespondent`に`completedAt`・`finalArtDataUrl`を追加。
- `app/mesh-gradient/dev-server.js`、`app/mesh-gradient/api/sessions/[sid]/complete.js` —
  `POST /api/sessions/:sid/complete`。
- `app/mesh-gradient/public/index.html`、`public/reply.html` — 完成フローのUI。

各処理のWHYはコードコメントに書いてあるため重複させない。ここに書くのは設計判断のみ。

## 完成版アートは、セッションJSONブロブにdataURLとして直接埋め込む（別ストレージに分離しない）

fable-advisorに相談した上での判断（個人規模のスパイクプロジェクトという前提）。検討した代替案（画像だけ
file-store/kv-storeそれぞれに専用の保存単位を新設する案）は、解決する問題（セッションブロブの肥大化）が
実質発生しないため採用しなかった: 完成後は参加者PATCH自体をサーバー側で拒否するため（後述）、無関係な
操作が画像データを巻き込む状況が起きない。また、完成後のアクセスはどのみち画像込みで読むことになるため、
分離してもロード量は減らない。ダウンロードもdataURLを`<a download>`に渡すだけで済み、バイナリ配信用の
別エンドポイントが不要になる副次的な利点もある。

サイズ上限は`MAX_FINAL_ART_LENGTH`（900,000文字）。Upstash Redis無料プランのREST APIリクエスト1MB上限
（Vercel Functionsのボディ4.5MB上限より厳しい方）に、JSONラッパー等の余白を残して収まる値。実測では
560×840のPNG（紙質感・ドメインワープ込み）で概ね650KB前後（文字数として約65万文字）に収まっており、
現状の描画設定であれば上限に達しない。

## 「完成」は`completedAt`のセットと`finalArtDataUrl`の保存を1回の呼び出し・1回の永続化で行う

`completeSession`は、両方のフィールドを同時にセットしてから呼び出し側が1回`store.saveSession`する設計。
「completedAtは立ったが画像が無い」という中間状態を意図的に作らない。保存自体が失敗した場合は
`completedAt`も未設定のままなので、そのまま再試行できる（不可逆操作の入り口を安全側に倒す）。

既に完成済みのセッションに対する`completeSession`呼び出し（別タブ・別デバイスからのレースで後着した場合）
も、409だけでなく`completedAt`・`finalArtDataUrl`を応答に含める。呼び出し側（index.html）はこの2フィールド
の有無だけで「実際に完成しているか」を判定するため、後着した側にも「失敗した」ではなく実際の完成状態を
正しく伝えられる。

## 完成後は、参加者個別の`respondedAt`とは独立に、全フィールド・全操作を一律拒否する

`patchParticipant`・`addParticipant`・`deleteParticipant`は、既存の`respondedAt`ロック判定より前段で
`session.completedAt`を見て、該当すれば内容に関わらず409を返す。既存の`respondedAt`ロックは「色・位置・
影響範囲」の3フィールドのみが対象だったが、「完成」はセッション全体のスナップショット確定という要件のため、
ラベル変更・新規参加者追加・参加者削除も含めて全面凍結する。3関数の拒否レスポンス生成は`completedRejection`
ヘルパーに共通化してあり（対象participantがあれば`serializeForRespondent`で最新状態を添える）、新しい
mutatingな関数を追加する際にも同じ形で呼べるようにしてある。ただし`session.completedAt`をチェックする
呼び出し自体は各関数が個別に持つ（共通のミドルウェア層・ディスパッチのchokepointは設けていない）——
このアプリの規模（1ファイル・少数の関数）では、共有の判定呼び出し以上の抽象化は過剰と判断した。将来
mutatingな関数が増えて見落としリスクが無視できなくなった場合に、ルーティング層での一括ガードを検討する。

フロントエンド（index.html）側も、`completed`フラグが立ったら`respondedAt`の有無に関わらず全参加者行を
編集不可表示にする（`locked = completed || !!p.respondedAt`）。これは「発起人が自分の色をまだ`決定する`
していない状態で完成した場合でも、完成そのものによってその時点の値が凍結される」ことを意味する（要件は
自分の色決定（`respondedAt`）を完成の前提条件にしていないため、確定操作の有無を問わず完成時点の値で
固定する設計にした）。ただし「値が何もない」状態（`color`未設定）まで許すと、発起人自身の点が完成版
アートに一切現れなくなるため、`respondedAt`とは別に`color`の有無だけは完成の前提条件にする（後述）。

サーバー側の409は、UIの表示制御が想定通りに機能しなかった場合（複数タブ・ポーリング間隔中のレース等）の
最終防衛線でもある。発起人画面の「決定する」「＋友達を追加」「×（削除）」の各操作は、PATCH/POST/DELETEの
応答を確認し、エラー（`res.error`・非2xx）が返ってきた場合はローカルの楽観更新を確定させず、代わりに
`resyncFromServer()`（セッションを再取得してローカル状態を置き換える共通処理）を呼ぶ。これにより、ローカル
状態がサーバーの実際の状態と食い違ったまま表示され続けることを防ぐ（例: 拒否された参加者追加でIDが
`undefined`の偽の招待リンクが表示され続ける、拒否された削除で友達が消えたように見え続ける、等）。

## 完成後はポーリングを止める

発起人画面の自動反映ポーリング（[async-flow内部設計](./color-gradient-app-async-flow.md)の3秒間隔
`setInterval`）は、`completed`になった時点（ポーリング内での検知・「完成する」ボタン成功時・`boot()`での
起動時判定のいずれか）で`clearInterval`し、以後は呼ばない。完成後のセッションは仕様上二度と変化しないため
（全mutatingリクエストは409で拒否される）、ポーリングを続けても得るものがなく、完成版アート
（数百KB程度のdataURL）を3秒おきに無期限へ再取得し続ける無駄を避ける。

## 未回答のまま締め切られた枠は、レンダリング側の変更を一切必要としない

`mesh-render.js`の`render()`は元々`points.filter(p => !!p.color)`で色未設定の点を無視する実装だった
（このドキュメントの元になった要件が書かれる前から存在していたロジック）。「未回答枠は影響が表示されない
だけ」という要件は、この既存フィルタが完成後もそのまま適用されることで自然に満たされる。完成処理・
混色ロジックのどちらにも除外のための特別分岐を追加していない。

## 友達への公開範囲は、サーバー側のレスポンス生成時点でフィルタする

`serializeForRespondent`は、`session.completedAt && p.respondedAt`が両方真の場合のみ`finalArtDataUrl`を
含める。UIの出し分け（reply.htmlが表示を変える）だけに頼らず、そもそもAPIレスポンスに含めない形で担保する
（発起人向けの`serializeForRespondent`実装が既に採っていた「サーバーが返すデータ自体を絞る」という方針を
踏襲）。発起人向けの`serializeSessionForInitiator`は、発起人自身が完成させた本人であるため
`respondedAt`を問わず`completedAt`が立っていれば常に`finalArtDataUrl`を返す。

## 未回答のまま締め切られた友達がリンクを開いたときの表示は、専用の状態として区別する

reply.htmlは`renderParticipantState`で「回答済み」「未回答のまま締め切り」「回答フォーム」の3状態を
出し分ける。締め切り状態はエラー表示（`renderError`、リンク自体が無効な場合に使う）とは別の
`renderClosed`関数を用い、「エラーではなく締め切られたことが伝わる文言にする」という要件（async-flow
文書のUXライティング課題）を最小限の文言で満たした。文言そのものの最終決定は要件定義が明示的に
未定義のまま残した課題であり、ここでの文言は暫定。

送信ボタン押下から結果反映までの間に発起人が完成させた場合（レース）、PATCHは409
（`error: "session completed"`）で返る。この409レスポンスは成功時と同じ`participant`形状を
`result.body.participant`として含んでおり、`renderParticipantState(result.body.participant)`に
そのまま渡すことで、回答済み／締め切りいずれの状態になったかを再判定できる（この経路は、既存の
「回答済み」409（`error: "already responded"`）にも同じ構造で対応しており、以前は結果を正しく
出し分けられていなかった潜在バグを合わせて修正した）。

## 発起人自身の色が未設定のままでは完成できない（サーバー側でも強制する）

index.htmlの「完成する」クリック時には元々`if (!self || !self.color) { alert(...); return; }`という
クライアント側の確認があったが、これはUIの導線を塞ぐだけで、`completeSession`自体は`self.color`を一切
見ていなかった。直接APIを叩く経路（別クライアント・手動リクエスト等）ではこのチェックを迂回でき、
その場合`render()`の「色未設定の点は無視する」フィルタにより、発起人自身の点が完成版アートに一切
現れない状態のまま「完成」が確定してしまう。要件（session_completion）にこの制約を追加した後、
`completeSession`の先頭（`completedAt`済みチェックの直後、`dataUrl`検証の前）で`findSelf(session)`の
`color`が未設定なら400で拒否するようにした。`respondedAt`（「決定する」による確定）までは要求しない
——完成時点で色さえ選ばれていれば、その値がそのまま凍結されて完成版アートに含まれるため、要件が
明示的に求めているのはそこまでで十分と判断した。

## 既知の制約（対策していない）

- **完成と回答の競合**: `file-store`/`kv-store`はread-modify-writeで、セッション単位のロックを持たない。
  発起人が「完成」のためにセッションをロードした直後に、別の友達が回答してsaveすると、発起人側の
  `saveSession`が後勝ちでその回答を上書きしうる（「回答したのに締め切り扱いになる」レアケース）。
  個人規模の利用（発起人＋数人の友達が短時間に操作する想定）では許容範囲と判断し、対策
  （楽観ロック等）は入れていない。将来、同時アクセス数が増える場合はこの制約を再検討する。
- **完成ボタンを押せる条件**: フロントエンドは`flow === "idle"`のときのみボタンを表示・有効化する
  （友達配置中でないこと）。発起人が自分の色を`決定する`（`respondedAt`確定）前でも押せる（要件が
  確定操作そのものを前提条件にしていないため）。ただし`color`が未設定の場合はクライアント側の確認
  ダイアログとサーバー側`completeSession`の両方で拒否する（前述）。

</internal_design>
