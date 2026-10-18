import { expect } from 'chai'
import { configurePwnFox, isValidStartPort, PWNFOX_COLORS } from '../../../src/options/pwnfox'

describe('PwnFox quick setup', () => {
  let identities: any[]
  let saved: any
  let writes: number

  beforeEach(() => {
    identities = [{ cookieStoreId: 'existing-blue', name: 'PwnFox-blue', color: 'blue', icon: 'fingerprint' }]
    saved = {
      proxies: [{ id: 'manual', title: 'Manual', type: 'http', host: 'example.org', port: 9000, doNotProxyLocal: true }],
      relations: { other: ['manual'], 'existing-blue': ['manual'] }
    }
    writes = 0
    ;(global as any).browser = {
      contextualIdentities: {
        query: async () => identities,
        create: async ({ name, color, icon }: { name: string, color: string, icon: string }) => {
          const identity = { cookieStoreId: `new-${color}`, name, color, icon }
          identities.push(identity)
          return identity
        }
      },
      storage: {
        local: {
          get: async () => saved,
          set: async (value: any) => { saved = value; writes++ }
        }
      }
    }
  })

  afterEach(() => { delete (global as any).browser })

  it('assigns 8081–8088 in PwnFox color order and preserves unrelated routes', async () => {
    await configurePwnFox(8081)

    expect(identities).to.have.length(PWNFOX_COLORS.length)
    expect(identities.map(identity => identity.name)).to.deep.equal(PWNFOX_COLORS.map(color => `PwnFox-${color}`))
    expect(saved.proxies).to.have.length(9)
    expect(saved.relations.other).to.deep.equal(['manual'])
    expect(saved.relations['existing-blue']).to.deep.equal(['pwnfox-preset-blue'])
    for (const [index, color] of PWNFOX_COLORS.entries()) {
      const proxy = saved.proxies.find((item: any) => item.id === `pwnfox-preset-${color}`)
      expect(proxy).to.include({ type: 'http', host: '127.0.0.1', port: 8081 + index, doNotProxyLocal: false })
      expect(saved.relations[identities[index].cookieStoreId]).to.deep.equal([proxy.id])
    }
    expect(writes).to.equal(1)
  })

  it('updates the same proxies without duplicating containers or entries', async () => {
    await configurePwnFox(8081)
    await configurePwnFox(9001)

    expect(identities).to.have.length(8)
    expect(saved.proxies).to.have.length(9)
    expect(saved.proxies.find((item: any) => item.id === 'pwnfox-preset-purple').port).to.equal(9008)
  })

  it('rejects a range beyond port 65535 before changing anything', async () => {
    expect(isValidStartPort(65528)).to.equal(true)
    expect(isValidStartPort(65529)).to.equal(false)
    try {
      await configurePwnFox(65529)
      throw new Error('Expected the range to be rejected')
    } catch (error) {
      expect(error).to.be.instanceOf(RangeError)
    }
    expect(identities).to.have.length(1)
    expect(writes).to.equal(0)
  })
})
