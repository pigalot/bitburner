import { isString } from "./utils/helpers/isString";
import { GetServer } from "./Server/AllServers";
import { WorkerScript } from "./Netscript/WorkerScript";
import { Player } from "./Player";

export function netscriptDelay(time: number, workerScript: WorkerScript, useOld = false): Promise<void> {
  return new Promise(function (resolve, reject) {
    if (useOld) {
      workerScript.delay = window.setTimeout(() => {
        workerScript.delay = null;
        workerScript.delayReject = undefined;

        if (workerScript.env.stopFlag)
          reject(workerScript);
        else
          resolve();
      }, time);
    } else {
      if (Player.netscriptDelays.length > 15000) {
        reject(workerScript);
        return;
      }
      workerScript.endTime = Date.now() + time;
      Player.netscriptDelays.splice(sortedIndex(Player.netscriptDelays, workerScript), 0, workerScript);
    }
    workerScript.delayResolve = resolve;
    workerScript.delayReject = reject;
  });
}

function sortedIndex(array: WorkerScript[], value: WorkerScript): number {
	let low = 0,
		high = array.length;

	while (low < high) {
		const mid = low + high >>> 1;
		if (array[mid].endTime < value.endTime) low = mid + 1;
		else high = mid;
	}
	return low;
}

export function makeRuntimeRejectMsg(workerScript: WorkerScript, msg: string): string {
  if ((msg as any) instanceof WorkerScript) {
    console.error("HERE");
  }
  const server = GetServer(workerScript.hostname);
  if (server == null) {
    throw new Error(`WorkerScript constructed with invalid server ip: ${workerScript.hostname}`);
  }

  for (const scriptUrl of workerScript.scriptRef.dependencies) {
    // Return just the original msg if it's nullish so that we don't get a workerscript error
    msg = msg?.replace(new RegExp(scriptUrl.url, "g"), scriptUrl.filename) ?? msg;
  }

  return "|DELIMITER|" + server.hostname + "|DELIMITER|" + workerScript.name + "|DELIMITER|" + msg;
}

export function resolveNetscriptRequestedThreads(
  workerScript: WorkerScript,
  functionName: string,
  requestedThreads: number,
): number {
  const threads = workerScript.scriptRef.threads;
  if (!requestedThreads) {
    return isNaN(threads) || threads < 1 ? 1 : threads;
  }
  const requestedThreadsAsInt = requestedThreads | 0;
  if (isNaN(requestedThreads) || requestedThreadsAsInt < 1) {
    throw makeRuntimeRejectMsg(
      workerScript,
      `Invalid thread count passed to ${functionName}: ${requestedThreads}. Threads must be a positive number.`,
    );
  }
  if (requestedThreadsAsInt > threads) {
    throw makeRuntimeRejectMsg(
      workerScript,
      `Too many threads requested by ${functionName}. Requested: ${requestedThreads}. Has: ${threads}.`,
    );
  }
  return requestedThreadsAsInt;
}

export function isScriptErrorMessage(msg: string): boolean {
  if (!isString(msg)) {
    return false;
  }
  const splitMsg = msg.split("|DELIMITER|");
  if (splitMsg.length != 4) {
    return false;
  }
  return true;
}
