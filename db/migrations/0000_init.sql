-- Skema PostgreSQL v2 untuk aggregator esports MLBB.
-- Turunan dari riset/mlbb-schema-postgres.sql (v1, 16 Nov 2026). Perubahan terhadap v1 ada di
-- mlbb-spesifikasi-teknis.md bagian 5.3.
-- Prinsip: (1) master hero/item/emblem/talent berversi per patch, (2) setiap game menaut ke patch
-- beserta asal patch-nya, (3) setiap baris punya asal data, dan kolom yang diisi admin tidak boleh
-- ditimpa sinkronisasi (field_override), (4) angka turunan dihitung lewat view, tidak disimpan.
-- Diuji pada PostgreSQL 16 (dijalankan ulang 17 Nov 2026, termuat bersih). Dev, CI, dan produksi memakai 16.
-- Menjadi db/migrations/0000_init.sql (spesifikasi teknis bagian 2.5). Tabel Better Auth (user, session,
-- account, verification) dibuat terpisah lewat migrasi berikutnya, bukan di berkas ini.

-- ============ Referensi umum ============
CREATE TABLE data_source (
  id          smallserial PRIMARY KEY,
  code        text UNIQUE NOT NULL,          -- 'rone', 'liquipedia', 'manual', 'computed'
  attribution text,                          -- teks atribusi yang wajib ditampilkan
  notes       text
);
INSERT INTO data_source (code, attribution) VALUES
  ('rone',       'Data via Rone Arena API (ridwaanhall / RoneAI). Data game milik Moonton.'),
  ('liquipedia', 'Data dari Liquipedia, lisensi CC-BY-SA 3.0.'),
  ('manual',     NULL),
  ('computed',   NULL);

-- ============ Patch (versi game) ============
CREATE TABLE patch (
  id            serial PRIMARY KEY,
  version       text NOT NULL,               -- '2.2.16', '1.9.99B'
  server        text NOT NULL DEFAULT 'original' CHECK (server IN ('original','advanced','tournament')),
  released_on   date,                        -- dipakai menebak patch bila sumber tidak menyebut
  notes_url     text,
  UNIQUE (version, server)
);
CREATE INDEX patch_released_idx ON patch (released_on);

-- ============ Master berversi per patch ============
-- Entitas stabil (id dari game) dipisah dari baris atribut per patch.
CREATE TABLE hero (
  id          integer PRIMARY KEY,           -- hero_id dari game
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL
);
CREATE TABLE hero_version (
  hero_id     integer NOT NULL REFERENCES hero(id),
  patch_id    integer NOT NULL REFERENCES patch(id),
  roles       text[],
  lanes       text[],
  stats       jsonb NOT NULL DEFAULT '{}',
  skills      jsonb,
  image_path  text,                          -- salinan di penyimpanan sendiri, bukan hotlink
  is_disabled boolean NOT NULL DEFAULT false,
  source_id   smallint REFERENCES data_source(id),
  PRIMARY KEY (hero_id, patch_id)
);

CREATE TABLE item (
  id          integer PRIMARY KEY,
  name        text NOT NULL
);
CREATE TABLE item_version (
  item_id     integer NOT NULL REFERENCES item(id),
  patch_id    integer NOT NULL REFERENCES patch(id),
  category    text,
  price       integer,
  stats       jsonb NOT NULL DEFAULT '{}',
  passive     text,
  image_path  text,
  source_id   smallint REFERENCES data_source(id),
  PRIMARY KEY (item_id, patch_id)
);

CREATE TABLE emblem (
  id          integer PRIMARY KEY,
  name        text NOT NULL
);
CREATE TABLE emblem_version (
  emblem_id   integer NOT NULL REFERENCES emblem(id),
  patch_id    integer NOT NULL REFERENCES patch(id),
  stats       jsonb NOT NULL DEFAULT '{}',
  image_path  text,
  source_id   smallint REFERENCES data_source(id),
  PRIMARY KEY (emblem_id, patch_id)
);

