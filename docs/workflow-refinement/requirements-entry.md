# 要求整理からIssue作成を呼び出す入口

ユーザーの「まず、要求整理とissue作成を呼び出せるようにしたい」という依頼に対応する。関連する設計の背景はIssue #50。本変更を#50の全完了とは扱わない。変更用Issueは[#88](https://github.com/thkt/dotagents-workflow-trial/issues/88)。入口の追加と改名をまとめて扱う。

## 実装

既存の`scoping`を`.agents/skills/scoping`の相対symlinkから検出できるようにした。スキル本文は`skills/scoping`の1箇所に維持する。

呼び出しは`$scoping 依頼内容`。調査・必要な対話・合意後のIssue作成までを担当者が行う。既存の保存CLIを使い、Issueの重複確認・本文ファイルでの作成/更新・作成後の読取確認は標準のghを使う。「案だけ」の指定では公開しない。商品実装・修正CLIは起動しない。

利用方法は[README](../../README.md#要求整理とissue作成)、処理の正本は[SKILL.md](../../skills/scoping/SKILL.md)。[公式の検出仕様](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)に沿う。

## 改名前の確認結果

- Codex app-serverの`skills/list`をこのcheckoutで実行し、`clarify-requirements`を1件検出。`scope=repo`、`enabled=true`、実体パスと表示名・defaultPromptを確認した。モデルの起動は行っていない。
- bundled quick_validate.pyで`Skill is valid!`。PyYAMLはuvの隔離環境を利用し、repo依存は増やしていない。
- スキルの相対リンクとsymlinkの解決先、git diff --checkを確認。
- 新規モデルでの質問・回答・Issue公開までの通し試行は未実施。スキル検出の成功と、要求整理の判断品質・GitHub書込の成功は別に扱う。
- コード・依存・CIは変更していない。この確認時点では共通checkは未実行だった（当時のcheckoutにはnode_modulesなし）。

## 呼び出し名

要求と実装範囲を整理してIssueへ渡す役割を表すため、スキル名を`scoping`へ統一した。`$scoping 依頼内容`から要求整理・Issue作成、`$implement Issue番号`から実装・PR作成へ進める。改名では既存の手順・評価基準・保存CLIを維持する。

改名後のquick_validate.py・相対リンク・symlinkの検証は成功。Codex app-serverのskills/listで`scoping`をrepoスコープ・有効状態で1件検出し、旧名は検出されなかった。モデルは起動していない。PR公開時の共通checkとCIの結果はPRに記録する。
