# Zseb

Live app: https://unclegabi.github.io/zseb/ (open in Safari on iPhone, then Share → Add to Home Screen).

Phone-first budget tracker: salary split into 50% fixed costs, 30% well-being, 20% investment
(transferred separately). Unspent money in a bucket rolls over to the next month. All amounts are HUF.
Data is stored on the device only (browser local storage, key `cost-tracker-v1`); use Settings → Export backup regularly.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173, also reachable from the phone on the same Wi-Fi
npm test         # budget logic unit tests
npm run build    # production build in dist/
npm run icons    # re-render the PNG icons from public/logo.svg (macOS + Chrome)
```

The budget logic lives in `src/domain.ts` (pure functions, covered by `src/domain.test.ts`).
Everything on screen is derived from expenses and month setups; balances are never stored.

## Deploy to GitHub Pages

Every push to `main` runs `.github/workflows/deploy.yml`: tests, build, then publish to GitHub Pages
(repository Settings → Pages → Source: **GitHub Actions**). The installed app shows an "Update" bar
when a new version is available.

On the iPhone open the published URL in Safari → Share → **Add to Home Screen**.
Install first, then enter real data: Safari and the Home Screen app keep separate storage.
