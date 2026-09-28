// One headless claude session kept alive over stream-json stdin, so background work
// (Workflow runs, background agents) can finish and notify the model inside the same
// process. Resolves when a result matches `want`, when the human stops the run, when
// nothing arrives for `hangMs`, or when the process exits.
//
// A result that does not match and leaves no background task running is a turn the model
// ended on the human: `ask(text)` relays it and resolves with the human's answer, which is
// sent back verbatim. A result while a task is still running is a progress report; the
// task's notification starts the next turn by itself.
//
// Usage as a module: const r = await live({ prompt, cwd, want, ask, hangMs, tools })
// Smoke:  node live.mjs
import { spawn } from "node:child_process";

export const STOP = "__stop__";

export const live = ({ prompt, cwd, want, ask, hangMs = 90 * 60000, tools, model, extraArgs = [] }) =>
  new Promise((resolve) => {
    const args = ["--print", "--verbose", "--input-format", "stream-json", "--output-format", "stream-json", "--max-turns", "300", ...extraArgs];
    if (tools) args.push("--allowedTools", tools);
    if (model) args.push("--model", model);
    const child = spawn("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const started = Date.now();
    const turns = [];
    let sessionId = null;
    let questions = 0;
    let humanWaitMs = 0;
    let running = 0;
    let match = null;
    let buf = "";
    let hang;
    let done = false;
    const send = (text) => child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: text } })}\n`);
    const finish = (why) => {
      if (done) return;
      done = true;
      clearTimeout(hang);
      try {
        child.stdin.end();
      } catch {}
      setTimeout(() => child.kill("SIGTERM"), 15000).unref();
      resolve({ session_id: sessionId, turns, match: match?.[0] ?? null, id: match?.[1] ?? null, why, wall_ms: Date.now() - started, human_wait_ms: humanWaitMs, human_decisions: questions });
    };
    // A hang guard only: a live session always emits something while it works or waits on a task.
    const armHang = () => {
      clearTimeout(hang);
      hang = setTimeout(() => finish("hang"), hangMs);
    };
    const relay = async (text) => {
      clearTimeout(hang);
      questions += 1;
      const asked = Date.now();
      const answer = await ask(text, questions);
      humanWaitMs += Date.now() - asked;
      if (answer.trim() === STOP) return finish("stopped-by-human");
      send(answer);
      armHang();
    };
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        sessionId = ev.session_id ?? sessionId;
        armHang();
        if (ev.type === "system" && ev.subtype === "background_tasks_changed") running = ev.tasks?.length ?? 0;
        if (ev.type === "result") {
          const text = String(ev.result ?? "");
          turns.push({ at: Date.now() - started, num_turns: ev.num_turns, cost_usd: ev.total_cost_usd, duration_ms: ev.duration_ms, is_error: ev.is_error, running, text });
          match = text.match(want);
          if (match) return finish("matched");
          if (ev.is_error) return finish("error");
          if (running === 0) relay(text);
        }
      }
    });
    child.stderr.on("data", () => {});
    child.on("close", (code) => finish(`exit-${code}`));
    send(prompt);
    armHang();
  });

if (process.argv[1] && process.argv[1].endsWith("live.mjs")) {
  // Smoke: a result while a background Bash task runs is held, the notification starts the
  // next turn, and a turn that ends on a question reaches ask().
  const r = await live({
    prompt: "Run `sleep 20 && echo BENCH-DONE-7731` with the Bash tool in the background (run_in_background). Reply only 'launched'. When its completion notification arrives, ask me whether to print its output, and wait for my answer.",
    cwd: process.cwd(),
    want: /BENCH-DONE-(\d+)/,
    ask: async (text) => {
      console.log(`ASKED: ${text}`);
      return "Yes, print the output line exactly.";
    },
    hangMs: 120000,
    tools: "Bash",
    model: "haiku",
  });
  console.log(JSON.stringify({ ...r, turns: r.turns.map(({ text, ...t }) => ({ ...t, text: text.slice(0, 80) })) }, null, 1));
}
