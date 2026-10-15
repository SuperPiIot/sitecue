---
trigger: always_on
description: AI-TDD、Vitest、MSW、Playwright、およびテストモックの専門ルール
---

# Testing & AI-TDD Rules

※最優先遵守事項については必ず `.agent/rules/core-rules.md` を参照すること。

## 1. Test Stack & Placement
- **API (`apps/api/`)**: `bun test` (Hono標準テスト)
- **Extension (`apps/extension/`)**: `Vitest` + `React Testing Library` + `happy-dom`
- **Web (`apps/app/`)**: `Vitest` + `React Testing Library` + `jsdom` (React 19環境のため)
- **E2E (`apps/app/e2e/`)**: `Playwright`
- **コロケーション原則**: テストファイルは対象ファイルと同階層に配置すること（`[対象名].test.ts(x)`）。専用の `__tests__` ディレクトリを勝手に作らないこと。

### 【絶対遵守】テスト・Lint実行コマンド規約
ルート直下での裸の `bun test` 実行は厳禁。Next.js の `(dashboard)` 等の丸括弧による zsh エラー（`no matches found`）を防ぐため、**対象パスは必ずシングルクォート（`'...'`）で囲み**、以下の `--filter` コマンドでピンポイント実行すること。
- Web: `bun --filter @sitecue/app test '[対象パス]'`
- Extension: `bun --filter @sitecue/extension test '[対象パス]'`
- Shared: `bun --filter @sitecue/shared test '[対象パス]'`
- API: `bun --filter @sitecue/api test '[対象パス]'`
- Biome検証: `bun x @biomejs/biome check '[対象パス]'`

## 2. Mocking & Async Assertions
- **MSW の活用**: Web側の外部通信は MSW で傍受すること。MSW は0秒レスポンスのため、`isLoading === true` の一瞬の検証は避け、`await screen.findByText(...)` で最終描画結果を検証すること。
- **TestDataBuilder パターン**: 巨大なデータモデル（`Note`, `Draft` 等）をモックする際は `as any` や `Partial` を使わず、必ず `mocks/factories.ts` のファクトリ関数（`createMockNote` 等）を使用すること。

## 3. Test Maintenance & Anti-Patterns
- **逃げ（パッチ修正）の禁止**: テストを通すためだけに `.skip` を付与したり、`expect` を削除したり、`as any` / `// biome-ignore` で握りつぶすことは **厳禁**。仕様変更に合わせてモックや期待値を正しく書き直すこと。
- **スマート・テスト・セレクション**: UI微修正時はテスト実行0件を許容。ロジック変更時は影響する最大3件、リファクタリング時は代表1件を実行してデグレードを確認すること。
