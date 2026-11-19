import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { createAvatarTapCounter, FOCUS_URL } from '../src/utils/avatar-easter-egg.ts'

const source = readFileSync(new URL('../src/components/InteractiveAvatar.astro', import.meta.url), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^\n]+avatar-easter-egg[^\n]+/, '')
const compiled = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function environment() {
  const timers = new Map(), navigations = [], definitions = new Map()
  let now = 0, nextId = 0
  class Element extends EventTarget {
    style = {}; dataset = {}; children = []; innerHTML = ''
    setAttribute() {} focus() {} animate() { return { cancel() {} } }
    appendChild(child) { child.parent = this; this.children.push(child) }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
  }
  class Host extends Element {
    button = new Element()
    querySelector() { return this.button }
  }
  const document = Object.assign(new EventTarget(), {
    body: new Element(), createElement: () => new Element(),
    querySelector() { return this.body.children.find(child => 'verificationTransition' in child.dataset) }
  })
  const window = Object.assign(new EventTarget(), {
    location: { assign: url => navigations.push(url) },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id },
    clearTimeout: id => timers.delete(id)
  })
  vm.runInNewContext(compiled, {
    HTMLElement: Host, customElements: { get: name => definitions.get(name), define: (name, value) => definitions.set(name, value) },
    createAvatarTapCounter, FOCUS_URL, document, window, AbortController,
    performance: { now: () => now }, matchMedia: () => ({ matches: false }),
    cancelAnimationFrame() {}, requestAnimationFrame() { return 0 }
  })
  const avatar = new (definitions.get('interactive-avatar'))()
  avatar.connectedCallback()
  return { avatar, document, window, timers, navigations, tap() { now += 100; avatar.button.dispatchEvent(new Event('click')) } }
}

test('fifth tap shows the checking screen before navigating to the neutral verification route', () => {
  const env = environment()
  for (let i = 0; i < 4; i++) env.tap()
  assert.equal(env.document.body.children.length, 0)
  env.tap()
  assert.equal(env.document.body.children.length, 1)
  assert.match(env.document.body.children[0].innerHTML, /正在检查访问环境/)
  assert.deepEqual(env.navigations, [])
  for (let i = 0; i < 5; i++) env.tap()
  assert.equal(env.timers.size, 1)
  const timer = [...env.timers.values()][0]
  assert.equal(timer.delay, 1100)
  timer.callback()
  assert.deepEqual(env.navigations, ['/yen-chiu-astro/verify/'])
  env.avatar.disconnectedCallback()
})

test('navigation, pagehide and disconnect clean up the screen and delayed redirect', () => {
  for (const event of ['astro:before-swap', 'pagehide', 'disconnect']) {
    const env = environment()
    for (let i = 0; i < 5; i++) env.tap()
    if (event === 'disconnect') env.avatar.disconnectedCallback()
    else (event === 'pagehide' ? env.window : env.document).dispatchEvent(new Event(event))
    assert.equal(env.timers.size, 0)
    assert.equal(env.document.body.children.length, 0)
    assert.deepEqual(env.navigations, [])
    env.avatar.disconnectedCallback()
  }
})
