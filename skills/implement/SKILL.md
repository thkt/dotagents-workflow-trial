---
name: implement
description: 合意済みGitHub Issueの実装から検証・独立評価・PR作成までをdevelopment CLIで進める。Issue番号またはURLを渡して開発を依頼されたときに使う。要求整理だけ・レビューだけ・マージだけには使わない。
---

# IssueからPR作成

Issue番号またはURLを受け取り、信頼するこのスキルの実体から[development.ts](../../scripts/development.ts)を解決して実行する。対象checkoutは呼び出し元のrepoを使う。Issue未指定なら対象だけを質問する。

```sh
bun /absolute/path/to/trusted/scripts/development.ts 99 --repo /absolute/path/to/target-checkout
```

`$implement 99`の明示的な依頼は実装・検証・commit・push・PR作成までを含む。「公開しない」指定なら`--no-publish`を付ける。自動選択だけを公開許可にしない。対象は現在の試行repoに限る。準備・上限・停止時の記録は[CLI手順](../../scripts/README.md#issueからpr作成)を参照する。

段階をLLMが組み立てず、CLIに任せる。停止時は原因と記録の場所を報告し、既存runの削除や別runへの切り替えで上限を回避しない。CLI結果の`rendered_media_check`が残る場合はPR内の画像表示・動画再生を確認し、未確認ならそう示す。完了時はPR URL・検証結果・残る人のレビューを返す。人の承認・マージは行わない。
