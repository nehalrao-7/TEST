"""Build the claude.ai Artifact page from index.html (the viewer adds its own doctype/head/body)."""
import re, os
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
h = open(os.path.join(here, 'index.html')).read()
for pat in [r'<!DOCTYPE html>\s*', r'<html[^>]*>\s*', r'</?head>\s*', r'<body>\s*', r'\s*</body>\s*</html>\s*$',
            r'<meta charset="UTF-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
    h = re.sub(pat, '', h, flags=re.I)
open(os.path.join(here, 'fit-studio.html'), 'w').write(h.strip() + '\n')
print('ok', len(h))
