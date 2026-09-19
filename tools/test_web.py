import subprocess, time, os, sys, json
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
        # bloquear tiles externos para que la prueba sea rápida y estable
        pg.route("**/*", lambda route: route.abort()
                 if any(h in route.request.url for h in ["basemaps.cartocdn", "arcgisonline"])
                 else route.continue_())
        pg.goto(base, wait_until="load", timeout=20000)
        pg.wait_for_selector(".tree-marker, .cl", timeout=10000)
        time.sleep(1.0)

        stats = pg.inner_text("#stats")
        markers = pg.eval_on_selector_all(".tree-marker", "els => els.length")
        clusters = pg.eval_on_selector_all(".cl", "els => els.length")
        country_chips = pg.eval_on_selector_all("#fCountry .chip", "els => els.length")
        bank_chips = pg.eval_on_selector_all("#fBank .chip", "els => els.length")
        print("STATS inicial:", stats)
        print("marcadores visibles:", markers, "| clústeres:", clusters)
        print("chips país:", country_chips, "| chips banco:", bank_chips)
        pg.screenshot(path="tools/shot_desktop_light.png")

        # jitter: la función spread debe separar los puntos co-localizados
        jit = pg.evaluate("""async () => {
          const d = await (await fetch('data/arboles.json')).json();
          const g = d.trees.filter(t => t.precision==='aproximada' && Math.abs(t.lat-39.62)<0.001 && Math.abs(t.lon-2.99)<0.001);
          window.spread(g);
          const uniq = new Set(g.map(t=>t._lat.toFixed(6)+','+t._lon.toFixed(6)));
          return {n:g.length, uniq:uniq.size};
        }""")
        print("jitter Mallorca:", jit)

        # popup (usa la función global) en ES y EN
        pop = pg.evaluate("""async () => {
          const d = await (await fetch('data/arboles.json')).json();
          const ex = d.trees.find(t=>t.id==='Cs073');
          const ap = d.trees.find(t=>t.precision==='aproximada' && t.country==='ITA');
          return {ex: window.popup(ex), ap: window.popup(ap)};
        }""")
        print("popup exacta contiene badge exacta:", "Exacta" in pop["ex"], "| Csid:", "Cs073" in pop["ex"])
        print("popup aprox contiene badge aprox:", "Aproximada" in pop["ap"])

        # filtro: seleccionar el primer chip de país y ver que cambia el recuento
        pg.click("#fCountry .chip:first-child")
        time.sleep(0.4)
        print("STATS tras filtrar 1 país:", pg.inner_text("#stats"))
        pg.click('[data-clear="country"]')
        time.sleep(0.3)

        # idioma EN
        pg.click('#lang button[data-lang="en"]')
        time.sleep(0.4)
        print("STATS en EN:", pg.inner_text("#stats"))
        print("tagline EN:", pg.inner_text(".tagline"))
        pg.screenshot(path="tools/shot_desktop_en.png")

        # búsqueda
        pg.click('#lang button[data-lang="es"]')
        pg.fill("#search", "Plomo")
        time.sleep(0.4)
        print("STATS buscando 'Plomo':", pg.inner_text("#stats"))
        pg.fill("#search", "")

        # móvil
        pg2 = br.new_page(viewport={"width": 390, "height": 780}, device_scale_factor=2)
        pg2.goto(base, wait_until="load", timeout=20000)
        pg2.wait_for_selector(".tree-marker, .cl", timeout=10000)
        time.sleep(0.8)
        pg2.screenshot(path="tools/shot_mobile.png")
        br.close()
    print("\nERRORES JS:", errors if errors else "ninguno")
    real_console_errors = [c for c in console if c[0] == "error" and "ERR_" not in c[1] and "tile" not in c[1].lower()]
    print("CONSOLA (errores no-red):", real_console_errors if real_console_errors else "ninguno")
finally:
    srv.terminate()
