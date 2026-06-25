-- 原子递增 token 用量，防止多 tab 并发时配额被绕过
-- 同时过滤已过期 token（expires_at > now()），防止过期 token 继续消耗配额
CREATE OR REPLACE FUNCTION increment_token_usage(p_token text, p_seconds int)
RETURNS TABLE(quota_secs int, used_secs int) LANGUAGE sql AS $$
  UPDATE tokens
  SET used_secs = LEAST(used_secs + p_seconds, tokens.quota_secs)
  WHERE token = p_token AND expires_at > now()
  RETURNING tokens.quota_secs, tokens.used_secs;
$$;
