DO $$
DECLARE
  -- 1. ここに対象アカウントのメールアドレスを入力してください
  v_target_email text := 'claudeslogos@gmail.com';

  -- 2. 作成先ページのURLとスコープ（必要に応じて変更可能）
  v_target_url text := 'github.com/taikiwt/sitecue/issues';
  v_target_scope text := 'exact';

  -- 3. 作成件数（PCの35件、モバイルの20件を超える45件）
  v_count integer := 45;

  v_user_id uuid;
BEGIN
  -- メールアドレスからユーザーIDを特定
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_target_email;

  -- ユーザーが見つからない場合は安全に中断
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'メールアドレス「%」のユーザーが見つかりませんでした。アドレスが正しいか確認してください。', v_target_email;
  END IF;

  -- ノートを45件一括生成
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
    now() - ((45 - i) || ' minutes')::interval,
    now() - ((45 - i) || ' minutes')::interval,
    ARRAY['dummy', 'test']
  FROM generate_series(1, v_count) AS i;

  RAISE NOTICE 'ユーザー「% (ID: %)」向けに % 件のダミーノートを作成しました。', v_target_email, v_user_id, v_count;
END $$;