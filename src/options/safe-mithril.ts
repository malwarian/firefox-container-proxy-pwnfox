// Small renderer for the options page. It supports only the Mithril calls used
// here and creates nodes directly, so extension data is always rendered as text.
import type mithril from 'mithril'
export type { Component, ClassComponent, FactoryComponent, Vnode } from 'mithril'

type Attributes = Record<string, unknown>
type Child = SafeNode | string | number | boolean | null | undefined | Child[]
interface ComponentInstance { view: (vnode: SafeNode) => Child, oninit?: (vnode: SafeNode) => void }

interface SafeNode {
  tag: string | Function | ComponentInstance
  attrs: Attributes
  children: Child[]
}

const componentInstances = new Map<string, { tag: SafeNode['tag'], instance: ComponentInstance }>()
const nodePaths = new WeakMap<Node, string>()
let root: HTMLElement
let routes: Record<string, { render: (vnode: { attrs: Attributes }) => Child }>
let defaultRoute = '/containers'
let currentRoute = ''
let rendering = false
let pending = false

function isNode (value: unknown): value is SafeNode {
  return value !== null && typeof value === 'object' && 'tag' in (value as object) && 'attrs' in (value as object) && 'children' in (value as object)
}

function isAttributes (value: unknown): value is Attributes {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !isNode(value)
}

function parseSelector (selector: string): { tag: string, attrs: Attributes } {
  const first = /^[a-z][\w-]*/i.exec(selector)
  const tag = first?.[0] ?? 'div'
  const attrs: Attributes = {}
  const classes: string[] = []
  const suffix = selector.slice(first?.[0].length ?? 0)
  const token = /([.#])([\w-]+)|\[([^\]=]+)(?:=([^\]]+))?\]/g
  let match: RegExpExecArray | null
  while ((match = token.exec(suffix)) !== null) {
    if (match[1] === '.') classes.push(match[2])
    else if (match[1] === '#') attrs.id = match[2]
    else attrs[match[3]] = match[4] ?? ''
  }
  if (classes.length > 0) attrs.class = classes.join(' ')
  return { tag, attrs }
}

function h (tag: SafeNode['tag'], attributesOrChild?: Attributes | Child, child?: Child): SafeNode {
  const selector = typeof tag === 'string' ? parseSelector(tag) : null
  const hasAttributes = isAttributes(attributesOrChild)
  const attrs = { ...(selector?.attrs ?? {}), ...(hasAttributes ? attributesOrChild : {}) }
  if (selector?.attrs.class !== undefined && hasAttributes && attributesOrChild.class !== undefined) {
    attrs.class = `${String(selector.attrs.class)} ${String(attributesOrChild.class)}`
  }
  const children = hasAttributes ? child : attributesOrChild
  return { tag: selector?.tag ?? tag, attrs, children: children === undefined ? [] : [children] }
}

function pathFromHash (): string {
  const hash = window.location.hash
  return hash.startsWith('#!/') ? hash.slice(2) : defaultRoute
}

function matchedRoute (): { render: (vnode: { attrs: Attributes }) => Child, attrs: Attributes } {
  const path = pathFromHash()
  if (path in routes) return { render: routes[path].render, attrs: {} }
  for (const [template, route] of Object.entries(routes)) {
    const parameter = template.indexOf('/:')
    if (parameter === -1 || !path.startsWith(template.slice(0, parameter + 1))) continue
    const value = path.slice(parameter + 1)
    if (value === '' || value.includes('/')) continue
    return { render: route.render, attrs: { [template.slice(parameter + 2)]: decodeURIComponent(value) } }
  }
  return { render: routes[defaultRoute].render, attrs: {} }
}

function addAttributes (element: HTMLElement, attrs: Attributes): void {
  let selectValue: unknown
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'value' && element instanceof HTMLSelectElement) {
      selectValue = value
      continue
    }
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2), event => {
        if (rendering) return
        const result = (value as (event: Event) => unknown)(event)
        redraw()
        if (result !== null && typeof result === 'object' && 'then' in (result as object)) {
          Promise.resolve(result).then(redraw, redraw)
        }
      })
      continue
    }
    if (value === null || value === undefined || value === false) continue
    if (name === 'value' && element instanceof HTMLInputElement) {
      element.value = String(value)
    } else if (name === 'checked' && element instanceof HTMLInputElement) {
      element.checked = Boolean(value)
    } else if (name === 'selected' && element instanceof HTMLOptionElement) {
      element.selected = Boolean(value)
    } else if (typeof value === 'boolean') {
      element.setAttribute(name, '')
    } else {
      element.setAttribute(name, String(value))
    }
  }
  if (selectValue !== undefined && element instanceof HTMLSelectElement) {
    // Applied after its option elements have been inserted by renderNode.
    element.dataset.selectValue = String(selectValue)
  }
}

