import { pgTable, unique, integer, text, index, check, serial, date, smallserial, foreignKey, boolean, bigserial, smallint, timestamp, bigint, uniqueIndex, jsonb, primaryKey, numeric, pgView } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const hero = pgTable("hero", {
	id: integer().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
}, (table) => [
	unique("hero_slug_key").on(table.slug),
]);

export const patch = pgTable("patch", {
	id: serial().primaryKey().notNull(),
	version: text().notNull(),
	server: text().default('original').notNull(),
	releasedOn: date("released_on"),
	notesUrl: text("notes_url"),
}, (table) => [
	index("patch_released_idx").using("btree", table.releasedOn.asc().nullsLast().op("date_ops")),
	unique("patch_version_server_key").on(table.version, table.server),
	check("patch_server_check", sql`server = ANY (ARRAY['original'::text, 'advanced'::text, 'tournament'::text])`),
]);

export const dataSource = pgTable("data_source", {
	id: smallserial().primaryKey().notNull(),
	code: text().notNull(),
	attribution: text(),
	notes: text(),
}, (table) => [
	unique("data_source_code_key").on(table.code),
]);

export const item = pgTable("item", {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
});

export const emblem = pgTable("emblem", {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
});

export const talent = pgTable("talent", {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
});

export const battlefield = pgTable("battlefield", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	imagePath: text("image_path"),
	sincePatchId: integer("since_patch_id"),
	untilPatchId: integer("until_patch_id"),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sincePatchId],
			foreignColumns: [patch.id],
			name: "battlefield_since_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.untilPatchId],
			foreignColumns: [patch.id],
			name: "battlefield_until_patch_id_fkey"
		}),
	unique("battlefield_name_key").on(table.name),
]);

export const patchChange = pgTable("patch_change", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	patchId: integer("patch_id").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: integer("entity_id"),
	field: text(),
	oldValue: text("old_value"),
	newValue: text("new_value"),
	rawText: text("raw_text"),
}, (table) => [
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "patch_change_patch_id_fkey"
		}),
	check("patch_change_entity_type_check", sql`entity_type = ANY (ARRAY['hero'::text, 'item'::text, 'emblem'::text, 'talent'::text, 'battlefield'::text, 'system'::text])`),
]);

export const player = pgTable("player", {
	id: serial().primaryKey().notNull(),
	slug: text().notNull(),
	nickname: text().notNull(),
	realName: text("real_name"),
	nationality: text(),
	role: text(),
	photoPath: text("photo_path"),
}, (table) => [
	unique("player_slug_key").on(table.slug),
]);

export const team = pgTable("team", {
	id: serial().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	fullName: text("full_name"),
	region: text(),
	logoPath: text("logo_path"),
}, (table) => [
	unique("team_slug_key").on(table.slug),
]);

export const tournament = pgTable("tournament", {
	id: serial().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	leagueCode: text("league_code"),
	region: text(),
	tier: text(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	bansPerTeam: smallint("bans_per_team").default(5).notNull(),
	defaultPatchId: integer("default_patch_id"),
}, (table) => [
	foreignKey({
			columns: [table.defaultPatchId],
			foreignColumns: [patch.id],
			name: "tournament_default_patch_id_fkey"
		}),
	unique("tournament_slug_key").on(table.slug),
	check("tournament_bans_per_team_check", sql`(bans_per_team >= 0) AND (bans_per_team <= 5)`),
]);

export const tournamentStage = pgTable("tournament_stage", {
	id: serial().primaryKey().notNull(),
	tournamentId: integer("tournament_id").notNull(),
	name: text().notNull(),
	stageOrder: smallint("stage_order").default(0).notNull(),
	patchId: integer("patch_id"),
}, (table) => [
	foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournament.id],
			name: "tournament_stage_tournament_id_fkey"
		}),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "tournament_stage_patch_id_fkey"
		}),
]);

