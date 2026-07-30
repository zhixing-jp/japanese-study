#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_seo_pages.py
扫描所有救急场景 JSON 文件，生成静态 HTML 页面供 Google 索引。
运行方式：python3 scripts/generate_seo_pages.py
"""

import json
import os
import re
from pathlib import Path

# ── 路径配置 ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent          # 项目根目录
INDEX_JSON = ROOT / "data/rescue/index.json"
OUTPUT_DIR = ROOT / "scene"                  # 输出目录
SITE_URL = "https://livingjapanese.app"

# ── 语言配置 ──────────────────────────────────────────────
LANGS = {
    "zh":    {"label": "简体中文", "html_lang": "zh-Hans"},
    "zh-TW": {"label": "繁體中文", "html_lang": "zh-Hant"},
    "en":    {"label": "English",  "html_lang": "en"},
    "vi":    {"label": "Tiếng Việt", "html_lang": "vi"},
    "ko":    {"label": "한국어",    "html_lang": "ko"},
}

def tfield(obj, field, lang):
    """按语言取字段值，回退顺序：lang → zh → en → field"""
    return (obj.get(f"{field}_{lang}")
         or obj.get(f"{field}_zh")
         or obj.get(f"{field}_en")
         or obj.get(field)
         or "")

def clean_html(text):
    """移除 HTML 标签"""
    return re.sub(r'<[^>]+>', '', str(text))

def generate_page(scene_meta, scene_data, lang):
    """生成单个场景单个语言的 HTML 内容"""
    sid = scene_meta["id"]
    lang_cfg = LANGS[lang]

    title = tfield(scene_meta, "title", lang)
    description = tfield(scene_meta, "description", lang)
    site_name = "日活 Living Japanese"

    # ── 场景 info 块 ──
    info_html = ""
    for info in scene_meta.get("info", []):
        info_title = clean_html(tfield(info, "title", lang))
        info_lines = info.get(f"lines_{lang}") or info.get("lines_zh") or info.get("lines", [])
        if info_title or info_lines:
            info_html += f"<h3>{info_title}</h3><ul>"
            for line in info_lines:
                info_html += f"<li>{clean_html(line)}</li>"
            info_html += "</ul>"

    # ── 句子列表 ──
    items = scene_data.get("items", [])
    subcats = {s["id"]: tfield(s, "title", lang)
               for s in scene_data.get("subcategories", [])}

    items_html = ""
    current_sub = None
    for item in items:
        sub_id = item.get("subcategory", "")
        if sub_id != current_sub:
            current_sub = sub_id
            sub_title = subcats.get(sub_id, "")
            if sub_title:
                items_html += f"<h3>{sub_title}</h3>"

        jp = item.get("furigana") or item.get("jp", "")
        translation = (item.get(f"{lang}") or item.get("zh") or "")
        role = item.get("role", "user")
        role_label = "▶" if role == "user" else "◀"

        items_html += f"""
        <div class="phrase">
          <p class="jp" lang="ja">{jp}</p>
          <p class="trans">{role_label} {translation}</p>
        </div>"""

    # ── hreflang ──
    hreflang_tags = ""
    for l in LANGS:
        hreflang_tags += f'<link rel="alternate" hreflang="{l}" href="{SITE_URL}/scene/{sid}-{l}.html">\n'
    hreflang_tags += f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}/scene/{sid}-zh.html">\n'

    # ── 语言导航 ──
    lang_nav = " | ".join(
        f'<a href="{SITE_URL}/scene/{sid}-{l}.html">{LANGS[l]["label"]}</a>'
        for l in LANGS
    )

    html = f"""<!doctype html>
