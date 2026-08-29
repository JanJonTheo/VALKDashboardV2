import { describe,expect,it } from "vitest";
import { formatValue } from "@/lib/utils";

describe("formatValue",()=>{it("formats large dashboard numbers",()=>{expect(formatValue(184_200_000)).toBe("184.2M");expect(formatValue(5_820_000_000)).toBe("5.82B")});it("uses an em dash for missing data",()=>{expect(formatValue(null)).toBe("—")})});
