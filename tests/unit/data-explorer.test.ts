import { describe, expect, it } from "vitest";
import {
  buildEventFilters,
  collectExplorerFilterOptions,
  explorerJsonText,
  isDataExplorerTable,
  orderExplorerColumns,
  parseExplorerJson,
  rowMatchesExplorerSearch,
  rowsToClipboard,
  rowsToCsv,
} from "@/lib/data-explorer";

describe("data explorer helpers", () => {
  it("restricts table names to the selectable tenant tables", () => {
    expect(isDataExplorerTable("event")).toBe(true);
    expect(isDataExplorerTable("mission_completed_event")).toBe(true);
    expect(isDataExplorerTable("sqlite_master")).toBe(false);
    expect(isDataExplorerTable("event; drop table event")).toBe(false);
  });

  it("builds structured event and inclusive date filters", () => {
    expect(
      buildEventFilters({
        cmdr: " TORVYR ",
        event: "",
        tickid: "tick-42",
        colonisationOnly: true,
        dateFilter: true,
        fromDate: "2026-08-28",
        toDate: "2026-08-29",
      }),
    ).toEqual([
      { field: "cmdr", operator: "eq", value: "TORVYR" },
      { field: "event", operator: "contains", value: "Colonisation" },
      { field: "tickid", operator: "eq", value: "tick-42" },
      {
        field: "timestamp",
        operator: "gte",
        value: "2026-08-28T00:00:00Z",
      },
      {
        field: "timestamp",
        operator: "lte",
        value: "2026-08-29T23:59:59.999Z",
      },
    ]);
  });

  it("lets an explicit event override colonisation-only", () => {
    const filters = buildEventFilters({
      cmdr: "",
      event: "FSDJump",
      tickid: "",
      colonisationOnly: true,
      dateFilter: false,
      fromDate: "",
      toDate: "",
    });
    expect(filters).toEqual([
      { field: "event", operator: "eq", value: "FSDJump" },
    ]);
  });

  it("searches scalar, nested and raw_json content", () => {
    const row = {
      id: 7,
      event: "FSDJump",
      raw_json: '{"StationFaction":{"Name":"East India Company"}}',
      nested: { state: "Boom" },
    };
    expect(rowMatchesExplorerSearch(row, "east india")).toBe(true);
    expect(rowMatchesExplorerSearch(row, "boom")).toBe(true);
    expect(rowMatchesExplorerSearch(row, "missing")).toBe(false);
  });

  it("orders event columns like the legacy viewer and retains extras", () => {
    expect(
      orderExplorerColumns(
        ["custom", "raw_json", "cmdr", "id", "timestamp"],
        "event",
      ),
    ).toEqual(["id", "timestamp", "cmdr", "raw_json", "custom"]);
  });

  it("collects sorted dropdown options and known colonisation events", () => {
    const options = collectExplorerFilterOptions([
      { cmdr: "Zed", event: "FSDJump", tickid: "tick-1" },
      { cmdr: "alpha", event: "Docked", tickid: "tick-2" },
      { cmdr: "Zed", event: "Docked", tickid: "tick-2" },
    ]);
    expect(options.cmdrs).toEqual(["alpha", "Zed"]);
    expect(options.events).toContain("ColonisationContribution");
    expect(options.tickids).toEqual(["tick-2", "tick-1"]);
  });

  it("parses JSON and conservative Python literal payloads without eval", () => {
    expect(parseExplorerJson('{"Docked":false,"StarPos":[1,2,3]}')).toEqual({
      Docked: false,
      StarPos: [1, 2, 3],
    });
    expect(
      parseExplorerJson(
        "{'Docked': False, 'Station': None, 'Name': 'Arc Town'}",
      ),
    ).toEqual({ Docked: false, Station: null, Name: "Arc Town" });
    expect(explorerJsonText('{"event":"StartUp"}')).toBe(
      '{\n  "event": "StartUp"\n}',
    );
  });

  it("quotes CSV and clipboard values without losing JSON", () => {
    const rows = [
      { id: 1, note: 'value, with "quotes"', raw_json: { ok: true } },
    ];
    expect(rowsToCsv(rows, ["id", "note", "raw_json"])).toContain(
      '"value, with ""quotes"""',
    );
    expect(rowsToClipboard(rows, ["id", "raw_json"])).toBe(
      'id\traw_json\r\n1\t"{""ok"":true}"',
    );
    expect(rowsToCsv([{ value: '=HYPERLINK("bad")' }])).toContain(
      "'=HYPERLINK",
    );
  });
});
