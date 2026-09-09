import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Logs stay outside the actor's worktree. The parent owns limits and process termination.
const [role, evidenceDir] = process.argv.slice(2);
if (!['repair', 'review'].includes(role) || !evidenceDir) throw Error('Usage: bun scripts/codex-actor.js repair|review EVIDENCE_DIR');
const dir = await mkdtemp(join(evidenceDir, `${role}-codex-`));
const final = join(dir, 'final.json');
const schema = join(dir, 'schema.json');
await writeFile(schema, JSON.stringify({
  type: 'object', additionalProperties: false, required: ['status', 'findings'],
  properties: {
    status: { type: 'string', enum: role === 'review' ? ['accepted', 'needs_changes'] : ['repaired', 'needs_human'] },
    findings: { type: 'string' },
  },
}));
const args = ['exec', '--ignore-user-config', '-m', 'gpt-6-astra', '-c', 'model_reasoning_effort="high"',
  '--sandbox', role === 'review' ? 'read-only' : 'workspace-write', '--json', '--output-schema', schema, '-o', final, '-'];
const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'] });
process.stdin.pipe(child.stdin);
child.stdin.on('error', () => {});
const events = createWriteStream(join(dir, 'events.jsonl'));
const errors = createWriteStream(join(dir, 'stderr.log'));
child.stdout.pipe(events);
child.stderr.pipe(errors);
const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
await Promise.all([events, errors].map(stream => stream.closed ? Promise.resolve() : new Promise(resolve => stream.on('close', resolve))));
if (code !== 0) { console.error(`Codex failed; evidence: ${dir}`); process.exit(1); }
console.log(await readFile(final, 'utf8'));
