# Trade Journal for Mac

A thin Mac app around your hosted Trade Journal. You sign in with the same account as the web version,
so trades entered here show up on the web and the other way around (everything lives in your account).

## Build the DMG (Apple Silicon)

1. Install Node.js (LTS) from https://nodejs.org, or `brew install node`.
2. In Terminal, in this `desktop` folder:

       ./build.sh https://your-journal.vercel.app

   (Leave off the URL and the app will ask for it the first time it opens.)
3. Open `dist/Trade Journal-2.0.0-arm64.dmg` and drag the app into Applications.

Try without building a DMG: `npm install && npm start`.

## Notes

- You need an internet connection; if the site can't be reached you get a retry screen.
- Your login is remembered between launches (30 days).
- To point the app at a different site: menu bar > Server > Change Server URL.
- The app only ever displays your configured site. Links to other sites open in your browser.
- Not signed with an Apple Developer certificate. If macOS refuses to open it, run
  `xattr -cr "/Applications/Trade Journal.app"` or right-click the app and choose Open.
