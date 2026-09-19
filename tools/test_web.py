import subprocess, time, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PORT = 8137
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
base = f"http://localhost:{PORT}"
errors, console = [], []
try:
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={"width": 1280, "height": 820}, device_scale_factor=2)
        pg.on("console", lambda m: console.append((m.type, m.text)))
        pg.on("pageerror", lambda e: errors.append(str(e)))
        def route_handler(route):
            u = route.request.url
            if "open-meteo" in u:
                route.fulfill(status=200, content_type="application/json",
                    body='{"daily":{"time":["2020-01-01","2020-01-02"],"temperature_2m_mean":[10,20],"precipitation_sum":[3,3]}}')
            elif any(h in u for h in ["arcgisonline", "cartocdn", "hits.sh"]):
                route.abort()
            else:
                route.continue_()
        pg.route("**/*", route_handler)
        pg.goto(base, wait_until="load", timeout=20000)
        pg.wait_for_selector(".tree-marker, .cl", timeout=10000)
        time.sleep(1.0)

        print("STATS:", pg.inner_text("#stats"))
        print("marcadores:", pg.eval_on_selector_all(".tree-marker", "e=>e.length"),
              "clústeres:", pg.eval_on_selector_all(".cl", "e=>e.length"))
        print("chips país:", pg.eval_on_selector_all("#fCountry .chip", "e=>e.length"),
              "chips banco:", pg.eval_on_selector_all("#fBank .chip", "e=>e.length"))
        pg.screenshot(path="tools/shot_desktop.png")

        # fichas: popup y visor
        info = pg.evaluate("""async () => {
          const d = await (await fetch('data/arboles.json')).json();
          const ex = d.trees.find(t => t.id==='Cs073');       // Plomo 1, con ficha
          const nof = d.trees.find(t => !t.ficha && t.precision==='exacta');
          const withFicha = d.trees.filter(t=>t.ficha).length;
          return {
            popExact: window.popup(ex),
            popNoF: window.popup(nof),
            withFicha
          };
        }""")
        print("árboles con ficha:", info["withFicha"])
        print("popup(Plomo1) tiene botón ficha:", "ficha-btn" in info["popExact"], "| data-ficha Plomo1.png:", "Plomo1.png" in info["popExact"])
        print("popup(sin ficha) sin botón:", "ficha-btn" not in info["popNoF"])
        lb = pg.evaluate("""() => { window.openFicha('Plomo1.png','Plomo 1 · Cs073');
          const l=document.getElementById('lightbox');
          return {hidden:l.hidden, src:document.getElementById('lbImg').src, cap:document.getElementById('lbCap').textContent}; }""")
        print("visor abierto:", (not lb["hidden"]), "| src correcto:", lb["src"].endswith("Fichas/Plomo1.png"), "| cap:", lb["cap"])
        pg.keyboard.press("Escape")
        print("visor cerrado tras Esc:", pg.eval_on_selector("#lightbox", "e=>e.hidden"))

        # clima (normales) con respuesta simulada
        cl = pg.evaluate("""async () => {
          const c = await window.getClima(36.93, -1.99);
          const d = await (await fetch('data/arboles.json')).json();
          return { t: c.t, p: c.p, popHasClima: window.popup(d.trees[0]).includes('class="clima"') };
        }""")
        print("clima t:", cl["t"], "| p>0:", cl["p"] > 0, "| popup incluye clima:", cl["popHasClima"])

        # filtro país
        pg.click("#fCountry .chip:first-child"); time.sleep(0.3)
        print("STATS tras 1 país:", pg.inner_text("#stats"))
        pg.click('[data-clear="country"]'); time.sleep(0.2)

        # idioma
        pg.click('#lang button[data-lang="en"]'); time.sleep(0.3)
        print("STATS EN:", pg.inner_text("#stats"))
        pg.click('#lang button[data-lang="es"]')

        # búsqueda
        pg.fill("#search", "Bédar"); time.sleep(0.3)
        print("STATS 'Bédar':", pg.inner_text("#stats"))
        pg.fill("#search", "")

        # toggle de filtros
        open1 = pg.eval_on_selector("#controls", "e=>e.classList.contains('open')")
        pg.click("#toggleFilters"); time.sleep(0.2)
        open2 = pg.eval_on_selector("#controls", "e=>e.classList.contains('open')")
        print("toggle filtros:", open1, "->", open2)

        br.close()
    print("\nERRORES JS:", errors if errors else "ninguno")
    real = [c for c in console if c[0] == "error" and "ERR_" not in c[1] and "hits" not in c[1].lower()]
    print("CONSOLA (errores no-red):", real if real else "ninguno")
finally:
    srv.terminate()