function renderNode (child: Child, parent: Node, path: string, seen: Set<string>): void {
  if (Array.isArray(child)) {
    child.forEach((item, index) => renderNode(item, parent, `${path}/${index}`, seen))
    return
  }
  if (child === null || child === undefined || typeof child === 'boolean') return
  if (!isNode(child)) {
    parent.appendChild(document.createTextNode(String(child)))
    return
  }
  if (typeof child.tag !== 'string') {
    const key = `${currentRoute}:${path}`
    seen.add(key)
    let record = componentInstances.get(key)
    if (record === undefined || record.tag !== child.tag) {
      const tag = child.tag
      const instance = typeof tag === 'function'
        ? ('prototype' in tag && typeof (tag as any).prototype.view === 'function'
          ? new (tag as any)() as ComponentInstance
          : (tag as () => ComponentInstance)())
        : tag
      record = { tag, instance }
      componentInstances.set(key, record)
      record.instance.oninit?.(child)
    }
    renderNode(record.instance.view(child), parent, `${path}/view`, seen)
    return
  }
  const element = document.createElement(child.tag)
  nodePaths.set(element, path)
  addAttributes(element, child.attrs)
  child.children.forEach((item, index) => renderNode(item, element, `${path}/${index}`, seen))
  if (element instanceof HTMLSelectElement && element.dataset.selectValue !== undefined) {
    element.value = element.dataset.selectValue
    delete element.dataset.selectValue
  }
  parent.appendChild(element)
}

function render (): void {
  if (rendering || root === undefined) return
  rendering = true
  try {
    const path = pathFromHash()
    if (path !== currentRoute) {
      componentInstances.clear()
      currentRoute = path
    }
    const active = document.activeElement
    const focusPath = active === null ? undefined : nodePaths.get(active)
    const selection = active instanceof HTMLInputElement && active.type !== 'number'
      ? { start: active.selectionStart, end: active.selectionEnd }
      : null
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const fragment = document.createDocumentFragment()
    const seen = new Set<string>()
    const route = matchedRoute()
    renderNode(route.render({ attrs: route.attrs }), fragment, 'root', seen)
    root.replaceChildren(fragment)
    for (const key of componentInstances.keys()) {
      if (!seen.has(key)) componentInstances.delete(key)
    }
    if (focusPath !== undefined) {
      const target = Array.from(root.querySelectorAll<HTMLElement>('*')).find(node => nodePaths.get(node) === focusPath)
      target?.focus({ preventScroll: true })
      if (selection !== null && target instanceof HTMLInputElement && selection.start !== null && selection.end !== null) {
        target.setSelectionRange(selection.start, selection.end)
      }
    }
    window.scrollTo(scrollX, scrollY)
  } finally {
    rendering = false
  }
}

function redraw (): void {
  if (pending) return
  pending = true
  queueMicrotask(() => {
    pending = false
    render()
  })
}

function route (element: HTMLElement, fallback: string, definitions: typeof routes): void {
  root = element
  routes = definitions
  defaultRoute = fallback
  window.addEventListener('hashchange', redraw)
  root.addEventListener('submit', event => event.preventDefault())
  render()
}

route.get = pathFromHash
route.set = (path: string): void => {
  window.location.hash = `!${path}`
  redraw()
}

const m = Object.assign(h, { redraw, route }) as unknown as typeof mithril
export default m
