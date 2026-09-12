# 商品一覧の並び順復元: 検証・撮影記録

この修正時の `generated/` の媒体は2026-09-12のEsc操作のホスト撮影 `90-revalidation-after-92/verification/capture-1`で再取得したものです。更新された動画2点を含む対象差分・実際の `CAPTURE_PROVENANCE`・媒体ハッシュは[Esc操作の検証記録](search-escape.md#ホスト実行対象差分と媒体の照合)を参照してください。以下は2026-09-11の実行記録で、当時の動画ハッシュを現在の動画の照合には使用しません。

対象: Issue #75「商品一覧で選んだ並び順を次回の訪問時に復元する」の合意済み要求。要求の基準commitは `5c5ae81b3d50b1cde202ae1467060a641a436093`。実際の撮影対象は、ディレクトリ移動後のcheckout HEAD `201b13657864861b64e5d455e65bd9e084812084` に並び順保存・復元の未commit差分を加えたもの。2026-09-11 JSTのホスト実行 `implement-host-75/run` の結果を以下に記録する。

## 実装と守る条件

`trial/public/search.js` は既存selectの変更時に画面へ適用し、localStorageの `product-order` に `original` / `ascending` / `descending` のみ保存する。初期化ではその3値だけを復元する。取得・読取失敗や未対応値は元の順序、書込失敗は画面の選択を維持する。初期化時には書き込まず、以前の保存成功値を壊さない。検索語は保存せず、読み込み時に空にする。保存期限、保存ボタン、失敗通知、storageイベントでの即時同期は追加しない。

既存のIntl.Collator('ja')と元の行配列による安定した比較、検索条件、名前とコードの対応、件数・該当なし表示、フォーカスを維持する。

## 検証定義の変更理由と範囲

既存 `product-search.spec.js` の再読み込み後original固定の期待は合意済みの復元仕様へ更新した。それ以外の検索・読み比較・同値の相対順・キーボード・表示幅の検証を維持し、同値の相対順は復元後も検証する。初回・保存値なしでoriginalになる検証は追加テストに残すため、この条件の検出を失わない。テストの除外、skip、再試行や合格基準の緩和は追加していない。

`product-order-persistence.spec.js` は既存Chromiumのdesktop 1280×800 / mobile 375×812で次を確認する。

- 3種類それぞれの即時保存・再読み込み・タブ再オープン。選択値、商品名とコードの行対応、件数、検索欄、該当なし、横はみ出しを固定期待値で確認する。保存対象が並び順だけであることも確認する。
- 保存値の欠落・未対応値・Storage取得/読取/書込例外と検索・クリアの継続。書込失敗後は以前の保存成功値、保存値がなければ元の順序を復元する。
- 復元後の検索、0件・1件で3種類の保存、クリアと全削除で保存値を維持、再読み込みで検索語を消して全件表示。
- タブ間のstorageイベントを待っても操作中の選択が変わらないこと、次の読み込みで最新の保存成功値を使うこと、操作中のタブが再選択して保存できること。
- 復元後のTab移動・selectキー操作、フォーカス維持、並べ替え時の遷移なし。既存テストと同じモバイルUIエミュレーションを両画面幅で使う。[Issue #62の記録](issue-62/evaluation.md)にあるmacOS headless Chromiumの制約を踏まえ、デスクトップのネイティブselectキー操作を自動検証したとは扱わない。
- OS一時ディレクトリの同じ永続プロファイルでChromiumを終了・再起動し、同じURLで3種類を復元する。別の永続プロファイルは保存値なしで開始する。page.reloadやstorageState注入をブラウザー再起動の証拠にしない。各テスト終了時にブラウザーを閉じ、プロファイルを削除する。

保存例外は実ブラウザー内のlocalStorage getter / Storage.prototype.getItem / setItemでSecurityError・QuotaExceededErrorを注入する。ブラウザー設定による実際の保存拒否は未検証で、この例外再現と区別する。Firefox・WebKit・実機タッチ・支援技術の動作保証は行わない。

## ホスト実行と対象差分の照合

sandboxではブラウザー・サーバーを起動せず、全 `bun run check` も実行しないという依頼に従った。実装準備時の定義検査は以下のとおり。

- `bun run lint`: 成功。
- `bun run complexity`: 成功。
- Playwright `--list`: 通常テストと独立した撮影テストの定義読み込みを確認。
- `git diff --check`: 成功。

ホストの実行結果と実ファイルを読み取り、次を照合した。原記録の写しを [order-persistence-run/](order-persistence-run/) に保存した。

- `capture-1`: exit 0、タイムアウトなし。撮影レポートの開始時刻は `2026-09-11T03:59:18.554Z`（12:59:18.554 JST）、所要10.726秒。desktop・mobile各1件、計2 passed、skipped / unexpected / flakyはすべて0。[JSONレポート](order-persistence-run/capture-1-media.report.json)、[標準出力](order-persistence-run/capture-1.stdout)。
- `check-1`: `bun run check` がexit 0、タイムアウトなし。制御テスト82 passed、E2E 84 passed。3種類×2画面幅の永続プロファイル終了・再起動と別プロファイル分離の6件も成功した。[標準出力](order-persistence-run/check-1.stdout)、[標準エラー出力](order-persistence-run/check-1.stderr)。これはホスト結果の確認であり、今回のsandbox内での再実行ではない。
- ホストが記録した撮影前のsource識別値は `678d0e172753f44c28368a7b714d2d4cdd5f5351a4a2064732285b465bd7dac1`、媒体収集後のcheck対象は `c1d2ec82cd7f6e571f3c2039b568890e4f26b844be738d0767428a5cdd86110c`。これらはcommit IDではなく、ファイル名・mode・内容ハッシュをまとめたSHA-256である。
- 今回の文書修正前に同じ計算法でcheckoutを照合するとcheck対象と一致し、`trial/evidence/generated/` の4媒体だけを除くと撮影対象と一致した。したがって両実行間の商品実装・テスト・撮影定義は同一である。収集済み4媒体もホスト出力とバイト単位で一致した。[来歴とファイル別SHA-256](order-persistence-run/provenance.json)に計算法、実際のHEAD、実行イベント、対象コード・媒体の識別値を記録した。

## 実際の撮影条件と媒体

ホストは `scripts/capture.ts` からPlaywright CLIを `test --config …/verification/capture-1-media.config.js` で起動した。[実際の生成設定](order-persistence-run/capture-1-media.config.txt)は既存 `trial/playwright.config.js` のprojects・webServerを再利用し、`trial/capture.spec.js` だけを実行する。READMEの `trial/capture.config.js` を直接指定した実行とは区別する。

Playwright 1.63.0、Chromium headless、desktop 1280×800 / mobile 375×812（mobileはisMobile・hasTouch有効）、workers 1、retries 0。インストールログはmacOS arm64用Chromium 153.0.8010.12（v1243）を記録している。Bun 1.4.2で `bun server.js` を `trial/` から起動し、PORT=4173、同一URL `http://127.0.0.1:4173/` を使用、既存サーバーの再利用はなし。

`PLAYWRIGHT_BROWSERS_PATH=0`、`CAPTURE_OUTPUT=/Users/thkt/.local/share/dotagents/trials/implement-host-75/run/verification/capture-1-media`。PNG/WebMはこの絶対パス直下へ出力し、動画contextを閉じて保存した。runner出力・JSONレポートはcheckout外の `verification/` に作られた。撮影成功後、ホストが媒体を `trial/evidence/generated/` に収集した。この修正では撮影を行わず、既存のログを検証記録としてコピーした。

両プロジェクトとも元の順序から降順を選択し、`note` を入力して2件表示、再読み込み後に降順・空の検索欄・全4件を確認した。撮影時のassertionは白いマグ/MUG-001、黒いペン/PEN-001、赤いノート/NOTE-002、青いノート/NOTE-001の順、該当なし非表示まで成功している。

最終媒体の参照先（capture-1で画像2点・動画2点を収集済み。ホストの再撮影時には更新される）:

| 確認対象 | desktop | mobile |
| --- | --- | --- |
| 降順復元・空の検索欄・全4件 | [PNG](generated/product-order-restored-desktop.png) | [PNG](generated/product-order-restored-mobile.png) |
| 降順を選択→note検索→再読み込み→全件を降順で復元 | [WebM](generated/product-order-restore-desktop.webm) | [WebM](generated/product-order-restore-mobile.webm) |

`provenance.json` の媒体ハッシュと実行結果はcapture-1収集時の記録であり、将来の再撮影結果を表すものではない。再撮影時の各媒体・対象ファイルのSHA-256、撮影時刻・プロジェクト・結果は撮影テストが標準出力にも記録するため、ホストの次の撮影ログと対応づけられる。

今回の修正では文書と原ログの保存に加え、`trial/capture.spec.js` に成功時の `CAPTURE_PROVENANCE` 出力を追加した。撮影操作・assertion・保存先は維持し、媒体以外のファイルは撮影中に生成しない。対象を絞ったOxlint・Biome検査、Playwright `--list`（両プロジェクト計2件）、`git diff --check` が成功した。媒体ハッシュ・未変更の対象コードのハッシュ・原ログのコピー・文書リンクも照合した。来歴出力追加後のブラウザー実行はホストに委ねる。

人による両画面幅の読みやすさ、選択欄と順序の一致、件数、検索欄、操作の連続性のレビュー・承認は残っている。PR作成・添付アップロード・公開先での媒体表示確認は公開担当者の作業であり、この修正では行っていない。動画は再読み込みのデモであり、ブラウザー終了・再起動の証拠は通常E2Eの永続プロファイルテスト結果で確認する。今回の文書・来歴出力の修正後の全checkと再撮影はホストが別途実行する。