CREATE TABLE talent (
  id          integer PRIMARY KEY,
  name        text NOT NULL
);
CREATE TABLE talent_version (
  talent_id   integer NOT NULL REFERENCES talent(id),
  patch_id    integer NOT NULL REFERENCES patch(id),
  tier        smallint,
  description text,
  image_path  text,
  source_id   smallint REFERENCES data_source(id),
  PRIMARY KEY (talent_id, patch_id)
);

CREATE TABLE battle_spell (
  id          integer PRIMARY KEY,
  name        text NOT NULL,
  image_path  text
);

-- Battlefield sebagai tabel master (bukan enum), karena daftarnya berubah per patch atau musim.
CREATE TABLE battlefield (
  id             serial PRIMARY KEY,
  name           text UNIQUE NOT NULL,       -- Healing Turtle, Revealing Wisps, Golden Turret, ...
  description    text,
  image_path     text,
  since_patch_id integer REFERENCES patch(id),
  until_patch_id integer REFERENCES patch(id),
  is_active      boolean NOT NULL DEFAULT true
);

CREATE TABLE patch_change (
  id          bigserial PRIMARY KEY,
  patch_id    integer NOT NULL REFERENCES patch(id),
  entity_type text NOT NULL CHECK (entity_type IN ('hero','item','emblem','talent','battlefield','system')),
  entity_id   integer,
  field       text,
  old_value   text,
  new_value   text,
  raw_text    text
);

-- ============ Kompetisi ============
CREATE TABLE team (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  full_name   text,
  region      text,
  logo_path   text
);

CREATE TABLE player (
  id          serial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  nickname    text NOT NULL,
  real_name   text,
  nationality text,
  role        text,
  photo_path  text
);
CREATE TABLE player_alias (                  -- nama pemain di sumber bisa berbeda dari roster
  alias       text NOT NULL,
  source_id   smallint NOT NULL REFERENCES data_source(id),
  player_id   integer NOT NULL REFERENCES player(id),
  PRIMARY KEY (alias, source_id)
);
CREATE TABLE roster_membership (
  team_id     integer NOT NULL REFERENCES team(id),
  player_id   integer NOT NULL REFERENCES player(id),
  role        text,
  from_date   date NOT NULL,
  to_date     date,
  PRIMARY KEY (team_id, player_id, from_date)
);

CREATE TABLE tournament (
  id               serial PRIMARY KEY,
  slug             text UNIQUE NOT NULL,
  name             text NOT NULL,            -- 'MPL ID Season 18'
  league_code      text,                     -- 'id', 'ph', 'my', 'kh' (kode liga di Rone)
  region           text,
  tier             text,
  start_date       date,
  end_date         date,
  bans_per_team    smallint NOT NULL DEFAULT 5 CHECK (bans_per_team BETWEEN 0 AND 5),
  default_patch_id integer REFERENCES patch(id)
);
CREATE TABLE tournament_stage (
  id            serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournament(id),
  name          text NOT NULL,               -- 'Regular Season', 'Playoffs'
  stage_order   smallint NOT NULL DEFAULT 0,
  patch_id      integer REFERENCES patch(id)
);
CREATE TABLE standing (
  stage_id    integer NOT NULL REFERENCES tournament_stage(id) ON DELETE CASCADE,
  team_id     integer NOT NULL REFERENCES team(id),
  position    smallint,
  series_won  smallint, series_lost smallint,
  games_won   smallint, games_lost  smallint,
  points      smallint,
  source_id   smallint REFERENCES data_source(id),
  fetched_at  timestamptz,
  PRIMARY KEY (stage_id, team_id)
);

