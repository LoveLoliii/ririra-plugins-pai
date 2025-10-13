import { Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { Pai } from './entity/ririra.pai.js';
import Decimal from 'decimal.js';

// ESM 下没有 this 指向全局，所以用字符串或模块名作为 context
const logger = new Logger('PaiPlugin');

Decimal.set({ precision: 10000 });

/**
 * 异步延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算 π 的十进制小数部分
 * @param {number} digits 小数位数
 * @returns {string} π 的小数部分字符串
 */
function computePi(digits) {
  const one = new Decimal(1);
  const four = new Decimal(4);
  const terms = Math.ceil(digits / 14) + 10; // 足够精度

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

/**
 * 异步查找目标数字串在 π 小数中的位置
 * @param {string} target
 * @param {(progress: number) => Promise<void>} onProgress
 * @returns {Promise<number|null>}
 */
async function findInPi(target, onProgress) {
  const chunkSize = 10000;
  let position = 0;
  const targetLength = target.length;

  while (true) {
    const piDigits = computePi(position + chunkSize).slice(position);
    const idx = piDigits.indexOf(target);
    if (idx !== -1) return position + idx + 1;
    position += chunkSize;
    if (onProgress) await onProgress(position);
    //if (position > 1000000) return null; // 最大查找长度限制
    await sleep(10); // 异步暂停，避免阻塞
  }
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
          const pai = await paiRepository.findOne({
            where: { uid, gid, status: In([0, 1]) },
            order: { created_at: 'DESC' },
          });
          if (pai && pai.pai) {
            if(pai.status === 0){
              await ctx.reply(`「${pai.pai}」首次出现在 π 的第 ${pai.find_where} 位（小数点后），耗时 ${pai.find_secord}s`);
            }else{
              await ctx.reply(`你当前的 π 查找任务：\n目标：${pai.pai}\n进度：${pai.find_where}\n耗时：${pai.find_secord}s`);
            }
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

          const pos = await findInPi(pai_value, onProgress);
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