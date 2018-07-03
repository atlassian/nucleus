import * as cp from 'child-process-promise';

export const spawnPromiseAndCapture = async (command: string, args: string[], opts: any = {}): Promise<[Buffer, Buffer, Error | null]> => {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const child = cp.spawn(command, args, opts);
  child.childProcess.stdout.on('data', (data: Buffer) => stdout.push(data));
  child.childProcess.stderr.on('data', (data: Buffer) => stderr.push(data));
  let error: Error | null = null;
  try {
    await child;
  } catch (err) {
    error = err;
  }
  return [Buffer.concat(stdout), Buffer.concat(stderr), error];
};

export const escapeShellArguments = (args: string[]): string[] => {
  return args.map((value) => {
    if (value.indexOf(' ') > -1) {
      if (value.indexOf('"') > -1) {
        throw new Error(`Unable to escape parameter: ${value}`);
      }
      return `"${value}"`;
    }
    return value;
  });
};