export const series = pgTable("series", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	slug: text().notNull(),
	tournamentId: integer("tournament_id").notNull(),
	stageId: integer("stage_id"),
	roundLabel: text("round_label"),
	teamAId: integer("team_a_id").notNull(),
	teamBId: integer("team_b_id").notNull(),
	bestOf: smallint("best_of").notNull(),
	scoreA: smallint("score_a").default(0).notNull(),
	scoreB: smallint("score_b").default(0).notNull(),
	status: text().default('scheduled').notNull(),
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }),
	winnerTeamId: integer("winner_team_id"),
	sourceId: smallint("source_id"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }),
	frozenAt: timestamp("frozen_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("series_start_idx").using("btree", table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("series_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("series_tournament_idx").using("btree", table.tournamentId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournament.id],
			name: "series_tournament_id_fkey"
		}),
	foreignKey({
			columns: [table.stageId],
			foreignColumns: [tournamentStage.id],
			name: "series_stage_id_fkey"
		}),
	foreignKey({
			columns: [table.teamAId],
			foreignColumns: [team.id],
			name: "series_team_a_id_fkey"
		}),
	foreignKey({
			columns: [table.teamBId],
			foreignColumns: [team.id],
			name: "series_team_b_id_fkey"
		}),
	foreignKey({
			columns: [table.winnerTeamId],
			foreignColumns: [team.id],
			name: "series_winner_team_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "series_source_id_fkey"
		}),
	check("series_best_of_check", sql`best_of = ANY (ARRAY[1, 2, 3, 5, 7])`),
	check("series_status_check", sql`status = ANY (ARRAY['scheduled'::text, 'live'::text, 'finished'::text, 'postponed'::text, 'cancelled'::text])`),
	check("series_check", sql`team_a_id <> team_b_id`),
	check("series_check1", sql`(score_a + score_b) <= best_of`),
	check("series_check2", sql`(winner_team_id IS NULL) OR ((winner_team_id = team_a_id) OR (winner_team_id = team_b_id))`),
]);

export const game = pgTable("game", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	seriesId: bigint("series_id", { mode: "number" }).notNull(),
	gameNo: smallint("game_no").notNull(),
	patchId: integer("patch_id"),
	patchOrigin: text("patch_origin"),
	battlefieldId: integer("battlefield_id"),
	durationSec: integer("duration_sec"),
	blueTeamId: integer("blue_team_id"),
	winnerTeamId: integer("winner_team_id"),
	status: text().default('pending').notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	vodUrl: text("vod_url"),
	sourceId: smallint("source_id"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("game_battlefield_idx").using("btree", table.battlefieldId.asc().nullsLast().op("int4_ops")),
	index("game_patch_idx").using("btree", table.patchId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.seriesId],
			foreignColumns: [series.id],
			name: "game_series_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "game_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.battlefieldId],
			foreignColumns: [battlefield.id],
			name: "game_battlefield_id_fkey"
		}),
	foreignKey({
			columns: [table.blueTeamId],
			foreignColumns: [team.id],
			name: "game_blue_team_id_fkey"
		}),
	foreignKey({
			columns: [table.winnerTeamId],
			foreignColumns: [team.id],
			name: "game_winner_team_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "game_source_id_fkey"
		}),
	unique("game_series_id_game_no_key").on(table.seriesId, table.gameNo),
	check("game_game_no_check", sql`(game_no >= 1) AND (game_no <= 7)`),
	check("game_patch_origin_check", sql`patch_origin = ANY (ARRAY['source'::text, 'manual'::text, 'stage_default'::text, 'tournament_default'::text, 'guessed_by_date'::text])`),
	check("game_duration_sec_check", sql`(duration_sec IS NULL) OR (duration_sec > 0)`),
	check("game_status_check", sql`status = ANY (ARRAY['pending'::text, 'live'::text, 'finished'::text])`),
	check("game_check", sql`(patch_id IS NULL) = (patch_origin IS NULL)`),
]);

