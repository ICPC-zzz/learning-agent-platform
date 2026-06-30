import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { tsImport } from "tsx/esm/api";

const dockerRunner = await tsImport("../lib/judge/docker-sandbox-runner.ts", import.meta.url);

function makeFakeChild() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  return {
    stdout,
    stderr,
    stdin: {
      end() {},
    },
    kill() {
      return true;
    },
    on(eventName, handler) {
      stdout.on(eventName, handler);
      stderr.on(eventName, handler);
      this._events = this._events || new EventEmitter();
      this._events.on(eventName, handler);
      return this;
    },
    emit(eventName, ...args) {
      this._events = this._events || new EventEmitter();
      return this._events.emit(eventName, ...args);
    },
  };
}

test("A474 docker runner: buildDockerRunArgs uses hardened docker flags", () => {
  const args = dockerRunner.buildDockerRunArgs({
    image: "python:latest",
    command: ["python", "main.py"],
    mountDir: "C:\\temp\\judge",
    workingDir: "/workspace",
    stdin: "",
    timeoutMs: 3000,
    memoryMb: 256,
    cpus: 1,
    maxOutputBytes: 65536,
    containerName: "lap-judge-test",
  });

  assert.deepEqual(args.slice(0, 6), ["run", "--rm", "-i", "--name", "lap-judge-test", "--network"]);
  assert.ok(args.includes("none"));
  assert.ok(args.includes("--memory"));
  assert.ok(args.includes("256m"));
  assert.ok(args.includes("--cpus"));
  assert.ok(args.includes("1"));
  assert.ok(args.includes("-w"));
  assert.ok(args.includes("/workspace"));
  assert.ok(args.includes("python:latest"));
  assert.deepEqual(args.slice(-2), ["python", "main.py"]);
});

test("A474 docker runner: execute spawns docker directly and collects output", async () => {
  const spawnCalls = [];
  const child = makeFakeChild();
  const runner = dockerRunner.createDockerSandboxRunner({
    spawnImpl(command, args, options) {
      spawnCalls.push({ command, args, options });
      setImmediate(() => {
        child.stdout.emit("data", Buffer.from("hello"));
        child.stderr.emit("data", Buffer.from("warn"));
        child.emit("close", 0, null);
      });
      return child;
    },
    now: () => 1000,
  });

  const result = await runner.execute({
    image: "python:latest",
    command: ["python", "main.py"],
    mountDir: "C:\\temp\\judge",
    workingDir: "/workspace",
    stdin: "input\n",
    timeoutMs: 50,
    memoryMb: 256,
    cpus: 1,
    maxOutputBytes: 65536,
    containerName: "lap-judge-test",
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, "docker");
  assert.equal(spawnCalls[0].options.windowsHide, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "hello");
  assert.equal(result.stderr, "warn");
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimitExceeded, false);
});

test("A474 docker runner: kill args are docker kill only", () => {
  assert.deepEqual(dockerRunner.buildDockerKillArgs("lap-judge-test"), ["kill", "lap-judge-test"]);
});
