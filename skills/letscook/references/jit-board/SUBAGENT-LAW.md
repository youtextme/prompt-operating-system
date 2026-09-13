# JIT Subagent Law — main context is orchestration only

**Spoiler:** Running Board / SME / Applied AI / CoS / CSAT / Meta work inside the orchestrator context pollutes the main window and collapses role isolation. That is a failure mode.

## Hard rule

On every **non-trivial** `/letscook` run:

1. The **main agent** may only: Status Law, Outcome Frame, contract path, dispatch Task/subagents, merge summaries, Human Action Closure.
2. All domain work happens in **fresh Task subagents** (own context windows). Prefer `run_in_background: true` for independent roles; await only when sequencing requires it.
3. Never re-implement a role’s full deliberation in the main thread “for speed.”
4. Status line `agents:N […]` must list **real** dispatched subagents, not imaginary roles.

## Six mandatory JIT seats (non-trivial)

| Step | Seat | Subagent job | Main may keep |
|------|------|--------------|---------------|
| 1 | Board of Directors | Recruit / qualify world-class experts for the ask | Seat names only |
| 2 | Subject Matter Experts | Solutioning until expert bar is met | Final expert panel list |
| 3 | Applied AI Experts | DoD, hallucination/FMEA, split of agent responsibilities, self-heal | DoD + failure modes |
| 4 | Chief of Staff | Team, skills, delivery bar, exception criteria for consumer | Roster + delivery plan |
| 5 | Customer Satisfaction | Outcome trust, async consumer loop, steer signals | CSAT brief for human |
| 6 | Logging Meta | Full execution truth log for other agents | Path to meta run |

Steps 1→3 may run as a **pipeline of subagents**; 5 and 6 should start early and stay open (meta logs every turn).

## Feasibility gate

If the runtime **cannot** spawn subagents (no Task tool, solo CLI without agents):

1. Say so on Status: `Trust:YELLOW | next:subagents unavailable — sequenced role files`
2. Still execute roles **as separate written role passes** with isolated prompt files under `.agents/meta/runs/<id>/roles/`, never as one blended brain dump.
3. Prefer upgrading the runtime (Cursor Agent with Task, Cloud Agent, `pos run`) over accepting single-context spoilers.

## Isolation checklist (Evaluator grades this)

- [ ] Main transcript has no long SME solution drafts
- [ ] Each seat has a subagent id or role-pass artifact
- [ ] Meta JSONL has `spawn`, `role_output`, `merge` events
- [ ] Evaluator ≠ Builder (and ≠ CoS who planned the build)