export const draftAction = pgTable("draft_action", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }).notNull(),
	teamId: integer("team_id").notNull(),
	actionType: text("action_type").notNull(),
	heroId: integer("hero_id").notNull(),
	playerId: integer("player_id"),
	orderNo: smallint("order_no"),
	sourceId: smallint("source_id"),
}, (table) => [
	index("draft_action_game_idx").using("btree", table.gameId.asc().nullsLast().op("int4_ops"), table.teamId.asc().nullsLast().op("int8_ops"), table.actionType.asc().nullsLast().op("int8_ops")),
	index("draft_action_hero_idx").using("btree", table.heroId.asc().nullsLast().op("int4_ops"), table.actionType.asc().nullsLast().op("text_ops")),
	uniqueIndex("draft_action_order_uq").using("btree", table.gameId.asc().nullsLast().op("int8_ops"), table.orderNo.asc().nullsLast().op("int2_ops")).where(sql`(order_no IS NOT NULL)`),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [game.id],
			name: "draft_action_game_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "draft_action_team_id_fkey"
		}),
	foreignKey({
			columns: [table.heroId],
			foreignColumns: [hero.id],
			name: "draft_action_hero_id_fkey"
		}),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.id],
			name: "draft_action_player_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "draft_action_source_id_fkey"
		}),
	unique("draft_action_game_id_hero_id_key").on(table.gameId, table.heroId),
	check("draft_action_action_type_check", sql`action_type = ANY (ARRAY['ban'::text, 'pick'::text])`),
	check("draft_action_order_no_check", sql`(order_no >= 1) AND (order_no <= 20)`),
	check("draft_action_check", sql`(action_type = 'pick'::text) OR (player_id IS NULL)`),
]);

export const battleSpell = pgTable("battle_spell", {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	imagePath: text("image_path"),
});

export const fieldOverride = pgTable("field_override", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	tableName: text("table_name").notNull(),
	rowKey: text("row_key").notNull(),
	columnName: text("column_name").notNull(),
	value: jsonb(),
	editedBy: text("edited_by").notNull(),
	editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("field_override_table_name_row_key_column_name_key").on(table.tableName, table.rowKey, table.columnName),
]);

export const ingestLog = pgTable("ingest_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	sourceId: smallint("source_id").notNull(),
	endpoint: text().notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	statusCode: integer("status_code"),
	payload: jsonb(),
	error: text(),
}, (table) => [
	index("ingest_log_time_idx").using("btree", table.fetchedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "ingest_log_source_id_fkey"
		}),
]);

export const adminUser = pgTable("admin_user", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("admin_user_email_key").on(table.email),
]);

export const auditLog = pgTable("audit_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	adminEmail: text("admin_email").notNull(),
	action: text().notNull(),
	tableName: text("table_name").notNull(),
	rowKey: text("row_key").notNull(),
	before: jsonb(),
	after: jsonb(),
	at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_log_row_idx").using("btree", table.tableName.asc().nullsLast().op("text_ops"), table.rowKey.asc().nullsLast().op("text_ops")),
]);

export const playerAlias = pgTable("player_alias", {
	alias: text().notNull(),
	sourceId: smallint("source_id").notNull(),
	playerId: integer("player_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "player_alias_source_id_fkey"
		}),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.id],
			name: "player_alias_player_id_fkey"
		}),
	primaryKey({ columns: [table.alias, table.sourceId], name: "player_alias_pkey"}),
]);

export const seriesExternalId = pgTable("series_external_id", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	seriesId: bigint("series_id", { mode: "number" }).notNull(),
	sourceId: smallint("source_id").notNull(),
	externalId: text("external_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.seriesId],
			foreignColumns: [series.id],
			name: "series_external_id_series_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "series_external_id_source_id_fkey"
		}),
	primaryKey({ columns: [table.sourceId, table.externalId], name: "series_external_id_pkey"}),
]);

export const gamePlayerTalent = pgTable("game_player_talent", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }).notNull(),
	playerId: integer("player_id").notNull(),
	talentId: integer("talent_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.talentId],
			foreignColumns: [talent.id],
			name: "game_player_talent_talent_id_fkey"
		}),
	foreignKey({
			columns: [table.gameId, table.playerId],
			foreignColumns: [gamePlayerStat.gameId, gamePlayerStat.playerId],
			name: "game_player_talent_game_id_player_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.gameId, table.playerId, table.talentId], name: "game_player_talent_pkey"}),
]);

export const emblemVersion = pgTable("emblem_version", {
	emblemId: integer("emblem_id").notNull(),
	patchId: integer("patch_id").notNull(),
	stats: jsonb().default({}).notNull(),
	imagePath: text("image_path"),
	sourceId: smallint("source_id"),
}, (table) => [
	foreignKey({
			columns: [table.emblemId],
			foreignColumns: [emblem.id],
			name: "emblem_version_emblem_id_fkey"
		}),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "emblem_version_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "emblem_version_source_id_fkey"
		}),
	primaryKey({ columns: [table.emblemId, table.patchId], name: "emblem_version_pkey"}),
]);

