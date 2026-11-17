import { relations } from "drizzle-orm/relations";
import { patch, battlefield, patchChange, tournament, tournamentStage, series, team, dataSource, game, draftAction, hero, player, ingestLog, playerAlias, seriesExternalId, talent, gamePlayerTalent, gamePlayerStat, emblem, emblemVersion, rosterMembership, item, gamePlayerItem, gameTeamStat, talentVersion, itemVersion, heroVersion, standing, battleSpell } from "./schema";

export const battlefieldRelations = relations(battlefield, ({one, many}) => ({
	patch_sincePatchId: one(patch, {
		fields: [battlefield.sincePatchId],
		references: [patch.id],
		relationName: "battlefield_sincePatchId_patch_id"
	}),
	patch_untilPatchId: one(patch, {
		fields: [battlefield.untilPatchId],
		references: [patch.id],
		relationName: "battlefield_untilPatchId_patch_id"
	}),
	games: many(game),
}));

export const patchRelations = relations(patch, ({many}) => ({
	battlefields_sincePatchId: many(battlefield, {
		relationName: "battlefield_sincePatchId_patch_id"
	}),
	battlefields_untilPatchId: many(battlefield, {
		relationName: "battlefield_untilPatchId_patch_id"
	}),
	patchChanges: many(patchChange),
	tournaments: many(tournament),
	tournamentStages: many(tournamentStage),
	games: many(game),
	emblemVersions: many(emblemVersion),
	talentVersions: many(talentVersion),
	itemVersions: many(itemVersion),
	heroVersions: many(heroVersion),
}));

export const patchChangeRelations = relations(patchChange, ({one}) => ({
	patch: one(patch, {
		fields: [patchChange.patchId],
		references: [patch.id]
	}),
}));

export const tournamentRelations = relations(tournament, ({one, many}) => ({
	patch: one(patch, {
		fields: [tournament.defaultPatchId],
		references: [patch.id]
	}),
	tournamentStages: many(tournamentStage),
	series: many(series),
}));

export const tournamentStageRelations = relations(tournamentStage, ({one, many}) => ({
	tournament: one(tournament, {
		fields: [tournamentStage.tournamentId],
		references: [tournament.id]
	}),
	patch: one(patch, {
		fields: [tournamentStage.patchId],
		references: [patch.id]
	}),
	series: many(series),
	standings: many(standing),
}));

export const seriesRelations = relations(series, ({one, many}) => ({
	tournament: one(tournament, {
		fields: [series.tournamentId],
		references: [tournament.id]
	}),
	tournamentStage: one(tournamentStage, {
		fields: [series.stageId],
		references: [tournamentStage.id]
	}),
	team_teamAId: one(team, {
		fields: [series.teamAId],
		references: [team.id],
		relationName: "series_teamAId_team_id"
	}),
	team_teamBId: one(team, {
		fields: [series.teamBId],
		references: [team.id],
		relationName: "series_teamBId_team_id"
	}),
	team_winnerTeamId: one(team, {
		fields: [series.winnerTeamId],
		references: [team.id],
		relationName: "series_winnerTeamId_team_id"
	}),
	dataSource: one(dataSource, {
		fields: [series.sourceId],
		references: [dataSource.id]
	}),
	games: many(game),
	seriesExternalIds: many(seriesExternalId),
}));

export const teamRelations = relations(team, ({many}) => ({
	series_teamAId: many(series, {
		relationName: "series_teamAId_team_id"
	}),
	series_teamBId: many(series, {
		relationName: "series_teamBId_team_id"
	}),
	series_winnerTeamId: many(series, {
		relationName: "series_winnerTeamId_team_id"
	}),
	games_blueTeamId: many(game, {
		relationName: "game_blueTeamId_team_id"
	}),
	games_winnerTeamId: many(game, {
		relationName: "game_winnerTeamId_team_id"
	}),
	draftActions: many(draftAction),
	rosterMemberships: many(rosterMembership),
	gameTeamStats: many(gameTeamStat),
	standings: many(standing),
	gamePlayerStats: many(gamePlayerStat),
}));

