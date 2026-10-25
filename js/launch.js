// Quick launch: your most used sites, each marked with a line symbol (drawn here, nothing is downloaded).
const Launch = (() => {
  // 24x24 single-stroke symbols, same line style as the sketches.
  const GLYPHS = {
    book: ['Notes / docs', 'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z'],
    calendar: ['Calendar', 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h3'],
    check: ['Tasks', 'M4 12.5l5 5L20 6.5'],
    cap: ['School', 'M2 9.5l10-5 10 5-10 5z M6 11.5v4.5c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5 M22 9.5v5.5'],
    mail: ['Mail', 'M3 6h18v12H3z M3 7l9 6.5L21 7'],
    chat: ['Chat / AI', 'M4 5h16v11H10l-5 4v-4H4z M8 10h8'],
    play: ['Video', 'M4 4h16v16H4z M10 8.5v7l6-3.5z'],
    music: ['Music', 'M9 18V6l11-2v12 M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3z M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z'],
    code: ['Code', 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16'],
    cloud: ['Files / cloud', 'M7 18a4 4 0 0 1-.6-8 6 6 0 0 1 11.6-1.2A4.6 4.6 0 0 1 18 18z'],
    folder: ['Folder', 'M3 6h6l2 2h10v11H3z'],
    chart: ['Grades / stats', 'M4 20V11 M10 20V5 M16 20v-7 M21 20H3'],
    shield: ['Military', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4'],
    dumbbell: ['Fitness', 'M6.5 7v10 M17.5 7v10 M3.5 9.5v5 M20.5 9.5v5 M6.5 12h11'],
    news: ['News', 'M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 16h5'],
    globe: ['Web', 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18'],
    target: ['Goals', 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9z M12 11.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6z'],
    bolt: ['Power', 'M13 2L4 14h7l-1 8 9-12h-7z'],
    star: ['Favorite', 'M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.8 6.4 20.2l1.5-6.4L3 9.6l6.4-.5z'],
    rocket: ['Launch', 'M12 2.5c3 2 5 5.8 5 9.8l-2 3.7H9l-2-3.7c0-4 2-7.8 5-9.8z M12 8.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2z M9 16l-2.5 4 M15 16l2.5 4 M12 16v5'],
    compass: ['Maps', 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M15.5 8.5l-2 5-5 2 2-5z']
  };
  const AUTO = [
    [/canvas|instructure|blackboard|moodle|\.edu(\/|$)/, 'cap'], [/calendar/, 'calendar'], [/todoist|ticktick|tasks/, 'check'],
    [/notion|onenote|evernote|docs\.google/, 'book'], [/mail|outlook|proton\.me/, 'mail'], [/youtube|netflix|twitch|hulu/, 'play'],
    [/claude|chatgpt|openai|gemini|discord|slack|teams|messenger|groupme/, 'chat'], [/github|gitlab|stackoverflow|replit/, 'code'],
    [/drive\.google|onedrive|dropbox|sharepoint|icloud|box\.com/, 'cloud'], [/spotify|music|soundcloud/, 'music'],
    [/\.mil(\/|$)|westpoint|usma|army/, 'shield'], [/strava|fitness|gym|myfitnesspal/, 'dumbbell'], [/maps|earth\.google/, 'compass'],
    [/news|cnn|bbc|nytimes|wsj|reuters/, 'news']
  ];
  const DEFAULT_LINKS = [
    { name: 'Notion', url: 'https://www.notion.so', icon: 'auto' },
    { name: 'Calendar', url: 'https://calendar.notion.so', icon: 'auto' },
    { name: 'Todoist', url: 'https://app.todoist.com', icon: 'auto' },
    { name: 'Claude', url: 'https://claude.ai', icon: 'auto' }
  ];
  const MAX = 9;

  function normUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href : ''; } catch (e) { return ''; }
  }
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function iconFor(link) {
    if (link.icon && link.icon !== 'auto' && GLYPHS[link.icon]) return link.icon;
    const u = String(link.url || '').toLowerCase();
    for (const [re, k] of AUTO) if (re.test(u)) return k;
    return 'globe';
  }
  function clean(list) {
    return (Array.isArray(list) ? list : []).map((l) => {
      const url = normUrl(l && l.url);
      if (!url) return null;
      const host = hostOf(url);
      const name = String((l && l.name) || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || host.split('.')[0].replace(/^./, (c) => c.toUpperCase());
      const icon = l && (l.icon === 'auto' || GLYPHS[l.icon]) ? l.icon : 'auto';
      return { name, url, icon };
    }).filter(Boolean).slice(0, MAX);
  }
  const svg = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${(GLYPHS[k] || GLYPHS.globe)[1]}"/></svg>`;
  return { GLYPHS, DEFAULT_LINKS, MAX, clean, iconFor, normUrl, hostOf, svg };
})();
