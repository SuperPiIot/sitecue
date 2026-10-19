# 文字数制限の仕様と変更手順

## 1. 現在の文字数制限値
システム全体の保護およびパフォーマンス維持のため、以下の文字数制限が設定されています。

*   **Note (`sitecue_notes`)**: 10,000文字[cite: 6]
*   **Draft (`sitecue_drafts`)**: 100,000文字[cite: 6]
*   **Template (`sitecue_templates`)**: 5,000文字 (boilerplate, weave_prompt の各カラム)[cite: 6]

## 2. 制限値が定義されているファイル（確認場所）
文字数制限は「DB層での防御」と「フロントエンドでのUI制御」を両立するため、以下の3箇所に定義されています。

**【データベース層】**
*   `schema.sql` (各テーブルの `CHECK` 制約として定義されています)[cite: 6]

**【フロントエンド層】**
*   **App Basecamp**: `apps/app/src/constants/limits.ts` ( `APP_LIMITS` オブジェクト)[cite: 6]
*   **Extension**: `apps/extension/src/constants/limits.ts` ( `APP_LIMITS` オブジェクト)[cite: 6]

## 3. 制限値を変更する際の作業手順
フロントエンドとデータベースで不整合が起きるのを防ぐため、制限値を変更する際は必ず以下の手順ですべての箇所を同期させてください。

### Step 1: データベース制約の更新 (マイグレーション)
1. `supabase/migrations/` 配下に新しいマイグレーションファイルを作成します。
2. 既存の `CHECK` 制約を削除（`DROP CONSTRAINT`）し、新しい制限値で制約を追加（`ADD CONSTRAINT`）するSQLを記述します。
3. ローカルDBにマイグレーションを適用し、`supabase db dump --local > schema.sql` を実行してスキーマ情報を最新化します。

### Step 2: 定数ファイルの更新
以下の2つのファイルを開き、`APP_LIMITS` 内の該当する数値を新しい制限値に書き換えます。
*   `apps/app/src/constants/limits.ts`[cite: 6]
*   `apps/extension/src/constants/limits.ts`[cite: 6]

### Step 3: 動作確認
各入力コンポーネント（`NoteEditor`, `DraftEditor`, `NoteInput` 等）は上記の定数ファイル（`APP_LIMITS`）を動的に参照して文字数カウンターや保存ボタンの無効化を行っています[cite: 6]。
そのため、個別のUIコンポーネントのコードを修正する必要はありません。定数を変更後、画面上で新しい上限値に合わせて警告表示や保存ブロックが正しく機能するか確認してください。
