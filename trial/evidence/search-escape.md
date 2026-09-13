# 検索欄のEsc操作

対象はIssue「検索欄のEscクリア操作を仕様とE2Eで保証する」（2026-09-12合意）です。`type="search"` と既存のinputイベントによる検索・件数更新、並べ替えを再利用し、独自のキー処理は追加しません。利用者が操作対象と対応範囲を判断できるよう、[README](../../README.md#セットアップと検証)にEscと空欄時の動作、フォーカス・並び順の保持、mobile検証の限界を記載しています。

現在の[商品E2E](../tests/product-search.spec.js)と[撮影定義](../capture.spec.js)がEsc後の検索欄・全件復帰・並び順・フォーカスと再検索を検証します。9月12日のE2E追加件数と当時のホストcheck結果は[履歴](search-escape-20260912.md)に保存しています。今回の来歴修正ではテスト・撮影定義を変更していません。

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

現在の8媒体は、2026-09-13のホスト実行 `108/resume-20260913/verification-108-content-fixed/capture-2` に対応します。capture-1からWebM 4点とdesktopのEsc画像1点が変わりました。Esc画像は43046 bytesから43044 bytesとなり、残るPNG 3点は同じバイト列でした。9月12日の `90-revalidation-after-92/verification/capture-1` のハッシュは現在の動画の根拠には使いません。

対象はHEAD `28642977a02518f79c6729af550ddf8c191b0fc5` に[撮影対象の保存差分](search-escape-run/generalization-108/captured-source.diff)を加えたものです。この差分はログに列挙された11ファイルを再現するもので、Issue全体の差分ではありません。[現行の照合記録](search-escape-run/provenance.json)に対象ファイル・媒体・保存ログのバイト数とSHA-256、撮影結果、ホストの実行識別値を記載しています。原ログのsourceFiles.pathは `sourcePathBase: "trial/"` から解決します。

- [標準出力のCAPTURE_PROVENANCE 4件](search-escape-run/generalization-108/capture-2.stdout)と[JSONレポート](search-escape-run/generalization-108/capture-2-media.report.json)は、Esc・並び順復元 × desktop・mobileの4件成功、skipped / unexpected / flakyすべて0、errorsなしを記録しています。開始 `2026-09-13T13:55:55.416Z`（22:55:55.416 JST）、所要36.541秒です。
- [保存したホストstate](search-escape-run/generalization-108/host-state-after-check-3.json)のcaptureイベントはexit 0、タイムアウトなしです。[標準エラー出力](search-escape-run/generalization-108/capture-2.stderr)は空です。stateは修正後の共通check成功後、独立評価2回の上限で停止した記録であり、最終受入の記録ではありません。
- 対象11ファイルすべてと媒体8点の現在のバイト数・SHA-256がログと一致しました。媒体8点はホスト出力ともバイト単位で一致しました。この修正では媒体を再生成していません。

## 撮影コマンドと設定

[対象設定](../../.dotagents.json)のcapture.commandは次のとおりです。ホストは対象checkoutを作業ディレクトリとし、`{harness}` をハーネスの絶対パスに解決して、作成済みのcheckout外の絶対出力ディレクトリを最後の引数に追加します。

```text
bun {harness}/scripts/capture.ts trial/capture.spec.js trial/playwright.config.js ABSOLUTE_OUTPUT
```

今回の[生成設定](search-escape-run/generalization-108/capture-2-media.config.txt)は `trial/playwright.config.js` のprojects・webServerを再利用します。`trial/capture.config.js` を直接指定した実行とは区別します。実際のPlaywright CLI引数はJSONレポートのconfig.argvにあります。

Playwright 1.63.0、Chromium 153.0.8010.12、headless、workers 1、retries 0。desktopは1280×800・isMobile=false・hasTouch=false、mobileは375×812・isMobile=true・hasTouch=trueです。webServerは `trial/` から `bun server.js` をPORT=4173で起動し、URLは `http://127.0.0.1:4173`、既存サーバーの再利用はありません。`PLAYWRIGHT_BROWSERS_PATH=0`、`CAPTURE_OUTPUT=…/108/resume-20260913/verification-108-content-fixed/capture-2-media`（完全な絶対パスは原ログに記録）です。

媒体はその直下にPNG/WebMだけを保存し、動画contextを閉じて確定します。生成設定・レポート・runner出力はcheckout外の `verification-108-content-fixed/` に出力されました。ホストが収集した最終媒体は `trial/evidence/generated/` にあります。

両画面幅で、結果あり・該当なし・空欄からEscで空文字・全4件・降順・件数表示・該当なし非表示・検索欄フォーカスを確認し、再フォーカスせず `note` を入力して2件へ再検索するassertionが成功しました。同じ撮影実行で並び順復元も成功し、降順選択→`note`検索→再読み込み→空の検索欄・全4件・降順を確認しています。

| 撮影 | desktop（UTC） | mobile（UTC） |
| --- | --- | --- |
| Esc・画像と動画 | 13:55:55.819–13:56:10.074 | 13:56:14.155–13:56:28.245 |
| 並び順復元・画像と動画 | 13:56:10.079–13:56:13.873 | 13:56:28.249–13:56:31.924 |

並び順復元の[desktop動画](generated/product-order-restore-desktop.webm)・[mobile動画](generated/product-order-restore-mobile.webm)と[desktop画像](generated/product-order-restored-desktop.png)・[mobile画像](generated/product-order-restored-mobile.png)も同じ実行の媒体です。[以前の並び順復元記録](order-persistence.md)の結果は当時の実行に限定します。

| 今回照合した動画 | bytes | SHA-256 |
| --- | --- | --- |
| product-order-restore-desktop.webm | 131272 | `4cbbf199b30b226f8716b00709573f98b0bec2588ac0dde5df875f2b7cc4e284` |
| product-order-restore-mobile.webm | 59280 | `15dda91e0ad91f56c386daa37763a821f7d488e88497b036c91535338efff0cc` |
| product-search-escape-desktop.webm | 530077 | `6eec6f480d0efc2f6e0a2db53cc29605e51918592100ab440c9a82775ab2edc4` |
| product-search-escape-mobile.webm | 266195 | `ed84eb557041b3cc05bd13ff2ca53251086dba4a442db2b5421fb3537e70b4ee` |

## 履歴の保持と修正時の確認

再撮影後も旧来歴を現行媒体の根拠としていた参照を修正しました。9月12日の[説明](search-escape-20260912.md)・[照合記録](search-escape-run/revalidation-provenance.json)と、それ以前の[capture-2照合記録](search-escape-run/capture-2-provenance.json)・原ログは履歴として保持しています。共通入口の変更とホスト検証は[汎用化の検証記録](repository-generalization.md)を参照してください。

この最後のホスト来歴更新は文書と保存記録だけです。対象11ファイル・媒体8点・保存ログのSHA-256とバイト数、ホスト出力との一致、HEADと保存差分からの対象再現、関連リンク、`git diff --check`を確認しました。撮影再利用の識別値は保存したホストstateのcaptureSourceと同じ `e4075ba19df66b43f5ca4a7c581a7f24ef0c8a5dd3c9ee71e88eb089c9a712a2` です。現行CLIは通常のMarkdownと保存記録をこの識別値から除き、コード・設定・媒体は含めます。再利用の判定はホストが行い、再撮影された場合は新しい原ログと収集後の媒体へ来歴を更新します。

テストの追加・削除・統合はなく、失う検出条件はありません。保存済み媒体の取り違えは今回のハッシュ・原ログ照合で確認し、時点固有の値を固定する恒久テストは追加しません。商品E2E、制御テストと撮影assertionは維持します。この記録更新ではブラウザー・サーバー・テストを再実行していません。直前のホスト実行では撮影4件と共通checkが成功しましたが、修正後の独立評価は回数上限により未実施です。

mobileは既存のモバイル画面・タッチ設定でのキー入力検証です。実機のソフトウェアキーボード、別ブラウザー、検索欄以外からのショートカットは保証しません。媒体のハッシュ照合は目視・動画再生の確認ではありません。公開担当者によるPR作成・添付・画像表示／動画再生・最新CI確認と、人のレビュー・承認は引き続き必要です。

直前のcapture-1の[照合記録](search-escape-run/generalization-108-capture-1-provenance.json)と原ログも保持しています。現在の媒体はcapture-2に対応します。