export const rosterMembership = pgTable("roster_membership", {
	teamId: integer("team_id").notNull(),
	playerId: integer("player_id").notNull(),
	role: text(),
	fromDate: date("from_date").notNull(),
	toDate: date("to_date"),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "roster_membership_team_id_fkey"
		}),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.id],
			name: "roster_membership_player_id_fkey"
		}),
	primaryKey({ columns: [table.teamId, table.playerId, table.fromDate], name: "roster_membership_pkey"}),
]);

export const gamePlayerItem = pgTable("game_player_item", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }).notNull(),
	playerId: integer("player_id").notNull(),
	slotNo: smallint("slot_no").notNull(),
	itemId: integer("item_id").notNull(),
	purchaseOrder: smallint("purchase_order"),
}, (table) => [
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [item.id],
			name: "game_player_item_item_id_fkey"
		}),
	foreignKey({
			columns: [table.gameId, table.playerId],
			foreignColumns: [gamePlayerStat.gameId, gamePlayerStat.playerId],
			name: "game_player_item_game_id_player_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.gameId, table.playerId, table.slotNo], name: "game_player_item_pkey"}),
	check("game_player_item_slot_no_check", sql`(slot_no >= 1) AND (slot_no <= 6)`),
]);

export const gameTeamStat = pgTable("game_team_stat", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }).notNull(),
	teamId: integer("team_id").notNull(),
	towers: smallint(),
	lords: smallint(),
	turtles: smallint(),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "game_team_stat_team_id_fkey"
		}),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [game.id],
			name: "game_team_stat_game_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.gameId, table.teamId], name: "game_team_stat_pkey"}),
]);

export const talentVersion = pgTable("talent_version", {
	talentId: integer("talent_id").notNull(),
	patchId: integer("patch_id").notNull(),
	tier: smallint(),
	description: text(),
	imagePath: text("image_path"),
	sourceId: smallint("source_id"),
}, (table) => [
	foreignKey({
			columns: [table.talentId],
			foreignColumns: [talent.id],
			name: "talent_version_talent_id_fkey"
		}),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "talent_version_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "talent_version_source_id_fkey"
		}),
	primaryKey({ columns: [table.talentId, table.patchId], name: "talent_version_pkey"}),
]);

export const itemVersion = pgTable("item_version", {
	itemId: integer("item_id").notNull(),
	patchId: integer("patch_id").notNull(),
	category: text(),
	price: integer(),
	stats: jsonb().default({}).notNull(),
	passive: text(),
	imagePath: text("image_path"),
	sourceId: smallint("source_id"),
}, (table) => [
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [item.id],
			name: "item_version_item_id_fkey"
		}),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "item_version_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "item_version_source_id_fkey"
		}),
	primaryKey({ columns: [table.itemId, table.patchId], name: "item_version_pkey"}),
]);

export const heroVersion = pgTable("hero_version", {
	heroId: integer("hero_id").notNull(),
	patchId: integer("patch_id").notNull(),
	roles: text().array(),
	lanes: text().array(),
	stats: jsonb().default({}).notNull(),
	skills: jsonb(),
	imagePath: text("image_path"),
	isDisabled: boolean("is_disabled").default(false).notNull(),
	sourceId: smallint("source_id"),
}, (table) => [
	foreignKey({
			columns: [table.heroId],
			foreignColumns: [hero.id],
			name: "hero_version_hero_id_fkey"
		}),
	foreignKey({
			columns: [table.patchId],
			foreignColumns: [patch.id],
			name: "hero_version_patch_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "hero_version_source_id_fkey"
		}),
	primaryKey({ columns: [table.heroId, table.patchId], name: "hero_version_pkey"}),
]);

export const standing = pgTable("standing", {
	stageId: integer("stage_id").notNull(),
	teamId: integer("team_id").notNull(),
	position: smallint(),
	seriesWon: smallint("series_won"),
	seriesLost: smallint("series_lost"),
	gamesWon: smallint("games_won"),
	gamesLost: smallint("games_lost"),
	points: smallint(),
	sourceId: smallint("source_id"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.stageId],
			foreignColumns: [tournamentStage.id],
			name: "standing_stage_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "standing_team_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "standing_source_id_fkey"
		}),
	primaryKey({ columns: [table.stageId, table.teamId], name: "standing_pkey"}),
]);

