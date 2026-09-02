import "server-only";

const galaxyTickUrl =
  process.env.GALAXY_TICK_URL ?? "http://tick.infomancer.uk/galtick.json";

export async function getLastGalaxyTick() {
  try {
    const response = await fetch(galaxyTickUrl, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { lastGalaxyTick?: unknown };
    if (typeof body.lastGalaxyTick !== "string") return null;

    const lastTick = body.lastGalaxyTick.trim();
    return lastTick && Number.isFinite(Date.parse(lastTick)) ? lastTick : null;
  } catch {
    return null;
  }
}
