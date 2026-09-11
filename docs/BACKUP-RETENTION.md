# Serverseitige Sicherungen

Bereinigung am 11.09.2026 im Verzeichnis `/home/valk/dashboard-v2/shared`.

## Aufbewahrt

- `housekeeping-backup-20260911`: drei Mandantendatenbanken und Backendquellen vor der Alarmbereinigung.
- `conflict-updates-data-20260911T195938Z`: letzte Sicherung aller drei Mandantendatenbanken im Rahmen der Konfliktdaten-Ergänzung.
- `conflict-updates-source-20260911T195647Z`: Backendquellen vor Einführung der Konfliktupdates.
- `backup-cleanup-reports-20260911`: ursprüngliche Gap-Bereinigungsberichte und Manifest der entfernten Sicherungen.

Die sechs aufbewahrten Datenbanksicherungen wurden vor dem Löschen mit SQLite `quick_check` geprüft. Laufende Datenbanken, Dashboard-Releases und `runtime.env` sind von dieser Bereinigung ausgeschlossen.

## Entfernte Zwischenstände

- `conflict-gap-backup-20260911T133025238484Z` (Berichte separat erhalten)
- `conflict-gap-source-20260911T132948Z`
- `admin-alerts-source-20260911T191717Z`
- `conflict-updates-data-20260911T195541Z`
- `conflict-updates-data-20260911T195855Z`
- `eic-before-initial-alerts-a87852e69a8141e495288dee87fb832e.db`
- `eic-before-master-sync-75a99ae971854299ae07108d8f05023f.db`
- `eic-before-master-sync-ffee6b4d7de34d738cebc8b2e0672e63.db`

Dies ist eine gezielte einmalige Bereinigung, keine automatisch laufende Aufbewahrungsregel. Ältere Dokumentation nennt teilweise die ursprünglichen Sicherungspfade; maßgeblich für noch vorhandene Sicherungen ist diese Übersicht.

Entfernte Dateigröße insgesamt: 2.130.063.713 Bytes (rund 2,13 GB). Alle sechs SQLite-Prüfungen waren erfolgreich.
