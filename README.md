# Backdrop Rotator

Hosted app for the Backdrop Rotator Edge extension: minimal line-sketch backgrounds for every new tab. The extension is a small permanent shell
that loads `newtab.html` and `settings.html` from this site, so pushing changes here updates
the app everywhere without reinstalling anything.

- `js/bridge.js`: talks to the extension shell (storage, downloads, browser search)
- `js/store.js`: library, settings, rotation (sketches only; no web images)
- `js/sketch.js`: minimal line-art sketches (built-in subjects, Surprise me generators, looks, draw-in animation)
- `js/claude.js`: "Sketch anything with Claude" (user's own Anthropic API key, validated vector output)
- `js/newtab.js`, `js/settings.js`: the two pages
