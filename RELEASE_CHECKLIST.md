# Spanish App — Release Candidate Checklist

## 1) Freeze + verify
- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual smoke test:
  - [ ] register/login persists after refresh
  - [ ] continue lesson path persists after restart
  - [ ] AI-only modules disable when providers unavailable
  - [ ] AI-only modules enable when provider available
  - [ ] content pack import/reset works

## 2) Product readiness
- [ ] Set production env vars
  - [ ] `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GEMINI_API_KEY`
  - [ ] optional `VITE_GOOGLE_CLIENT_ID`
- [ ] Confirm no secrets committed to repo
- [ ] Confirm friendly error states in UI

## 3) Deployability
- [ ] Build artifact created (`dist/`)
- [ ] Host static files (Vercel/Netlify/Nginx)
- [ ] Ensure server-side proxy route exists for `/api/anthropic/messages`
  - if static-only host, deploy a small backend function for this route
- [ ] Validate CORS/origin rules

## 4) Post-deploy checks
- [ ] New user can register/login
- [ ] Existing user profile is preserved
- [ ] Adaptive recommendations change after lesson completion
- [ ] Randomized challenge sets differ between runs
- [ ] AI lesson fallback chain works

## 5) RC tag
- [ ] Commit: `feat: adaptive progression + analytics + content pack manager`
- [ ] Tag: `v1.0.0-rc1`
