---
description: Model choice, effort, and fallback when passing `model` to the subagent tool on Pi
alwaysApply: true
---

# Subagent models

| Model                            | Use for                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `xhy-api/gpt-6.1-sol`            | judgment, review, hard debugging, synthesis                                     |
| `oc-go/deepseek-v4.1-flash`      | coding and optimization                                                         |
| `xhy-api/gpt-6-luna`             | cheap simple work such as exploration; weak at agentic tasks and factual recall |
| `oc-go/longcat-2.5-preview-free` | low-stakes work only; never above `:medium`                                     |

- Classify the actual subtask, not the enclosing feature. Hard root-cause analysis, architecture trade-offs, critical review, and final synthesis go to `gpt-6.1-sol`.
- Effort suffix: `:low` for recon and mechanical work, `:medium` by default, `:high` for judgment and review. Valid levels are `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.
- Use only IDs listed by `pi --list-models`. Never guess a slug.
- Fall back only on unavailability, unsupported ID, rate limit, or a model-specific failure. Try one alternate of comparable strength, then omit `model` to inherit the parent. Never retry a failed model, never downgrade judgment work to luna or longcat, and report the substitution. Auth failures, refusals, and failed validation are not fallback triggers.
- Before redispatching after a partial run, inspect its edits to avoid duplicate side effects.