export const gamePlayerStat = pgTable("game_player_stat", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }).notNull(),
	teamId: integer("team_id").notNull(),
	playerId: integer("player_id").notNull(),
	heroId: integer("hero_id").notNull(),
	role: text(),
	kills: smallint(),
	deaths: smallint(),
	assists: smallint(),
	gold: integer(),
	damageDealt: integer("damage_dealt"),
	damageTaken: integer("damage_taken"),
	towerDamage: integer("tower_damage"),
	warParticipationPct: numeric("war_participation_pct", { precision: 5, scale:  2 }),
	isMvp: boolean("is_mvp").default(false).notNull(),
	emblemId: integer("emblem_id"),
	battleSpellId: integer("battle_spell_id"),
	sourceId: smallint("source_id"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("gps_hero_idx").using("btree", table.heroId.asc().nullsLast().op("int4_ops")),
	index("gps_player_idx").using("btree", table.playerId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [game.id],
			name: "game_player_stat_game_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "game_player_stat_team_id_fkey"
		}),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.id],
			name: "game_player_stat_player_id_fkey"
		}),
	foreignKey({
			columns: [table.heroId],
			foreignColumns: [hero.id],
			name: "game_player_stat_hero_id_fkey"
		}),
	foreignKey({
			columns: [table.emblemId],
			foreignColumns: [emblem.id],
			name: "game_player_stat_emblem_id_fkey"
		}),
	foreignKey({
			columns: [table.battleSpellId],
			foreignColumns: [battleSpell.id],
			name: "game_player_stat_battle_spell_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceId],
			foreignColumns: [dataSource.id],
			name: "game_player_stat_source_id_fkey"
		}),
	primaryKey({ columns: [table.gameId, table.playerId], name: "game_player_stat_pkey"}),
	unique("game_player_stat_game_id_hero_id_key").on(table.gameId, table.heroId),
	check("game_player_stat_kills_check", sql`kills >= 0`),
	check("game_player_stat_deaths_check", sql`deaths >= 0`),
	check("game_player_stat_assists_check", sql`assists >= 0`),
	check("game_player_stat_gold_check", sql`gold >= 0`),
	check("game_player_stat_damage_dealt_check", sql`damage_dealt >= 0`),
	check("game_player_stat_damage_taken_check", sql`damage_taken >= 0`),
	check("game_player_stat_tower_damage_check", sql`tower_damage >= 0`),
	check("game_player_stat_war_participation_pct_check", sql`(war_participation_pct >= (0)::numeric) AND (war_participation_pct <= (100)::numeric)`),
]);
export const vGameTeamTotals = pgView("v_game_team_totals", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }),
	teamId: integer("team_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	kills: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deaths: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	assists: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalGold: bigint("total_gold", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDamage: bigint("total_damage", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDamageTaken: bigint("total_damage_taken", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTowerDamage: bigint("total_tower_damage", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playerRows: bigint("player_rows", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	goldRows: bigint("gold_rows", { mode: "number" }),
}).as(sql`SELECT game_id, team_id, sum(kills) AS kills, sum(deaths) AS deaths, sum(assists) AS assists, sum(gold) AS total_gold, sum(damage_dealt) AS total_damage, sum(damage_taken) AS total_damage_taken, sum(tower_damage) AS total_tower_damage, count(*) AS player_rows, count(gold) AS gold_rows FROM game_player_stat s GROUP BY game_id, team_id`);

export const vGamePlayerParticipation = pgView("v_game_player_participation", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }),
	playerId: integer("player_id"),
	teamId: integer("team_id"),
	participationPct: numeric("participation_pct"),
	participationOrigin: text("participation_origin"),
}).as(sql`SELECT s.game_id, s.player_id, s.team_id, COALESCE(s.war_participation_pct, CASE WHEN t.kills > 0 THEN LEAST(100::numeric, round(100.0 * (s.kills + s.assists)::numeric / t.kills::numeric, 1)) ELSE NULL::numeric END) AS participation_pct, CASE WHEN s.war_participation_pct IS NOT NULL THEN 'official'::text WHEN t.kills > 0 THEN 'estimated'::text ELSE NULL::text END AS participation_origin FROM game_player_stat s JOIN v_game_team_totals t USING (game_id, team_id)`);

