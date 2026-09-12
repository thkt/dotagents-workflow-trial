# 検索欄のEsc操作

対象はIssue「検索欄のEscクリア操作を仕様とE2Eで保証する」（2026-09-12合意）です。`type="search"` と既存のinputイベントによる検索・件数更新、並べ替えを再利用し、独自のキー処理は追加しません。利用者が操作対象と対応範囲を判断できるよう、[README](../../README.md#セットアップと検証)にEscと空欄時の動作、フォーカス・並び順の保持、mobile検証の限界を記載しています。

[既存E2E](../tests/product-search.spec.js)に、検索結果あり（`note`）・該当なし（`missing`）・空欄と3種類の並び順を組み合わせた9ケースを追加しました。既存のChromium desktop・mobileで計18件を追加実行する定義です。Esc前の状態、Esc後の空文字・全4商品の名前とコードと表示順・件数・該当なし表示の解除・選択値・フォーカスを確認し、再フォーカスせずキーボードから`note`を入力して再検索と順序保持を検証します。既存ケース・検証設定は維持し、失う検出条件はありません。

## 撮影と確認する内容

撮影は通常checkとは別に実行します。[READMEの撮影コマンド](../../README.md#レビュー用キャプチャ)が再実行の入口です。今回のホスト実行では、後述の生成設定から[capture.spec.js](../capture.spec.js)を実行し、既存の並び順復元に加え、両画面幅の次の操作を撮影しました。

1. 降順を選び、検索欄へフォーカスする。
2. `note`を1文字ずつ入力し、2件からEscで全4件へ戻って再検索する。
3. `missing`を1文字ずつ入力し、該当なしからEscで全4件へ戻って再検索する。
4. 空欄でEscを押し、全件表示を保って再検索する。

各再検索後はEscで空欄へ戻します。動画では件数・表示順・検索欄のフォーカスと入力先を確認します。キー名は画面に表示されないため、上の手順と照合します。PNGは該当なしからEscを押した直後です。

| 媒体 | desktop | mobile |
| --- | --- | --- |
| 全件復帰・降順・検索欄フォーカス | [PNG](generated/product-search-escape-cleared-desktop.png) | [PNG](generated/product-search-escape-cleared-mobile.png) |
| 3状態のEscと再検索 | [WebM](generated/product-search-escape-desktop.webm) | [WebM](generated/product-search-escape-mobile.webm) |

`CAPTURE_OUTPUT`は必須のcheckout外の絶対パスです。媒体はその直下に保存し、動画contextを閉じて動画を確定します。レポートはOSの一時ディレクトリへ出力します。ホストが収集する最終媒体は上記`trial/evidence/generated/`を参照し、撮影ログの`CAPTURE_PROVENANCE`には対象ファイルと媒体のSHA-256、ブラウザー版、画面・タッチ設定、時刻と結果を残します。

## ホスト実行・対象差分と媒体の照合

現在の8媒体は、2026-09-12のホスト実行 `development/d3d15c767753bba6/90-revalidation-after-92/verification/capture-1` に対応します。以前の `90/verification/capture-2` とは別の実行です。対象はHEAD `7bebfd3b8828873fd176b8a97a9497637d1affdc` に[対象ファイルの未commit差分](search-escape-run/revalidation/captured-source.diff)を加えたものです。差分はREADME、検索E2E、撮影定義を含み、商品実装はHEADと同じです。[引き継ぎ記録](search-escape-run/revalidation/handoff.json)に今回の基準版と以前の実行との対応を保存しています。

- 撮影は4件成功（Esc・並び順復元 × desktop・mobile）、skipped / unexpected / flakyはすべて0、errorsなし。開始 `2026-09-12T08:35:43.287Z`（17:35:43.287 JST）、所要38.962秒。[標準出力のCAPTURE_PROVENANCE 4件](search-escape-run/revalidation/capture-1.stdout)、[JSONレポート](search-escape-run/revalidation/capture-1-media.report.json)、[標準エラー出力](search-escape-run/revalidation/capture-1.stderr)を保存しました。
- 同じホストの `check-1` は `bun run check` がexit 0、タイムアウトなし。制御118件・E2E 102件成功で、E2EはEsc追加18件を含み、skipped / unexpected / flakyはすべて0、errorsなし。[標準出力](search-escape-run/revalidation/check-1.stdout)、[標準エラー出力](search-escape-run/revalidation/check-1.stderr)、[E2Eレポート](search-escape-run/revalidation/check-1-e2e.report.json)、[ホストの終了コード記録](search-escape-run/revalidation/host-state.json)を保存しました。これは修正前の保存済みホスト結果であり、今回のsandbox内での再実行ではありません。
- `CAPTURE_PROVENANCE` の対象11ファイルすべてについて、現在のバイト数・SHA-256がログと一致しました。媒体8点もすべてログのバイト数・SHA-256、およびホスト出力ファイルとバイト単位で一致しました。[照合記録](search-escape-run/provenance.json)にcheckout基準のパス、完全なハッシュ、実行結果、保存した原ログと差分のハッシュを記載しています。原ログのsourceFiles.pathは `sourcePathBase: "trial/"` から解決します。

ホストは `scripts/capture.ts` からPlaywright CLIの `test --config …/90-revalidation-after-92/verification/capture-1-media.config.js` を実行しました。[実際の生成設定](search-escape-run/revalidation/capture-1-media.config.txt)は既存 `trial/playwright.config.js` のprojects・webServerを再利用します。READMEの `trial/capture.config.js` を直接指定した実行とは区別します。

Playwright 1.63.0、Chromium 153.0.8010.12、headless、workers 1、retries 0。desktopは1280×800・isMobile=false・hasTouch=false、mobileは375×812・isMobile=true・hasTouch=trueです。webServerは `trial/` から `bun server.js` をPORT=4173で起動し、URLは `http://127.0.0.1:4173`、既存サーバーの再利用はありません。`PLAYWRIGHT_BROWSERS_PATH=0`、`CAPTURE_OUTPUT=…/90-revalidation-after-92/verification/capture-1-media`（完全な絶対パスは原ログに記録）で、媒体はその直下、レポートはcheckout外の `verification/` に出力されました。動画contextを閉じて保存後、ホストが最終媒体を `trial/evidence/generated/` へ収集しています。

両画面幅で、上記3状態からEscで空文字・全4件・降順・件数表示・該当なし非表示・検索欄フォーカスを確認し、再フォーカスせず `note` を入力して2件へ再検索するassertionが成功しました。同じ撮影実行で並び順復元も成功し、降順選択→`note`検索→再読み込み→空の検索欄・全4件・降順を確認しています。

| 撮影 | desktop（UTC） | mobile（UTC） |
| --- | --- | --- |
| Esc・画像と動画 | 08:35:46.300–08:36:00.477 | 08:36:04.551–08:36:18.591 |
| 並び順復元・画像と動画 | 08:36:00.482–08:36:04.217 | 08:36:18.597–08:36:22.222 |

並び順復元の[desktop動画](generated/product-order-restore-desktop.webm)・[mobile動画](generated/product-order-restore-mobile.webm)と[desktop画像](generated/product-order-restored-desktop.png)・[mobile画像](generated/product-order-restored-mobile.png)も同じ実行の媒体です。[以前の並び順復元記録](order-persistence.md)のハッシュは当時の実行に限定します。

| 今回照合した動画 | bytes | SHA-256 |
| --- | --- | --- |
| product-order-restore-desktop.webm | 133533 | `0123591062194090776be0b2ae9c6524dec914d2346f02c15fa0dd808235df5d` |
| product-order-restore-mobile.webm | 68303 | `3c0d9ee6a99da1bc5aae15c06c8c894095255ce26bef66012a14adf6a45d21d1` |
| product-search-escape-desktop.webm | 511631 | `bb6463357a99be264a08c3866a5b83fd47453a65088ab8e9598bffcaf7fc002e` |
| product-search-escape-mobile.webm | 262755 | `98d61b042168a76ce45abefee4d47ffc32ce221326601a2ed8d691a138db011d` |

## 来歴不足の修正と再撮影の扱い

再検証でホストが同名の動画4点を更新した一方、文書とprovenance.jsonは以前のcapture-2を参照していました。今回、現物に一致する再検証のログ・設定・結果・対象差分を保存し、照合記録と関連文書を更新しました。以前の[照合記録](search-escape-run/capture-2-provenance.json)とその原ログは過去の結果として保存し、現在の媒体を照合する根拠には使いません。

今回の修正はMarkdownと `trial/evidence/` 内の保存記録だけです。現行ホストの[撮影再利用条件](../../scripts/README.md)に従い、コード・撮影定義・媒体などのファイル内容・モード・パスから算出する識別値が、成功済みcapture-1の収集時と同じ `38e3c9565fdb22d09edce5e5e529c1b96e8fffd6b400114adc8fb092c7d187a9` であることを確認しました。この条件ではホストが撮影を再利用するため、記録修正だけで再び動画が置き換わることを避けられます。撮影定義・アプリ・媒体などが変わって再撮影される場合は、新しい実ログと収集後の媒体を照合して記録を更新します。この表は将来の媒体を保証しません。

## 修正時の確認と限界

対象を絞り、保存ログの集計・終了コード、対象11ファイルと媒体8点のSHA-256・バイト数、ホスト出力との一致、HEADと保存差分からの対象ファイル再現、関連文書リンク、`git diff --check`、撮影再利用の識別値を確認しました。利用仕様の正本であるREADMEとE2E・撮影定義は要求に一致するため、今回追加の変更はありません。DEVELOPMENT.mdの文書更新方針に従い、実行条件と結果はこの検証記録へまとめています。

ブラウザー・サーバー・全check・撮影は起動していません。修正後の全checkとブラウザーテスト、および撮影の再利用判定はホストが実行します。媒体は取得・照合済みですが、目視・動画再生によるレビュー済みとは扱いません。

mobileは既存のモバイル画面・タッチ設定でのキー入力検証です。実機のソフトウェアキーボード、別ブラウザー、検索欄以外からのショートカットは保証しません。人のレビュー・承認、公開担当者によるPR作成・媒体添付と公開先の表示・再生確認は別途必要です。
