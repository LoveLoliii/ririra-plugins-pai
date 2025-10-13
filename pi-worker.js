// pi-worker.js
import { parentPort, workerData } from 'worker_threads';
import Decimal from 'decimal.js';

Decimal.set({ precision: 10000 });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computePi(digits) {
  const one = new Decimal(1);
  const four = new Decimal(4);
  const terms = Math.ceil(digits / 14) + 10;

  function arctan(x) {
    let xPow = x;
    let sum = new Decimal(0);
    for (let n = 0; n < terms; n++) {
      const term = xPow.div(2 * n + 1);
      sum = n % 2 === 0 ? sum.plus(term) : sum.minus(term);
      xPow = xPow.times(x).times(x);
    }
    return sum;
  }

  const arctan1_5 = arctan(one.div(5));
  const arctan1_239 = arctan(one.div(239));
  const pi = four.times(four.times(arctan1_5).minus(arctan1_239));
  return pi.toFixed(digits).replace('.', '');
}

async function findInPi(target) {
  const chunkSize = 10000;
  let position = 0;
  const startTime = Date.now();
  let lastReportTime = Date.now();

  while (true) {
    const piDigits = computePi(position + chunkSize).slice(position);
    const idx = piDigits.indexOf(target);
    if (idx !== -1) return position + idx + 1;
    position += chunkSize;
    // 每分钟上报一次进度
    const now = Date.now();
    if (now - lastReportTime >= 60000) { // 每分钟
      const seconds = Math.floor((now - startTime) / 1000);
      parentPort.postMessage({
        progress: {
          where: position,
          seconds
        }
      });
      lastReportTime = now;
    }
    await sleep(10); // 让出事件循环
  }
}

// 执行查找
(async () => {
  const pos = await findInPi(workerData.target);
  parentPort.postMessage({ position: pos });
})();