import { Team } from './entities/teams.entity';

/** Respuesta API: equipo con todas sus categorías */
export function mapTeamWithCategories(team: Team) {
  const fromJoin =
    team.teamCategories
      ?.map((tc) => tc.category)
      .filter((c): c is NonNullable<typeof c> => !!c) ?? [];

  const categories =
    fromJoin.length > 0
      ? fromJoin
      : team.category
        ? [team.category]
        : [];

  return {
    ...team,
    categories,
    categoryIds: categories.map((c) => c.id),
    categoryNames: categories.map((c) => c.name),
  };
}
