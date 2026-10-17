---
target: Cobrancas view (index.html)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-17T01-44-32Z
slug: index-html-cobrancas-view
---
Method: dual-agent (A: design-review subagent · B: detector-evidence subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | KPI strip, trust badges and due chips give a real-time read, but writes are optimistic with no "saving…" state and no rollback on failure. |
| 2 | Match Between System and Real World | 4 | Status vocabulary ("Aguardando a GOM", "Set não fechou") and the trust-verification concept map directly onto how group-buy debt actually gets tracked. |
| 3 | User Control and Freedom | 2 | Status walk-back exists; delete has a staged confirm. The highest-stakes transition — marking a charge Paga — has no confirmation and no undo. |
| 4 | Consistency and Standards | 2 | Two different visual/interaction systems (board vs. flat list) coexist for the same entity, toggled by a control mislabeled as a sort order. Confirmed by the detector: the stylesheet carries three stacked, unscoped redesign passes over the same selectors. |
| 5 | Error Prevention | 2 | Delete is staged/confirmed; marking Paga isn't, despite equal stakes. The "você pagou?" prompt also forces a false yes/no binary. |
| 6 | Recognition Rather Than Recall | 3 | Community color-chips and inline trust badges reduce recall burden well. |
| 7 | Flexibility and Efficiency of Use | 2 | No batch action exists — the "checkout-like flow" the README describes as the plan was never built. |
| 8 | Aesthetic and Minimalist Design | 2 | Collapsed board is clean; expanding a card dumps the entire generic form with no staged disclosure. |
| 9 | Help Users Recognize/Diagnose/Recover from Errors | 1 | Failure toasts are generic and transient; optimistic writes are never rolled back, so a failed save can leave a false "Paga" state with no trail. |
| 10 | Help and Documentation | 1 | One inline hint sentence; the view's most novel concept (trust/confiança) has zero explanation anywhere. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed before users are happy** |

## Design Specificity Verdict

**LLM assessment**: Partially grounded, and less than it looks at first glance. The data model and copy are unmistakably this product — "Set não fechou", "Aguardando a GOM", pix/comprovante language, and `trustOf()` (a genuinely original feature that tracks *where* a debt figure came from and *when* it was last verified against a spreadsheet or chat). But the interaction model sitting on top of that data is generic CRUD: expanding any card falls back to the same generic field-editing form (`rowHtml`/`formHtml`) shared by five other unrelated tabs (itens, envios, repasses, cegs, comunidades). Swap the field labels and status strings for any other domain and the actual mechanics — expand, see a form, change a dropdown, submit — transplant unchanged. The product-specific thinking happened in the data layer and a few CTAs, not in the core interaction model.

**Deterministic scan**: `detect.mjs` found 8 slop findings against the full file, all `side-tab` (5) or `border-accent-on-rounded` (3) — the classic AI-generated "thick colored accent border on a card" tell. Of these, 2 are live and in-scope for Cobranças: `.crow` (line 972, every card in the new grouped board) and `.cobk` (line 958, the 4 summary tiles). This is where LLM review and detector evidence converge on the same conclusion from two different directions: the LLM reviewer judged the new `cobBoard` redesign as "a shell wrapped around the old UI" at the *interaction* level; independently, the detector's cascade archaeology shows that at the *visual* level, `.crow` **reintroduces** the exact flush-border side-tab accent that an earlier iteration of the plain `.row` component (used everywhere else) had already walked back through two further design passes, ending with no visible accent at all. The in-progress Cobranças redesign isn't just incomplete — on this specific, measurable axis, it's a regression relative to a pattern the rest of the app had already fixed.

One flagged line (66, `.row`) is likely a **false positive against the rendered app**: the detector can't resolve CSS cascade, and two later same-specificity rules neutralize that border-left in the live UI. It's real as dead source cruft, not as a rendered issue. The scan also turned up two fully dead CSS classes (`.envc`/`.envc2`, lines 318/662) with zero matches anywhere in the markup — leftover from a superseded envios card design. Taken together, the stylesheet shows three full, unscoped redesign passes stacked on the same selectors over time, with the dead code from earlier passes never cleaned up. That's a direct warning for the Cobranças redesign the user is about to start: without cleanup, it risks becoming a fourth stacked layer rather than a replacement.

**Visual overlays**: Not available this run. The real app requires Google OAuth sign-in against a production Supabase backend holding real personal financial data, so no authenticated live inspection was attempted — this was a deliberate, accepted limitation, not a failed step. All findings above come from static source analysis (HTML/CSS/JS reading plus the mechanical detector), not a live-rendered page.

## Overall Impression

The data model here is the real achievement — `trustOf()` solves a problem generic finance/invoice tools don't even recognize exists (debt info relayed through chat, not issued by a merchant). But the view asks users to make the single highest-stakes decision in the app — "did I pay this, for real, with my own money, to a friend" — through the same undifferentiated CRUD form used for renaming a CEG, with no confirmation, no undo, and (per a real P0 below) no guarantee the save even stuck. The biggest opportunity: finish what the README says was planned — a real checkout-like settlement flow — rather than the board-shell half-measure currently in place.

## What's Working

1. **`trustOf()`** is genuinely original and domain-correct: treating "where did I hear this number" and "when did I last check it" as first-class visible attributes of a debt matches how group-buy accounting actually works.
2. **The KPI strip** (`cobtop`) gives honest at-a-glance status in four numbers — total owed, count in doubt, count pending GOM action, trust ratio — without requiring a single row read.
3. **Accessible color use**: the detector confirms every status color pairing used in Cobranças (ok/warn/bad/info, plus the trust-badge `.crtrust.bad` pairing) passes WCAG AA contrast (4.98:1–8.74:1) in both light and dark, and color is consistently paired with icon + text, not used alone.

## Priority Issues

**[P0] Optimistic writes are never rolled back on failure — the UI can show a false "Paga" state indefinitely.**
- **Why it matters**: The click handler updates local state and re-renders *before* the database write resolves; the catch block only shows a toast that vanishes in 2.2 seconds and never reverts the local value. If the write fails (flaky connection, expired session, RLS rejection), the screen keeps showing a charge as paid with no reason to ever revisit it — for money owed to a real person. This is a data-integrity bug wearing a UX costume.
- **Fix**: On catch, revert the local entry and re-render; show a genuine pending/"saving" state until the write confirms; make the failure toast actionable ("Não deu pra salvar — tentar de novo") instead of a dead end.
- **Suggested command**: `/impeccable harden`

**[P1] The grouped-board redesign is an unfinished shell: it regresses a visual anti-pattern the codebase had already fixed, and still routes the core task through the old generic form.**
- **Why it matters**: `cobBoard` delivers only half the README's stated redesign goal ("cartões agrupados"); the other half ("fluxo parecido com um checkout") never happened — expanding any card falls straight into the same generic form shared by five unrelated tabs, with CSS specifically written to hide that seam. At the same time, the new board's `.crow`/`.cobk` reintroduce the exact thick accent-border pattern an earlier pass on the shared `.row` component had already removed. Users get a nicer collapsed view, but the actual settlement task is unchanged, and there's still no way to select several charges to the same GOM and settle them together — the one thing a "checkout flow" would add.
- **Fix**: Before shaping a new redesign, decide explicitly whether to finish this one: replace the generic-form fallback inside an expanded charge with a purpose-built confirm/pay flow, add multi-select so same-GOM charges can be settled together, and drop the flush accent border rather than reintroducing it.
- **Suggested command**: `/impeccable shape`

**[P1] The view's sort control silently swaps the entire render model, and it's mislabeled.**
- **Why it matters**: The toggle that switches Cobranças between the grouped board and the flat list is exposed as "Ordenar: Status (padrão)" — a sort order — when it actually swaps between two completely different visual languages (cards+KPIs+trust badges vs. a flat list). Every other grouped view in the app (envios, cegs, comunidades) has a correctly labeled "Agrupar por..." entry for this; Cobranças — the view the project's own README calls the most important part of the app — doesn't. A control that silently does something categorically different from what it claims erodes trust in a tool managing real money.
- **Fix**: Add a correctly labeled "Agrupar por status (padrão)" entry for cobrancas; reconsider whether sort-state should be allowed to swap render mode at all.
- **Suggested command**: `/impeccable clarify`

**[P2] "Você pagou?" forces a false binary onto messier real payment states.**
- **Why it matters**: The only two options for an "A confirmar" charge are "já paguei" / "ainda não." Real states are messier — paid partially, paid to the wrong PIX, paid but unacknowledged, paid by a friend on your behalf. Forcing a premature yes/no produces bad data in exactly the system whose purpose is preventing bad data.
- **Fix**: Add a third "não tenho certeza / preciso conferir" path that routes into the existing source-check flow instead of forcing a binary choice.
- **Suggested command**: `/impeccable clarify`

**[P2] Zero explanation anywhere for the view's one genuinely novel concept.**
- **Why it matters**: "Confiança 3/5" and the trust badges are the most original part of this view, but nothing explains the freshness threshold or what "conferido" means operationally. This isn't a standard pattern users have seen elsewhere, so the silence is a comprehension gap, not minimalism — especially for a first-time or returning-after-a-break user judging how reliable their own data is.
- **Fix**: A single inline "?" affordance on the confiança tile and each trust badge, one sentence each.
- **Suggested command**: `/impeccable document`

## Persona Red Flags

**Alex (Power User)**: The mislabeled sort/board toggle costs her a double-take every session when the view unexpectedly reshapes. No batch action exists anywhere — four pending charges to the same GOM still require four separate open-and-confirm actions, exactly what the never-built checkout flow was meant to fix.

**Riley (Stress Tester)**: A charge with a non-numeric/missing value silently counts as zero in the "pra pagar" total with no flag on the tile. A charge stuck in "A confirmar" past its deadline never gets the overdue treatment (`late` only checks the "Pendente" status). A charge with no community assigned renders as visually blank instead of an explicit "(sem comunidade)" placeholder used elsewhere in the app. With zero charges, the KPI tiles still render, including a nonsensical "confiança 0/0."

**Sam (Accessibility-Dependent User)**: The toast confirming the highest-stakes action in the view (marking paid) has no `role="status"`/`aria-live` — a screen-reader user gets zero announcement that anything happened. On the positive side: color is consistently paired with icon and text across the view, and all measured contrast pairs pass WCAG AA.

## Minor Observations

- Interactive buttons in this view (pay/confirm/undo) render at 34–36px min-height — clears the WCAG 2.5.8 minimum (24×24px) but falls short of the common 44px touch-target guideline.
- `.crtrust.bad` mixes a muted background with bad-colored text, slightly inconsistent with `.cobk.bad`'s fuller color commitment elsewhere — a small leftover from the board being bolted on rather than designed as one system.
- Status-filter chips disappear entirely in board mode — there's no way to glance at just "Cancelada" without switching render modes via the mislabeled toggle.
- The codebase already has a working two-stage "armed" confirm pattern (used for delete) that would be the obvious template for protecting the "mark as paid" action — it just wasn't reused there.

## Questions to Consider

- The README frames this as "ainda tem a versão antiga" needing a full redesign, but `cobBoard`/`.crow` already build the "grouped cards" half. Is the real remaining work much smaller than "redesign the view" — just "build the checkout flow and retire the old form fallback"?
- If the checkout metaphor is taken literally — multiple charges, one settlement action — what would it take to let a user select several same-GOM charges and mark them paid together, mirroring how one Pix transfer often covers several group-buy charges at once?
- Given the optimistic-write bug, how many "Paga" charges in the real production data might already be silently wrong from a dropped request? Is "a usabilidade está confusa" partly describing a data-integrity bug wearing a UX costume?
- Given the stylesheet already carries three stacked, un-cleaned-up redesign passes, should cleanup/consolidation happen before or alongside the next redesign, so this doesn't become a fourth layer?
