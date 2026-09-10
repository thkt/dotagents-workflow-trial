# 検索クリアの実装・検証

要求は[Issue #56](https://github.com/thkt/dotagents-workflow-trial/issues/56)、フロー試行は[Issue #65](https://github.com/thkt/dotagents-workflow-trial/issues/65)。親タスクが初期実装・テスト・撮影を担当した。既存の検索更新処理を再利用し、クリア時にも全件・件数・該当なし表示を更新する。合意した操作・フォーカス方針の変更はない。

## 対象と検証

アプリ・テスト・画像・動画の対象commitは `ec15ad1e874dfc5a5ed2d9410fd99b020270fab0`。親タスクはこのHEADとアプリ・テストの差分がない状態で両動画を再撮影した。画像4枚は同じHEADでhost側checkが生成した同名ファイルとSHA-256が一致した。後続の証拠追加はアプリ・テストを変更しない。

`bun run check`成功（制御80件、Chromium E2E24件）。既存の検索ケースに加え、クリック・hasTouch環境のtap・Enter・Spaceで、絞り込み・該当なし・空白・空入力からのクリアと再検索を確認した。ボタンのフォーカス維持・反復クリア・Shift+Tabでの検索欄復帰、画面遷移なし・件数復帰・表示順も検証した。期待値をアプリの検索処理から生成しておらず、テストの削除・緩和はない。

PC 1280×800・モバイル375×812の画像で、検索欄・クリアボタン・件数・一覧の配置とボタンのフォーカス表示を確認した。

| 状態 | PC | モバイル |
| --- | --- | --- |
| 2件に絞り込み | [画像](product-search-filtered-desktop.png) | [画像](product-search-filtered-mobile.png) |
| クリア後・フォーカス | [画像](product-clear-desktop.png) | [画像](product-clear-mobile.png) |

[PC動画](clear-desktop.mp4) / [モバイル動画](clear-mobile.mp4)

Playwrightで、初期表示→noteを1文字350msで入力→クリア→mugで再検索→mugxで0件→クリアを録画した。各状態で表示件数をassertした。PCはTab・Enter・Shift+Tab・Space、モバイルはhasTouch環境のtapを使用し、文字入力はキーボードイベント。FFmpegでH.264/yuv420pに変換し、モバイルの操作viewportは375×812で、動画ファイルの実寸は374×812。音声なし。実機やOSキーボードの検証ではない。

## フローの観測

レビュー済みmain `1d32141`の制御CLIとAstra/highを使用した。初回check成功→[独立評価のneeds_changes](review-1.json)→[修正担当のneeds_human](repair-1.json)→[human_decision_requiredで停止](initial-result.json)を観測した。初回指摘は検証記録の対象commit不足。修正担当は画像・checkの対応付けを追記したが、動画の撮影対象を確定できず、サーバー起動にも失敗した。成功に読み替えず停止した。

親タスクは停止後に、上記commitで動画を再撮影し、検証記録を整えた。元の状態を初期化せず、残り上限（修正1回・評価2回・モデル累計残り約17分）を新しい実行へ引き継いだ。初回の消費は修正1回・評価1回・モデル178.50秒。自動区間への指摘の中継は0件、停止後の親による撮影・記録の修正介入は1件。要求・権限の変更やユーザーへの追加質問は不要だった。

Firefox・WebKit・実機・スクリーンリーダー・IME変換中は未検証。PR添付と表示確認は公開担当、人による操作の発見しやすさ・読みやすさの確認と承認はPRで行う。この試行は完全な無人進行や、ユーザーの要求変更を伴う回答・再開の成功を示さない。

再開後のcheckも制御80件・E2E24件で成功した。[再評価](review-2.json)は実装・E2E・画像の具体的な不備を認めなかったが、PR添付・表示確認・人の操作確認が未完了としてneeds_changesを返した。[修正担当](repair-2.json)は公開禁止と人の確認要件により変更せずneeds_humanを返し、[再び停止した](resume-result.json)。初回と再開の合計は修正2回・評価2回・モデル255.58秒。accepted、ready_for_human_reviewには到達していない。

評価前の完成条件に公開・人の確認まで含めたため、公開禁止の修正担当へ解消できない指摘が渡った。要求の全文は維持しつつ、評価する段階と公開担当・人へ引き継ぐ条件を区別することが次の改善候補。親は公開担当としてPRを作成し、添付を確認する。制御CLIの成功結果を書き換えたり、人の確認を代行したりしない。
