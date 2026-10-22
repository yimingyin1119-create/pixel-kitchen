import { builders, connect, workflow } from '../lib/nodes.mjs';

export const NOTIFY_ID = 'pkNotify00000001';

const MEAL = "({ lunch: '午饭', dinner: '晚饭', late: '夜宵' })[$json.meal]";
const DISHES = "$json.dishes.join('、')";

const DATE = "{{ Number($json.wantedDate.slice(5, 7)) }}月{{ Number($json.wantedDate.slice(8, 10)) }}日";

// [event type, branch label, title expression, content expression]
export const MESSAGES = [
  ['request.created', '新要求', `={{ $json.who }} 想吃 {{ ${DISHES} }}`,
    `=${DATE} {{ ${MEAL} }}{{ $json.wantedTime ? ' ' + $json.wantedTime : '' }}｜{{ $json.servings }}人{{ $json.note ? '｜备注：' + $json.note : '' }}{{ $json.shortages.length ? '｜缺：' + $json.shortages.join('、') + '（已加进采购清单）' : '' }}{{ $json.selfCook ? '｜TA 自己做' : '' }}`],
  ['request.taken', '有人接了', `={{ $json.taker }} 接了你的 {{ ${DISHES} }}`, '=等着开饭吧'],
  ['request.released', '做不了', `={{ $json.taker }} 做不了 {{ ${DISHES} }}`, '=重新等人接'],
  ['request.cancelled', '被取消', `={{ $json.who }} 取消了 {{ ${DISHES} }}`, '=不用做啦'],
  ['request.done', '出锅了', `={{ ${DISHES} }} 出锅啦`, '={{ $json.taker }} 做的，快来吃！'],
  ['stock.low', '快用完了', '={{ $json.name }} 快用完了', '=已经加进采购清单'],
  ['push.test', '测试推送', '=搭伙小灶', '=推送设置成功 ✦'],
];

export default function notify({ core, cfg }) {
  const B = builders({ workflowId: NOTIFY_ID, core, cfg });
  const nodes = [
    B.sticky('## 通知中心\n点餐接口和每日早报把「事件」交过来，这里按类型拼成一句人话，再通过 PushPlus 发到对方微信。\n推送失败不会影响点菜本身。', [0, -1.6], [5, 1.4]),
    B.execTrigger('收到事件', [0, 2]),
    B.switchOn('事件类型', '={{ $json.type }}', MESSAGES.map(([type, label]) => [type, label]), [1, 2]),
    ...MESSAGES.map(([, label, title, content], i) => B.setFields(`拼消息：${label}`, { to: '={{ $json.to }}', title, content }, [2, i * 0.8])),
    B.httpPostJson('发到微信', cfg.pushplusUrl,
      "={{ { token: $json.to, title: $json.title, content: $json.content, template: 'txt' } }}", [3, 2], { continueOnError: true }),
  ];
  const connections = connect(
    ['收到事件', '事件类型'],
    ...MESSAGES.map(([, label], i) => ['事件类型', `拼消息：${label}`, i]),
    ...MESSAGES.map(([, label]) => [`拼消息：${label}`, '发到微信']),
  );
  return workflow({ id: NOTIFY_ID, name: '搭伙小灶 · 通知中心', nodes, connections, cfg });
}
