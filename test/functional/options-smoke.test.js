const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { expect } = require('chai')
const webExtensionsGeckoDriver = require('webextensions-geckodriver')
const { webdriver, firefox } = webExtensionsGeckoDriver
const { By, until } = webdriver

describe('Options page smoke test', function () {
  this.timeout(60000)
  let driver
  const fixture = path.resolve(__dirname, '../../dist/options/smoke-test.html')

  before(async () => {
    const fxOptions = new firefox.Options().headless()
    const extension = await webExtensionsGeckoDriver(
      path.resolve(__dirname, '../../dist/manifest.json'),
      { binary: 'C:/Program Files/Mozilla Firefox/firefox.exe', fxOptions }
    )
    driver = extension.geckodriver
    const html = fs.readFileSync(path.resolve(__dirname, '../../dist/options/options.html'), 'utf8')
    const mock = `<script>
      const data = { proxies: [], relations: {} };
      const identities = [];
      window.browser = {
        i18n: { getMessage: key => key },
        runtime: { getManifest: () => ({ name: 'Container Proxy for PwnFox' }) },
        extension: { isAllowedIncognitoAccess: async () => false },
        contextualIdentities: {
          query: async () => identities,
          create: async values => {
            const identity = { ...values, cookieStoreId: 'firefox-container-' + (identities.length + 1) };
            identities.push(identity);
            return identity;
          }
        },
        storage: { local: {
          get: async () => data,
          set: async values => Object.assign(data, values)
        } }
      };
    </script><script src="index.js"></script>`
    fs.writeFileSync(fixture, html.replace('<script src="index.js"></script>', mock))
    await driver.setContext(firefox.Context.CONTENT)
    await driver.get(pathToFileURL(fixture).href)
  })

  it('configures the eight PwnFox proxies and navigates the options', async () => {
    await driver.wait(until.elementLocated(By.css('.pwnfox-preset button')), 10000)
    await driver.findElement(By.css('.pwnfox-preset button')).click()
    await driver.wait(async () => (await driver.findElements(By.css('.container-item'))).length >= 9, 10000)

    const assignments = await driver.executeScript('return browser.storage.local.get(["proxies", "relations"])')
    expect(assignments.proxies.filter(proxy => proxy.id.startsWith('pwnfox-preset-'))).to.have.length(8)
    expect(assignments.proxies.find(proxy => proxy.id === 'pwnfox-preset-blue').port).to.equal(8081)
    expect(assignments.proxies.find(proxy => proxy.id === 'pwnfox-preset-purple').port).to.equal(8088)

    await driver.findElement(By.css('[test-id=proxies]')).click()
    await driver.wait(until.elementLocated(By.css('.proxy-list-item')), 10000)
    await driver.findElement(By.css('a[href="#!/proxies/new"]')).click()
    await driver.wait(until.elementLocated(By.css('[data-testid=ProxyForm]')), 10000)
    await driver.findElement(By.css('[data-testid=title]')).sendKeys('Smoke test')
    await driver.findElement(By.css('select')).sendKeys('http')
    await driver.findElement(By.css('[data-testid=host]')).sendKeys('127.0.0.1')
    const portInput = await driver.findElement(By.css('[data-testid=port]'))
    await portInput.clear()
    await driver.findElement(By.css('[data-testid=port]')).sendKeys('9090')
    await driver.findElement(By.css('[data-testid=save]')).click()
    await driver.wait(async () => (await driver.getCurrentUrl()).includes('#!/proxies') &&
      (await driver.findElements(By.css('.proxy-name'))).length >= 9, 10000)
    const names = await Promise.all((await driver.findElements(By.css('.proxy-name'))).map(node => node.getText()))
    expect(names).to.include('Smoke test')
    await driver.findElement(By.css('[test-id=assign]')).click()
    await driver.wait(until.elementLocated(By.css('.pwnfox-preset')), 10000)
  })

  after(async () => {
    if (driver !== undefined) await driver.quit()
    if (fs.existsSync(fixture)) fs.unlinkSync(fixture)
  })
})
