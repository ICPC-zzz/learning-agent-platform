import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";

export interface DockerSandboxExecutionRequest {
  image: string;
  command: readonly string[];
  mountDir: string;
  workingDir: string;
  stdin: string;
  timeoutMs: number;
  memoryMb: number;
  cpus: number;
  maxOutputBytes: number;
  containerName: string;
}

export interface DockerSandboxExecutionResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  spawnError: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface DockerSandboxRunner {
  execute(request: DockerSandboxExecutionRequest): Promise<DockerSandboxExecutionResult>;
}

export interface DockerSandboxRunnerDependencies {
  spawnImpl?: typeof spawn;
  now?: () => number;
}

export function buildDockerRunArgs(request: DockerSandboxExecutionRequest): string[] {
  return [
    "run",
    "--rm",
    "-i",
    "--name",
    request.containerName,
    "--network",
    "none",
    "--memory",
    `${request.memoryMb}m`,
    "--cpus",
    String(request.cpus),
    "-v",
    `${request.mountDir}:/workspace`,
    "-w",
    request.workingDir,
    request.image,
    ...request.command,
  ];
}

export function buildDockerKillArgs(containerName: string): string[] {
  return ["kill", containerName];
}

export function createDockerSandboxRunner(
  deps: DockerSandboxRunnerDependencies = {},
): DockerSandboxRunner {
  const spawnImpl = deps.spawnImpl ?? spawn;
  const now = deps.now ?? (() => Date.now());

  return {
    execute(request: DockerSandboxExecutionRequest): Promise<DockerSandboxExecutionResult> {
      return executeDockerSandboxCommand(request, { spawnImpl, now });
    },
  };
}

async function executeDockerSandboxCommand(
  request: DockerSandboxExecutionRequest,
  deps: Required<DockerSandboxRunnerDependencies>,
): Promise<DockerSandboxExecutionResult> {
  const startedAt = deps.now();
  const args = buildDockerRunArgs(request);
  const spawnOptions: SpawnOptionsWithoutStdio = {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  };

  return new Promise<DockerSandboxExecutionResult>((resolve) => {
    const child = deps.spawnImpl("docker", args, spawnOptions);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let exitCode: number | null = null;
    let signal: NodeJS.Signals | null = null;
    let spawnError: string | null = null;
    let timedOut = false;
    let outputLimitExceeded = false;
    let finished = false;
    let killRequested = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        timedOut,
        outputLimitExceeded,
        spawnError,
        stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
        stderr: Buffer.concat(stderrChunks, stderrBytes).toString("utf8"),
        durationMs: deps.now() - startedAt,
      });
    };

    const requestKill = (reason: "timeout" | "output_limit") => {
      if (killRequested) {
        return;
      }
      killRequested = true;
      if (reason === "timeout") {
        timedOut = true;
      } else {
        outputLimitExceeded = true;
      }

      try {
        child.kill("SIGKILL");
      } catch {
        // Best effort.
      }

      void deps.spawnImpl("docker", buildDockerKillArgs(request.containerName), {
        stdio: "ignore",
        windowsHide: true,
      });
    };

    const appendChunk = (
      chunks: Buffer[],
      currentBytes: number,
      chunk: Buffer,
      maxBytes: number,
    ): number => {
      if (currentBytes >= maxBytes) {
        requestKill("output_limit");
        return currentBytes;
      }

      const remaining = maxBytes - currentBytes;
      if (chunk.length <= remaining) {
        chunks.push(chunk);
        return currentBytes + chunk.length;
      }

      chunks.push(chunk.subarray(0, remaining));
      requestKill("output_limit");
      return maxBytes;
    };

    const timer = setTimeout(() => {
      requestKill("timeout");
    }, request.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes = appendChunk(stdoutChunks, stdoutBytes, chunk, request.maxOutputBytes);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes = appendChunk(stderrChunks, stderrBytes, chunk, request.maxOutputBytes);
    });

    child.on("error", (error: Error) => {
      spawnError = error.message;
      finish();
    });

    child.on("close", (code: number | null, closeSignal: NodeJS.Signals | null) => {
      exitCode = code;
      signal = closeSignal;
      finish();
    });

    if (request.stdin.length > 0) {
      child.stdin.end(request.stdin);
    } else {
      child.stdin.end();
    }
  });
}
