import subprocess, time, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PORT = 8137
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
base = f"http://localhost:{PORT}"
errors, console = [], []

def handler(route):
    u = route.request.url
    if "open-meteo" in u:
        route.fulfill(status=200, content_type="application/json",
            body='{"daily":{"time":["2020-01-01","2020-01-02","2020-01-03"],"temperature_2m_mean":[17.8,18.2,18.0],"precipitation_sum":[0,1.5,0.5]}}')
    elif "abacus" in u:
        route.fulfill(status=200, content_type="application/json", body='{"value":12345}')
    elif "arcgisonline" in u:
        route.abort()
    else:
        route.continue_()

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-gl=angle",
                                     "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
        pg = br.new_page(viewport={"width": 1280, "height": 820}, device_scale_factor=1)
        pg.on("console", lambda m: console.append((m.type, m.text)))
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.route("**/*", handler)
        pg.goto(base, wait_until="load", timeout=25000)
        pg.wait_for_selector(".tree-marker, .cl", timeout=15000)
        time.sleep(1.5)

        print("STATS:", pg.inner_text("#stats"))
        print("globo por defecto:", pg.eval_on_selector("#toggleGlobe", "e=>e.classList.contains('on')"))
        print("panel cerrado:", not pg.eval_on_selector("#controls", "e=>e.classList.contains('open')"))
        print("contador:", not pg.eval_on_selector("#hits", "e=>e.hidden"), pg.inner_text("#hitsCount"))
        print("botones solo-icono (mode span oculto):", pg.eval_on_selector("#toggleMode span", "e=>getComputedStyle(e).display==='none'"))
        print("marcadores:", pg.eval_on_selector_all(".tree-marker", "e=>e.length"), "clústeres:", pg.eval_on_selector_all(".cl", "e=>e.length"))
        pg.screenshot(path="tools/shot_globe_default.png")

        info = pg.evaluate("""async () => {
          const d = await (await fetch('data/arboles.json')).json();
          const ex = d.trees.find(t=>t.id==='Cs073');
          const c = await window.getClima(36.93,-1.99);
          return { pop: window.popup(ex), withFicha: d.trees.filter(t=>t.ficha).length, t:c.t };
        }""")
        print("con ficha:", info["withFicha"], "| popup ok:", ("ficha-btn" in info["pop"]) and ('class="clima"' in info["pop"]), "| clima:", info["t"])
        print("visor:", pg.evaluate("()=>{window.openFicha('Plomo1.png','x');return !document.getElementById('lightbox').hidden;}")); pg.keyboard.press("Escape")

        # globo -> plano
        pg.click("#toggleGlobe"); time.sleep(1.0)
        print("tras click globo (debe quedar plano/off):", pg.eval_on_selector("#toggleGlobe","e=>e.classList.contains('on')"))
        pg.screenshot(path="tools/shot_flat.png")

        # pines
        pg.click("#toggleMode"); time.sleep(0.8)
        print("pines:", pg.eval_on_selector_all(".tree-pin","e=>e.length"), "| on:", pg.eval_on_selector("#toggleMode","e=>e.classList.contains('on')"))
        pg.click("#toggleMode"); time.sleep(0.5)

        # filtros / idioma / búsqueda
        pg.click("#toggleFilters"); time.sleep(0.2)
        print("panel abre:", pg.eval_on_selector("#controls","e=>e.classList.contains('open')"))
        pg.click("#fCountry .chip:first-child"); time.sleep(0.4)
        print("STATS 1 país:", pg.inner_text("#stats"))
        pg.click('[data-clear="country"]'); time.sleep(0.2)
        pg.click('#lang button[data-lang="en"]'); time.sleep(0.4)
        print("EN:", pg.inner_text("#stats"))
        pg.click('#lang button[data-lang="es"]')
        pg.fill("#search","Bédar"); time.sleep(0.4)
        print("Bédar:", pg.inner_text("#stats"))

        # móvil
        pg2 = br.new_page(viewport={"width": 390, "height": 800}, device_scale_factor=2)
        pg2.route("**/*", handler)
        pg2.goto(base, wait_until="load", timeout=25000)
        pg2.wait_for_selector(".tree-marker, .cl", timeout=15000); time.sleep(1.2)
        pg2.screenshot(path="tools/shot_mobile.png")

        br.close()
    print("\nERRORES JS:", errors if errors else "ninguno")
    real = [c for c in console if c[0] == "error" and "ERR_" not in c[1] and "404" not in c[1] and "tile" not in c[1].lower()]
    print("CONSOLA (errores no-red):", real if real else "ninguno")
finally:
    srv.terminate()
