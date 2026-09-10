# 要求分離後の文書整理の実測

成果物要求だけを渡した今回の1回では、基本文書への個別実験手順の混入は見つかりませんでした。修正1回・独立評価2回で完了し、親による生成文書の修正は0回です。所要時間とtoken量は増えており、速度・コスト改善を示す結果ではありません。

[成果物Issue #41](https://github.com/thkt/dotagents-workflow-trial/issues/41)と[実験管理Issue #42](https://github.com/thkt/dotagents-workflow-trial/issues/42)を分けました。比較元は[Issue #31](https://github.com/thkt/dotagents-workflow-trial/issues/31)・[PR #32](https://github.com/thkt/dotagents-workflow-trial/pull/32)の保存済み実行です。各構成1回であり、要求分離の因果効果や成功率は推定できません。

## 比較条件

作業コピーは両方とも`2256dcf0c5619553b792963c64bd40b2a1d1be2c`です。初期ファイルhashは`0921eac86c554be4221ba72b9dd5c3d72e27fa818640c7633962da0f89eae221`で一致し、既存の同じnode_modulesを使いました。Astra/high、Codex CLI 0.154.0、Bun 1.4.2も同じです。

Issue #25の成果物に関する目的・問題・完了条件・検証と説明を保持し、目的中の実験についての1文と「試行手順と評価」を除いてIssue #41を新設しました。旧Issueは変更していません。実行時の要求は[requirements.json](requirements.json)に保存しました。

制御側は現行mainの`154f208185680c506d3dc97e0a06ad9be5d7825f`です。前回の`50cc2f5`からログ参照とstream保存処理も変わっています（[差分](controller.diff)）。Issue番号・updatedAt・実行時点も異なり、要求以外をすべて固定した比較ではありません。両checkは成功したため、check失敗ログを渡す修正経路は使いませんでした。

上限は修正2回・独立評価3回・モデル累計20分、check各9分。再試行・上限初期化・自動区間への親の指示や修正はありません。生成文書は旧基準の比較用差分として保持し、現在のmainには適用しません。

## 観測結果

| 観点 | 前回 #31 | 今回 #42 |
| --- | --- | --- |
| 修正 / 独立評価 / ホストcheck | 1 / 2 / 2 | 1 / 2 / 2 |
| 終了 | ready_for_human_review | ready_for_human_review |
| 個別実験手順が混入した基本文書の節 | 1 | 0 |
| 公開前に必要と判断した手直し | 1節 | 0 |
| 親の中継・自動区間への介入 | 0 | 0 |
| 修正担当の共通check重複実行 | 0 | 0 |
| 自動区間の壁時計時間 | 406.835秒 | 466.749秒 |
| モデル累計時間 | 365.153秒 | 409.193秒 |
| input tokens | 721,548 | 775,477 |
| cached input tokens（inputの内数） | 558,976 | 613,504 |
| output tokens | 9,771 | 11,296 |

前回の混入はscripts/README.md「試行の記録と公開」にある、この文書整理の計測・公開・一般化の制約です。今回はREADME.md、DEVELOPMENT.md、scripts/README.mdの全体を確認し、同種の個別実験手順はありません。一般的なCLIの上限・中断手順や過去記録へのリンクは混入に数えていません。手直し数は公開前の親による判断であり、人の承認結果ではありません。前回も今回も生成文書そのものへの手直しは行わず、観測結果を保持しています。

処理はcheck成功 → needs_changes → 修正 → check成功 → acceptedでした。各モデルは初回評価49.124秒、修正282.860秒、最終評価77.209秒です。両ホストcheckは制御54件・E2E18件を実行して成功しました。これは旧作業コピーの検証件数であり、公開用mainの件数とは区別します。

修正担当は局所的な文書・リンク・差分確認だけを行いました。コマンド文字列内の`bun run check`は生成する説明文にも現れるため、文字列件数ではなく実行内容を確認しています。存在しない`.github/workflows/check.yml`の読み取り失敗が1件あり、次に実ファイルを探して確認しています。失敗を除外して成功だけを集計していません。

## 成果物の評価

独立LLMの[初回評価](review-1.json)は既存の不整合を差し戻し、[修正報告](repair-1.json)後の[最終評価](review-2.json)はacceptedでした。親も完了後に以下を確認しました。

| 完了条件 | 最終差分での確認 |
| --- | --- |
| 現在のセットアップ・check・JS/TSの範囲 | READMEの導線からDEVELOPMENTの6段階の表へ辿れ、package.json・設定と整合 |
| 方針の正本と必要な説明・リンク | 検証とレビューはDEVELOPMENT、セットアップはREADME、CLI固有手順はscripts/READMEへ整理 |
| 承認・検証変更説明・画面証拠・実行上限・中断 | 各正本に保持。コードが保証しない中断・検証上の限界も残る |
| 過去の結果と未検証範囲 | evidence/development-history.mdへ整理し、Issue #10/#13の結果・動画へリンク。当時の結果と現行TS版を区別 |
| 通常開発とCLI試行の区別 | READMEの読む順序とscripts/README冒頭に用途を明記 |
| コード・テスト・依存・CI・設定を変更しない | 変更はMarkdown4ファイルだけ |

ローカルリンク59件は有効、`git diff --check`も成功しました（[確認結果](doc-check.json)）。今回の要求に対する修正必須の残件は見つかりませんでした。ただし、READMEの既存のIssue #9/#10への経緯の言及や、CLI例のIssue番号13は残っています。今回の個別実験手順の混入とは分けており、汎用手順としてさらに整理する余地はあります。現在のmainへ採用できる完成文書という判定ではありません。

## 証拠と限界

[生成差分](generated-documents.diff)は未追跡の履歴ファイルも含み、最終作業コピーに対する逆適用checkで再現性を確認しました。[result.json](result.json)に状態・比較指標、[actors.json](actors.json)に実行コマンド・各actorのusageと応答、[conditions.json](conditions.json)に開始条件を保存しています。raw JSONL・checkログ・設定・作業コピーはローカルに保持しています。

[timing.json](timing.json)の準備は94.533秒、自動区間は466.749秒、終了から公開準備開始までは75.748秒です。PR公開・CI完了の時刻はPR本文へ追記します。tokenから料金は計算していません。

今回は入力整理を維持する根拠にはなりますが、LLMの見逃しがなくなった、人のレビューが不要になった、速度や費用が改善したという結論にはなりません。追加のハーネス処理は導入せず、別の実作業でも要求の混入と修正負荷を観測するのが次の候補です。
