# scopingからimplementへの通し試行（Issue #90）

2026-09-12、main `be7b8a214e58aa781677d7cd06a3f74494d78363` のスキルとCLIを使用した。
成果物要求は[Issue #90](https://github.com/thkt/dotagents-workflow-trial/issues/90)。本記録はフロー検証の結果であり、成果物要求を変更しない。

## 要求整理

このCodexチャットでscopingを使用し、題材の選択と具体的な完了条件への回答を待った。ユーザーが「Escキーで検索をクリアする」を選択後、現行Chromiumで既に標準動作として成立することを実測した。README・E2Eへの追加、対応範囲、完了条件を提示し、「この範囲でIssue作成からPRまで進める」と合意した。

既存discovery CLIで根拠・合意・全基準の評価を保存し、gate後にIssueを公開・再読した。Issue参照を保存・再評価し、調査をarchiveした。scopingの検出だけでなく、質問・回答待ち・合意・Issue作成まで実行できた。ただし会話履歴なしの担当者による試行や、スキルの自動選択は検証していない。

## 実装入口

implementスキルを読み、既存の `bun scripts/development.ts 90 --repo /Users/thkt/.codex/worktrees/8332/dotagents-workflow-trial` を実行した。標準のモデル累計20分、修正2回・独立評価2回等の上限を変更していない。

初回担当は商品本体の実装を維持し、既存E2Eへ18件、README、撮影定義、証拠文書を追加した。ホスト撮影4件・共通check（制御110件、E2E 102件）は成功した。

## 確認できた問題

1回目の独立評価は要求・E2Eの整合を認めたが、証拠文書が撮影待ちのままである点を差し戻した。修正担当がcapture-1の実ログ・媒体ハッシュを記録すると、ホストがcapture-2を実行して動画4点を置き換えた。2回目の独立評価は、現在の動画とcapture-1のハッシュの不一致を指摘した。2回目の修正でcapture-2へ更新した後もcapture-3が実行された。

`hasOnlyMarkdownChanges` は最初のHEADからの累積差分と未追跡ファイルを判定する。元のテスト・撮影定義の変更が残るため、証拠記録だけを直しても `verifyHost` は再撮影する。撮影した動画のバイト列が変わり、直前に整えた来歴が古くなる。これは要求やEsc操作の不足ではなく、撮影と証拠記録を確定する順序の問題である。

次の修正では、撮影に影響する変更と証拠記録だけの更新を区別し、同じ撮影対象に対する媒体・来歴を維持したまま最終checkと独立評価へ渡す条件を定める。単に再試行の上限を増やして解決したとは扱わない。本試行中の制御コードは変更していない。この結果を受けたCLI修正は[Issue #91](https://github.com/thkt/dotagents-workflow-trial/issues/91)で扱う。

## 最終結果

既存CLIは終了コード1、`execution_limit`で停止した。状態はrepair=2、review=2、checks=3、active=null。3回目の共通checkも制御110件・E2E 102件が成功したが、最終成果物への独立評価の承認は得られておらず、PR公開には進んでいない。上限のリセットや別名での再実行はしていない。

本記録をCLI修正の根拠としてリポジトリに保存する。成果物の変更は実行記録内の隔離checkoutに保持され、元のmainの商品実装には取り込んでいない。

## 記録の所在

- 実行記録・隔離checkout: `/Users/thkt/.local/share/dotagents/development/d3d15c767753bba6/90/`
- 制御状態: 同ディレクトリの `verification/state.json`
- 指摘: `verification/review-1.stdout`、`verification/review-2.stdout`
- 撮影とcheck: `verification/capture-*`、`verification/check-*`
- 要求整理: `/Users/thkt/.local/share/dotagents/contexts/github.com/thkt/dotagents-workflow-trial/work/escape-scoping-20260912`

これらは同一ホストの保存先であり、他環境から開ける共有URLとは扱わない。成果物・上限・ログを保持し、停止した実行を別名や状態削除で再試行しない。
