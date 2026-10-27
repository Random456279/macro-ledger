"""End-to-end test of the standalone build against a local `wrangler dev` (local D1, AI stubbed).
Run: npm run test:standalone   (starts wrangler dev itself; needs Playwright's Chromium)
Covers: key sheet, connect, onboarding, logging, server persistence across a cleared browser, scan via the
Worker proxy, offline outbox replay, and the API's auth rejection."""
import asyncio, json, os, pathlib, re, subprocess, sys, time, hashlib, secrets, urllib.request, urllib.error
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8799
BASE = f'http://127.0.0.1:{PORT}'
WRANGLER = str(ROOT / 'node_modules' / '.bin' / 'wrangler')
KEY = 'ml_' + secrets.token_urlsafe(24)
KEY_HASH = hashlib.sha256(KEY.encode()).hexdigest()
STUB = json.dumps({"kind": "supplement", "basis": "label", "name": "Stub Fish Oil", "brand": "Test", "servingLabel": "2 soft gels", "servingGrams": None,
                   "perServing": {"kcal": 20, "fat": 2, "omega3": 1100}, "extras": [{"name": "EPA", "amount": 650, "unit": "mg"}], "confidence": "high", "notes": "stub"})

def sh(args, **kw):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print(r.stdout, r.stderr); raise SystemExit('command failed: ' + ' '.join(args))
    return r.stdout

def http(method, path, body=None, key=KEY):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'authorization': 'Bearer ' + key, 'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'null')

def ok(cond, msg):
    if not cond: raise SystemExit('ASSERT: ' + msg)
    print('ok  ' + msg)

