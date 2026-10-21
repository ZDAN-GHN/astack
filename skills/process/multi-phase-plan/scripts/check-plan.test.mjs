import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkPlan } from './check-plan.mjs';

const unit = (id, dependencies = 'None.') => `
## Load the configuration (${id})

**Owner.** Parent.
**Depends on.** ${dependencies}
**Inputs.** The base configuration parser and its existing tests.
**Files.**
- [ ] Edit src/config.ts. Evidence in the reviewed diff.
**Build.**
- [ ] Parse the timeout setting. Evidence in src/config.ts.
**You see.**
- [ ] The service uses the configured timeout. Evidence in runtime/config.log.
**Verify, unit.**
- [ ] Run npm test -- config.test.ts. Pass with exit 0. Save runtime/unit.log.
**Verify, live.**
- [ ] Run the service with a 2000ms timeout. Pass when its startup log reports 2000. Save runtime/config.log with the diff identity.
**Verify, perf.** N/A. This unit changes configuration parsing and has no latency or throughput acceptance criterion.
**Review gate.** None. The user authorized local integration.
**Integrate.**
- [ ] Parent integrates the diff and records combined behavior in runtime/integration.log.
**Handoff.**
- [ ] Deliver the diff identity, changed files and runtime logs to the integration owner; record any unresolved findings.
`;

const plan = (units = unit('U1') + unit('U2', 'U1.')) => `# Configuration plan

Load the user's configured timeout.

## How to read this
Check each box only with evidence for the current diff. Use references/execution.md.
## Outcome and constraints
The running service reports and uses the configured timeout. Local integration only.
## Program checklist
- [ ] Record the base and tracker mapping in docs/plans/config.md.
${units}
## Close the program
- [ ] Check the integrated service and save runtime/final.log.
## Appendix A. Prototype evidence
None. The existing parser contract establishes the approach.
## Appendix B. Alternatives rejected
None. The change uses the existing configuration loader.
## Appendix C. Risks
Malformed values must retain the documented default.
## Appendix D. Links and reading list
Read src/config.ts and tests/config.test.ts.
`;

test('accepts dependency-ordered units with a justified perf N/A', () => {
  assert.deepEqual(checkPlan(plan()), { units: 2, problems: [] });
});
test('rejects an unfilled template placeholder', () => {
  assert.match(checkPlan(plan().replace('Parent.', '<owner>')).problems.join('\n'), /placeholder/);
});
test('rejects missing live evidence scenarios', () => {
  const missing = plan(unit('U1').replace(/- \[ \] Run the service[^\n]+/, 'N/A. No runtime available.'));
  assert.match(checkPlan(missing).problems.join('\n'), /Verify, live. needs a checkbox/);
});
test('rejects unknown dependencies and dependency cycles', () => {
  assert.match(checkPlan(plan(unit('U1', 'U9.'))).problems.join('\n'), /unknown dependency U9/);
  assert.match(checkPlan(plan(unit('U1', 'U2.') + unit('U2', 'U1.'))).problems.join('\n'), /dependency cycle/);
});
test('rejects duplicated IDs and misplaced fields', () => {
  assert.match(checkPlan(plan(unit('U1') + unit('U1'))).problems.join('\n'), /duplicate unit/);
  assert.match(checkPlan(plan().replace('**Owner.** Parent.', '**Files.** Parent.')).problems.join('\n'), /fields must be/);
});
test('requires a reason for N/A and every perf item for a measured gate', () => {
  const short = unit('U1').replace(/N\/A\. This unit[^\n]+/, 'N/A.');
  assert.match(checkPlan(plan(short)).problems.join('\n'), /N\/A needs a concrete reason/);
  const measured = unit('U1').replace(/N\/A\. This unit[^\n]+/, '\n- [ ] Metric. Startup time.');
  assert.match(checkPlan(plan(measured)).problems.join('\n'), /perf lacks Probe/);
});
test('does not parse fenced examples as headings or fields', () => {
  const example = '\n~~~~markdown\n## Fake (U9)\n**Owner.** Fake\n```\n~~~~\n';
  assert.equal(checkPlan(plan().replace('## Outcome and constraints', example + '## Outcome and constraints')).problems.length, 0);
});
test('rejects missing sections and unclosed fences', () => {
  assert.match(checkPlan(plan().replace('## Outcome and constraints', '### Outcome and constraints')).problems.join('\n'), /Outcome and constraints/);
  assert.match(checkPlan(plan() + '\n```sh\n').problems.join('\n'), /unclosed code fence/);
});
test('bundled template has valid structure once all placeholders are filled', () => {
  const template = readFileSync(new URL('../references/plan-template.md', import.meta.url), 'utf8');
  assert.match(checkPlan(template).problems.join('\n'), /placeholder/);
  const filled = template.replace(/<[^>\n]+>/g, 'Recorded configuration evidence');
  assert.deepEqual(checkPlan(filled), { units: 1, problems: [] });
});
