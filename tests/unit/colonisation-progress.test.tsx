import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ColonisationCommodityGroupedTable,
  ColonisationGroupedTable,
  colonisationCommanderGroupKey,
  colonisationCommodityGroupKey,
} from "@/components/colonisation-progress";
import type { ColonisationConstruction } from "@/lib/colonisation";

afterEach(cleanup);

const construction: ColonisationConstruction = {
  id: "42",
  construction: "Ivaldi Foundry",
  system: "Synookoi",
  status: "open",
  need: 100,
  delivered: 40,
  diff: 60,
  commodities: [
    {
      key: "aluminium",
      commodity: "Aluminium",
      need: 100,
      delivered: 40,
      diff: 60,
      unrecorded: 0,
      contributors: [{ cmdr: "JanJonTheo", delivered: 40 }],
    },
  ],
};

function GroupedTableHarness() {
  const [collapsedConstructionIds, setCollapsedConstructionIds] = useState(
    new Set<string>(),
  );
  const [collapsedCommanderIds, setCollapsedCommanderIds] = useState(
    new Set<string>(),
  );

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ColonisationGroupedTable
      constructions={[construction]}
      collapsedConstructionIds={collapsedConstructionIds}
      collapsedCommanderIds={collapsedCommanderIds}
      onToggleConstruction={(constructionId) =>
        toggle(setCollapsedConstructionIds, constructionId)
      }
      onToggleCommander={(constructionId, cmdr) =>
        toggle(
          setCollapsedCommanderIds,
          colonisationCommanderGroupKey(constructionId, cmdr),
        )
      }
    />
  );
}

function CommodityGroupedTableHarness() {
  const [collapsedConstructionIds, setCollapsedConstructionIds] = useState(
    new Set<string>(),
  );
  const [collapsedCommodityIds, setCollapsedCommodityIds] = useState(
    new Set<string>(),
  );

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ColonisationCommodityGroupedTable
      constructions={[construction]}
      collapsedConstructionIds={collapsedConstructionIds}
      collapsedCommodityIds={collapsedCommodityIds}
      onToggleConstruction={(constructionId) =>
        toggle(setCollapsedConstructionIds, constructionId)
      }
      onToggleCommodity={(constructionId, commodityKey) =>
        toggle(
          setCollapsedCommodityIds,
          colonisationCommodityGroupKey(constructionId, commodityKey),
        )
      }
    />
  );
}

describe("Colonisation grouped table", () => {
  it("collapses Construction and Cmdr levels independently", () => {
    render(<GroupedTableHarness />);
    const table = screen.getByRole("table");

    const commanderToggle = within(table).getByRole("button", {
      name: "Collapse Cmdr JanJonTheo",
    });
    expect(commanderToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(table).getByText("Aluminium")).toBeInTheDocument();

    fireEvent.click(commanderToggle);
    expect(
      within(table).getByRole("button", { name: "Expand Cmdr JanJonTheo" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByText("Aluminium")).not.toBeInTheDocument();

    const constructionToggle = within(table).getByRole("button", {
      name: "Collapse construction Ivaldi Foundry",
    });
    fireEvent.click(constructionToggle);
    expect(
      within(table).getByRole("button", {
        name: "Expand construction Ivaldi Foundry",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(table).queryByText("Cmdr JanJonTheo"),
    ).not.toBeInTheDocument();
  });

  it("marks completion and leaves Cmdr rows without diff colour classes", () => {
    render(
      <ColonisationGroupedTable
        constructions={[
          construction,
          {
            ...construction,
            id: "43",
            construction: "Completed Habitat",
            status: "completed",
            delivered: 100,
            diff: 0,
            commodities: [],
          },
        ]}
        collapsedConstructionIds={new Set()}
        collapsedCommanderIds={new Set()}
        onToggleConstruction={() => undefined}
        onToggleCommander={() => undefined}
      />,
    );
    const table = screen.getByRole("table");

    expect(
      within(table).getByLabelText("Construction incomplete"),
    ).toBeVisible();
    expect(
      within(table).getByLabelText("Construction completed"),
    ).toBeVisible();
    const commanderRow = within(table)
      .getByText("Cmdr JanJonTheo")
      .closest("tr");
    expect(commanderRow).toHaveClass("commander-group-row");
    expect(commanderRow).not.toHaveClass("diff-positive", "diff-zero");
    expect(within(commanderRow!).getAllByRole("cell").at(-1)).toHaveTextContent(
      "—",
    );

    const commodityRow = within(table).getByText("Aluminium").closest("tr");
    expect(within(commodityRow!).getAllByRole("cell").at(-1)).toHaveTextContent(
      "—",
    );

    const constructionRow = within(table)
      .getByRole("button", { name: "Collapse construction Ivaldi Foundry" })
      .closest("tr");
    expect(
      within(constructionRow!).getAllByRole("cell").at(-1),
    ).toHaveTextContent("60");
  });

  it("shows Commodity groups with collapsible Cmdr contributions", () => {
    render(<CommodityGroupedTableHarness />);
    const table = screen.getByRole("table");

    expect(within(table).getByText("Cmdr JanJonTheo")).toBeInTheDocument();
    const commodityToggle = within(table).getByRole("button", {
      name: "Collapse commodity Aluminium",
    });
    expect(commodityToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(commodityToggle);
    expect(
      within(table).getByRole("button", {
        name: "Expand commodity Aluminium",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(table).queryByText("Cmdr JanJonTheo"),
    ).not.toBeInTheDocument();
  });
});
