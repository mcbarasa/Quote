# Sauti Gang Studios - Quotes & Invoices (installable phone app)

Black-and-yellow Sauti Gang branding, Node.js + SQLite backend, installable as a phone app (PWA).
Exports: PDF (with your logo), Excel (.xlsx), CSV, Word (.doc).

## 1. Try it on your computer
    npm install
    npm start
Open http://localhost:3000   (needs Node.js 18+ from nodejs.org)

## 2. Put it online so your phone can install it  (required for a real app install)
Phones only offer "Install app" on a secure (https) website, so host the folder on a Node host
(Render, Railway, Fly.io or a small VPS). Settings for any of them:
- Build command:  npm install
- Start command:  npm start
- Environment variables:
    APP_USER=your-username          (password-protects the whole app - always set this)
    APP_PASS=your-strong-password
    DATA_DIR=/path/of/persistent/disk   (see below)
IMPORTANT: your data is a file (sauti.db). Attach a persistent disk/volume to the host and point
DATA_DIR at it, otherwise the data is wiped on every redeploy. Most hosts charge a small fee for disks.

## 3. Install on the phone
Android (Chrome): open your https link, tap "Add to home screen" on the Home screen of the app
  (or Chrome menu > Install app). 
iPhone (Safari): open the link, tap Share > Add to Home Screen.
You get the sg.ke icon and the app opens full screen, with no browser bar.

## 4. Optional: real Android APK
After hosting, go to https://www.pwabuilder.com, paste your https link and choose Android.
It produces an APK/AAB you can install directly or upload to Google Play.

## Files
server.js              API + database
public/index.html      the app
public/manifest.webmanifest, sw.js, icons, logo.png   make it installable
Back up by copying data/sauti.db (or the file inside DATA_DIR).

## Edit your details
In the app: Equipment tab > Business details (name, tagline, phone/email line shown on documents).
