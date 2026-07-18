# Operative Kommunikation

Die EinsatzWerk-Kommunikation verbindet Disposition und Außendienst direkt mit
dem jeweiligen Auftrag und Einsatz. Sie ist kein allgemeiner Chat, sondern ein
nachvollziehbarer Teil des Arbeitsablaufs.

## Automatische Ereignisse

EinsatzWerk erzeugt adressierte Meldungen bei:

- Zuweisung eines neuen Einsatzes
- Termin- oder Technikerwechsel
- Neuberechnung der Tagesroute
- Stornierung eines Auftrags
- Anforderung, Freigabe, Bestellung, Eingang oder Ablehnung eines Teils
- Einsatzabschluss oder notwendigem Folgeeinsatz
- neuem Einsatzfoto und neuer Kundenunterschrift

Kritische Änderungen müssen vom Techniker bestätigt werden. Bei einer
Terminverschiebung speichert die Meldung sowohl den bisherigen als auch den
neuen Stand. Zustellung, Lesen und Bestätigung werden getrennt protokolliert.

## Benachrichtigung

Office und Technikeroberfläche fragen neue Ereignisse in kurzen Intervallen ab.
Dadurch funktioniert die Kommunikation auch ohne zusätzlichen WebSocket-Dienst.
Für wichtige Meldungen stehen zur Verfügung:

- sichtbarer Screen Pop
- Ton und auf Mobilgeräten Vibration
- Systembenachrichtigung nach Freigabe durch den Benutzer
- Zähler für ungelesene Nachrichten
- direkter Sprung zum Auftrag oder Einsatz

Der Polling-Fallback bleibt auch dann nutzbar, wenn Redis oder ein später
ergänzter Realtime-Dienst kurzfristig nicht erreichbar ist.

## Nachrichten

Nachrichten können einem Techniker und optional einem Auftrag zugeordnet werden.
Unterstützt werden:

- normale, wichtige und dringende Nachrichten
- verpflichtende Bestätigung durch den Techniker
- Fotos und Dokumente bis 20 MB
- Schnellantworten: `Übernommen`, `Bin unterwegs`, `Rückfrage`, `Teil fehlt`
- sichere Downloads nur für Absender, Empfänger oder berechtigte
  organisationsinterne Rundmeldungen

Alle Daten sind nach Organisation getrennt. Originaldateien werden außerhalb
des öffentlichen Webroots auf dem Laravel-Storage gespeichert.
