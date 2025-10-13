import { Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { In } from 'typeorm';
import { Pai } from './entity/ririra.pai.js';

// ESM 下没有 this 指向全局，所以用字符串或模块名作为 context
const logger = new Logger('PaiPlugin');


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
        let pai = await paiRepository.findOne({
            where: { uid, gid, status: In([0, 1]) },
            order: { created_at: 'DESC' },
          });
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
          try {
            const { position: pos } = await runPiWorker(pai_value);
            const totalSec = Math.floor((Date.now() - startTime) / 1000);

            pai.find_where = pos || 0;
            pai.find_secord = totalSec;
            pai.status = 0;
            await paiRepository.save(pai);

            if (pos) {
              await ctx.reply(`「${pai_value}」首次出现在 π 的第 ${pos} 位（小数点后），耗时 ${totalSec}s`);
            }
          } catch (err) {
            logger.error('π 查找失败', err);
            await ctx.reply('π 查找失败，请稍后重试');
          }
        })();
      }
    });
  },
};


// 计算 pai 的函数改成 worker 异步调用
function runPiWorker(pai_value) {
  return new Promise((resolve, reject) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const worker = new Worker(path.join(__dirname, 'pi-worker.js'), {
      workerData: { target: pai_value }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}