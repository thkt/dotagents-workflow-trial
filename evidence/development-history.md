# 開発手順・検証追加の履歴

文書整理前のDEVELOPMENT.mdから、初期整備の実測とIssue #9〜#23の追加記録を保存したものです。「追加します」「現在」や件数・成功の記述は各Issue当時の状態であり、現行版の再実測や今後の作業指示を意味しません。この履歴は現行方針に合わせて更新しません。

現行の案内は[README](../README.md)、レビュー・開発方針は[DEVELOPMENT.md](../DEVELOPMENT.md)、CLIの実行・中断手順は[scripts/README.md](../scripts/README.md)を参照してください。
当時のJS版での実モデル試行と未検証範囲は[Issue #10](issue-10/evaluation.md)と[Issue #13](issue-13/evaluation.md)にあります。以下のTS移行後の制御テストや静的検証の記録とは区別します。

## 初期整備で確認した範囲

[Issue #1](https://github.com/thkt/dotagents-workflow-trial/issues/1)の試行結果です。各PRには対象commitとCIへのリンクがあります。

| 観点 | 証拠と結果 |
| --- | --- |
| 同じ検証の実行 | [PR #2](https://github.com/thkt/dotagents-workflow-trial/pull/2)でローカル・Actionsが成功。別checkoutと新しいnode_modulesでもfrozen lockfileによるセットアップと検証が成功。 |
| Appと人の主体分離 | [PR #3](https://github.com/thkt/dotagents-workflow-trial/pull/3)をAppが作成し、thkt本人がApproveした。 |
| 未承認・古い承認 | PR #3でCI成功・未承認はBLOCKED、承認後はCLEAN、差分更新で旧承認がDISMISSED、再承認後はCLEANとなった。 |
| CI失敗 | [PR #4](https://github.com/thkt/dotagents-workflow-trial/pull/4)は人が試行として承認してもBLOCKED。 |
| 必須チェック欠落 | [PR #5](https://github.com/thkt/dotagents-workflow-trial/pull/5)は別名チェックが成功し、人が試行として承認してもBLOCKED。 |
| スキップの不足と修正 | [PR #6](https://github.com/thkt/dotagents-workflow-trial/pull/6)ではverify自体がSKIPPEDでも承認後CLEANとなった。[PR #7](https://github.com/thkt/dotagents-workflow-trial/pull/7)で判定を分離し、checks SKIPPEDからverify FAILUREとなること、通常時に両方成功することを実測した。 |

検証用PR #4〜#6はマージせず閉じました。マージAPIを試して阻止させた実験ではなく、GitHubのマージ可否状態を読み取った結果です。

workflow全体のキャンセル、runner障害、あらゆる検証定義の改変を網羅的に実測したわけではありません。
Issue #9で商品一覧と実ブラウザーE2Eを追加しています。初期整備時点の上記証拠は、商品一覧の動作品質、テストの十分性、LLMの監査品質、費用対効果を評価したものではありません。
初期整備の完了は、これらを含む開発フロー全体の完成を意味しません。

## Issue #9で追加する検証

商品一覧の固定データと表示順を実際の画面で確認するため、既存の `check` のlint・複雑度検証の後にPlaywright E2Eを追加します。追加する開発依存関係は `@playwright/test` とその依存パッケージです。ブラウザーの準備はローカル・CIとも `bun run setup:e2e` を使います。

既存のOxlintルール、Biomeの複雑度上限15、検証対象の指定を変更しません。CIのhead commit検証、権限、時間上限、キャンセル方針、`verify` の成功条件も維持します。E2Eやブラウザー準備の失敗も `checks` の失敗になり、既存の `verify` に伝わります。既存検証から検出できなくなるケースはありません。

E2Eが検出するのは、固定4商品の欠落・余分な行・名前とコードの誤りや対応違い・順序違い、見出しや表構造の欠落、検証した画面幅での非表示・横はみ出し、検索入力の追加です。画面の読みやすさ全般、他ブラウザーや実機での表示、支援技術による読み上げは保証しません。スクリーンショットと差分による人の確認が必要です。再現手順と画像の保存先はREADMEに記録します。

今回の追加は人がレビューする初期資産の準備です。検索実装、ハーネス実装、障害注入や比較実験の成績には含めません。対象commitでの検証・画像の取得、独立評価、PRへの証拠添付と人の承認は、それぞれ実施結果を区別して記録してください。

## Issue #10で変更する検証

基準commit `f97b76d0129ec33ee26544fe408ed9e62ec26b8f` の一覧HTML/CSS、固定4商品、Bun配信、Playwright設定と一覧E2E、共通検証コマンド・依存関係・CIを再利用します。検索欄と行の表示切り替え、検索用JavaScriptの配信を追加します。

一覧E2Eの「検索入力がないこと」だけを、Issue #10に合わせて「ラベルで特定できる検索欄が見えること」に変更します。検索入力の追加は検出すべき不具合ではなくなります。それ以外の全4商品の名前・コード・対応・順序、見出し・表構造、可視性・画面内表示、横はみ出しの検証を維持します。

検索E2Eは合意した各入力と期待結果、キーボード操作、該当なしと全削除からの復帰・再検索を実ブラウザーで確認します。元の4商品が復帰することを画面から確認し、実装の内部データや検索関数を期待値として使いません。同じ条件の単体テストは追加しません。共通の `bun run check`、lint・複雑度上限、2画面幅、再試行なし、CIの条件は変更しません。

人には、検索ラベルとフォーカスの見やすさ、絞り込み前後・該当なしの読みやすさ、検証変更がIssueの要求を満たすかを差分と画像で確認してほしいです。画像の再現手順はREADMEに記録します。Firefox・WebKit・実機・支援技術・日本語IMEの変換途中の動作は未検証です。ローカル検証の成功と、最新commitでのCI・独立評価・人の承認・フロー評価の結果は分けて記録してください。

## Issue #13で追加する検証

失敗から修正・再評価へ接続するCLIの制御テストを、共通checkへ追加します。既存の静的検証・18件のE2E・CI判定を維持し、検出できなくなるケースはありません。テストは実際のCLI入口と一時Git作業コピーを使います。実モデルによる修正・評価の成績とは区別します。[実行方法・結果・制約](../scripts/README.md)を参照してください。

## Issue #15で追加する検証

制御コードと制御テストをTypeScriptへ移し、共通checkへ`tsc --noEmit`によるstrictな型検査を追加します。商品アプリ・bun test・Playwright・既存の検証条件は維持します。追加する開発依存関係は固定版のTypeScriptとBun型定義です。既存の検出条件を減らさず、実行状態・結果・設定の型の不整合を検査できるようにします。Issue #13の実モデル記録は当時のJS版の証拠として残し、TS版で再実測したとは扱いません。

## Issue #17で追加する検証

実際の制御CLIをcheck・repair・reviewの途中で中断し、SIGINT/SIGTERMでの子孫の書き込み停止、並行起動と再実行の拒否、予約回数の保持を検証します。SIGKILLでは再実行拒否だけを確認し、子の自動停止を保証しません。完了後のIssue変更も古い成功を無効にすることを確認します。既存の検証条件は減らさず、模擬コマンドを使った回帰テストを追加します。モデルの判断品質は今回の評価対象外です。

## TypeScriptの書き方（Issue #19）

`scripts/**/*.ts`の書式はOxfmt 0.66.0に統一します。`bun run format`で整形し、`bun run format:check`で書き換えずに確認します。共通`bun run check`にも書式確認を含めるため、CIでも同じ条件を適用します。2スペース・single quote・セミコロン・行幅100を基本とし、importの並べ替えは有効にしません。商品アプリのJSや過去のevidenceは今回の整形対象外です。

Oxlintは既存のcorrectness検査に加え、同じTS範囲で次をerrorにします。

| ルール | 揃える書き方 |
| --- | --- |
| `typescript/consistent-type-imports` | 型だけに使うものは`import type` |
| `typescript/no-explicit-any` | 明示的な`any`を使わず、必要なら`unknown`から絞り込む |
| `typescript/no-non-null-assertion` | `!`で省略せず、存在条件を確認する |
| `prefer-const` / `no-var` | 再代入しなければ`const`、再代入には`let` |
| `eqeqeq` | `===` / `!==`で比較する |
| `curly` | 制御構文の本体を波括弧で囲む |

既存のstrict型検査はtsc、認知的複雑度の上限15はBiomeの`noExcessiveCognitiveComplexity`だけで検査します。OxfmtとOxlintに型の整合性や要求達成まで保証させるものではありません。ルールの追加・緩和は検証定義の変更として、目的と検出力への影響をPRで説明します。

既存の検出条件を削らず、7ルールと書式検査を追加しました。違反を含む一時TSで7ルールの拒否と書式検査の失敗、整形後の書式検査成功を確認しています。一時ファイルは削除し、型検査・制御26件・E2E18件を維持します。

設定の詳細は[Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html)と[Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config.html)を参照してください。

## 型情報を使う検証（Issue #21）

Oxlintの`typeAware`を有効にし、固定版`oxlint-tsgolint` 7.0.2001を追加します。TSには`no-floating-promises`（`ignoreVoid: false`）、`no-misused-promises`、`await-thenable`、`no-unsafe-assignment` / `call` / `member-access` / `argument` / `return`をerrorで適用します。既存correctnessの型情報を必要とするルールも有効になります。tscは維持し、`noUncheckedIndexedAccess`を追加します。

現在の診断ではJSON由来のanyと未確認のCLI引数が中心でした。Promiseの待ち忘れが多数見つかったという結果ではありません。設定と保存状態は`input.ts`で必要な形・値を確認してから使います。テスト側はJSONをunknownのレコードとして扱い、期待値を独立に検証します。型アサーション・明示的any・disableで回避しません。

不正な設定、予約・消費量・イベント・結果の記録、CLI引数不足の回帰テストを追加しました。正常時の進行・上限・状態ファイル形式と既存テストは維持します。不正入力の拒否は強まりますが、保存履歴の真正性や完全な意味的一貫性まで保証しません。違反を含む一時TSで8ルールと配列アクセスの検出を確認し、一時ファイルを削除しました。

Oxfmt、Biomeの認知的複雑度15、既存の静的検証とE2Eは維持し、既存の検出条件を削りません。型付きlintの仕組みは[公式ドキュメント](https://oxc.rs/docs/guide/usage/linter/type-aware)を参照してください。

## テストの実行完了（Issue #23）

`bun run test:control`と`bun run test:e2e`は、`scripts/test.ts`から既存runnerを実行します。`only`はBunの`CI=true`とPlaywrightの`--forbid-only`で拒否します。ローカルの共通checkでも同じ条件になります。

runnerが成功終了した後、BunのJUnitルート集計とPlaywrightのJSON statsを確認します。テスト0件・未実行件数が0以外・必要な集計の欠落は失敗です。skip/todo/条件付きskip/fixmeの指定方法をソースから列挙せず、実行結果で判断します。毎回`artifacts`内に新しい保存先を作り、過去のレポートを再利用しません。runnerの失敗時にはレポート判定へ進みません。

Bun 1.4.2の固定されたJUnit集計形式だけを読み取り、汎用XML解析は行いません。Playwright 1.63.0は標準JSON出力を使います。runnerの更新時は形式と判定の回帰テストを確認します。追加依存関係はありません。

通常のテスト実行・only・skip・todo/fixme・条件付きskip・失敗・0件を実runnerで回帰検証します。現在の制御34件とE2E18件を維持し、実行完了の判定を検証する20件を追加しました。テストと無関係な同名プロパティやimportを禁止するOxlintルールは使いません。

ローカルの調査で対象を絞る場合は`bun test`やPlaywright CLIを直接使い、提出前には引数なしの`bun run check`を実行します。意図的な除外は対象・理由・失う検出条件・代替証拠・復帰条件をIssue/PRで示し、検証定義の変更として人が承認します。現在は除外を追加していません。

任意の条件分岐によるテスト未登録、テスト削除、CIの実行対象変更まで保証するものではありません。検証対象と検証定義のレビューを継続します。
