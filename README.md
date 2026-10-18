# Container Proxy for PwnFox

A Firefox extension based on [Container Proxy](https://github.com/bekh6ex/firefox-container-proxy) by Aleksey Bekh-Ivanov. This fork adds one-click setup for the eight default containers of [PwnFox](https://github.com/yeswehack/PwnFox). It is an independent companion extension, not an official PwnFox release.

Requires Firefox desktop 142 or later.

## Quick setup

1. Install PwnFox and this extension. In PwnFox, turn off **Proxify all tabs** and **Proxify only containers tabs** so this extension controls the proxy routes.
2. Open this extension's options by clicking its toolbar icon. Under **Assign**, set the first port (default **8081**) and click **Configure PwnFox**.
3. Run an HTTP proxy on `127.0.0.1` at each port you intend to use. Existing tabs may need reloading after you change their route.

The button creates any missing PwnFox containers and assigns the following local HTTP proxies:

| PwnFox container | Default port |
| --- | ---: |
| PwnFox-blue | 8081 |
| PwnFox-turquoise | 8082 |
| PwnFox-green | 8083 |
| PwnFox-yellow | 8084 |
| PwnFox-orange | 8085 |
| PwnFox-red | 8086 |
| PwnFox-pink | 8087 |
| PwnFox-purple | 8088 |

Changing the first port shifts the whole sequence. You can run the button again without creating duplicate containers or proxies. It replaces only the assignments for these eight PwnFox containers; other containers and proxies remain as configured. The regular proxy editor remains available for manual changes.

The button configures Firefox routes only. It does not start local proxy listeners or change PwnFox's own settings. As in the original extension, the `cookies` permission identifies the request's container, and `webRequest`/`webRequestBlocking` support proxy authentication. The preset stores only its proxy settings in Firefox's local extension storage. The extension has no telemetry or server operated by the maintainer. The original manual proxy **Test** action, if the user chooses it and confirms, sends IP-check requests to DuckDuckGo; the PwnFox quick setup does not use that action.

## Build and review

This repository contains the unminified source. Use Node.js, pnpm 7 and the committed lockfile:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run lint
pnpm run bundle
```

`dist/` is the build output. `web-ext-artifacts/` contains the unsigned package for Mozilla submission. See [NOTES_TO_REVIEWER.md](NOTES_TO_REVIEWER.md) for reproduction details.

## Credit and license

The original Container Proxy source and design are by **Aleksey Bekh-Ivanov**. Original project: [bekh6ex/firefox-container-proxy](https://github.com/bekh6ex/firefox-container-proxy); original Firefox listing: [Container Proxy](https://addons.mozilla.org/firefox/addon/container-proxy/). This fork is maintained by **malwarian**. The original BSD 2-Clause copyright notice and license are retained in [LICENSE](LICENSE), which is also included in the extension package.

PwnFox is a separate project by its [original contributors](https://github.com/yeswehack/PwnFox). This extension integrates with its default container names and colors; it does not include PwnFox code.

## Original project notes

The original project documents a possible DNS leak with uBlock in non-default containers: [issue #23](https://github.com/bekh6ex/firefox-container-proxy/issues/23#issuecomment-773249909). Its translation project is on [Weblate](https://hosted.weblate.org/engage/firefox-container-proxy/).
