# Kitzair Hubschrauber-Berechnungstool

Premium-Berechnungstool für Hubschrauber-Transfers. Beide Helikopter-Typen werden nach Eingabe sofort berechnet. Enthält Karte (Leaflet), Wetter, Sunrise/Sunset und Adresssuche für den nächsten Startort.

## Einbettung in die Kundenwebseite

### Option 1: Iframe

```html
<iframe
  src="https://[IHRE-APP-URL]/?embed=1"
  title="Hubschrauber-Transfer Berechnung"
  width="100%"
  height="800"
  style="min-height: 600px; border: none;"
></iframe>
```

### Option 2: Kitzair Loader (JavaScript-Snippet)

Ein leeres Container-Element mit einer ID anlegen und das Script mit `data-kitzair-target` auf diese ID verweisen:

```html
<div id="kitzair-tool"></div>
<script
  src="https://[IHRE-APP-URL]/kitzair-loader.js"
  data-kitzair-target="kitzair-tool"
  data-kitzair-width="100%"
  data-kitzair-height="800px"
  data-kitzair-min-height="600"
></script>
```

- **data-kitzair-target** (Pflicht): ID des HTML-Elements, in das das Iframe eingefügt wird.
- **data-kitzair-width**: Breite (Standard: 100%).
- **data-kitzair-height**: Höhe (Standard: 800px).
- **data-kitzair-min-height**: Mindesthöhe (Standard: 600).

## Konfiguration

- **Helikopter:** `src/config/helicopters.ts` – Flugstundenpreis Netto, MwSt, Base, Geschwindigkeit (kts).
- **Locations:** `src/config/locations.ts` – Orte mit Koordinaten (lat/lon).

## Entwicklung

```bash
npm install
npm run dev
```

## Deployment (Vercel)

1. Repo mit GitHub verbinden, in Vercel importieren.
2. Build: `npm run build`, Output: `dist`.
3. Optional: Eigene Domain eintragen.

Umgebungsvariablen sind nur bei Nutzung externer Dienste (z. B. Geocoding) nötig; Leaflet und Sunrise-Berechnung benötigen keine Keys.
