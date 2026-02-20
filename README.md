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

## Dynamic progression features

- Persistent profile migration (`schemaVersion` based)
- Adaptive difficulty (1-5) driven by recent performance
- Mastery-based recommended lessons
- Randomized challenge sets each run
- Content Pack Manager (import/reset custom JSON packs)

See `RELEASE_CHECKLIST.md` for public-hosting readiness.
