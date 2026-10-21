#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredSections = [
  'How to read this', 'Outcome and constraints', 'Program checklist',
  'Close the program', 'Appendix A. Prototype evidence',
  'Appendix B. Alternatives rejected', 'Appendix C. Risks',
  'Appendix D. Links and reading list',
];
const requiredFields = [
  'Owner.', 'Depends on.', 'Inputs.', 'Files.', 'Build.', 'You see.',
  'Verify, unit.', 'Verify, live.', 'Verify, perf.', 'Review gate.', 'Integrate.', 'Handoff.',
];
const box = /^\s*- \[[ x]\] \S/;

export function checkPlan(text) {
  const problems = [];
  const fail = (line, message) => problems.push(`line ${line}: ${message}`);
  const lines = text.split(/\r?\n/);
  const sections = [];
  let fence = null;
  let titleCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const line = i + 1;
    if (/<[^>\n]+>/.test(text)) fail(line, 'unfilled angle-bracket placeholder');
    if (fence) {
      const close = text.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { char: open[1][0], length: open[1].length };
      continue;
    }
    if (/^# \S/.test(text)) titleCount++;
    const heading = text.match(/^## (.+)$/);
    if (heading) sections.push({ title: heading[1].trim(), line, body: [] });
    else if (sections.length) sections.at(-1).body.push({ text, line });
  }
  if (fence) fail(lines.length, 'unclosed code fence');
  if (titleCount !== 1) fail(1, `expected one H1 title, found ${titleCount}`);

  let previous = -1;
  for (const title of requiredSections) {
    const matches = sections.filter(section => section.title === title);
    if (matches.length !== 1) fail(1, `expected one "${title}" section, found ${matches.length}`);
    if (matches.length === 1) {
      const index = sections.indexOf(matches[0]);
      if (index <= previous) fail(matches[0].line, `"${title}" is out of order`);
      previous = index;
      if (!matches[0].body.some(row => row.text.trim())) fail(matches[0].line, `"${title}" is empty`);
    }
  }
  const program = sections.findIndex(section => section.title === 'Program checklist');
  const close = sections.findIndex(section => section.title === 'Close the program');
  const units = program >= 0 && close > program ? sections.slice(program + 1, close) : [];
  if (!units.length) fail(1, 'no units between Program checklist and Close the program');
  for (const title of ['Program checklist', 'Close the program']) {
    const section = sections.find(section => section.title === title);
    if (section && !section.body.some(row => box.test(row.text))) fail(section.line, `"${title}" has no checkbox`);
  }
  const graph = new Map();
  for (const unit of units) {
    const match = unit.title.match(/^.+ \((U[1-9]\d*)\)$/);
    if (!match) { fail(unit.line, 'unit heading must end with (U1), (U2), etc.'); continue; }
    const id = match[1];
    if (graph.has(id)) fail(unit.line, `duplicate unit ${id}`);
    const fields = [];
    for (const row of unit.body) {
      const field = row.text.match(/^\*\*([^*]+)\*\*(.*)$/);
      if (field) fields.push({ name: field[1], rest: field[2].trim(), line: row.line, body: [] });
      else if (fields.length) fields.at(-1).body.push(row);
    }
    if (fields.map(field => field.name).join('|') !== requiredFields.join('|')) {
      fail(unit.line, `${id} fields must be ${requiredFields.join(', ')} in order`);
    }
    const find = name => fields.find(field => field.name === name);
    for (const name of ['Owner.', 'Depends on.', 'Inputs.', 'Review gate.']) {
      const field = find(name);
      if (field && !field.rest) fail(field.line, `${id} ${name} is empty`);
    }
    for (const name of ['Files.', 'Build.', 'You see.', 'Verify, live.', 'Integrate.', 'Handoff.']) {
      const field = find(name);
      if (field && !field.body.some(row => box.test(row.text))) fail(field.line, `${id} ${name} needs a checkbox`);
    }
    for (const name of ['Verify, unit.', 'Verify, perf.']) {
      const field = find(name);
      if (!field) continue;
      if (/^N\/A\./.test(field.rest)) {
        if (!/^N\/A\.\s+\S.{4,}$/.test(field.rest)) fail(field.line, `${id} ${name} N/A needs a concrete reason`);
        if (field.body.some(row => box.test(row.text))) fail(field.line, `${id} ${name} mixes N/A with checkboxes`);
      } else if (!field.body.some(row => box.test(row.text))) fail(field.line, `${id} ${name} needs checkboxes or N/A with a reason`);
    }
    const perf = find('Verify, perf.');
    if (perf && !/^N\/A\./.test(perf.rest)) {
      for (const item of ['Metric.', 'Probe.', 'Baseline.', 'Rule.']) {
        if (!perf.body.some(row => box.test(row.text) && row.text.replace(/^\s*- \[[ x]\] /, '').startsWith(`${item} `))) {
          fail(perf.line, `${id} perf lacks ${item}`);
        }
      }
    }
    const depends = find('Depends on.');
    const dependencyText = depends?.rest.replace(/\.$/, '') ?? '';
    const dependencies = dependencyText === 'None' ? [] : dependencyText.split(/\s*,\s*/);
    if (depends && dependencyText !== 'None' && !/^U[1-9]\d*(,\s*U[1-9]\d*)*$/.test(dependencyText)) {
      fail(depends.line, `${id} dependencies must be None or comma-separated unit IDs`);
    }
    graph.set(id, { dependencies, line: unit.line });
  }
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) { fail(graph.get(id).line, `dependency cycle at ${id}`); return; }
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of graph.get(id).dependencies) {
      if (!graph.has(dependency)) fail(graph.get(id).line, `${id} unknown dependency ${dependency}`);
      else visit(dependency);
    }
    active.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);
  return { units: units.length, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node check-plan.mjs <plan.md>'); process.exit(2); }
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (error) { console.error(`${file}: ${error.message}`); process.exit(2); }
  const result = checkPlan(text);
  console.log(`${result.units} units, ${result.problems.length} structural problems`);
  for (const problem of result.problems) console.error(`${file}: ${problem}`);
  process.exit(result.problems.length ? 1 : 0);
}
