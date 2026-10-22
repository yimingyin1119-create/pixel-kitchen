import { builders, connect, workflow } from '../lib/nodes.mjs';

export const SEED_ID = 'pkSeed0000000001';

const PREPARE = (recipes) => `
const existing = $('读取 pk_recipes').all().filter((i) => i.json.uid);
const rows = existing.length > 0 ? [] : PK.seedRows({ now: new Date().toISOString(), rand: $('生成随机数').first().json.rand, seq: 0 }, ${JSON.stringify(recipes)});
return [{ json: { rows, count: rows.length, body: { ok: true, seeded: rows.length }, status: 200 } }];
`;

const PICK = `return $('准备预设').first().json.rows.map((json) => ({ json }));`;

export default function seed({ core, cfg, seedRecipes }) {
  const B = builders({ workflowId: SEED_ID, core, cfg });
  const nodes = [
    B.sticky('## 写入预设菜谱\n菜谱表是空的时候，写入 12 道家常菜（2 人份）；已经有菜谱就什么都不做。\n只在服务器本机调用。', [0, -1.4], [5, 1.2]),
    B.webhook('开始写入', 'pk-seed', [0, 0]),
    B.cryptoRand('生成随机数', [1, 0]),
    B.dtGetAll('pk_recipes', [2, 0]),
    B.code('准备预设', PREPARE(seedRecipes), [3, 0], { withCore: true }),
    B.code('挑出菜谱', PICK, [4, 0.8]),
    B.dtUpsert('pk_recipes', [5, 0.8]),
    B.respond('写好了', { fromNode: '准备预设' }, [4, 2]),
  ];
  const connections = connect(
    ['开始写入', '生成随机数'],
    ['生成随机数', '读取 pk_recipes'],
    ['读取 pk_recipes', '准备预设'],
    ['准备预设', '挑出菜谱'],
    ['挑出菜谱', '写入 pk_recipes'],
    ['准备预设', '写好了'],
  );
  return workflow({ id: SEED_ID, name: '搭伙小灶 · 写入预设菜谱', nodes, connections, cfg, webhook: true });
}
