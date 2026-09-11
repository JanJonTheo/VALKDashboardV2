# Konfliktdetails und Tick-Updates

## Darstellung

BGS-Watchlist und Record Details zeigen alle gemeldeten Konflikte eines Systems als getrennte Einträge. Die Detailansicht unter System intelligence verwendet dieselbe Darstellung. Pro Konflikt werden beide Fraktionen, Konflikttyp, Status, die gewonnenen Tage beider Parteien und ihre jeweiligen Stakes angezeigt. Soweit vorhanden, erscheint der Aktualisierungszeitpunkt. Null gewonnene Tage werden als `0` dargestellt; ein fehlender Spielstand als `—`.

Konfliktwarnungen unter BGS Alerts zeigen den historischen Stand ihres Auslöse-Ticks. Die darunterstehenden Fraktionswerte und die über Record Details geöffneten Systemdaten sind weiterhin aktuelle Daten. Discord-Konfliktmeldungen enthalten Spielstand und Stakes in den Snapshot-Feldern.

## Regeln

Die bestehende Bedingung `tenant_faction_new_conflict` umfasst jetzt neue Konflikte und Folgeupdates. Der Rules Catalog bezeichnet sie als „conflicts & tick updates“ und erklärt die Updates samt Spielständen und Stakes. Aktivierte persönliche, Mandanten- und Protected-Faction-Regeln verwenden dieselbe Logik; ihre gewählten Konflikttypen, Schweregrade und Versandkanäle bleiben erhalten. Die Standardkonfliktregeln sind Warnungen für Election und War.

- Eine Meldung je betroffenem Fraktionspaar und neuem abgeschlossenen System-Tick, auch bei unverändertem Spielstand.
- Pending → Active erscheint als Update, nicht als neuer Konflikt.
- Ein gemeldeter Übergang vom laufenden zum beendeten Konflikt erzeugt eine Abschlussmeldung. Ein unverändert beendeter Konflikt erzeugt keine weiteren Updates.
- Fehlt der Konflikt im neuen Snapshot, wird die alte Meldung erledigt; es wird kein nicht übermitteltes Endergebnis erfunden.
- Ein neuer Tick löst frühere Konfliktmeldungen ab. Alte Meldungen werden erledigt und ausstehende/retry Versandaufträge storniert. Bereits versandte Discord-Nachrichten bleiben erhalten.
- Gleiche Regel, gleiches Fraktionspaar und gleicher Tick bleiben durch die vorhandene Ereignisidentität gegen Duplikate geschützt.

Ein System-Tick setzt einen neuen abgeschlossenen Snapshot voraus; ein Kalendertag ohne neue Systemdaten erzeugt kein erfundenes Update. Neu aktivierte Regelpakete behalten ihr bisheriges Baseline-Verhalten.

## Einführung am 11.09.2026

Nach SQLite-Sicherung wurden historische Stakes und Spielstände für sieben Konfliktwarnungen bei East India Company und acht bei VALK Development aus exakt passenden Snapshots ergänzt. Bei Impactive Profit Protectors lagen keine Konfliktwarnungen vor. Keine historischen Snapshots fehlten. Bestehende Regelzustände starten Folgeupdates ab ihrem nächsten neuen Tick, damit die Einführung keine rückwirkende Meldungsserie auslöst.

Datenbanksicherung: `/home/valk/dashboard-v2/shared/conflict-updates-data-20260911T195541Z`.

Die Abschlussprüfung erfasste insgesamt acht Konfliktwarnungen bei East India Company und neun bei VALK Development. Je eine ältere Warnung für Sun Bat's Raiders / East India Company ließ sich keinem gleichartigen Fraktionspaar im zugehörigen Snapshot zuordnen. Ihre Detailfelder bleiben ausdrücklich unbekannt (`null`, `details_available=false`); bestehende Alarmfakten bleiben erhalten. Es wurden keine Stakes oder Spielstände aus einem anderen Konflikt übernommen. Abschließende Sicherung: `/home/valk/dashboard-v2/shared/conflict-updates-data-20260911T195938Z`.

Live: Backenddateien mit dem getesteten Stand verglichen, Dashboardrelease `20260911-conflict-updates` aktiv, Healthcheck für alle drei Mandanten erfolgreich.

Prüfung: 49 Backendtests einschließlich zweier gleichzeitiger Konflikte, mehrerer Ticks, wiederholter Auswertung, Abschluss und Discord-Details; neun Frontendtests für Normalisierung, Darstellung und Alert-Kontext. Typecheck, Lint und Produktionsbuild erfolgreich. Konfliktdarstellung mit langen Stakes, mehreren Konflikten und fehlenden Spielständen bei Desktop- und Mobilbreite visuell geprüft.

Hinweis zur Sicherungsbereinigung am 11.09.2026: Überholte Zwischenstände wurden entfernt. Noch vorhandene Sicherungen und separat erhaltene Bereinigungsberichte stehen in der [Sicherungsübersicht](BACKUP-RETENTION.md).