export const dataSourceRelations = relations(dataSource, ({many}) => ({
	series: many(series),
	games: many(game),
	draftActions: many(draftAction),
	ingestLogs: many(ingestLog),
	playerAliases: many(playerAlias),
	seriesExternalIds: many(seriesExternalId),
	emblemVersions: many(emblemVersion),
	talentVersions: many(talentVersion),
	itemVersions: many(itemVersion),
	heroVersions: many(heroVersion),
	standings: many(standing),
	gamePlayerStats: many(gamePlayerStat),
}));

export const gameRelations = relations(game, ({one, many}) => ({
	series: one(series, {
		fields: [game.seriesId],
		references: [series.id]
	}),
	patch: one(patch, {
		fields: [game.patchId],
		references: [patch.id]
	}),
	battlefield: one(battlefield, {
		fields: [game.battlefieldId],
		references: [battlefield.id]
	}),
	team_blueTeamId: one(team, {
		fields: [game.blueTeamId],
		references: [team.id],
		relationName: "game_blueTeamId_team_id"
	}),
	team_winnerTeamId: one(team, {
		fields: [game.winnerTeamId],
		references: [team.id],
		relationName: "game_winnerTeamId_team_id"
	}),
	dataSource: one(dataSource, {
		fields: [game.sourceId],
		references: [dataSource.id]
	}),
	draftActions: many(draftAction),
	gameTeamStats: many(gameTeamStat),
	gamePlayerStats: many(gamePlayerStat),
}));

export const draftActionRelations = relations(draftAction, ({one}) => ({
	game: one(game, {
		fields: [draftAction.gameId],
		references: [game.id]
	}),
	team: one(team, {
		fields: [draftAction.teamId],
		references: [team.id]
	}),
	hero: one(hero, {
		fields: [draftAction.heroId],
		references: [hero.id]
	}),
	player: one(player, {
		fields: [draftAction.playerId],
		references: [player.id]
	}),
	dataSource: one(dataSource, {
		fields: [draftAction.sourceId],
		references: [dataSource.id]
	}),
}));

export const heroRelations = relations(hero, ({many}) => ({
	draftActions: many(draftAction),
	heroVersions: many(heroVersion),
	gamePlayerStats: many(gamePlayerStat),
}));

export const playerRelations = relations(player, ({many}) => ({
	draftActions: many(draftAction),
	playerAliases: many(playerAlias),
	rosterMemberships: many(rosterMembership),
	gamePlayerStats: many(gamePlayerStat),
}));

export const ingestLogRelations = relations(ingestLog, ({one}) => ({
	dataSource: one(dataSource, {
		fields: [ingestLog.sourceId],
		references: [dataSource.id]
	}),
}));

export const playerAliasRelations = relations(playerAlias, ({one}) => ({
	dataSource: one(dataSource, {
		fields: [playerAlias.sourceId],
		references: [dataSource.id]
	}),
	player: one(player, {
		fields: [playerAlias.playerId],
		references: [player.id]
	}),
}));

export const seriesExternalIdRelations = relations(seriesExternalId, ({one}) => ({
	series: one(series, {
		fields: [seriesExternalId.seriesId],
		references: [series.id]
	}),
	dataSource: one(dataSource, {
		fields: [seriesExternalId.sourceId],
		references: [dataSource.id]
	}),
}));

export const gamePlayerTalentRelations = relations(gamePlayerTalent, ({one}) => ({
	talent: one(talent, {
		fields: [gamePlayerTalent.talentId],
		references: [talent.id]
	}),
	gamePlayerStat: one(gamePlayerStat, {
		fields: [gamePlayerTalent.gameId],
		references: [gamePlayerStat.gameId]
	}),
}));

export const talentRelations = relations(talent, ({many}) => ({
	gamePlayerTalents: many(gamePlayerTalent),
	talentVersions: many(talentVersion),
}));

