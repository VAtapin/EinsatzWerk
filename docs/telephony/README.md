# Telefonie in EinsatzWerk

EinsatzWerk besitzt einen providerunabhängigen Telefonie-Eingang. Jede
Telefonanlage wird durch einen Adapter auf ein gemeinsames internes Ereignis
abgebildet:

- Provider und externe Call-ID
- Richtung und Status (`ringing`, `accepted`, `ended`, `missed`)
- Anrufer-, Ziel- und Nebenstellennummer
- Anzeigename, Zeitpunkt und Gesprächsdauer
- unveränderte Originaldaten des Providers

Die Original-Rufnummern in den Kundendaten werden nicht umgeschrieben. Für die
Suche erzeugt EinsatzWerk ausschließlich im Speicher Vergleichsvarianten
(Ziffernformat und deutsche `+49`/`0`-Variante). Ein Kunde wird nur bei einem
eindeutigen Treffer automatisch zugeordnet.

## Ablauf im Office

1. Die Telefonanlage sendet ein Ereignis an den geheimen Webhook.
2. EinsatzWerk ordnet die Rufnummer organisationsbezogen einem Kunden zu.
3. Im Office erscheint der Screen Pop mit Kunde, Serviceadressen, Geräten und
   offenen Aufträgen.
4. Ein Klick öffnet die Anrufannahme mit vorausgewähltem Kunden. Bei unbekannter
   Rufnummer öffnet sich die Neukundenaufnahme mit vorausgefüllter Rufnummer.
5. Mehrdeutige Treffer werden dem Disponenten zur Auswahl angeboten.

Der Browser fragt neue Ereignisse derzeit alle zwei Sekunden ab. Der
Provider-Webhook zum Backend arbeitet sofort; die Browser-Abfrage ist bewusst
als robuste Basis ohne Abhängigkeit von einem WebSocket-Dienst ausgeführt.

## Einrichtung in EinsatzWerk

Unter **Einstellungen → Telefonie & Screen Pop**:

1. `3CX verbinden` oder `Placetel verbinden` wählen.
2. Die einmalig angezeigten geheimen URLs sicher speichern.
3. Die URLs in der Telefonanlage eintragen.
4. Mit einer vorhandenen Kundennummer einen Testanruf auslösen.

Der Pfad enthält einen 64 Zeichen langen geheimen Schlüssel. Er übernimmt die
Authentifizierung eingehender Provider-Callbacks. Bei Verdacht auf Offenlegung
muss der Schlüssel rotiert und anschließend beim Provider ersetzt werden.

## 3CX

EinsatzWerk unterstützt zwei 3CX-Wege über denselben Adapter.

### CRM Integration

Die von EinsatzWerk angezeigte **Kontaktsuche** wird im 3CX CRM Integration
Wizard als `GET`-Abfrage verwendet. Der Platzhalter `[Number]` bleibt in der
URL stehen. Die Antwort enthält unter anderem:

- `id` / `entity_id`
- `first_name`, `last_name`, `company_name`
- `business_phone`, `business_phone_2`
- `email_for_3cx`
- `contact_url`

`contact_url` führt direkt zur EinsatzWerk-Anrufannahme des Kunden.

Für das Call Journaling wird die angezeigte **Ereignis-Webhook-URL** als
`POST`-Ziel verwendet. Der Adapter akzeptiert insbesondere:

```json
{
  "call_id": "3cx-call-1001",
  "event": "IncomingCall",
  "direction": "inbound",
  "party_caller_id": "+493332123456",
  "party_did": "100",
  "party_caller_name": "Peter Müller"
}
```

Weitere Ereignisse derselben Verbindung verwenden dieselbe `call_id`, etwa
`Accepted` und `Hungup`, optional mit `duration`.

### Call Control API

Der Adapter verarbeitet außerdem Ereignishüllen der 3CX Call Control API,
einschließlich `AttachedData`, `Response`, `RequestData` und
`participants`. Ein kleiner Connector kann die WebSocket-Ereignisse der
Call-Control-API an die Ereignis-Webhook-URL weiterreichen.

Die Call Control API ist laut 3CX ab Version 20 Update 2 verfügbar und setzt
eine 8SC+ Enterprise-Lizenz voraus. Für Installationen ohne diese Lizenz bleibt
die CRM-Integration der einfachere Weg.

Offizielle Dokumentation:

- <https://www.3cx.com/docs/crm-integration/>
- <https://www.3cx.com/docs/crm-template-xml-description/>
- <https://www.3cx.com/docs/call-control-api/>

## Placetel

Placetel registriert Callback-Ziele über die API v2. EinsatzWerk zeigt beim
Anlegen bereits den passenden Subscription Body:

```json
{
  "service": "einsatzwerk",
  "url": "https://api.example/api/v1/telephony/placetel/SECRET/events",
  "incoming": true,
  "outgoing": true,
  "accepted": true,
  "hungup": true,
  "phone": true
}
```

Dieser Body wird mit einem Placetel API Token an
`PUT https://api.placetel.de/v2/subscriptions` gesendet. Placetel sendet danach
Call-Callbacks an die angegebene URL. Der EinsatzWerk-Adapter versteht unter
anderem:

```text
call_id=12345
event=IncomingCall
from=+493332123456
to=493332100
```

Beim Auflegen kommen je nach Ereignis zusätzlich `direction`, `duration` und
`type` (zum Beispiel `missed`).

Offizielle Dokumentation:

- <https://api.placetel.de/>

## Weitere Provider

Neue Anbieter implementieren lediglich
`App\Telephony\Contracts\TelephonyProviderAdapter`. Der Generic-Adapter kann
bereits für einfache Webhooks mit üblichen Feldnamen eingesetzt werden. Die
Provider-Rohdaten bleiben in jedem Fall am Ereignis gespeichert, sodass ein
neuer Adapter ergänzt werden kann, ohne die Fachlogik oder den Screen Pop zu
ändern.

## Test und Diagnose

- **Testanruf** in den Einstellungen prüft Matching und Screen Pop ohne echte
  Telefonanlage.
- `telephony_integrations.last_event_at` zeigt, ob Callbacks eintreffen.
- Jedes Provider-Ereignis wird unveränderlich in `telephony_call_events`
  gespeichert.
- Wiederholte Provider-Zustellungen werden über einen Ereignis-Hash
  dedupliziert.
- Alle Abfragen und Zuordnungen sind strikt auf die jeweilige Organisation
  beschränkt.
