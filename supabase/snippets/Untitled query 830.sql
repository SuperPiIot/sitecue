-- ====================================================================
-- ダミーノート一括生成スクリプト（スクロール連動・遅延フェッチ検証用）
-- ====================================================================
DO $$
DECLARE
  v_target_email text := 'claudeslogos@gmail.com';
  -- 先ほどスクリーンショットにあったページをデフォルトに設定（必要に応じて変更可）
  v_target_url text := 'github.com/taikiwt/sitecue/issues'; 
  v_target_scope text := 'exact'; -- 'exact' または 'inbox' / 'domain'
  v_count integer := 45; -- PC初期35件 / モバイル初期20件 を確実に超える45件
BEGIN
  -- 最新の登録ユーザーIDを自動取得
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'ユーザーが見つかりません。先にサインアップまたはログインしてください。';
  END IF;

  INSERT INTO public.sitecue_notes (
    user_id,
    url_pattern,
    scope,
    note_type,
    content,
    is_pinned,
    is_resolved,
    sort_order,
    created_at,
    updated_at,
    tags
  )
  SELECT
    v_user_id,
    v_target_url,
    v_target_scope,
    CASE (i % 3)
      WHEN 0 THEN 'info'
      WHEN 1 THEN 'alert'
      ELSE 'idea'
    END,
    format(
      E'# [Dummy] Test Note %s\nスクロール連動フェッチ検証用のダミーノートです（Item #%s）。\n2行目・3行目のプレビュー表示と、スクロール追加取得をテストしています。',
      i,
      i
    ),
    false,
    false,
    i * 1.0,
    -- 新しい順に並ぶよう作成日時をずらして生成
    now() - ((45 - i) || ' minutes')::interval,
    now() - ((45 - i) || ' minutes')::interval,
    ARRAY['dummy', 'test']
  FROM generate_series(1, v_count) AS i;

  RAISE NOTICE '% 件のダミーノートを作成しました (User: %, URL: %)', v_count, v_user_id, v_target_url;
END $$;