export const gamePlayerStatRelations = relations(gamePlayerStat, ({one, many}) => ({
	gamePlayerTalents: many(gamePlayerTalent),
	gamePlayerItems: many(gamePlayerItem),
	game: one(game, {
		fields: [gamePlayerStat.gameId],
		references: [game.id]
	}),
	team: one(team, {
		fields: [gamePlayerStat.teamId],
		references: [team.id]
	}),
	player: one(player, {
		fields: [gamePlayerStat.playerId],
		references: [player.id]
	}),
	hero: one(hero, {
		fields: [gamePlayerStat.heroId],
		references: [hero.id]
	}),
	emblem: one(emblem, {
		fields: [gamePlayerStat.emblemId],
		references: [emblem.id]
	}),
	battleSpell: one(battleSpell, {
		fields: [gamePlayerStat.battleSpellId],
		references: [battleSpell.id]
	}),
	dataSource: one(dataSource, {
		fields: [gamePlayerStat.sourceId],
		references: [dataSource.id]
	}),
}));

export const emblemVersionRelations = relations(emblemVersion, ({one}) => ({
	emblem: one(emblem, {
		fields: [emblemVersion.emblemId],
		references: [emblem.id]
	}),
	patch: one(patch, {
		fields: [emblemVersion.patchId],
		references: [patch.id]
	}),
	dataSource: one(dataSource, {
		fields: [emblemVersion.sourceId],
		references: [dataSource.id]
	}),
}));

export const emblemRelations = relations(emblem, ({many}) => ({
	emblemVersions: many(emblemVersion),
	gamePlayerStats: many(gamePlayerStat),
}));

export const rosterMembershipRelations = relations(rosterMembership, ({one}) => ({
	team: one(team, {
		fields: [rosterMembership.teamId],
		references: [team.id]
	}),
	player: one(player, {
		fields: [rosterMembership.playerId],
		references: [player.id]
	}),
}));

export const gamePlayerItemRelations = relations(gamePlayerItem, ({one}) => ({
	item: one(item, {
		fields: [gamePlayerItem.itemId],
		references: [item.id]
	}),
	gamePlayerStat: one(gamePlayerStat, {
		fields: [gamePlayerItem.gameId],
		references: [gamePlayerStat.gameId]
	}),
}));

export const itemRelations = relations(item, ({many}) => ({
	gamePlayerItems: many(gamePlayerItem),
	itemVersions: many(itemVersion),
}));

export const gameTeamStatRelations = relations(gameTeamStat, ({one}) => ({
	team: one(team, {
		fields: [gameTeamStat.teamId],
		references: [team.id]
	}),
	game: one(game, {
		fields: [gameTeamStat.gameId],
		references: [game.id]
	}),
}));

export const talentVersionRelations = relations(talentVersion, ({one}) => ({
	talent: one(talent, {
		fields: [talentVersion.talentId],
		references: [talent.id]
	}),
	patch: one(patch, {
		fields: [talentVersion.patchId],
		references: [patch.id]
	}),
	dataSource: one(dataSource, {
		fields: [talentVersion.sourceId],
		references: [dataSource.id]
	}),
}));

export const itemVersionRelations = relations(itemVersion, ({one}) => ({
	item: one(item, {
		fields: [itemVersion.itemId],
		references: [item.id]
	}),
	patch: one(patch, {
		fields: [itemVersion.patchId],
		references: [patch.id]
	}),
	dataSource: one(dataSource, {
		fields: [itemVersion.sourceId],
		references: [dataSource.id]
	}),
}));

export const heroVersionRelations = relations(heroVersion, ({one}) => ({
	hero: one(hero, {
		fields: [heroVersion.heroId],
		references: [hero.id]
	}),
	patch: one(patch, {
		fields: [heroVersion.patchId],
		references: [patch.id]
	}),
	dataSource: one(dataSource, {
		fields: [heroVersion.sourceId],
		references: [dataSource.id]
	}),
}));

export const standingRelations = relations(standing, ({one}) => ({
	tournamentStage: one(tournamentStage, {
		fields: [standing.stageId],
		references: [tournamentStage.id]
	}),
	team: one(team, {
		fields: [standing.teamId],
		references: [team.id]
	}),
	dataSource: one(dataSource, {
		fields: [standing.sourceId],
		references: [dataSource.id]
	}),
}));

export const battleSpellRelations = relations(battleSpell, ({many}) => ({
	gamePlayerStats: many(gamePlayerStat),
}));