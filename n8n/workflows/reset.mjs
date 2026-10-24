import { builders, connect, workflow } from '../lib/nodes.mjs';
import { TABLES } from '../../core/schema.js';

export const RESET_ID = 'pkReset000000001';

export default function reset({ core, cfg }) {
  const B = builders({ workflowId: RESET_ID, core, cfg });
  const tables = Object.keys(TABLES);
  const nodes = [
    B.sticky('## 重置数据\n只在服务器本机由 `scripts/server.sh reset` 调用（先备份、要输入 RESET 确认）。\n把 7 张数据表整个删掉，之后再由「建表」「写入预设菜谱」重新建好。', [0, -1.4], [5, 1.2]),
    B.webhook('开始重置', 'pk-reset', [0, 0]),
    ...tables.map((t, i) => B.dtDeleteTable(t, [1 + i, 0])),
    B.respond('删好了', { status: 200 }, [1 + tables.length, 0]),
  ];
  nodes.at(-1).parameters.responseBody = '={{ { ok: true } }}';
  const connections = connect(
    ['开始重置', `删表 ${tables[0]}`],
    ...tables.slice(1).map((t, i) => [`删表 ${tables[i]}`, `删表 ${t}`]),
    [`删表 ${tables.at(-1)}`, '删好了'],
  );
  return workflow({ id: RESET_ID, name: '饭搭子 · 重置数据', nodes, connections, cfg });
}
