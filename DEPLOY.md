# Deploy checklist

## Environment
1. Set production values in `.env` (copy from `.env.example` if available)
2. Set `ADMIN_KEY` to a strong random secret
3. Rotate `TOKEN_SECRET` and `IP_HASH_SECRET`

## Build
```bash
cd prototype
npm ci
npm run build
```

## CSP: update connect-src
In `prototype/public/index.html`, replace `http://localhost:5001` with your production analytics URL:
```
connect-src 'self' https://testnet.hashio.io https://hashscan.io https://durl.dev;
```

## Serve
- Static files: `prototype/build/` behind nginx (or equivalent)
- Analytics server: `node prototype/analytics/server.cjs` behind reverse proxy with TLS
- Logs write to `data/logs/`, DB lives in `data/analytics.db` — both outside webroot

## Post-deploy
- Verify `.db` and `.map` files are not accessible via HTTP
- Confirm HSTS and CSP headers in browser DevTools
