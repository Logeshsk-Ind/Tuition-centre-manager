# Tuition Centre Manager

The mobile app is now available as an installable, offline-capable web app in
[`web/`](./web/). It is written in plain HTML, CSS, and JavaScript and does not
require Flutter or a package install. The original Flutter source remains in
[`lib/`](./lib/) for reference.

## Features

- Dashboard totals for enrolled students, current-month collections, and
  outstanding fees.
- Board and class management. New boards start with L.K.G., U.K.G., and
  Classes 1–12.
- Student search and board → class → student organization.
- Optional custom text fields on student profiles.
- Monthly fee status and UPI or cash payment entries, including partial
  payments.
- Glass-style interface with selectable light/dark mode and seven accent
  colors (Burgundy, Soft pink, Glacier, Lavender, Sage, Mist blue, and Light
  gold).
- On-device data storage, offline access after the first visit, and JSON
  backup/restore.

## Preview on your computer

Install Python 3 if it is not already available, then run this from the
repository root:

```powershell
py -m http.server 8000 --directory web
```

Open <http://localhost:8000> in a browser. Stop the server with Ctrl+C.

## Install on your phone

The phone install is a **PWA shortcut**, not an APK or App Store download. To
install it:

1. Publish the contents of the `web` folder to a static web host that provides
   an **HTTPS** address. Service workers and offline installation require
   HTTPS (except when testing on `localhost`).
2. Open that HTTPS address on your phone while online.
3. **Android:** in Chrome, open the browser menu and tap **Install app** or
   **Add to Home screen**.
4. **iPhone:** in Safari, tap **Share**, then **Add to Home Screen**.
5. Launch it from the new home-screen icon. After the first online visit, the
   app shell is cached and can be opened offline.

## Your records

Records are saved in the browser storage on that device and are not synced
between devices. Use **Settings → Export backup** regularly. **Import backup**
replaces the records currently on the device, so export a copy first if needed.
Clearing browser/site data can erase records.

## Files

```text
web/
  app.js
  icon.svg
  index.html
  manifest.json
  styles.css
  sw.js
lib/                     Original Flutter implementation
test/                    Original Flutter tests
```
