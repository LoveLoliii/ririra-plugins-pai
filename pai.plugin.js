import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { Pai } from './entity/ririra.pai.js';

// ESM 下没有 this 指向全局，所以用字符串或模块名作为 context
const logger = new Logger('PaiPlugin');

// 获取 __filename 和 __dirname（ESM 方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

/**
 * 异步延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 使用 BBP 公式（Bailey–Borwein–Plouffe）异步分批计算 π 的小数位，
 * 慢速查找目标数字串在 π 的小数点后第几位出现。
 * @param {string} target 目标字符串（例如 "14159"）
 * @param {(progress: number) => Promise<void>} onProgress 进度回调
 * @returns {Promise<number|null>} 找到则返回位置（1-based），否则 null
 */
async function slowFindInPi(target, onProgress) {
  // BBP 公式实现（十六进制位）
  function bbpTerm(k) {
    return (
      (1 / Math.pow(16, k)) *
      (4 / (8 * k + 1) - 2 / (8 * k + 4) - 1 / (8 * k + 5) - 1 / (8 * k + 6))
    );
  }

  const targetLen = target.length;
  let piDigits = '';
  const batchSize = 1000;
  const maxDigits = Infinity; // 最大计算位数（防止无限运行）

  for (let i = 0; i < maxDigits; i += batchSize) {
    let batch = '';
    for (let j = 0; j < batchSize; j++) {
      const n = i + j;
      let x = 0;
      for (let k = 0; k <= n; k++) {
        x += bbpTerm(k);
      }
      x = x - Math.floor(x);
      const hexDigit = Math.floor(16 * x);
      batch += (hexDigit % 10).toString(); // 简单转十进制字符
    }

    piDigits += batch;
    const idx = piDigits.indexOf(target);
    if (idx !== -1) {
      return idx + 1; // 位置从 1 开始
    }

    if (onProgress) await onProgress(i + batchSize);
    await sleep(10); // 暂停以避免 CPU 爆炸
  }

  return null;
}

// 插件主体
export default {
  entities: [Pai],

  /**
   * 插件入口
   * @param {import('ririra-types').EventBus} eventBus
   * @param {import('ririra-types').DB} db
   */
  async init(eventBus, db) {
    eventBus.on('GROUP_AT_MESSAGE_CREATE', async (ctx) => {
      const content = ctx.payload.d.content.trim();
      const uid = ctx.payload.d.author.id;
      const gid = ctx.payload.d.group_openid;

      const paiRepository = db.getRepository(Pai);

      if (/^\/pai/.test(content)) {
        const query = content.replace(/^.*?\/pai/, '').trim().split(/\s+/);
        const input = query[0] || '';

        if (!input) {
          // 查询当前 π 状态
          const pai = await paiRepository.findOne({ where: { uid, gid, status: In([0, 1]) } });
          if (pai && pai.pai) {
            await ctx.reply(`你当前的 π 查找任务：\n目标：${pai.pai}\n进度：${pai.find_where}\n耗时：${pai.find_secord}s`);
          } else {
            await ctx.reply('你当前没有 π 查找任务。示例 `/pai 14159` 开始查找。');
          }
          return;
        }

        // 新建任务
        const pai_value = input;
        let pai = await paiRepository.findOne({ where: { uid, gid, status: In([0, 1]) } });
        if (pai) {
          pai.status = -1;
          await paiRepository.save(pai);
        }

        pai = paiRepository.create({
          uid,
          gid,
          pai: pai_value,
          find_where: 0,
          find_secord: 0,
          status: 1,
          created_at: new Date(),
        });
        await paiRepository.save(pai);

        await ctx.reply(`开始查找「${pai_value}」在 π 中的位置，可能需要较长时间……`);

        // 异步执行查找
        (async () => {
          const startTime = Date.now();
          const onProgress = async (progress) => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            pai.find_where = progress;
            pai.find_secord = elapsed;
            await paiRepository.save(pai);
            if (progress % 5000 === 0) {
              logger.debug(`π 查找进度：${progress} 位...`);
            }
          };

          const pos = await slowFindInPi(pai_value, onProgress);
          const totalSec = Math.floor((Date.now() - startTime) / 1000);

          pai.find_where = pos || 0;
          pai.find_secord = totalSec;
          pai.status = 0;
          await paiRepository.save(pai);

          if (pos) {
            await ctx.reply(`「${pai_value}」首次出现在 π 的第 ${pos} 位（小数点后），耗时 ${totalSec}s`);
          }
        })();
      }
    });
  },
};