export const vGamePlayerLoadout = pgView("v_game_player_loadout", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }),
	playerId: integer("player_id"),
	heroId: integer("hero_id"),
	heroStatsAtPatch: jsonb("hero_stats_at_patch"),
	slotNo: smallint("slot_no"),
	itemId: integer("item_id"),
	itemStatsAtPatch: jsonb("item_stats_at_patch"),
	price: integer(),
}).as(sql`SELECT g.id AS game_id, s.player_id, s.hero_id, hv.stats AS hero_stats_at_patch, i.slot_no, i.item_id, iv.stats AS item_stats_at_patch, iv.price FROM game g JOIN game_player_stat s ON s.game_id = g.id LEFT JOIN hero_version hv ON hv.hero_id = s.hero_id AND hv.patch_id = g.patch_id LEFT JOIN game_player_item i ON i.game_id = g.id AND i.player_id = s.player_id LEFT JOIN item_version iv ON iv.item_id = i.item_id AND iv.patch_id = g.patch_id`);

export const vGameCompleteness = pgView("v_game_completeness", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gameId: bigint("game_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	seriesId: bigint("series_id", { mode: "number" }),
	gameNo: smallint("game_no"),
	hasPatch: boolean("has_patch"),
	hasBattlefield: boolean("has_battlefield"),
	hasWinner: boolean("has_winner"),
	hasDuration: boolean("has_duration"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playerRows: bigint("player_rows", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playerRowsFullStats: bigint("player_rows_full_stats", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playerRowsWithWp: bigint("player_rows_with_wp", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playerRowsWithEmblem: bigint("player_rows_with_emblem", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playersWithItems: bigint("players_with_items", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	picks: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bans: bigint({ mode: "number" }),
	bansExpected: integer("bans_expected"),
	completeness: text(),
}).as(sql`SELECT g.id AS game_id, g.series_id, g.game_no, g.patch_id IS NOT NULL AS has_patch, g.battlefield_id IS NOT NULL AS has_battlefield, g.winner_team_id IS NOT NULL AS has_winner, g.duration_sec IS NOT NULL AS has_duration, COALESCE(p.n, 0::bigint) AS player_rows, COALESCE(p.n_full, 0::bigint) AS player_rows_full_stats, COALESCE(p.n_wp, 0::bigint) AS player_rows_with_wp, COALESCE(p.n_emblem, 0::bigint) AS player_rows_with_emblem, COALESCE(it.n, 0::bigint) AS players_with_items, COALESCE(d.picks, 0::bigint) AS picks, COALESCE(d.bans, 0::bigint) AS bans, 2 * t.bans_per_team AS bans_expected, CASE WHEN g.status <> 'finished'::text OR COALESCE(p.n, 0::bigint) = 0 THEN 'menunggu'::text WHEN g.patch_id IS NOT NULL AND g.battlefield_id IS NOT NULL AND g.winner_team_id IS NOT NULL AND p.n = 10 AND p.n_full = 10 AND p.n_wp = 10 AND p.n_emblem = 10 AND COALESCE(it.n, 0::bigint) = 10 AND COALESCE(d.picks, 0::bigint) = 10 AND COALESCE(d.bans, 0::bigint) = (2 * t.bans_per_team) THEN 'lengkap'::text ELSE 'sebagian'::text END AS completeness FROM game g JOIN series sr ON sr.id = g.series_id JOIN tournament t ON t.id = sr.tournament_id LEFT JOIN ( SELECT game_player_stat.game_id, count(*) AS n, count(*) FILTER (WHERE game_player_stat.kills IS NOT NULL AND game_player_stat.gold IS NOT NULL AND game_player_stat.damage_dealt IS NOT NULL AND game_player_stat.damage_taken IS NOT NULL AND game_player_stat.tower_damage IS NOT NULL) AS n_full, count(game_player_stat.war_participation_pct) AS n_wp, count(game_player_stat.emblem_id) AS n_emblem FROM game_player_stat GROUP BY game_player_stat.game_id) p ON p.game_id = g.id LEFT JOIN ( SELECT game_player_item.game_id, count(DISTINCT game_player_item.player_id) AS n FROM game_player_item GROUP BY game_player_item.game_id) it ON it.game_id = g.id LEFT JOIN ( SELECT draft_action.game_id, count(*) FILTER (WHERE draft_action.action_type = 'pick'::text) AS picks, count(*) FILTER (WHERE draft_action.action_type = 'ban'::text) AS bans FROM draft_action GROUP BY draft_action.game_id) d ON d.game_id = g.id`);