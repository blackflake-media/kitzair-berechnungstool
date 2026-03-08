# Kitzair Berechnungstool – Online stellen

**Erledigt:** Git-Repo ist initialisiert, erster Commit ist auf Branch `main`. Du bist bei Vercel und GitHub im Browser angemeldet.

---

## So geht es jetzt am schnellsten (GitHub + Vercel)

### 1. Neues Repo auf GitHub anlegen

1. Geh zu [github.com/new](https://github.com/new).
2. Repository name: z.B. **kitzair-berechnungstool**.
3. **Public**, ohne README/ .gitignore (haben wir schon).
4. **Create repository**.

### 2. Projekt mit GitHub verbinden und pushen

Im Projektordner in der **Terminal/CMD/PowerShell** (im Ordner `kitzair-berechnungstool`):

```bash
git remote add origin https://github.com/DEIN-GITHUB-USERNAME/kitzair-berechnungstool.git
git push -u origin main
```

(DEN-GITHUB-USERNAME durch deinen echten GitHub-Benutzernamen ersetzen.)

### 3. Bei Vercel deployen

1. Geh zu [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → dein Repo **kitzair-berechnungstool** auswählen.
3. **Deploy** klicken (Build-Kommando und Ausgabe-Ordner erkennt Vercel automatisch).
4. Fertig – deine URL z.B. `https://kitzair-berechnungstool-xxx.vercel.app`.

Ab dann: Bei jedem **Push auf main** baut Vercel automatisch neu.

---

## Veröffentlichte Version aktualisieren

Wenn du etwas änderst (z. B. Basis-Adresse, Texte, Config) und die live Seite updaten willst:

**Mit GitHub + Vercel (empfohlen):**

1. Änderungen committen und nach GitHub pushen:
   ```bash
   git add .
   git commit -m "Basis-Adresse / LOJE aktualisiert"
   git push origin main
   ```
2. Vercel baut automatisch neu; nach 1–2 Minuten ist die neue Version online.

**Nur mit Vercel CLI:**

```bash
git add .
git commit -m "Basis-Adresse / LOJE aktualisiert"
npx vercel --prod
```

---

## Alternative: Nur Vercel CLI (ohne GitHub)

1. Einmal im Terminal einloggen (Browser öffnet sich):
   ```bash
   npx vercel login
   ```
2. Deploy:
   ```bash
   npx vercel --prod
   ```

---

## Option: Nur `dist` hochladen

Build: `npm run build`  
Den Inhalt von **`dist/`** bei einem beliebigen Hoster hochladen; SPA-Routing auf `index.html` leiten.
