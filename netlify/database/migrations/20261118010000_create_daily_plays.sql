-- They're a 10, But... — first Netlify Database migration.
-- Automatically applied during a Netlify deploy.
-- One completed daily lineup per browser ID / date / game version.

CREATE TABLE IF NOT EXISTS public.daily_plays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  play_date date NOT NULL,
  game_version integer NOT NULL CHECK (game_version BETWEEN 1 AND 100),
  player_id uuid NOT NULL,
  ranks smallint[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_daily_play_per_browser UNIQUE (play_date, game_version, player_id),
  CONSTRAINT rankings_are_permutation CHECK (
    array_ndims(ranks) = 1
    AND cardinality(ranks) = 10
    AND ranks @> ARRAY[1,2,3,4,5,6,7,8,9,10]::smallint[]
    AND ranks <@ ARRAY[1,2,3,4,5,6,7,8,9,10]::smallint[]
  )
);

CREATE INDEX IF NOT EXISTS daily_plays_by_date_and_version
  ON public.daily_plays (play_date, game_version);

-- Intentionally no public API or browser database credentials. The Netlify
-- Function is the only application entry point for reading/writing this table.
