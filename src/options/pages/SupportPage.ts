import m, { Vnode } from '../safe-mithril'

const supportEmail = 'malwarian@pm.me'

export default class SupportPage {
  view (): Vnode {
    return m('div', [
      browser.i18n.getMessage('SupportPage_contactMessage') + ' ',
      m('a', { href: `mailto:${supportEmail}` }, supportEmail)
    ])
  }
}