-- ============ Seri dan game ============
CREATE TABLE series (
  id             bigserial PRIMARY KEY,
  slug           text NOT NULL,              -- kosmetik; yang dipakai server hanya id
  tournament_id  integer NOT NULL REFERENCES tournament(id),
  stage_id       integer REFERENCES tournament_stage(id),
  round_label    text,                       -- 'Week 3 Day 2', 'Upper Final'
  team_a_id      integer NOT NULL REFERENCES team(id),
  team_b_id      integer NOT NULL REFERENCES team(id),
  best_of        smallint NOT NULL CHECK (best_of IN (1,2,3,5,7)),
  score_a        smallint NOT NULL DEFAULT 0,
  score_b        smallint NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
  start_at       timestamptz,                -- selalu UTC
  winner_team_id integer REFERENCES team(id),
  source_id      smallint REFERENCES data_source(id),
  fetched_at     timestamptz,
  frozen_at      timestamptz,                -- setelah diisi, sinkronisasi tidak lagi menyentuh seri ini
  CHECK (team_a_id <> team_b_id),
  CHECK (score_a + score_b <= best_of),
  CHECK (winner_team_id IS NULL OR winner_team_id IN (team_a_id, team_b_id))
);
CREATE TABLE series_external_id (
  series_id   bigint NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  source_id   smallint NOT NULL REFERENCES data_source(id),
  external_id text NOT NULL,
  PRIMARY KEY (source_id, external_id)
);
CREATE INDEX series_start_idx ON series (start_at);
CREATE INDEX series_tournament_idx ON series (tournament_id);
CREATE INDEX series_status_idx ON series (status);

CREATE TABLE game (
  id             bigserial PRIMARY KEY,
  series_id      bigint NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  game_no        smallint NOT NULL CHECK (game_no BETWEEN 1 AND 7),
  patch_id       integer REFERENCES patch(id),
  patch_origin   text CHECK (patch_origin IN
                 ('source','manual','stage_default','tournament_default','guessed_by_date')),
  battlefield_id integer REFERENCES battlefield(id),
  duration_sec   integer CHECK (duration_sec IS NULL OR duration_sec > 0),
  blue_team_id   integer REFERENCES team(id),
  winner_team_id integer REFERENCES team(id),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','finished')),
  finished_at    timestamptz,
  vod_url        text,
  source_id      smallint REFERENCES data_source(id),
  fetched_at     timestamptz,
  UNIQUE (series_id, game_no),
  CHECK ((patch_id IS NULL) = (patch_origin IS NULL))
);
CREATE INDEX game_patch_idx ON game (patch_id);
CREATE INDEX game_battlefield_idx ON game (battlefield_id);

-- game_no tidak boleh melebihi best_of seri.
CREATE FUNCTION game_check_best_of() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bo smallint;
BEGIN
  SELECT best_of INTO bo FROM series WHERE id = NEW.series_id;
  IF NEW.game_no > bo THEN
    RAISE EXCEPTION 'game_no % melebihi best_of % pada seri %', NEW.game_no, bo, NEW.series_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER game_best_of_trg BEFORE INSERT OR UPDATE OF game_no, series_id ON game
  FOR EACH ROW EXECUTE FUNCTION game_check_best_of();

-- Draft: ban dan pick. Urutan (order_no) boleh kosong.
-- Pick dari sumber otomatis, ban dari admin (atau Liquipedia bila kelak tersedia).
CREATE TABLE draft_action (
  id          bigserial PRIMARY KEY,
  game_id     bigint NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  team_id     integer NOT NULL REFERENCES team(id),
  action_type text NOT NULL CHECK (action_type IN ('ban','pick')),
  hero_id     integer NOT NULL REFERENCES hero(id),
  player_id   integer REFERENCES player(id),         -- hanya untuk pick
  order_no    smallint CHECK (order_no BETWEEN 1 AND 20),
  source_id   smallint REFERENCES data_source(id),
  UNIQUE (game_id, hero_id),                         -- satu hero hanya sekali per game
  CHECK (action_type = 'pick' OR player_id IS NULL)
);
CREATE UNIQUE INDEX draft_action_order_uq ON draft_action (game_id, order_no) WHERE order_no IS NOT NULL;
CREATE INDEX draft_action_game_idx ON draft_action (game_id, team_id, action_type);
CREATE INDEX draft_action_hero_idx ON draft_action (hero_id, action_type);

