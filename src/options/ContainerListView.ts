import m, { Component, Vnode } from './safe-mithril'
import { Store } from '../store/Store'
import ContextualIdentity = browser.contextualIdentities.ContextualIdentity
import { ProxySettings } from '../domain/ProxySettings'
import { configurePwnFox, DEFAULT_START_PORT, isValidStartPort, MAX_START_PORT, PWNFOX_COLORS } from './pwnfox'

class ContainerListModel {
  containers: ContextualIdentity[] = []
  proxies: ProxySettings[] = []
  proxiesById: { [key: string]: ProxySettings } = {}
  relations: Map<string, string[]> = new Map<string, string[]>()
  enableIncognito: boolean = false

  async loadAll (): Promise<void> {
    this.containers = await browser.contextualIdentities.query({})
    const store: Store = (window as any).store
    this.proxies = await store.getAllProxies()
    this.proxies.forEach(p => {
      this.proxiesById[p.id] = p
    })
    const result = await browser.storage.local.get('relations')
    this.relations = new Map<string, string[]>(Object.entries(result.relations ?? {}))
    this.enableIncognito = await browser.extension.isAllowedIncognitoAccess()
    m.redraw()
  }

  async saveRelations (): Promise<void> {
    await browser.storage.local.set({ relations: Object.fromEntries(this.relations) })
  }
}

export class ContainerListView implements Component {
  model: ContainerListModel = new ContainerListModel()
  startPort = String(DEFAULT_START_PORT)
  applying = false
  message = ''
  error = ''

  async oninit (): Promise<void> {
    await this.model.loadAll()
    m.redraw()
  }

  view (): Vnode | null {
    if (this.model.containers === undefined) {
      return null
    }
    const items = this.model.containers.map((i) => this.renderContainerItem(i))
    const defaultContainer = this.renderContainerItem({
      cookieStoreId: 'firefox-default',
      name: browser.i18n.getMessage('ContainerList_defaultContainerName'),
      color: '',
      colorCode: '',
      icon: 'default',
      iconUrl: ''
    })

    const privateContainer = this.model.enableIncognito ? this.renderContainerItem({
      cookieStoreId: 'firefox-private',
      name: browser.i18n.getMessage('ContainerList_privateBrowsingContainerName'),
      color: '',
      colorCode: '',
      icon: 'private-browsing',
      iconUrl: ''
    }) : []
    const port = Number(this.startPort)
    const valid = isValidStartPort(port) && this.startPort.trim() !== ''
    const preset = m('section.pwnfox-preset', [
      m('h2', browser.i18n.getMessage('PwnFox_heading')),
      m('p', browser.i18n.getMessage('PwnFox_description')),
      m('label', { for: 'pwnfox-start-port' }, browser.i18n.getMessage('PwnFox_startPort')),
      m('div.pwnfox-preset-controls', [
        m('input#pwnfox-start-port[type=number]', {
          min: 1,
          max: MAX_START_PORT,
          step: 1,
          value: this.startPort,
          oninput: (event: InputEvent) => { this.startPort = (event.target as HTMLInputElement).value }
        }),
        m('button.button--primary[type=button]', {
          disabled: this.applying || !valid,
          onclick: async () => {
            this.applying = true
            this.message = ''
            this.error = ''
            try {
              await configurePwnFox(port)
              await this.model.loadAll()
              this.message = browser.i18n.getMessage('PwnFox_success')
            } catch (error) {
              this.error = browser.i18n.getMessage('PwnFox_error') + ' ' + String(error)
            } finally {
              this.applying = false
              m.redraw()
            }
          }
        }, browser.i18n.getMessage('PwnFox_apply'))
      ]),
      m('p.pwnfox-ports', valid
        ? PWNFOX_COLORS.map((color, index) => `${color}: ${port + index}`).join(' · ')
        : browser.i18n.getMessage('PwnFox_invalidPort')),
      this.message !== '' ? m('p.pwnfox-status[role=status]', this.message) : null,
      this.error !== '' ? m('p.pwnfox-error[role=alert]', this.error) : null
    ])
    return m('.containers', [preset, ...items, defaultContainer, privateContainer])
  }

  renderSelectProxy (cookieStoreId: string, proxyId: string): Vnode {
    const proxyOptions = this.model.proxies.map(p => m('option', {
      value: p.id,
      selected: p.id === proxyId
    }, p.title !== '' ? p.title : p.url))
    const defaultOption = m('option', {
      value: '',
      selected: proxyId === ''
    }, browser.i18n.getMessage('ContainerList_proxyDisabled'))
    return m(
      'select',
      {
        oninput: async (e: InputEvent): Promise<void> => {
          const proxyId = (e.target as HTMLSelectElement).value
          if (proxyId === '') {
            this.model.relations.delete(cookieStoreId)
          } else {
            this.model.relations.set(cookieStoreId, [proxyId])
          }
          await this.model.saveRelations()
        }
      },
      [defaultOption, ...proxyOptions]
    )
  }

  renderContainerItem (container: ContextualIdentity): Vnode {
    const proxies = this.model.relations.get(container.cookieStoreId) ?? []

    const classes = `identity-color-${container.color} identity-icon-${container.icon}`
    const icon = m('.container-icon')
    const name = m('.container-name', container.name)
    return m('.container-item', { class: classes }, [
      m('.container-label', [icon, name]),
      m('.attached-proxies', [
        this.renderSelectProxy(container.cookieStoreId, proxies[0])
      ])
    ])
  }
}
