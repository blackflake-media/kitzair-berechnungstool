# Kitzair Berechnungstool – Online stellen

Der Build liegt unter `dist/`. Du kannst auf folgende Arten veröffentlichen:

---

## Option 1: Vercel (empfohlen, bereits vorbereitet)

Die Projektdatei `vercel.json` ist schon da. So geht’s:

### A) Mit Vercel CLI (ohne Git)

1. Einmal einloggen:
   ```bash
   npx vercel login
   ```
   (E-Mail öffnen und Link klicken.)

2. Im Projektordner deployen:
   ```bash
   npx vercel --prod
   ```
   Beim ersten Mal: Projektname bestätigen, danach bekommst du eine URL wie  
   `https://kitzair-berechnungstool-xxx.vercel.app`.

### B) Mit GitHub + Vercel (für automatische Deployments)

1. Git-Repo anlegen (falls noch nicht geschehen):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Repo auf GitHub pushen (eigenes Repo unter github.com anlegen, dann):
   ```bash
   git remote add origin https://github.com/DEIN-USER/kitzair-berechnungstool.git
   git branch -M main
   git push -u origin main
   ```

3. Auf [vercel.com](https://vercel.com) einloggen → **Add New Project** → **Import** das GitHub-Repo.  
   Vercel erkennt Vite und die `vercel.json` automatisch. Mit **Deploy** ist die App online.

---

## Option 2: Anderer Hoster (nur `dist` hochladen)

1. Build erzeugen:
   ```bash
   npm run build
   ```

2. Den kompletten Inhalt des Ordners **`dist/`** auf deinen Webspace hochladen (z.B. per FTP, Netlify Drag & Drop, Cloudflare Pages, etc.).

Wichtig: Beim Hoster **SPA-Routing** aktivieren (alle Routen auf `index.html` umleiten), sonst funktionieren direkte URLs/Reload nicht. Bei Vercel ist das bereits über `vercel.json` eingestellt.
