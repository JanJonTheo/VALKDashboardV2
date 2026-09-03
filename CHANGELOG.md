# Changelog

Alle Änderungen von VALK Dashboard V2 seit dem initialen Repository-Stand, nach Datum absteigend. Die Einträge fassen die funktionalen und technischen Änderungen zusammen; die verlinkten Commits enthalten die vollständigen Dateidifferenzen.

Die Historie beginnt mit `c11adc9` vom 29.08.2026 und umfasst alle zehn bisher vorhandenen Commits sowie die anschließend deployten View-Änderungen. Zeitangaben beziehen sich auf Europe/Berlin (MESZ). Git dokumentiert Commit-, aber keine verlässlich rekonstruierbaren Push-Zeitpunkte; deshalb werden keine separaten Push-Daten behauptet. Es werden keine nachträglichen Release-Tags oder Versionsnummern erfunden.

## Noch nicht veröffentlicht

### Dokumentation

- Dieses Changelog mit der vollständigen bisherigen Änderungshistorie hinzugefügt.
- Changelog in der README verlinkt.

## 03.09.2026 – Einheitliche Evaluations-Details und periodenabhängige Discord-Berichte

Status: am 03.09.2026 um 10:59 MESZ auf [valk-elite.de](https://valk-elite.de) deployt. Release-Kennung: `20260903-104316-evaluation-details-discord-period`.

### Geändert und behoben

- Die Detailtabelle in Evaluations verwendet nun dieselben 15 Spalten in derselben Reihenfolge wie die Detailtabelle im Leaderboard.
- „Send Discord Report“ übermittelt die ausgewählte vordefinierte Periode sowie eigene Datums- und Monatsbereiche an das Backend; vollständige und Top-5-Berichte bleiben dabei erhalten.
- Unvollständige eigene Zeiträume deaktivieren den Versand und werden zusätzlich serverseitig abgelehnt, statt stillschweigend auf „All“ zurückzufallen.
- Preference-Schema auf Version 5 angehoben, damit bestehende Evaluations-Ansichten einmalig die vollständige neue Standardspaltenauswahl erhalten.
- Die BGS-Alertliste ist auf kleinen Ansichten per Tastatur fokussierbar, damit der horizontale Scrollbereich zugänglich bleibt.
- OpenAPI-Vertrag, generierte Typen sowie Unit- und Browser-Tests für Spaltenreihenfolge und Discord-Payloads erweitert.

### Deployment und Prüfung

- Lint, TypeScript-Prüfung, Linux-Produktionsbuild, 146 Unit-Tests und die vollständige Browser-Testmatrix mit 29 erfolgreichen und 4 planmäßig übersprungenen Tests ausgeführt.
- Den neuen Linux-Release separat gebaut und vor der Umschaltung intern geprüft; anschließend öffentliche HTTPS-, Authentifizierungs-, Better-Auth-, Datenparitäts-, Evaluations-, EDDN-, Watchlist-, Benutzerverwaltungs- und Preference-Smoke-Tests für alle drei Mandanten erfolgreich ausgeführt.
- Saved-Views-Smoke an Schema-Version 5 angepasst; alle temporären Benutzer-, Sitzungs-, View- und Watchlist-Daten wurden durch die Tests entfernt.
- Den vorherigen Dashboard-Release, das hochgeladene Deployment-Archiv und die Staging-Reste nach erfolgreicher Produktivprüfung entfernt.

## 03.09.2026 – Perioden- und Kennzahlenanalyse für Evaluations

Status: am 03.09.2026 um 01:27 MESZ auf [valk-elite.de](https://valk-elite.de) deployt. Release-Kennung: `20260903-012139-evaluation-period-metrics`.

### Hinzugefügt

- Perioden- und Kennzahlauswahl in Evaluations entsprechend dem Leaderboard ergänzt, einschließlich eigener Datums- und Monatsbereiche.
- Visual Analysis kann zwischen Summen als Balkendiagramm und historischem Verlauf als Liniendiagramm wechseln.
- Historische UTC-Zeitfenster für Tag, Woche, Monat, Jahr, die letzten zwölf Monate sowie Current Tick und Last Tick ergänzt.
- Eigene, mandantenfähige History-API mit den zwölf Leaderboard-Kennzahlen, Top 10 in der vollständigen Ansicht und Top 5 in der kompakten Ansicht ergänzt.

### Geändert und geprüft

- Die Evaluations-Detailtabelle folgt der gewählten Periode, bleibt aber unabhängig von der ausgewählten Kennzahl.
- Preference-Schema auf Version 4 erweitert; Diagrammtyp, Periode und Kennzahl werden in URL und gespeicherten Views berücksichtigt.
- Produktionsbuild, 141 Unit-Tests und der Evaluations-Browser-Test auf Desktop, Tablet und Smartphone erfolgreich ausgeführt.
- Das neue Linux-Release vor der Umschaltung separat gebaut und intern geprüft; anschließend Health-, HTTPS-, Authentifizierungs-, Datenparitäts- und Evaluations-History-Smoke-Tests erfolgreich ausgeführt.
- Alte serverseitige Dashboard-Releases, Datenbank- und Deployment-Sicherungen sowie Staging-Reste nach erfolgreicher Produktivprüfung entfernt.

## 30.08.2026 – Einheitliches Aktualisieren und persönliche Views

Status: am 30.08.2026 um 23:20 MESZ auf [valk-elite.de](https://valk-elite.de) deployt; zum Zeitpunkt der Changelog-Erstellung noch ohne eigenen Git-Commit. Grundlage ist `5bf927f` plus die Änderungen im Arbeitsverzeichnis. Release-Kennung: `20260830-saved-views-225358`.

### Hinzugefügt

- Persönliche, serverseitig gespeicherte Views für die filterbaren Dashboard-Ansichten: Analyse- und Operationsseiten, BGS Watchlist, BGS Alerts, Data Explorer und Verwaltung geschützter Fraktionen.
- Views speichern je nach Seite Suche, Filter, Sortierung, sichtbare Spalten, Seitengröße, Zeitraum, Kennzahl und Ansichtsvariante. In der Watchlist wird auch der gewählte Bereich beziehungsweise die geschützte Fraktion berücksichtigt.
- Views unter einem Namen speichern, wieder aufrufen, aktualisieren, umbenennen und nach Bestätigung löschen. Anzeige, wenn die aktuelle Ansicht vom gespeicherten Stand abweicht.
- Bis zu 20 Views pro Seite und Benutzer; Namen mit maximal 64 Zeichen, ohne Duplikate unabhängig von Groß-/Kleinschreibung. Zusätzlich gilt die bestehende Backend-Grenze von 16 KB pro Sammlung.
- Gemeinsame Seitensteuerung für Zurücksetzen und Aktualisieren sowie ein einheitliches View-Menü.

### Geändert und behoben

- Die bisher funktionslose Schaltfläche „Updated just now“ aktualisiert die aktuelle Seite und setzt deren Ansichtseinstellungen auf die Standardwerte zurück. Gespeicherte Views bleiben erhalten.
- Lokale „Refresh“-Schaltflächen laden Daten neu und behalten Filter und Sortierungen bei.
- Zurücksetzen und Wiederaufrufen einer View berücksichtigen auch die relevanten URL-Parameter und setzen die lokale Seitennavigation bei Bedarf zurück.
- View-Zustände werden beim Wechsel zwischen Funktionsseiten nicht versehentlich übernommen; beim Abmelden wird der Abfrage-Cache geleert.
- Laufende Ansichtseinstellungen werden verzögert gespeichert, explizite View-Aktionen ohne diese Verzögerung. Schreibzugriffe werden nacheinander ausgeführt.
- Speicherfehler werden sichtbar angezeigt. Nicht bestätigte Änderungen an gespeicherten Views werden zurückgenommen, während die aktuellen Arbeitsfilter erhalten bleiben.
- Bereits vor Abschluss des Ladens vorgenommene Benutzereingaben werden beim Übernehmen gespeicherter Einstellungen berücksichtigt.

### Datenkompatibilität und Qualität

- Preference-Schema auf Version 3 mit aktueller Ansicht, aktiver View-ID und benannten Views erweitert. Bisherige einzelne View-Einstellungen bleiben lesbar.
- Alte Watchlist-Sortierungen werden als Ausgangszustand übernommen. Die eigentliche Liste beobachteter Systeme bleibt von den Ansichtseinstellungen getrennt.
- Prüfung der tatsächlichen UTF-8-Größe einschließlich des an Flask gesendeten Umschlags; verständliche Fehlermeldung bei Überschreitung der 16-KB-Grenze.
- Unit-Tests für View-Schema, Seitensteuerung und API-Größenlimit sowie Browser-Tests für die unterschiedlichen Refresh-Funktionen und benannte Views ergänzt.
- Wiederverwendbaren Live-Test `deploy/saved-views-smoke.py` ergänzt: temporäre Views und kurzlebige Sitzungen werden nach dem Test bereinigt, vorhandene Benutzereinstellungen nicht überschrieben.
- Verifiziert: Lint, TypeScript, Linux-Produktionsbuild, 90 Unit-Tests und Browser-Tests der betroffenen Funktionen auf Desktop, Tablet und Smartphone.
- Speicherung, Umbenennen, Zurücksetzen, Wiederaufrufen und Löschen über die öffentliche HTTPS-Adresse in allen drei konfigurierten Mandanten geprüft. Benutzertrennung im Mandanten mit mehreren verfügbaren Testnutzern geprüft.
- Neues Release separat gebaut und vor der Umschaltung intern geprüft; vorherige Version als Rollback erhalten. Keine Änderung an Flask, Streamlit oder dem Discord-Bot für dieses Deployment.

## 30.08.2026, 16:43 – Korrekte Bezeichnungen im Fraktions-Regelkatalog

Commit: [5bf927f – Fix protected faction catalog labels](https://github.com/JanJonTheo/VALKDashboardV2/commit/5bf927f445aefd4d192751ac59b1ce5b813277fd)

- Bedingungen für geschützte Fraktionen werden in Katalog und Vorlageneditor als „Protected faction“ statt fälschlich als „Tenant faction“ bezeichnet.
- Zielabhängige Bezeichnungen für Einflussverlust, neue Konflikte, Unterschreiten eines Schwellenwerts und Annäherung anderer Fraktionen ergänzt.
- Bestehende Bezeichnungen für mandanteneigene Fraktionen beibehalten.
- Unit- und Browser-Tests für die zielabhängigen Texte ergänzt.

## 30.08.2026, 15:12 – Sichtbare Eingabe von Fraktions-Webhooks

Commit: [568abbb – Show protected faction webhook input](https://github.com/JanJonTheo/VALKDashboardV2/commit/568abbb35ed3050ca4ce5e5f999c8b42547198e0)

- Das Eingabefeld für neue beziehungsweise ersetzte Discord-Webhooks zeigt die eingegebene URL an, statt sie wie ein Passwort zu maskieren.
- URL-Eingabetyp verwendet und Rechtschreibprüfung deaktiviert.
- Bereits gespeicherte Webhook-URLs werden weiterhin nicht an den Browser zurückgegeben.
- Zugehörige Unit- und Browser-Tests angepasst.

## 30.08.2026, 14:42 – Fraktions-Autovervollständigung

Commit: [ac3e401 – Fix protected faction autocomplete](https://github.com/JanJonTheo/VALKDashboardV2/commit/ac3e4013aeb66dbf5c54c97388934a0304560ba5)

- Native Vorschlagsliste durch eine explizite, im Dashboard gestaltete EDDN-Autovervollständigung ersetzt.
- Auswahl per Maus sowie Pfeiltasten und Enter; Schließen per Escape oder Fokuswechsel.
- Zugängliche Combobox-/Listbox-Semantik und aktive Auswahl ergänzt.
- Ladezustand und fehlende Treffer sichtbar gemacht; freie Eingabe eines exakten Fraktionsnamens bleibt möglich.
- Veraltete Suchvorschläge werden während einer geänderten Suchanfrage nicht angezeigt.
- Tests für Vorschläge und Auswahlverhalten aktualisiert.

## 30.08.2026, 14:13 – Verwaltung geschützter Fraktionen

Commit: [e2375a0 – Add protected faction administration](https://github.com/JanJonTheo/VALKDashboardV2/commit/e2375a0b2d7e14d1ce4986dd1bbec5fcf5e78157)

- Admin-Seite `/admin/protected-factions` einschließlich Navigation und Zugriffsprüfung hinzugefügt.
- Geschützte Fraktionen auflisten, suchen, nach Aktivstatus filtern, anlegen und bearbeiten.
- Fraktionsname mit optionalen EDDN-Vorschlägen, Beschreibung und optionalem Discord-Webhook erfassen.
- Deaktivieren mit Bestätigung sowie dauerhaftes Löschen mit zusätzlicher Texteingabe zur Bestätigung.
- Gespeicherte Webhooks testen, ohne ihre URLs offenzulegen; Webhook-Verwaltung als reine Schreibeingabe umgesetzt.
- Geschützte API-Routen für Verwaltung, Kandidatensuche und Webhook-Test ergänzt.
- OpenAPI-Vertrag, generierte Typen sowie Berechtigungs-, Komponenten- und Browser-Tests erweitert.

## 30.08.2026, 11:03 – Native Deployment-Skripte

Commit: [32a93bc – Fix native deployment scripts](https://github.com/JanJonTheo/VALKDashboardV2/commit/32a93bc11e9271d389feac613b55d039634d4993)

- `start-native.sh`, `ensure-native.sh` und `install-https-vhost.sh` im Repository als ausführbar markiert.
- LF-Zeilenenden für Shell-Skripte über `.gitattributes` festgelegt, um Windows-/Linux-Kompatibilitätsprobleme zu vermeiden.

## 30.08.2026, 10:56 – Watchlist für geschützte Fraktionen

Commit: [f68c0d8 – Add protected factions watchlist](https://github.com/JanJonTheo/VALKDashboardV2/commit/f68c0d8ece475fbb103fb5661987b4e71ac444f8)

- Geschützte Fraktionen als zusätzlichen Bereich der BGS Watchlist integriert.
- Fraktionsauswahl und zugehörige Systemdaten über eine eigene geschützte API-Route angebunden; Filterung, Sortierung und Seitennavigation ergänzt.
- Regelkatalog um den Zieltyp `protected_faction` erweitert.
- Frühwarnpakete gezielt auf eine geschützte Fraktion anwenden; zugehörige Paket-/Regelzuordnung in der Oberfläche berücksichtigen.
- OpenAPI und generierte Typen für geschützte Watchlists und Regelziele erweitert.
- API-, Komponenten-, Regelkatalog- und Browser-Tests ergänzt.

## 30.08.2026, 05:10 – BGS-Warnungen im Command Center

Commit: [98c259c – Add BGS alerts to command center](https://github.com/JanJonTheo/VALKDashboardV2/commit/98c259c6e091426620c91b17f6fe4e74e73fb811)

- Aktive persönliche und mandantenweite BGS-Warnungen direkt auf der Startseite angezeigt, einschließlich Schweregrad, Zeit, System, Regel und Gelesen-Status.
- Anzahl aktiver und ungelesener Warnungen sowie Verknüpfung zur vollständigen Warnungsübersicht ergänzt.
- Lade-, Fehler- und Leerzustände sowie automatische Aktualisierung der Startseitenwarnungen ergänzt.
- Gemeinsamen Client zum Laden von BGS-Warnungen eingeführt.
- Layout des Command Centers und Darstellung des Aktivitätsdiagramms angepasst; Browser-Tests erweitert.

## 30.08.2026, 03:56 – Intelligence, Command Center und erweiterte Analysen

Commit: [3cc8c85 – Expand dashboard intelligence and command center](https://github.com/JanJonTheo/VALKDashboardV2/commit/3cc8c8598bba2c8133922367dd03579c0fb820ce)

### Command Center

- Startseiten-Kennzahlen und Commander-Aktivität aus den Leaderboard-Daten zusammengeführt: Einfluss, Kopfgutscheine, Erkundungsverkäufe, Kampfprämien und Handelsvolumen.
- Beitragsanteile mit exakten Werten und Prozentangaben im Aktivitätsdiagramm ergänzt; leere beziehungsweise ungültige Summen berücksichtigt.
- Anzeige des letzten Galaxy-Ticks, geschätzten nächsten Ticks und Countdowns einschließlich Überfälligkeit ergänzt. Die Schätzung verwendet einen Abstand von 24 Stunden.
- Navigation, responsive Darstellung und Demo-Daten erweitert.

### BGS Watchlist, Regeln und Warnungen

- Globale Watchlist auf Basis der Systeme mit Präsenz der Mandantenfraktion ergänzt, einschließlich serverseitiger Filterung, Sortierung und Seitennavigation.
- Watchlist-Statistiken und erweiterte System-/Fraktionsdarstellung einschließlich stabiler Fraktionsfarben und Supermacht-Symbole ergänzt.
- Persönliche und mandantenweite BGS-Regeln mit System- oder Watchlist-Bezug verwalten; Schwellenwerte, Zeitfenster, Schweregrad und Benachrichtigungsziele konfigurieren.
- Regelvorlagen und -pakete anzeigen, verwalten, anwenden und synchronisieren; Frühwarnbedingungen für Einflussänderungen, Abstände und Konflikte integriert.
- Warnungszentrum mit Filtern und persistentem Bearbeitungszustand angebunden.
- BGS-KI-Oberfläche für Risiko- und Strategieberichte ergänzt, einschließlich passender Berechtigungen und längerer API-Zeitlimits.
- Persönliche Discord-Webhooks im Konto verwalten und testen; persönliche und mandantenweite Benachrichtigungsziele getrennt validieren.
- Berechtigungen für persönliche Regeln, Mandantenregeln und BGS-KI ergänzt.

### Colonisation

- Contributions, Constructions, Commodity-Gruppierung und chronologische Contribution Events erweitert.
- Mehrfachauswahl für Commander und Waren sowie Filter für System, Status und Datumsbereich ergänzt; aktive Filter und Sortieroptionen in die Oberfläche integriert.
- Mehrstufige Gruppen unabhängig ein- und ausklappbar gemacht; Sortierung, Kopieraktionen, Fertigstellungsanzeige und Mengen-/Differenzdarstellung verbessert.
- Aggregation doppelter Beiträge sowie nicht zugeordneter Lieferungen berücksichtigt, ohne vorhandene Ereignisse doppelt zu zählen.
- Gesamtbedarf und Bausummen beim Filtern konsistent gehalten.
- Visuelle Auswertung mit Top 5, Top 10 oder Top 25 und Auswahl anhand der jüngsten Ereignisse ergänzt.

### Data Explorer und technische Ergänzungen

- Eigenständigen Data Explorer mit auswählbaren Tabellen und Standardtabelle `event` eingeführt.
- Legacy-Filter für Commander, Event, Tick-ID, Colonisation und Datum sowie Volltextsuche, serverseitige Sortierung und Seitengröße angebunden.
- JSON-Detailansicht und CSV-Export ausgewählter Datensätze ergänzt; horizontal und vertikal scrollbar, einschließlich Touch-Bedienung.
- Zwischenablage-Fallback für Umgebungen ohne verfügbare Clipboard-API ergänzt.
- EDDN-Metadaten-Backfill-Skript für Fraktionen und passende Laufzeitkonfiguration hinzugefügt.
- OpenAPI-Verträge, generierte API-Typen, Normalisierung, Demo-Daten und Live-Auth-/Datenparitätsprüfungen erweitert.
- Unit-, Komponenten-, Browser- und Barrierefreiheitstests für die neuen Funktionen ergänzt.

## 29.08.2026, 03:22 – Erste vollständige Dashboard-Implementierung

Commit: [b460a58 – Build tenant-aware VALK Dashboard V2](https://github.com/JanJonTheo/VALKDashboardV2/commit/b460a58f53df2f9cb03c464ff084bc96422d64ff)

### Anwendung und Darstellung

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 und Radix-basierte UI-Grundbausteine eingerichtet.
- Responsives VALK-Design mit App-Shell, Navigation, Anmeldeseite, Kontoansicht, Metadaten, Manifest und OpenGraph-Bild aufgebaut.
- TanStack Query für Datenabfragen und Aktualisierungen, TanStack Table für Tabellen und ECharts mit tabellarischer Alternative für Diagramme integriert.
- Demo-Modus mit unterschiedlichen Benutzerrollen und Beispieldaten ergänzt.

### Fachfunktionen

- Startseite mit Berichtsübersicht und Kennzahlen umgesetzt.
- Analyse-Seiten für Leaderboard, Evaluations einschließlich Full/Top-5-Ansicht und Discord-Bericht, Monthly Performance mit KI-Bewertung, Commander, Recruits, eingelöste Kopfgutscheine sowie Space-/Ground-Conflict-Zones hinzugefügt.
- Zeitraum-, Datums-, Monats- und fachbezogene Filter, Kennzahlenauswahl, Tabellen-/Diagrammansichten, Sortierung und benutzerbezogene Ansichtseinstellungen eingeführt.
- Objectives mit validierter Eingabe sowie Colonisation-Beiträge, Bauvorhaben, gruppierte Waren-/Commander-Darstellung und Fortschrittsanzeigen umgesetzt.
- Systeminformationen aus EDDN und 24-Stunden-Fraktionsberichte integriert.
- Persönliche System-Watchlist mit Favoriten, Sektor-/Projektangaben, Sortierung, Filtern, Einflussverläufen und Fraktions-/Konfliktdetails aufgebaut.
- Stationsdaten, Systemkarte und Detailansichten über eigene API-Routen angebunden.
- Erste Data-Explorer- und Service-/Audit-Ansichten sowie Benutzeradministration ergänzt.

### Anmeldung und Sicherheit

- Bestehende mandantenlokale Anmeldung über Benutzername und Passwort an Flask angebunden; Mandantenauswahl und gemerkte Auswahl integriert.
- Signierte HttpOnly-Sitzungen mit zwölf Stunden Laufzeit und Rollen Member, Leadership und Admin eingeführt.
- Same-Origin-Backend-for-Frontend mit serverseitiger Auflösung der Mandanten-API-Schlüssel und Datenbankzuordnung eingerichtet.
- Benutzer anlegen, Rollen ändern, sperren/entsperren, löschen und Passwörter zurücksetzen; Einmalpasswort und verpflichtenden Passwortwechsel unterstützt.
- Kontoprofil, Passwortwechsel und Zugriffsübersicht hinzugefügt.
- Better-Auth-Anbindung für explizit verknüpfte Google-/Discord-Konten pro Mandant vorbereitet: keine soziale Selbstregistrierung oder automatische Verknüpfung anhand gleicher E-Mail-Adresse; Sitzungstransfer und verschlüsselte Provider-Tokens berücksichtigt.
- Sicherheitsheader, Prüfung der Request-Herkunft und sichere öffentliche URL-Konfiguration ergänzt; Mandantenschlüssel und Provider-Geheimnisse bleiben serverseitig.

### Betrieb, Verträge und Tests

- Native Node.js-Start- und Healthcheck-Skripte, Laufzeitkonfiguration, SQLite-Runtime-Prüfung sowie nginx-/HTTPS-Einrichtung hinzugefügt.
- Dockerfile und Compose-Konfiguration als zusätzliche Repository-Artefakte aufgenommen; native Bereitstellung dokumentiert.
- Hilfsskripte zur Watchlist-Vorbelegung, Laufzeitkonfiguration und Produktionsprüfung von Anmeldung, Benutzerverwaltung, Datenparität und Preferences ergänzt.
- OpenAPI-3.1-Vertrag und daraus generierte TypeScript-Typen eingeführt.
- ESLint, Vitest, Testing Library, Playwright und axe-core eingerichtet; Desktop-, Tablet- und Smartphone-Testprofile angelegt.
- README, Konfigurationsbeispiel, Entwicklungsanweisungen, Paritätsinventar und Deployment-/Rollback-Dokumentation ergänzt.
- Parallelen Betrieb mit Streamlit und die unveränderte Zuständigkeit des separaten Discord-Bots als Integrationsgrenze dokumentiert.

## 29.08.2026, 03:19 – Initialer Repository-Stand

Commit: [c11adc9 – Initial commit](https://github.com/JanJonTheo/VALKDashboardV2/commit/c11adc9c38be7f49db1ac551cde2498ce12a32de)

- Repository mit GNU General Public License, Version 3, initialisiert.
- Noch kein Anwendungscode; dieser folgt mit `b460a58`.

## Pflege

- Neue Änderungen oben unter „Noch nicht veröffentlicht“ ergänzen; beim Release Datum, nachvollziehbare Git-Referenz und gegebenenfalls bestätigten Deployment-Status eintragen.
- Bereits deployte, aber noch nicht committede Änderungen ausdrücklich kennzeichnen und ihre Commit-Referenz nachtragen, sobald sie existiert.
- Funktionen, Fehlerbehebungen, Sicherheit, Datenkompatibilität, Betrieb und Tests dokumentieren; keine Zugangsdaten oder internen Geheimnisse aufnehmen.
- Commit- und Deployment-Zeitpunkte nicht gleichsetzen. Änderungen an anderen Repositories nur nennen, wenn sie belegt und Bestandteil des jeweiligen Releases sind.