CREATE TABLE game_player_stat (
  game_id         bigint NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  team_id         integer NOT NULL REFERENCES team(id),
  player_id       integer NOT NULL REFERENCES player(id),
  hero_id         integer NOT NULL REFERENCES hero(id),
  role            text,
  kills           smallint CHECK (kills >= 0),
  deaths          smallint CHECK (deaths >= 0),
  assists         smallint CHECK (assists >= 0),
  gold            integer  CHECK (gold >= 0),
  damage_dealt    integer  CHECK (damage_dealt >= 0),
  damage_taken    integer  CHECK (damage_taken >= 0),
  tower_damage    integer  CHECK (tower_damage >= 0),
  war_participation_pct numeric(5,2)                 -- angka resmi dari layar hasil, diisi admin
                  CHECK (war_participation_pct BETWEEN 0 AND 100),
  is_mvp          boolean NOT NULL DEFAULT false,
  emblem_id       integer REFERENCES emblem(id),
  battle_spell_id integer REFERENCES battle_spell(id),
  source_id       smallint REFERENCES data_source(id),
  fetched_at      timestamptz,
  PRIMARY KEY (game_id, player_id),
  UNIQUE (game_id, hero_id)
);
CREATE INDEX gps_player_idx ON game_player_stat (player_id);
CREATE INDEX gps_hero_idx ON game_player_stat (hero_id);

CREATE TABLE game_player_talent (
  game_id   bigint NOT NULL,
  player_id integer NOT NULL,
  talent_id integer NOT NULL REFERENCES talent(id),
  PRIMARY KEY (game_id, player_id, talent_id),
  FOREIGN KEY (game_id, player_id) REFERENCES game_player_stat(game_id, player_id) ON DELETE CASCADE
);
CREATE TABLE game_player_item (
  game_id        bigint NOT NULL,
  player_id      integer NOT NULL,
  slot_no        smallint NOT NULL CHECK (slot_no BETWEEN 1 AND 6),
  item_id        integer NOT NULL REFERENCES item(id),
  purchase_order smallint,                           -- boleh kosong: sumber sering tidak punya
  PRIMARY KEY (game_id, player_id, slot_no),
  FOREIGN KEY (game_id, player_id) REFERENCES game_player_stat(game_id, player_id) ON DELETE CASCADE
);

-- Statistik objektif tim (opsional, tidak tersedia merata)
CREATE TABLE game_team_stat (
  game_id   bigint NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  team_id   integer NOT NULL REFERENCES team(id),
  towers    smallint, lords smallint, turtles smallint,
  PRIMARY KEY (game_id, team_id)
);

-- ============ Asal data, override manual, audit ============
-- Sinkronisasi tidak boleh menimpa kolom yang tercatat di sini.
CREATE TABLE field_override (
  id          bigserial PRIMARY KEY,
  table_name  text NOT NULL,
  row_key     text NOT NULL,                         -- mis. 'game:123' atau 'game_player_stat:123:45'
  column_name text NOT NULL,
  value       jsonb,
  edited_by   text NOT NULL,
  edited_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, row_key, column_name)
);

CREATE TABLE ingest_log (
  id          bigserial PRIMARY KEY,
  source_id   smallint NOT NULL REFERENCES data_source(id),
  endpoint    text NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  status_code integer,
  payload     jsonb,                                 -- respons mentah, untuk audit dan olah ulang
  error       text
);
CREATE INDEX ingest_log_time_idx ON ingest_log (fetched_at);

CREATE TABLE admin_user (
  id          serial PRIMARY KEY,
  email       text UNIQUE NOT NULL,                  -- daftar izin login admin
  name        text,
  is_active   boolean NOT NULL DEFAULT true
);
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  admin_email text NOT NULL,
  action      text NOT NULL,                         -- 'update', 'insert', 'delete', 'freeze', ...
  table_name  text NOT NULL,
  row_key     text NOT NULL,
  before      jsonb,
  after       jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_row_idx ON audit_log (table_name, row_key);

-- ============ Turunan (dihitung, tidak disimpan) ============
CREATE VIEW v_game_team_totals AS
SELECT s.game_id, s.team_id,
       sum(s.kills)        AS kills,
       sum(s.deaths)       AS deaths,
       sum(s.assists)      AS assists,
       sum(s.gold)         AS total_gold,
       sum(s.damage_dealt) AS total_damage,
       sum(s.damage_taken) AS total_damage_taken,
       sum(s.tower_damage) AS total_tower_damage,
       count(*)            AS player_rows,
       count(s.gold)       AS gold_rows             -- < 5 berarti total gold belum lengkap
