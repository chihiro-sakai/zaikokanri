# 研修用・共有在庫

架空の6品目を、参加者全員が同じURLから確認・更新する研修用アプリです。画面はCloudflare WorkersのStatic Assets、在庫と直近30件の操作履歴はCloudflare D1に保存します。

## 主な動作

- 在庫を1単位ずつ使用・入庫
- 全参加者で同じ数量を共有（画面は3秒ごとに更新）
- D1の原子的な更新により、同時操作でも在庫を0未満にしない
- 操作者名と変更履歴を記録
- 講師用コードで6品目と履歴を初期化
- 通知・発注・メール送信は実装していません

## 初期値

| 品目 | 在庫 | 基準数 |
|---|---:|---:|
| グローブ（M） | 2箱 | 5箱 |
| マスク | 4箱 | 4箱 |
| 紙コップ | 6袋 | 4袋 |
| ペーパータオル | 8袋 | 3袋 |
| 手指消毒剤 | 3本 | 2本 |
| ティッシュ | 0箱 | 2箱 |

## Cloudflareへ初回公開

前提：Cloudflareアカウント、GitHub上のこのリポジトリ、Node.js 18.17以降を使用します。以下はPowerShellで実行します。

1. 依存関係を準備し、Cloudflareへログインします。

   ```powershell
   npm install
   npx wrangler login
   ```

2. D1データベースを作成します。

   ```powershell
   npx wrangler d1 create zaikokanri-training
   ```

3. 表示された `database_id` を `wrangler.jsonc` の `REPLACE_WITH_D1_DATABASE_ID` と置き換えます。

4. テーブルと架空6品目を登録します。

   ```powershell
   npm run db:remote
   ```

5. まず公開します。

   ```powershell
   npm run deploy
   ```

6. 講師だけが知るリセットコードをCloudflare Secretへ登録します。入力値はGitHubやファイルへ保存されません。この操作で新しいWorkerバージョンが反映されます。

   ```powershell
   npx wrangler secret put RESET_TOKEN
   ```

表示された `workers.dev` URLを複数PCで開けば、同じ在庫を共有できます。参加者にはリセットコードを配りません。

## GitHubからの自動公開

最初の手動公開後、Cloudflare Dashboardの **Workers & Pages → 対象Worker → Settings → Builds → Connect** から `chihiro-sakai/zaikokanri` を接続します。Build commandは空欄、Deploy commandは `npm run deploy` を指定します。Worker名は `zaikokanri-training` に合わせ、D1 binding `DB` とSecret `RESET_TOKEN` が対象Workerに残っていることを確認してください。

## 研修前の確認

- 参加者用PC 2台で同じURLを開き、一方の変更が数秒以内に他方へ出ること
- 在庫0で「1つ使う」が無効になること
- 講師用リセットが初期値へ戻すこと
- Cloudflare Accessなどで、研修参加者だけがURLを開ける状態にすること

このリポジトリは新規実装です。配布教材のHTMLは、利用条件に従いコピーしていません。
