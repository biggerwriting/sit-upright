-- 试用记录：每设备 5 分钟免费
CREATE TABLE trials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text NOT NULL,
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX trials_device_id_idx ON trials (device_id);
CREATE INDEX trials_ip_idx        ON trials (ip);

-- 付费访问 token
CREATE TABLE tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text UNIQUE NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  quota_secs int NOT NULL DEFAULT 3600,
  used_secs  int NOT NULL DEFAULT 0
);
CREATE INDEX tokens_token_idx ON tokens (token);