FROM game_player_stat s
GROUP BY s.game_id, s.team_id;

-- War participation yang ditampilkan: angka resmi bila diisi, selain itu estimasi (kill+assist)/kill tim.
CREATE VIEW v_game_player_participation AS
SELECT s.game_id, s.player_id, s.team_id,
       COALESCE(s.war_participation_pct,
                CASE WHEN t.kills > 0
                     THEN LEAST(100, round(100.0 * (s.kills + s.assists) / t.kills, 1)) END
       ) AS participation_pct,
       CASE WHEN s.war_participation_pct IS NOT NULL THEN 'official'
            WHEN t.kills > 0 THEN 'estimated' END AS participation_origin
FROM game_player_stat s
JOIN v_game_team_totals t USING (game_id, team_id);

-- Hero dan item pada patch game tersebut.
CREATE VIEW v_game_player_loadout AS
SELECT g.id AS game_id, s.player_id, s.hero_id, hv.stats AS hero_stats_at_patch,
       i.slot_no, i.item_id, iv.stats AS item_stats_at_patch, iv.price
FROM game g
JOIN game_player_stat s ON s.game_id = g.id
LEFT JOIN hero_version hv ON hv.hero_id = s.hero_id AND hv.patch_id = g.patch_id
LEFT JOIN game_player_item i ON i.game_id = g.id AND i.player_id = s.player_id
LEFT JOIN item_version iv ON iv.item_id = i.item_id AND iv.patch_id = g.patch_id;

-- Kelengkapan data per game: dasar lencana "Lengkap / Sebagian / Menunggu" dan antrean admin.
CREATE VIEW v_game_completeness AS
SELECT g.id AS game_id, g.series_id, g.game_no,
       (g.patch_id IS NOT NULL)        AS has_patch,
       (g.battlefield_id IS NOT NULL)  AS has_battlefield,
       (g.winner_team_id IS NOT NULL)  AS has_winner,
       (g.duration_sec IS NOT NULL)    AS has_duration,
       COALESCE(p.n, 0)                AS player_rows,
       COALESCE(p.n_full, 0)           AS player_rows_full_stats,
       COALESCE(p.n_wp, 0)             AS player_rows_with_wp,
       COALESCE(p.n_emblem, 0)         AS player_rows_with_emblem,
       COALESCE(it.n, 0)               AS players_with_items,
       COALESCE(d.picks, 0)            AS picks,
       COALESCE(d.bans, 0)             AS bans,
       2 * t.bans_per_team             AS bans_expected,
       CASE
         WHEN g.status <> 'finished' OR COALESCE(p.n, 0) = 0 THEN 'menunggu'
         WHEN g.patch_id IS NOT NULL AND g.battlefield_id IS NOT NULL
              AND g.winner_team_id IS NOT NULL
              AND p.n = 10 AND p.n_full = 10 AND p.n_wp = 10 AND p.n_emblem = 10
              AND COALESCE(it.n, 0) = 10
              AND COALESCE(d.picks, 0) = 10 AND COALESCE(d.bans, 0) = 2 * t.bans_per_team
           THEN 'lengkap'
         ELSE 'sebagian'
       END AS completeness
FROM game g
JOIN series sr ON sr.id = g.series_id
JOIN tournament t ON t.id = sr.tournament_id
LEFT JOIN (
  SELECT game_id, count(*) AS n,
         count(*) FILTER (WHERE kills IS NOT NULL AND gold IS NOT NULL AND damage_dealt IS NOT NULL
                            AND damage_taken IS NOT NULL AND tower_damage IS NOT NULL) AS n_full,
         count(war_participation_pct) AS n_wp,
         count(emblem_id) AS n_emblem
  FROM game_player_stat GROUP BY game_id) p ON p.game_id = g.id
LEFT JOIN (
  SELECT game_id, count(DISTINCT player_id) AS n FROM game_player_item GROUP BY game_id) it ON it.game_id = g.id
LEFT JOIN (
  SELECT game_id, count(*) FILTER (WHERE action_type = 'pick') AS picks,
         count(*) FILTER (WHERE action_type = 'ban') AS bans
  FROM draft_action GROUP BY game_id) d ON d.game_id = g.id;
