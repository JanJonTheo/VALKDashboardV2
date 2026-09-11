# Gap-Warnungen bei Konflikten

Stand: 11.09.2026, Backend live aktualisiert.

## Verhalten

Eine Gap-Warnung kündigt einen geringen Einflussabstand an. Besteht zwischen genau diesen Fraktionen bereits ein angekündigter oder aktiver Konflikt, ist sie überflüssig. Die Auswertung von `tenant_faction_gap` und `controller_gap` unterdrückt deshalb das betreffende Paar bei War, Civil War und Election im aktuellen abgeschlossenen System-Snapshot. Persönliche Regeln, Mandantenregeln und Regeln für geschützte Fraktionen verwenden dieselbe Prüfung.

Andere Fraktionspaare im selben System bleiben auswertbar. Ein beendeter Konflikt blockiert die Gap-Regel nicht. Nach Konfliktende kann eine weiterhin unterschrittene Gap-Schwelle erneut ein Ereignis auslösen. Die Konfiguration und Auswertung der eigenständigen Konfliktregel bleiben unverändert.

Bereits offene Gap-Alarme werden bei der folgenden Regelauswertung erledigt, wenn ihre Bedingung durch den Konflikt inaktiv wird. Ausstehende und zur Wiederholung vorgesehene Versandaufträge dieser Alarme werden storniert. Bereits versandte Discord-Nachrichten bleiben bestehen.

## Bestandsbereinigung

Entfernt wurden Gap-Alarme, deren konkretes Fraktionspaar im historischen Auslösesnapshot bereits im Konflikt stand, sowie noch offene Gap-Alarme, deren Paar im neuesten abgeschlossenen Snapshot im Konflikt steht. Die Zuordnung erfolgt über System, Snapshot und Fraktionspaar; gleiche Systemnamen allein genügen nicht.

| Mandant | Entfernte Gap-Alarme | Verbleibende Gap-Alarme |
|---|---:|---:|
| East India Company | 4 | 19 |
| VALK Development | 5 | 19 |
| Impactive Profit Protectors | 0 | 0 |

Die Nachprüfung ergab null weitere Kandidaten in allen drei Mandanten. In `Flyua Eork IK-C a81-0` blieb die Konfliktmeldung zwischen East India Company und Orion's Guardians in beiden betroffenen Mandanten erhalten. Alle übrigen Alarm-IDs aus den Sicherungen sind weiterhin vorhanden. Löschtrigger entfernen zugehörige Versandaufträge und Lesestände und hinterlegen Ereignis-Tombstones gegen eine erneute Anlage desselben Ereignisses.

## Prüfung und Sicherungen

- 41 Tests für Regelauswertung und Regressionen erfolgreich, darunter Konflikttypen, Pending/Active, umgekehrte Fraktionsreihenfolge, fremde Konfliktparteien, Konfliktende, Controller-Gap, Bereinigungszuordnung und Versandstornierung.
- Installierte Backenddatei gegen die getestete Datei geprüft; Backenddienst aktiv und Dashboard-Healthcheck für drei konfigurierte Mandantendatenbanken erfolgreich.
- Quellcodesicherung: `/home/valk/dashboard-v2/shared/conflict-gap-source-20260911T132948Z`.
- SQLite-Sicherungen der betroffenen Mandanten und Bereinigungsprotokolle: `/home/valk/dashboard-v2/shared/conflict-gap-backup-20260911T133025238484Z`.
- Backenddateien: `EICFlaskServer/bgs_rule_scheduler.py`, `EICFlaskServer/repair_conflict_gaps.py`, `EICFlaskServer/tests/test_conflict_gap.py`.

Das Bereinigungsskript arbeitet standardmäßig als Vorschau. `--apply` erstellt vor Löschungen eine SQLite-Sicherung je betroffenem Mandanten. Die Live-Prüfung hat zusätzlich die erhaltenen übrigen Alarm-IDs und die Lösch-Tombstones kontrolliert.

Hinweis zur Sicherungsbereinigung am 11.09.2026: Überholte Zwischenstände wurden entfernt. Noch vorhandene Sicherungen und separat erhaltene Bereinigungsberichte stehen in der [Sicherungsübersicht](BACKUP-RETENTION.md).
