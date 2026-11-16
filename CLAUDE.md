# ATT in KL

Read docs/PLAN.md first. It is the spec; Part B is the shared contract.

- `src/contracts/*` is frozen. Report needed changes to the dispatcher instead of editing.
- Edit only the files your work package owns (PLAN.md B2).
- Before pushing: `npm run typecheck && npm run lint && npm run check-copy && npm test && npm run build && npm run check-private`.
- Dev with the mock store: `npm run dev`, then open `http://localhost:5173/att-app/?mock=1` (`&reset=1` restores the seed).
- Smoke test: `npx playwright test --trace off`.
- No em dash, en dash, middle dot, bullet or emoji in `src/` or `index.html`. No explanatory filler text in the UI.
- Never put real arrival times, places, stay names, addresses or coordinates in the repo. They live only in the gitignored `seed.local.json`.
- Glass (`.glass`) only on the floating navigation and control layer. Content sits on `--surface` over `--bg`.
