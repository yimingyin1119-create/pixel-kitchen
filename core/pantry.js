// Everyday seasonings assumed to be in the cupboard when a recipe says 适量 and nobody tracks them.
const PANTRY = [
  '盐', '糖', '生抽', '老抽', '酱油', '醋', '料酒', '姜', '葱', '蒜', '花椒', '八角', '桂皮', '香叶', '辣椒',
  '胡椒', '淀粉', '油', '鸡精', '味精', '豆瓣酱', '番茄酱', '芝麻', '孜然', '五香粉', '十三香', '蜂蜜',
];

export function isPantryName(name) {
  return PANTRY.some((w) => String(name).includes(w));
}

export function isPantry(need) {
  return need.kind === 'seasoning' && isPantryName(need.name);
}
