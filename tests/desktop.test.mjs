import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('desktop shell mounts the pet without a diagnostic overlay', async () => {
  const html = await read('desktop/src/index.html')

  assert.doesNotMatch(html, /__diag__/)
  assert.match(html, /background:\s*transparent/)
  assert.match(html, /<script\s+type="module"\s+src="\.\/main\.mjs"><\/script>/)
})

test('desktop production build uses relative asset URLs', async () => {
  const viteConfig = await read('desktop/vite.config.js')

  assert.match(viteConfig, /base:\s*['"]\.\/['"]/)
})

test('desktop window is a transparent borderless companion', async () => {
  const config = JSON.parse(await read('desktop/src-tauri/tauri.conf.json'))
  const window = config.app.windows.find(({ label }) => label === 'pet')

  assert.ok(window)
  assert.equal(window.decorations, false)
  assert.equal(window.transparent, true)
  assert.equal(window.resizable, false)
  assert.equal(window.skipTaskbar, true)
  assert.equal(window.shadow, false)
  assert.equal(window.focus, false)
})

test('desktop DSH requests avoid the WebKit streaming HTTP bridge', async () => {
  const [main, rust] = await Promise.all([
    read('desktop/src/main.mjs'),
    read('desktop/src-tauri/src/lib.rs'),
  ])

  assert.doesNotMatch(main, /@tauri-apps\/plugin-http|tauriFetch/)
  assert.match(main, /invoke\(['"]dsh_request['"]/)
  assert.match(rust, /async fn dsh_request/)
  assert.match(rust, /response\.bytes\(\)\.await/)
})

test('desktop passes bundled asset URLs through to the sprite renderer', async () => {
  const [main, client] = await Promise.all([
    read('desktop/src/main.mjs'),
    read('lib/client/index.mjs'),
  ])

  assert.match(main, /clientMod\.apply\(\{\s*resolveAssetUrl\s*\}\)/)
  assert.match(client, /ctx\.resolveAssetUrl/)
  assert.match(client, /resolveAssetUrl\(`\$\{ASSETS_URL\}\/characters\/\$\{id\}\/\$\{sheet\}/)
})
