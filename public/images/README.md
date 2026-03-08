# Bilder und Logo

Alle Dateien hier liegen im Ordner **`public/images/`** (bzw. `public/images/helicopters/`).  
Sie werden im Build 1:1 übernommen und unter **`/images/...`** ausgeliefert.

## Logo (Map-Loader)

- **Datei:** `public/images/logo_Kitzair.png`
- **URL:** `/images/logo_Kitzair.png`

## Helikopter-Bilder

- **Ordner:** `public/images/helicopters/`
- **Erwartete Dateien (genau so benennen):**
  - `as350.jpg` → AS350-Helikopter
  - `b505.jpg` → B505-Helikopter

**Struktur:**

```
public/
  images/
    logo_Kitzair.png
    helicopters/
      as350.jpg
      b505.jpg
```

Wenn die Bilder nicht erscheinen: Prüfen, ob die Dateien **wirklich** in `public/images/helicopters/` liegen und die Namen **genau** `as350.jpg` und `b505.jpg` sind (Kleinbuchstaben).
