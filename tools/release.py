#!/usr/bin/env python3
"""Publish a new app version.

Usage: python3 tools/release.py 2.2.0 "What changed" "Another change"

Copies the current app into v/<version>/ (a frozen copy that never changes) and adds the version
to versions.json. The extension's "Ask me first" mode keeps users on the version they approved and
shows them these notes before they approve the next one.
"""
import json, re, shutil, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {'v', 'tools', '.git', 'versions.json', 'README.md', 'index.html', '.nojekyll'}

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    version, notes = sys.argv[1], sys.argv[2:]
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        sys.exit('Version must look like 2.2.0')
    store = (ROOT / 'js' / 'store.js').read_text()
    if f"APP_VERSION = '{version}'" not in store:
        sys.exit(f"Set APP_VERSION = '{version}' in js/store.js first")
    dest = ROOT / 'v' / version
    if dest.exists():
        sys.exit(f'{dest} already exists: published versions are never changed. Use a new version number.')
    dest.mkdir(parents=True)
    for item in ROOT.iterdir():
        if item.name in SKIP:
            continue
        (shutil.copytree if item.is_dir() else shutil.copy2)(item, dest / item.name)
    vfile = ROOT / 'versions.json'
    data = json.loads(vfile.read_text()) if vfile.exists() else {'latest': '', 'versions': []}
    data['versions'] = [v for v in data['versions'] if v['version'] != version]
    data['versions'].insert(0, {'version': version, 'date': datetime.date.today().isoformat(), 'notes': notes})
    data['latest'] = version
    vfile.write_text(json.dumps(data, indent=2) + '\n')
    print(f'Released {version} -> v/{version}/ ({len(notes)} notes)')

if __name__ == '__main__':
    main()
