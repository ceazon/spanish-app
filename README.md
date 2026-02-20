# Spanish App

## AI features setup (Chat Partner + Picture Description)

AI calls now route through a local server endpoint:

- Frontend calls: `POST /api/anthropic/messages`
- Vite middleware forwards to Anthropic using server env var `ANTHROPIC_API_KEY`

### Run locally

```bash
export ANTHROPIC_API_KEY=your_key_here
# Optional: enable Google Sign-In button
export VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
npm install
npm run dev
```

### Build/preview

```bash
npm run build
ANTHROPIC_API_KEY=your_key_here npm run preview
```

If `ANTHROPIC_API_KEY` is missing, AI features will fail with a clear error response.

## Google Sign-In troubleshooting

If Google shows `401: invalid_client`:

1. In Google Cloud, create/use an OAuth client of type **Web application**.
2. Ensure `VITE_GOOGLE_CLIENT_ID` is exactly the full client id:
   - `1234567890-xxxx.apps.googleusercontent.com`
3. Add **Authorized JavaScript origins** that exactly match where you run the app:
   - `http://localhost:5173` (or your dev port)
   - your production domain(s) (e.g. Vercel/custom domain)
4. Redeploy after changing env vars (Vite injects env values at build time).

## Dynamic progression features

- Persistent profile migration (`schemaVersion` based)
- Adaptive difficulty (1-5) driven by recent performance
- Mastery-based recommended lessons
- Randomized challenge sets each run
- Content Pack Manager (import/reset custom JSON packs)

See `RELEASE_CHECKLIST.md` for public-hosting readiness.

## Automated testing

```bash
npm test
npm run test:e2e
```

If Playwright fails locally due missing Linux libs, run:

```bash
npx playwright install --with-deps chromium
```

CI is configured via `.github/workflows/ci.yml` to run unit + build + e2e on push/PR.
