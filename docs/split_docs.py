import re
import os

with open("docs/index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Remove style and script tags to avoid duplication
html = re.sub(r'<style>.*?</style>', '', html, flags=re.DOTALL)
html = re.sub(r'<script>.*?</script>', '', html, flags=re.DOTALL)

# Extract navigation
nav_match = re.search(r'<nav.*?</nav>', html, flags=re.DOTALL)
nav = nav_match.group(0) if nav_match else ""

# Update navigation to have relative links
nav_template = """
    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-logo">
                <div class="logo-icon"></div>
                After The Whistle
            </div>
            <div class="nav-links">
                <a href="index.html" class="{index_active}">Accueil</a>
                <a href="demo.html" class="{demo_active}">Simulateur</a>
                <a href="architecture.html" class="{arch_active}">Architecture</a>
                <a href="tools.html" class="{tools_active}">Outils MCP</a>
                <a href="setup.html" class="{setup_active}">Installation</a>
            </div>
        </div>
    </nav>
"""

# Extract footer
footer_match = re.search(r'<footer.*?</footer>', html, flags=re.DOTALL)
footer = footer_match.group(0) if footer_match else "<footer><div class=\"container\"><p>After The Whistle - Documentation</p></div></footer>"

# Extract sections
hero_match = re.search(r'<section class="hero".*?</section>', html, flags=re.DOTALL)
hero = hero_match.group(0) if hero_match else ""

def extract_section(section_id):
    # Matches <section id="xxx" ...> ... </section> correctly handling nested tags
    # Simplified regex since the HTML is fairly flat at section level
    match = re.search(r'<section id="' + section_id + r'".*?</section>\s*(?=<section|</main)', html, flags=re.DOTALL)
    if not match:
        match = re.search(r'<section id="' + section_id + r'".*?</section>', html, flags=re.DOTALL)
    return match.group(0) if match else ""

core_concept = extract_section("core-concept")
demo_section = extract_section("demo")
features = extract_section("features")
architecture = extract_section("architecture")
tools = extract_section("tools")
setup = extract_section("setup")

def make_page(filename, title, content, active_nav=""):
    nav_html = nav_template.format(
        index_active="active" if active_nav == "index" else "",
        demo_active="active" if active_nav == "demo" else "",
        arch_active="active" if active_nav == "arch" else "",
        tools_active="active" if active_nav == "tools" else "",
        setup_active="active" if active_nav == "setup" else ""
    )
    
    page = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>After The Whistle | {title}</title>
    <link rel="stylesheet" href="assets/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    {nav_html}
    <main>
        {content}
    </main>
    {footer}
    <script src="assets/app.js"></script>
</body>
</html>"""
    with open("docs/" + filename, "w", encoding="utf-8") as f:
        f.write(page)

# index.html
make_page("index.html", "Accueil", hero + "\n" + features, "index")

# demo.html
demo_content = '<div style="padding-top: 80px;"></div>\n' + demo_section
make_page("demo.html", "Simulateur", demo_content, "demo")

# architecture.html
arch_content = '<div style="padding-top: 80px;"></div>\n' + core_concept + "\n" + architecture
make_page("architecture.html", "Architecture", arch_content, "arch")

# tools.html
tools_content = '<div style="padding-top: 80px;"></div>\n' + tools
make_page("tools.html", "Outils MCP", tools_content, "tools")

# setup.html
setup_content = '<div style="padding-top: 80px;"></div>\n' + setup
make_page("setup.html", "Installation", setup_content, "setup")

print("Done generating HTML pages.")