<html lang="{lang_cfg['html_lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | {site_name}</title>
<meta name="description" content="{description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{SITE_URL}/scene/{sid}-{lang}.html">
{hreflang_tags}
<meta property="og:title" content="{title} | {site_name}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{SITE_URL}/scene/{sid}-{lang}.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{site_name}">
<style>
  body{{font-family:sans-serif;max-width:800px;margin:0 auto;padding:16px;color:#333;line-height:1.6}}
  header{{border-bottom:2px solid #1a8a4e;padding-bottom:12px;margin-bottom:24px}}
  header a{{color:#1a8a4e;text-decoration:none;font-weight:bold;font-size:1.1em}}
  h1{{color:#1a8a4e;font-size:1.4em;margin:0 0 8px}}
  h2{{color:#333;font-size:1.1em;border-left:4px solid #1a8a4e;padding-left:8px;margin-top:24px}}
  h3{{color:#555;font-size:1em;margin-top:16px}}
  .phrase{{border-bottom:1px solid #eee;padding:10px 0}}
  .jp{{font-size:1.1em;margin:0 0 4px;color:#111}}
  .trans{{margin:0;color:#555;font-size:0.95em}}
  .info-block{{background:#f5f5f5;border-radius:8px;padding:12px 16px;margin:16px 0}}
  .lang-nav{{font-size:0.85em;color:#888;margin-bottom:16px}}
  .lang-nav a{{color:#1a8a4e;margin:0 4px}}
  footer{{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:0.85em;color:#888}}
</style>
</head>
<body>
<header>
  <a href="{SITE_URL}">{site_name}</a>
  <h1>{title}</h1>
  <p>{description}</p>
</header>

<div class="lang-nav">{lang_nav}</div>

<a href="{SITE_URL}" style="display:inline-block;margin-bottom:16px;padding:8px 16px;background:#1a8a4e;color:#fff;border-radius:6px;text-decoration:none;font-size:0.9em">
  → 打开完整工具（含朗读功能）
</a>

{"<div class='info-block'>" + info_html + "</div>" if info_html else ""}

<h2>实用句子 / Phrases</h2>
{items_html}

<footer>
  <p>{site_name} — <a href="{SITE_URL}">{SITE_URL}</a></p>
  <p>专为在日外国人设计的免费日语急救工具 | Free Japanese phrase tool for foreigners in Japan</p>
</footer>
</body>
</html>"""

    return html


def main():
    # 读取场景索引
    with open(INDEX_JSON, encoding="utf-8") as f:
        index = json.load(f)

    scenes = index.get("scenes", [])

    # 创建输出目录
    OUTPUT_DIR.mkdir(exist_ok=True)

    generated = []
    skipped = []

    for scene_meta in scenes:
        sid = scene_meta["id"]
        file_path = scene_meta.get("file", "")
        if not file_path:
            skipped.append(sid)
            continue

        json_path = ROOT / file_path
        if not json_path.exists():
            print(f"⚠️  找不到文件：{json_path}，跳过 {sid}")
            skipped.append(sid)
            continue

        with open(json_path, encoding="utf-8") as f:
            scene_data = json.load(f)

        for lang in LANGS:
            html = generate_page(scene_meta, scene_data, lang)
            out_file = OUTPUT_DIR / f"{sid}-{lang}.html"
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(html)

        generated.append(sid)
        print(f"✓ {sid} — 已生成 {len(LANGS)} 个语言版本")

    # 生成 sitemap
    sitemap_urls = []
    for sid in generated:
        for lang in LANGS:
            sitemap_urls.append(f"{SITE_URL}/scene/{sid}-{lang}.html")
    sitemap_urls.append(SITE_URL + "/")

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    sitemap += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    for url in sitemap_urls:
        sitemap += f"  <url><loc>{url}</loc></url>\n"
    sitemap += "</urlset>"

    sitemap_path = ROOT / "sitemap.xml"
    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write(sitemap)

    print(f"\n完成：{len(generated)} 个场景 × {len(LANGS)} 种语言 = {len(generated)*len(LANGS)} 个页面")
    if skipped:
        print(f"跳过：{skipped}")
    print(f"Sitemap 已生成：{sitemap_path}")


if __name__ == "__main__":
    main()
