"""Phone-width screenshots of the built app (dist/macro-ledger.html) with seeded sample data.
Run: npm run shots   ->  test/shots/*.png   (needs Playwright's Chromium: python3 -m playwright install chromium)
Also prints the page's horizontal scroll width (must be 390) and any page errors."""
import asyncio, json, time, threading, http.server, socketserver, os, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'test' / 'shots'; OUT.mkdir(exist_ok=True)
WWW = ROOT / 'test' / '.www'; WWW.mkdir(exist_ok=True)
HTML = (ROOT / 'dist' / 'macro-ledger.html').read_text()
# the same skeleton the Artifact host wraps around the page
(WWW / 'index.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + HTML + '</body></html>')

today = time.strftime('%Y-%m-%d')
def N(**k):
    base = {x: 0 for x in ['kcal','protein','carbs','fat','fiber','sugar','addedSugar','satFat','transFat','cholesterol','sodium','potassium','calcium','iron','vitD']}
    base.update(k); return base
SEED = {
  "profile": {"sex":"m","age":20,"heightFt":6,"heightIn":0,"weightLb":180,"bodyFat":15,"activity":1.55,"goal":"lose","rate":1,"custom":False,
              "targets":{"kcal":2410,"protein":168,"carbs":270,"fat":75,"fiber":34,"addedSugar":60,"satFat":27,"cholesterol":300,"sodium":2300,"potassium":3400,"calcium":1000,"iron":8,"vitD":15,"bmr":1869,"tdee":2897}},
  "foods": {
    "f1":{"id":"f1","name":"Chobani Greek Yogurt, Vanilla","brand":"Chobani","servingLabel":"1 cup (227 g)","servingGrams":227,"n":N(kcal=190,protein=16,carbs=23,fat=4,sugar=20,addedSugar=14,satFat=2.5,cholesterol=15,sodium=75,potassium=280,calcium=200),"fav":True,"rating":4,"count":12,"last":1,"source":"label"},
    "f2":{"id":"f2","name":"Chicken burrito bowl","restaurant":"Chipotle","servingLabel":"1 bowl as served","n":N(kcal=840,protein=52,carbs=92,fat=28,fiber=14,sugar=5,satFat=9,cholesterol=140,sodium=1900,potassium=1200,calcium=300,iron=5),"fav":True,"rating":5,"count":6,"last":2,"source":"restaurant"},
    "s1":{"id":"s1","name":"Vitamin D3 5000 IU","brand":"Nature Made","servingLabel":"1 softgel","kind":"supplement","inStack":True,"stackQty":1,"n":N(vitD=125),"count":3}},
  "meals": {},
  "days": {today: {"date": today, "entries": [
    {"id":"e1","foodId":"f1","name":"Chobani Greek Yogurt, Vanilla","servingLabel":"1 cup (227 g)","qty":1,"slot":"breakfast","n":N(kcal=190,protein=16,carbs=23,fat=4,sugar=20,addedSugar=14,satFat=2.5,cholesterol=15,sodium=75,potassium=280,calcium=200)},
    {"id":"e3","foodId":"f2","name":"Chicken burrito bowl","restaurant":"Chipotle","servingLabel":"1 bowl as served","qty":1,"slot":"lunch","n":N(kcal=840,protein=52,carbs=92,fat=28,fiber=14,sugar=5,satFat=9,cholesterol=140,sodium=1900,potassium=1200,calcium=300,iron=5)}]}},
  "tab": "today"}
# Two weeks of morning weigh-ins trending down about a pound a week, plus a workout today, so Today's strip and Me's Weight section have something to show.
import datetime, random
random.seed(3)
for k in range(1, 15):
    d = (datetime.date.today() - datetime.timedelta(days=k)).isoformat()
    SEED["days"].setdefault(d, {"date": d, "entries": []})["weight"] = round(183.6 - (14 - k) * 0.14 + random.uniform(-0.6, 0.6), 1)
SEED["days"][today]["weight"] = 181.4
SEED["workouts"] = {today + "_seed": {"id": today + "_seed", "date": today, "name": "Push day", "started": int(time.time() * 1000) - 3600000, "finished": int(time.time() * 1000), "templateId": None, "note": "",
  "items": [{"id": "i1", "exId": "bench", "name": "Bench Press", "type": "weight", "sets": [{"w": 185, "r": 8, "done": True}, {"w": 185, "r": 8, "done": True}, {"w": 185, "r": 7, "done": True}]},
            {"id": "i2", "exId": "incline-db", "name": "Incline Dumbbell Press", "type": "weight", "sets": [{"w": 65, "r": 10, "done": True}, {"w": 65, "r": 10, "done": True}, {"w": 65, "r": 9, "done": True}]}]}}

async def main():
    os.chdir(WWW)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), Quiet); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{port}/'
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url); await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(OUT / 'onboarding.png'))
        await pg.evaluate("v => localStorage.setItem('macroledger.v1', v)", json.dumps(SEED))
        await pg.goto(url); await pg.wait_for_timeout(900)
        await pg.screenshot(path=str(OUT / 'today.png'))
        await pg.click('[data-act="toggle-full"]'); await pg.wait_for_timeout(350)
        await pg.screenshot(path=str(OUT / 'details.png'))
        await pg.click('.sheet .closex'); await pg.wait_for_timeout(250); await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(350)
        await pg.screenshot(path=str(OUT / 'add.png'))
        await pg.click('[data-act="add-filter"][data-f="basics"]'); await pg.click('[data-act="pick"][data-id="basic:chickenraw"]'); await pg.wait_for_timeout(250)
        await pg.click('#unitSeg button[data-u="lb"]'); await pg.fill('#qtyInput', '0.9'); await pg.wait_for_timeout(100)
        await pg.screenshot(path=str(OUT / 'amount.png'))
        await pg.goto(url); await pg.wait_for_timeout(200)
        await pg.click('nav.tabs button[data-tab="foods"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="foods-sort"][data-sort="meals"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / 'foods-meals.png'))
        await pg.click('nav.tabs button[data-tab="workout"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / 'workout-done.png'))
        await pg.click('[data-act="day"][data-n="1"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / 'workout-start.png'))
        await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(350)
        await pg.screenshot(path=str(OUT / 'exercise-picker.png'))
        await pg.evaluate("document.querySelector('.scrim .sheet-b').scrollTop = 900"); await pg.wait_for_timeout(150)
        await pg.screenshot(path=str(OUT / 'exercise-picker-scrolled.png'))
        await pg.click('[data-act="ex-pick"][data-id="bench"]'); await pg.wait_for_timeout(250)
        await pg.fill('.set input[data-si="0"][data-f="w"]', '185'); await pg.fill('.set input[data-si="0"][data-f="r"]', '8')
        await pg.click('[data-act="w-set-done"][data-si="0"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-act="w-add-exercise"]'); await pg.wait_for_timeout(250)
        await pg.click('[data-act="ex-pick"][data-id="incline-db"]'); await pg.wait_for_timeout(250)
        await pg.screenshot(path=str(OUT / 'workout.png'))
        await pg.click('nav.tabs button[data-tab="me"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / 'me.png'))
        sw = await pg.evaluate('document.documentElement.scrollWidth')
        print('scrollWidth', sw, 'errors', errs or 'none', '->', OUT)
        await b.close()
    srv.shutdown()

asyncio.run(main())
