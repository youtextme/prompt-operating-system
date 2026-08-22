# Optional: eBPF GoSolo Layer (Linux)

The **GoSolo** tenet targets universal prompt interception without per-IDE SDK integration.

## What it does

- **TLS uprobes** on OpenSSL/BoringSSL — intercept LLM API payloads before cloud egress
- **execve tracepoints** — track nested agent/subprocess spawns
- **Redirection** — force payloads through `PROMPT-ROUTER.md` intake + contract schema before allowing network resume

This is conceptually aligned with [AgentSight](https://github.com/eunomia-bpf/agentsight) (eBPF agent observability).

## Requirements

- Linux kernel with eBPF support
- Root or CAP_BPF for probe attachment
- Optional: `agentsight` or custom `pos-ebpf` daemon (not bundled — platform-specific)

## Default install path

`pos install` **does not require eBPF**. It wires known IDEs/CLIs via config injection (see `WIRING.json`).

Enable eBPF only when:

- You run many unmanaged CLI agents
- You need kernel-level lineage for compliance
- Per-tool wiring is insufficient

## Safety

- eBPF layer is **observe + gate**, not replace human outcome gates (legal, spend, secrets)
- All gated prompts still require `evidence-check.mjs` for `proven` status
- Fail-open vs fail-closed is a deployment choice — document yours in `contracts/`

## Status

Spec + integration hooks documented. Binary build is platform-specific — contribute via PR if you ship `pos-ebpf`.
