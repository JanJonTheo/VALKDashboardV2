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
  ColonisationContributionsTable,
  ColonisationContributionRecordsTable,
  ColonisationGroupedTable,
  colonisationCommanderGroupKey,
  colonisationCommodityGroupKey,
  colonisationContributionCommanderGroupKey,
  colonisationContributionConstructionGroupKey,
  type ColonisationSort,
  type ColonisationSortKey,
} from "@/components/colonisation-progress";
import {
  groupColonisationContributionRecords,
  includeUnattributedColonisationContributionRecords,
  normalizeColonisationContributionRecords,
  type ColonisationConstruction,
  type ColonisationContributionGroup,
} from "@/lib/colonisation";

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

const contributionGroup: ColonisationContributionGroup = {
  id: "janjontheo",
  cmdr: "JanJonTheo",
  delivered: 40,
  events: 1,
  commodities: [
    { key: "aluminium", commodity: "Aluminium", delivered: 40, events: 1 },
  ],
  constructions: [
    {
      id: construction.id,
      construction: construction.construction,
      system: construction.system,
      status: construction.status,
      delivered: 40,
      events: 1,
      commodities: [
        {
          key: "aluminium",
          commodity: "Aluminium",
          delivered: 40,
          events: 1,
        },
      ],
    },
  ],
};

function nextSort(current: ColonisationSort, key: ColonisationSortKey) {
  return {
    key,
    direction:
      current.key === key && current.direction === "asc" ? "desc" : "asc",
  } satisfies ColonisationSort;
}

function GroupedTableHarness() {
  const [sort, setSort] = useState<ColonisationSort>({
    key: "construction",
    direction: "asc",
  });
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
      sort={sort}
      onSort={(key) => setSort((current) => nextSort(current, key))}
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
  const [sort, setSort] = useState<ColonisationSort>({
    key: "construction",
    direction: "asc",
  });
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
      sort={sort}
      onSort={(key) => setSort((current) => nextSort(current, key))}
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
  it("collapses the Contributions Cmdr and Construction levels", () => {
    const baseProps = {
      groups: [contributionGroup],
      sort: { key: "cmdr", direction: "asc" } as ColonisationSort,
      onSort: () => undefined,
      onToggleCommander: () => undefined,
      onToggleConstruction: () => undefined,
    };
    const { rerender } = render(
      <ColonisationContributionsTable
        {...baseProps}
        collapsedCommanderIds={
          new Set([
            colonisationContributionCommanderGroupKey(contributionGroup.id),
          ])
        }
        collapsedConstructionIds={new Set()}
      />,
    );
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("button", { name: "Expand Cmdr JanJonTheo" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByText("Ivaldi Foundry")).not.toBeInTheDocument();

    rerender(
      <ColonisationContributionsTable
        {...baseProps}
        collapsedCommanderIds={new Set()}
        collapsedConstructionIds={
          new Set([
            colonisationContributionConstructionGroupKey(
              contributionGroup.id,
              construction.id,
            ),
          ])
        }
      />,
    );
    expect(within(table).getByText("Ivaldi Foundry")).toBeInTheDocument();
    expect(
      within(table).getByRole("button", {
        name: "Expand construction Ivaldi Foundry",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByText("Aluminium")).not.toBeInTheDocument();
  });

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
        sort={{ key: "construction", direction: "asc" }}
        onSort={() => undefined}
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

  it("shows sortable contribution events with copy actions", () => {
    const constructionWithUnattributed: ColonisationConstruction = {
      ...construction,
      delivered: 50,
      commodities: construction.commodities.map((commodity) => ({
        ...commodity,
        delivered: 50,
        unrecorded: 10,
      })),
    };
    const groups = groupColonisationContributionRecords(
      includeUnattributedColonisationContributionRecords(
        normalizeColonisationContributionRecords(
          [
            {
              event_id: 1,
              timestamp: "2026-08-28T10:00:00Z",
              cmdr: "JanJonTheo",
              commodity: "Aluminium",
              quantity: 40,
              market_id: 42,
              construction: "Ivaldi Foundry",
              target_system: "Synookoi",
            },
            {
              event_id: 2,
              timestamp: "2026-08-28T11:00:00Z",
              cmdr: "JanJonTheo",
              commodity: "Water",
              quantity: 20,
              market_id: 42,
              construction: "Ivaldi Foundry",
              target_system: "Synookoi",
            },
          ],
          [constructionWithUnattributed],
        ),
        [constructionWithUnattributed],
      ),
    );
    function ContributionRecordsHarness() {
      const [sort, setSort] = useState<ColonisationSort>({
        key: "date",
        direction: "asc",
      });
      return (
        <ColonisationContributionRecordsTable
          groups={groups}
          sort={sort}
          onSort={(key) => setSort((current) => nextSort(current, key))}
          collapsedConstructionIds={new Set()}
          collapsedCommanderIds={new Set()}
          onToggleConstruction={() => undefined}
          onToggleCommander={() => undefined}
        />
      );
    }
    render(<ContributionRecordsHarness />);
    const table = screen.getByRole("table");
    expect(
      within(table).queryByRole("columnheader", { name: "Status" }),
    ).not.toBeInTheDocument();
    const constructionCopy = within(table).getByLabelText(
      "Copy construction name: Ivaldi Foundry",
    );
    expect(constructionCopy.parentElement).toHaveClass(
      "colonisation-copyable-value",
    );
    expect(constructionCopy.parentElement).toHaveTextContent("Ivaldi Foundry");
    expect(
      within(table).getAllByLabelText("Copy system name: Synookoi").length,
    ).toBeGreaterThan(0);
    const constructionRow = constructionCopy.closest("tr");
    expect(constructionRow).toHaveClass(
      "construction-group-row",
      "diff-positive",
    );
    expect(
      within(constructionRow!).getByLabelText("Construction incomplete"),
    ).toBeInTheDocument();

    const commodityNames = within(table)
      .getAllByText("Aluminium")
      .map((element) => element.closest(".commodity-name"));
    expect(commodityNames).not.toHaveLength(0);
    for (const commodityName of commodityNames) {
      expect(commodityName?.querySelector("i")).toBeNull();
      expect(commodityName?.querySelector("svg")).not.toBeNull();
    }
    expect(
      within(table).getByText("Cmdr Unattributed deliveries"),
    ).toBeInTheDocument();
    expect(
      within(table).getByText("Contribution unattributed"),
    ).toBeInTheDocument();

    const contributionRows = () =>
      within(table)
        .getAllByText(/Contribution [12]/)
        .map((element) => element.closest("tr")?.textContent);
    expect(contributionRows()[0]).toContain("Contribution 1");
    fireEvent.click(within(table).getByRole("button", { name: "Delivered" }));
    expect(contributionRows()[0]).toContain("Contribution 2");
  });
});
