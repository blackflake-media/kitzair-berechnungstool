# Kitzair Berechnungstool – Deploy & Updates

**Vercel-Projektname:** `kitzair-berechnungstool_v1.2`  
(Weil „kitzair-berechnungstool“ auf Vercel schon vergeben war.)

**GitHub-Repo:** z. B. `blackflake-media/kitzair-berechnungstool` (Branch `main`)

---

## Live-Version updaten (so geht’s)

Wenn du im Code etwas geändert hast und die **öffentliche App auf Vercel** aktualisieren willst:

### 1. Änderungen zu GitHub pushen

Im Projektordner (PowerShell/CMD):

```powershell
git add .
git commit -m "Deine Änderung kurz beschreiben"
git push origin main
```

### 2. Vercel baut automatisch

- Vercel ist mit dem GitHub-Repo verbunden und baut bei jedem **Push auf `main`** neu.
- Dauert meist **1–3 Minuten**. Du siehst den Fortschritt unter:  
  **[vercel.com/dashboard](https://vercel.com/dashboard)** → Projekt **kitzair-berechnungstool_v1.2** → **Deployments**.

### 3. Richtige URL prüfen

- Deine **Production-URL** ist z. B.  
  `https://kitzair-berechnungstool-v1-2.vercel.app`  
  (oder eine eigene Domain, falls eingestellt).
- Öffne **genau diese** URL (nicht eine alte Preview-URL).

### 4. Cache umgehen

Damit du die neue Version siehst:

- **Hard Reload:** `Strg + Shift + R` (Windows) bzw. `Cmd + Shift + R` (Mac),  
  oder im Browser: Rechtsklick auf Reload → „Cache leeren und vollständig neu laden“.

---

## Wenn nach dem Push nichts passiert

1. **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard) → **kitzair-berechnungstool_v1.2**.
2. **Deployments:** Siehst du einen **neuen** Eintrag mit dem letzten Commit (z. B. „Mobile: Karte größer, Wetter unter Karte“)?  
   - **Ja, Status „Ready“** → Neue Version ist live. Mit Hard Reload (s. oben) testen.  
   - **Nein / alter Commit** → Prüfen, ob das Projekt wirklich mit **diesem** GitHub-Repo verbunden ist.
3. **Git-Verbindung prüfen:** Im Projekt → **Settings** → **Git** →  
   **Connected Git Repository** = dein Repo (z. B. `blackflake-media/kitzair-berechnungstool`),  
   **Production Branch** = `main`.
4. **Manuell neu deployen:** Unter **Deployments** beim letzten Deployment auf die drei Punkte (⋯) klicken → **Redeploy** → **Redeploy** bestätigen.

---

## Neues Projekt auf Vercel anlegen (falls nötig)

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → dein Repo wählen.
2. **Project Name** z. B. `kitzair-berechnungstool_v1.2` (wenn der andere Name schon belegt ist).
3. **Deploy** – Vercel übernimmt Build (Vite) und `vercel.json` automatisch.

---

## Nur Vercel CLI (ohne GitHub)

```powershell
npx vercel login
git add .
git commit -m "Deine Nachricht"
npx vercel --prod
```

Dann das richtige Projekt auswählen (z. B. **kitzair-berechnungstool_v1.2**), falls mehrere existieren.
