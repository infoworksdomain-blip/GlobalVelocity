# Page screenshots + viewer

Renders every page in headless Chromium with a signed-in session and builds a single-file HTML viewer.

    npm i -D @sparticuz/chromium puppeteer-core        # Chromium is bundled in the npm package (no download step)
    echo "<authjs.session-token value>" > /tmp/session.txt
    node scripts/screenshots/shots.mjs                    # writes out/*.png + out/results.json (h1, console/page errors)
    node scripts/screenshots/viewer.mjs                   # writes Velocity_Page_Viewer.html (edit the output path inside)

On Linux you may need: libnss3 libatk-bridge2.0-0 libgbm1 libasound2 libxkbcommon0 libgtk-3-0.
