# Trade Journal for Mac

A thin Mac app around your hosted Trade Journal. You sign in with the same account as the web version,
so trades entered here show up on the web and the other way around (everything lives in your account).

## Build the DMG (Apple Silicon)

1. Install Node.js (LTS) from https://nodejs.org, or `brew install node`.
2. In Terminal, in this `desktop` folder:

       ./build.sh https://your-journal.vercel.app

   (Leave off the URL and the app will ask for it the first time it opens. Add your GitHub repo as a second argument,
   e.g. `./build.sh https://your-journal.vercel.app your-name/trade-journal-web`, to turn on update notifications.)
3. Open `dist/Trade Journal-2.1.0-arm64.dmg` and drag the app into Applications.

Try without building a DMG: `npm install && npm start`.

## Notes

- You need an internet connection; if the site can't be reached you get a retry screen.
- Your login is remembered between launches (30 days).
- To point the app at a different site: menu bar > Server > Change Server URL.
- The app only ever displays your configured site. Links to other sites open in your browser.
- Not signed with an Apple Developer certificate. If macOS refuses to open it, run
  `xattr -cr "/Applications/Trade Journal.app"` or right-click the app and choose Open.

## Updates

- **The website and everything inside the app window update automatically.** The Mac app just displays your hosted site, so
  every time you push to GitHub and Vercel deploys, the app shows the new version the next time it loads (Cmd+R to refresh now).
  You only reinstall the app when the Mac shell itself changes, which is rare.
- **Shell updates:** if you built with a GitHub repo, the app checks for a newer release at launch (at most every 12 hours) and
  on Server > Check for Updates. It offers the new DMG, which you open and drag over the old app.
  To publish one: raise `version` in `desktop/package.json`, run `./build.sh ...`, then on GitHub create a Release tagged
  `v2.2.0` (matching the version) and attach the `.dmg`. The repo must be public for the check to work.
- **Fully silent auto-install** (like most Mac apps) requires signing the app with an Apple Developer ID certificate
  ($99/year) and notarizing it. This build isn't signed, so macOS wouldn't allow it. If you ever get a certificate, the app
  can be switched to `electron-updater`.
