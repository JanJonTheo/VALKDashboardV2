import { humanizeBgsValue, type WatchedConflict } from "@/lib/system-watchlist";

export function ConflictDetails({
  conflicts,
  title = "Current conflicts",
}: {
  conflicts: WatchedConflict[];
  title?: string;
}) {
  if (!conflicts.length) return null;
  return (
    <section className="conflict-details" aria-label={title}>
      <h3>{title}</h3>
      {conflicts.map((conflict, index) => (
        <article key={`${conflict.faction1}-${conflict.faction2}-${index}`}>
          <header>
            <strong>{humanizeBgsValue(conflict.type) || "Conflict"}</strong>
            <span>
              {humanizeBgsValue(conflict.status) || "Status unavailable"}
            </span>
          </header>
          <div className="conflict-parties">
            {[1, 2].map((side) => {
              const first = side === 1;
              return (
                <div key={side}>
                  <strong>
                    {(first ? conflict.faction1 : conflict.faction2) ||
                      "Unknown faction"}
                  </strong>
                  <dl>
                    <div>
                      <dt>Won days</dt>
                      <dd>
                        {(first ? conflict.wonDays1 : conflict.wonDays2) ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Stake</dt>
                      <dd>
                        {(first ? conflict.stake1 : conflict.stake2) ||
                          "None reported"}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          {conflict.updatedAt && <small>Updated: {conflict.updatedAt}</small>}
        </article>
      ))}
    </section>
  );
}