async def main():
    sh(['node', 'tools/build.mjs', '--standalone'])
    sh([WRANGLER, 'd1', 'execute', 'macro-ledger', '--local', '-y', '--file', 'worker/schema.sql'])   # harness only; the Worker also self-creates tables
    sh([WRANGLER, 'd1', 'execute', 'macro-ledger', '--local', '-y', '--command', f"DELETE FROM devices; DELETE FROM docs; DELETE FROM ai_usage; INSERT INTO devices (key_hash, user_id, label, created) VALUES ('{KEY_HASH}', 'tester', 'test', {int(time.time()*1000)})"])
    dev = subprocess.Popen([WRANGLER, 'dev', '--local', '--port', str(PORT), '--ip', '127.0.0.1', '--var', 'AI_STUB:' + STUB], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        for _ in range(120):
            time.sleep(1)
            try:
                with urllib.request.urlopen(BASE + '/manifest.webmanifest', timeout=2) as r:
                    if r.status == 200: break
            except Exception: pass
        else:
            print(dev.stdout.read()); raise SystemExit('wrangler dev did not start')
        # API level
        st, body = http('GET', '/api/me', key='ml_wrong'); ok(st == 401, 'wrong key is rejected (401)')
        st, body = http('GET', '/api/me'); ok(st == 200 and body['user'] == 'tester', 'right key is accepted')
        owner_key = open('/tmp/claude-0/-home-claude/6dbda2bb-2d0b-5768-a221-287b60f52238/scratchpad/devicekey.txt').read().split()[0] if os.path.exists('/tmp/claude-0/-home-claude/6dbda2bb-2d0b-5768-a221-287b60f52238/scratchpad/devicekey.txt') else None
        if owner_key:
            st, body = http('GET', '/api/me', key=owner_key); ok(st == 200 and body['user'] == 'owner', 'owner key from wrangler.toml vars is accepted without a devices row')
        st, body = http('GET', '/api/state'); ok(st == 200 and body['profile'] is None and body['foods'] == {}, 'fresh state is empty')

        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.route('**/fonts.g*/**', lambda r: r.abort())
            await pg.goto(BASE + '/'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#k-key').count() == 1, 'standalone opens with the device key sheet')
            await pg.fill('#k-key', KEY); await pg.click('[data-act="connect-go"]'); await pg.wait_for_timeout(800)
            ok(await pg.locator('#k-key').count() == 0, 'key accepted, sheet closed')
            # onboarding
            await pg.fill('#f-age', '20'); await pg.fill('#f-wt', '180'); await pg.select_option('#f-hft', '6'); await pg.select_option('#f-hin', '0')
            await pg.click('#onb-go'); await pg.wait_for_timeout(600)
            ok(await pg.locator('.hero .kcal-big').count() == 1, 'onboarding saved, Today rendered')
            # log a basic
            await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="add-filter"][data-f="basics"]'); await pg.click('[data-act="pick"][data-id="basic:egg"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="q-set"][data-v="2"]'); await pg.click('[data-act="q-add"]'); await pg.wait_for_timeout(900)
            ok(await pg.locator('.entry').count() == 1, 'entry logged')
            st, body = http('GET', '/api/state'); ok(st == 200 and body['profile'] and len(body['foods']) == 1 and len(body['days']) == 1, 'server has profile, food and day')
            # scan through the proxy (stubbed)
            await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(300)
            img = ROOT / 'test' / 'shots' / 'today.png'
            if not img.exists(): img = ROOT / 'src' / 'public' / 'icons' / 'icon-512.png'
            await pg.set_input_files('#photoInput', str(img)); await pg.wait_for_timeout(1500)
            ok(await pg.input_value('#ff-name') == 'Stub Fish Oil', 'scan went through the Worker proxy and filled the form')
            ok(await pg.input_value('#n-omega3') == '1100', 'omega-3 column filled from proxy reply')
            await pg.click('[data-act="ff-save"]'); await pg.wait_for_timeout(900)
            st, body = http('GET', '/api/me'); ok(body['usage']['calls'] == 1, 'usage recorded (1 call)')
            # a workout: start, add bench, type a set, finish, save as favorite; all of it should reach the server
            await pg.click('.sheet .closex'); await pg.wait_for_timeout(250)
            await pg.click('nav.tabs button[data-tab="workout"]'); await pg.wait_for_timeout(200)
            await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="ex-pick"][data-id="bench"]'); await pg.wait_for_timeout(300)
            await pg.fill('.set input[data-si="0"][data-f="w"]', '185'); await pg.fill('.set input[data-si="0"][data-f="r"]', '8')
            await pg.click('[data-act="w-finish"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="w-more"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-act="w-save-template"]'); await pg.wait_for_timeout(900)
            st, body = http('GET', '/api/state?days=30')
            ok(len(body['workouts']) == 1 and len(body['templates']) == 1, 'server has the workout and the favorite')
            wk = list(body['workouts'].values())[0]
            ok(wk['items'][0]['sets'][0]['w'] == 185 and wk['items'][0]['sets'][0]['r'] == 8 and wk['finished'], 'workout doc carries the typed set')
            # persistence: clear the browser entirely, reopen with the key, data comes from the server
            await ctx.close()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.route('**/fonts.g*/**', lambda r: r.abort())
            await pg.goto(BASE + '/'); await pg.wait_for_timeout(500)
            await pg.fill('#k-key', KEY); await pg.click('[data-act="connect-go"]'); await pg.wait_for_timeout(1200)
            ok(await pg.locator('.entry').count() == 1, 'fresh browser + key: the logged day came back from the server')
            await pg.click('nav.tabs button[data-tab="workout"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('.card.wk').count() == 1 and await pg.input_value('.set input[data-si="0"][data-f="w"]') == '185', 'fresh browser: the workout came back too')
            await pg.click('nav.tabs button[data-tab="today"]'); await pg.wait_for_timeout(200)
            # offline outbox: block the API, log, then unblock and confirm it synced
            await pg.route('**/api/**', lambda r: r.abort())
            await pg.click('nav.tabs button.add'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="add-filter"][data-f="basics"]'); await pg.click('[data-act="pick"][data-id="basic:banana"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-act="q-add"]'); await pg.wait_for_timeout(600)
            ok(await pg.locator('.entry').count() == 2, 'offline: entry logged locally')
            pend = await pg.evaluate("JSON.parse(localStorage.getItem('macroledger.outbox')||'[]').length"); ok(pend >= 1, f'offline: {pend} change(s) queued in the outbox')
            await pg.unroute('**/api/**'); await pg.evaluate("window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(1200)
            pend = await pg.evaluate("JSON.parse(localStorage.getItem('macroledger.outbox')||'[]').length"); ok(pend == 0, 'back online: outbox drained')
            st, body = http('GET', '/api/state'); day = list(body['days'].values())[0]; ok(len(day['entries']) == 2, 'server day has both entries after replay')
            # service worker and manifest served
            st2 = urllib.request.urlopen(BASE + '/sw.js').status; ok(st2 == 200, 'sw.js served')
            ok(not errs, 'no page errors (' + '; '.join(errs)[:200] + ')')
            await b.close()
        print('STANDALONE PASSED')
    finally:
        dev.terminate()
        try: dev.wait(timeout=10)
        except Exception: dev.kill()

asyncio.run(main())
