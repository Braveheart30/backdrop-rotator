# Backdrop Rotator

Hosted app for the Backdrop Rotator Edge extension. The extension is a small permanent shell
that loads `newtab.html` and `settings.html` from this site, so pushing changes here updates
the app everywhere without reinstalling anything.

- `js/bridge.js`: talks to the extension shell (storage, downloads, browser search)
- `js/store.js`: images, settings, rotation, Bing photo search
- `js/ai.js`: AI background generation (Pollinations free tier, OpenAI GPT Image)
- `js/sketch.js`: minimal line-art sketches (built-in subjects, draw-in animation)
- `js/claude.js`: "Sketch anything with Claude" (user's own Anthropic API key, validated vector output)
- `js/newtab.js`, `js/settings.js`: the two pages
