#!/usr/bin/env python3
"""Gera dist/hogwarts-voxel.html: o jogo inteiro (HTML, CSS e JS com three.js) em um único arquivo.

Uso: python3 scripts/build-single.py   (requer Node.js; baixa o esbuild via npx)
"""
import os, re, subprocess

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
os.makedirs('dist', exist_ok=True)
subprocess.run(['npx', '--yes', 'esbuild@0.24.0', 'src/main.js', '--bundle', '--format=esm', '--minify',
                '--alias:three=./lib/three.module.min.js', '--outfile=dist/bundle.js'], check=True)
html = open('index.html', encoding='utf-8').read()
css = open('style.css', encoding='utf-8').read()
js = open('dist/bundle.js', encoding='utf-8').read().replace('</script', '<\\/script')
html = html.replace('<link rel="stylesheet" href="style.css" />', f'<style>\n{css}</style>')
html = re.sub(r'\s*<script type="importmap">.*?</script>', '', html, flags=re.S)
html = html.replace('<script type="module" src="src/main.js"></script>', f'<script type="module">\n{js}\n</script>')
open('dist/hogwarts-voxel.html', 'w', encoding='utf-8').write(html)
os.remove('dist/bundle.js')
print('dist/hogwarts-voxel.html', len(html) // 1024, 'KB')
