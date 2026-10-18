import { ProxyDao } from '../store/Store'

// Keep this order in sync with PwnFox's default container buttons.
export const PWNFOX_COLORS = [
  'blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple'
] as const

export const DEFAULT_START_PORT = 8081
export const MAX_START_PORT = 65535 - PWNFOX_COLORS.length + 1

export function isValidStartPort (port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= MAX_START_PORT
}

export async function configurePwnFox (startPort: number): Promise<void> {
  if (!isValidStartPort(startPort)) {
    throw new RangeError(`Start port must be between 1 and ${MAX_START_PORT}`)
  }

  const identities = await browser.contextualIdentities.query({})
  const assignments: Array<{ cookieStoreId: string, proxy: ProxyDao }> = []

  for (const [index, color] of PWNFOX_COLORS.entries()) {
    const name = `PwnFox-${color}`
    const identity = identities.find(item => item.name === name) ??
      await browser.contextualIdentities.create({ name, color, icon: 'fingerprint' })
    assignments.push({
      cookieStoreId: identity.cookieStoreId,
      proxy: {
        id: `pwnfox-preset-${color}`,
        title: `PwnFox ${color}`,
        type: 'http',
        host: '127.0.0.1',
        port: startPort + index,
        doNotProxyLocal: false
      }
    })
  }

  // Commit both collections together. Unrelated proxies and container routes survive.
  const saved = await browser.storage.local.get(['proxies', 'relations'])
  const proxies: ProxyDao[] = Array.isArray(saved.proxies) ? saved.proxies : []
  const relations: { [key: string]: string[] } = saved.relations ?? {}
  for (const { cookieStoreId, proxy } of assignments) {
    const index = proxies.findIndex(item => item.id === proxy.id)
    if (index < 0) proxies.push(proxy)
    else proxies[index] = proxy
    relations[cookieStoreId] = [proxy.id]
  }
  await browser.storage.local.set({ proxies, relations })
}
