// Picks the pixel icon for a dish from its name, tags and main ingredients. First matching rule wins.
const DESSERT = ['西米露', '双皮奶', '红豆沙', '绿豆沙', '银耳', '圆子', '糖水', '布丁', '蛋挞', '甜品'];
const VEG = ['菜', '西兰花', '生菜', '土豆', '四季豆', '豆角', '地三鲜', '茄子', '青椒', '黄瓜', '冬瓜', '南瓜'];

const has = (text, words) => words.some((w) => text.includes(w));

export function dishIcon(recipe) {
  const name = recipe.name ?? '';
  const mains = (recipe.ingredients ?? []).filter((i) => i.kind !== 'seasoning').map((i) => i.name).join(' ');
  if ((recipe.tags ?? []).includes('甜品') || has(name, DESSERT)) return 'cake';
  if (has(name.replace('鱼香', ''), ['鱼', '鲈']) || has(mains, ['鱼', '鲈', '虾'])) return 'fish';
  if (name.includes('汤')) return 'soup';
  if (name.includes('面')) return 'noodles';
  if (name.includes('饭')) return 'rice';
  if (name.replace('鸡蛋', '').includes('鸡')) return 'chicken';
  if (has(name, ['肉', '牛', '排骨', '猪'])) return 'meat';
  if (name.includes('豆腐')) return 'tofu';
  if (name.includes('蛋')) return 'egg';
  if (name.includes('番茄')) return 'tomato';
  if (has(name, VEG)) return 'leaf';
  if (has(mains, ['鸡'])) return 'chicken';
  if (has(mains, ['肉', '牛', '排骨'])) return 'meat';
  return 'pot';
}
