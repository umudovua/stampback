import { schema, t, type SchemaType } from '@colyseus/schema';

/**
 * Bütün client-lərlə paylaşılan otaq vəziyyəti.
 * M0: yalnız qoşulan oyunçuların sayı. Tam vəziyyət M3-də gəlir
 * (docs/architecture.md, bölmə 6).
 */
export const MatchState = schema(
  {
    playerCount: t.uint8(),
  },
  'MatchState',
);

export type MatchState = SchemaType<typeof MatchState>;
