import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ConflictDetails } from "@/components/conflict-details";
import { normalizeConflict } from "@/lib/system-watchlist";

afterEach(cleanup);
it("keeps multiple conflict pairs, stakes and zero won days separate", () => {
  render(<ConflictDetails conflicts={[
    normalizeConflict({faction1: 'A', faction2: 'B', war_type: 'War', status: 'active', stake1: 'Alpha Port', stake2: 'Beta Port', won_days1: 0, won_days2: 2}),
    normalizeConflict({Faction1: {Name: 'C', Stake: 'Gamma Port', WonDays: 3}, Faction2: {Name: 'D', Stake: '', WonDays: 1}, WarType: '$Election;', Status: 'pending'}),
  ]} />);
  const cards = screen.getAllByRole('article');
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByText('0')).toBeVisible();
  expect(within(cards[0]).getByText('Beta Port')).toBeVisible();
  expect(within(cards[1]).getByText('Gamma Port')).toBeVisible();
  expect(within(cards[1]).getByText('None reported')).toBeVisible();
  expect(within(cards[0]).queryByText('Gamma Port')).toBeNull();
});
it("distinguishes missing scores from zero", () => {
  const item = normalizeConflict({ faction1: 'A', faction2: 'B', won_days1: null, won_days2: '0' });
  expect(item.wonDays1).toBeNull(); expect(item.wonDays2).toBe(0);
});
