# 共有入口への移行記録

[Issue #110](https://github.com/thkt/dotagents-workflow-trial/issues/110)の開始条件と、2026-09-14に停止した実測の履歴です。共有環境への移行受入全体の状況は[dotagents #54](https://github.com/thkt/dotagents/issues/54)、現在の操作は[README](../../README.md#共有入口の確認)を参照してください。この記録の過去の結果を、後続の実行や現在の媒体の成功証拠として流用しません。

## 開始条件

| 項目 | 記録した値 |
| --- | --- |
| 対象repo・remote・base | `thkt/dotagents-workflow-trial`・`origin`・`main` |
| bootstrap直前 | `93b38f0bc690373b4b1f68e37a42f721929d6386` |
| 最初の実測の開始HEAD | `d60f8a649f86d6f4d179b4d582698009fd8ed597` |
| 共有ハーネス | `a2159d50501afe58eec7048029db7bd11febbb7c`（人がマージした[PR #55](https://github.com/thkt/dotagents/pull/55)） |
| 共有入口 | `~/.agents/skills/scoping/SKILL.md`・`~/.agents/skills/implement/SKILL.md` |

bootstrapは `.dotagents.json` への `ciChecks: ["checks", "verify"]` 追加と、`.agents/skills/scoping`・`.agents/skills/implement` のsymlink削除です。repository・remote・base branch・setup・check・captureは維持します。対応PRにはbootstrapを含めます。試行用のローカル実装・依存・商品・撮影定義と過去の証拠を保持し、通常の実行は共有入口から解決したCLIを使います。

採用版を切り替える際は、新しいタスクで両スキルが意図した共有実体を参照することと対象checkoutを確認し、開始HEAD・設定・共有ハーネス版を実行記録へ残します。

## 停止した実測と修正

以下はホストに保持した `acceptance-20260914` の結果です。ログ・媒体・原文・失敗状態は上書きせず保存しています。

| 実行 | 確認できた結果と停止理由 |
| --- | --- |
| `development-110` | 最初のcheckは制御144成功・13失敗。fixture修正後のcheckは制御157件・runner契約5件・商品E2E45件が成功し、撮影4件も成功。独立評価で媒体来歴の追記を求められ、その後の文章確認で媒体一覧の古い撮影日が検出され `writing_failed` で停止 |
| `content-corrected-110` | 媒体一覧を直した後の検証。撮影4件と制御157件・runner契約5件・商品E2E45件は成功。別の検証状態に撮影再利用の基準がなく再撮影され、旧ハッシュ表との不一致を独立評価が検出。追加修正モデルを起動しない設定により `repair_failed` で停止 |

最初の13失敗は、macOSの一時パスの `/var` と `/private/var` の別名差によるものです。通常入口がcheckoutを実パス化する条件に合わせ、`scripts/tests/support/correction.ts` と `scripts/tests/discovery.test.ts` のfixture生成直後に `realpath` を適用しました。該当する73件のテストも成功しました。

ホストの原記録は `~/.local/share/dotagents/migrations/54/acceptance-20260914/` にあります。各runの `verification/state.json`、`capture-1.stdout` と出力媒体、check・review・writingのログから、対象source、撮影時刻、ソースと媒体のサイズ・SHA-256、結果を対応づけられます。記録されたsourceはcommit SHAとは異なります。原文と後の訂正も保持しており、過去のハッシュに合う媒体は各runの撮影出力で照合します。ホスト内の保存先であり、公開GitHubから直接閲覧できる資料ではありません。

## 今回保持する検証

fixture修正では本体の経路検査、期待値、撮影・停止条件を変えず、テストの追加・削除も行いません。既存ケースは、変更したソースに対する古い媒体の再利用、撮影失敗後の評価への進行、中断後の二重実行、別worktreeへの記録混入を検出します。一時ディレクトリの別名をそのまま入力する条件はこのfixtureでは扱わなくなりますが、意図的なsymlinkによるcheckout内への書込みや保存先の転送を拒否するテストは保持します。OS別名の解決自体を新しい受入条件にはしません。独立確認では検出条件の低下は認められませんでしたが、この評価だけでIssue全体の受入完了とはしません。

## 媒体と結果の確認先

`generated/` は次の撮影で更新される配置先です。過去の媒体の固定ハッシュ表を、この配置先の現在値として扱いません。撮影は既存のspec・画面幅・操作・capture条件に従います。

公開担当は撮影後、当該runの撮影ログと配置した媒体のサイズ・SHA-256、対象ソース、検証結果を照合し、対応PRへ掲載します。画像表示・動画再生・配置の確認、同じPR headの `checks`・`verify`、人のレビュー・承認は、それぞれの結果を区別して示します。未実施の段階を完了とはしません。

依頼者は停止後に失敗の修正を指示しました。新しい実測の根拠・上限・結果はdotagents #54と対応PRで管理します。旧runの状態・上限や成功判定を新しい実行へ移しません。今回のGemini確認は依頼者の指定により省略し、独立した内容確認を使います。Gemini実施済み・利用不能とは記録しません。
