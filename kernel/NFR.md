# Standing NFR bar

Apply the rows that match the risk class. Skip is a claim — write why.

| Class | Required |
|-------|----------|
| Any shipped UI | Accessible names, keyboard, contrast, error text a human can act on |
| Any user data | Least privilege, no secrets in git, retention named |
| Any network agent / scraper | ToS/robots, identity of the thing being compared, false-positive cost |
| Any messaging bot | Quiet hours, opt-out, no spam loops, one source of truth for alerts |
| Any production service | Logs on the critical path, rollback, error budget or explicit "prototype" label |
| Any learning / health / money product | Eval harness before scale; no self-graded "it works" |

Software tests do not cover this table. Evaluator does.
