const DEFAULT_BOT_ID = 'b4ffa957-24f2-4b8a-81a8-ce36d027170c';

/** 机器人账号（豆沙包）的 uuid，可用环境变量覆盖 */
export const BOT_ID = process.env.BOT_USER_ID || DEFAULT_BOT_ID;

export const BOT_NAME = '豆沙包';

const DEFAULT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const SYSTEM_PROMPT = [
  '你是回声上的用户「豆沙包」，一个有礼貌、说话简短、像同校同学一样的 AI 助手。',
  '你的身份是回声的机器人小助手，可以坦率承认自己是 AI。',
  '回复要求：中文、口语化、不超过 60 个字、不要用列表、不要长篇大论、不要重复对方的原话。',
  '你会用到的站内功能：点别人的头像可以看 TA 的主页并加好友/关注/私信；好友之间才能私信；',
  '好友页里有「对讲机」，按住按钮就能实时语音对话；群聊需要群主同意才能加入。',
  '遇到你不知道、也不该编的事情，就老实说不太清楚，并给一个可行的建议。'
].join('');

/** 没有配置大模型密钥时使用的规则回复，保证机器人始终能应答 */
function ruleReply(text) {
  const t = (text || '').toLowerCase();
  const has = (...keys) => keys.some((k) => t.includes(k));

  if (has('你好', '在吗', 'hi', 'hello', '嗨')) {
    return '在的～我是豆沙包，回声的机器人小助手。有什么想聊的或者需要帮忙的？';
  }
  if (has('对讲机', '语音', '说话')) {
    return '想试对讲机的话，进「好友」页点某位好友后面的「对讲机」，按住按钮说话就行，松手就停。记得戴耳机，不然会有回声。';
  }
  if (has('作业', '题', '考试', '学习', '复习', '论文', '作文')) {
    return '你具体卡在哪一步？把题目或者思路发我，我帮你理一理框架，再自己动笔会快很多。';
  }
  if (has('头像', '主页', '关注', '加好友')) {
    return '点别人的头像或昵称就能进 TA 的主页，主页上能关注、加好友、发私信；加好友要对方同意才算成。';
  }
  if (has('发帖', '帖子', '发不出去', '怎么发')) {
    return '首页输入框里写内容，点「发布」就行；带图的话点「📷 配图」再选图，单张不要超过 4MB。';
  }
  if (has('谢谢', '感谢', 'thanks')) {
    return '不客气～有事随时私信我。';
  }
  if (has('管理', '删帖', '禁言', '举报')) {
    return '骂人或者刷屏的帖子可以让管理员处理：管理员能删帖、能禁言。你也可以直接把帖子链接私信给管理员。';
  }
  return '收到～你再说详细点，我好帮你。要是想找人聊天，去「好友」页搜名字，加好友之后就能私信我了。';
}

async function llmReply({ username, text, history, cfg }) {
  const key = cfg?.key;
  const model = cfg?.model;
  const base = cfg?.url || DEFAULT_URL;
  // 允许配置成 https://xxx/v1 这种基地址，自动补全 completions 路径
  const url = /\/chat\/completions$/.test(base)
    ? base
    : String(base).replace(/\/+$/, '') + '/chat/completions';
  if (!key || !model) return null;

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of history || []) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: `${username}：${text}` });

  const payload = { model, messages, max_tokens: 220, temperature: 0.75 };
  // 豆包系列默认带思考链，会慢且啰嗦，这里关掉
  if (String(model).toLowerCase().includes('doubao')) payload.thinking = { type: 'disabled' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    const out = data?.choices?.[0]?.message?.content;
    if (typeof out === 'string' && out.trim()) return out.trim().slice(0, 400);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 读取机器人模型配置：环境变量优先，其次读 Supabase 的 app_config 表 */
export async function loadBotConfig(supabase) {
  const envCfg = {
    key: process.env.BOT_API_KEY || process.env.ARK_API_KEY || '',
    model: process.env.BOT_MODEL || process.env.ARK_MODEL || '',
    url: process.env.BOT_API_URL || ''
  };
  if (envCfg.key && envCfg.model) return { ...envCfg, url: envCfg.url || DEFAULT_URL };
  try {
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['bot_api_key', 'bot_api_model', 'bot_api_url']);
    const map = {};
    for (const row of data || []) map[row.key] = row.value;
    return {
      key: envCfg.key || map.bot_api_key || '',
      model: envCfg.model || map.bot_api_model || '',
      url: envCfg.url || map.bot_api_url || DEFAULT_URL
    };
  } catch {
    return { ...envCfg, url: envCfg.url || DEFAULT_URL };
  }
}

/** 生成一条回复：有模型配置走大模型，否则走规则兜底 */
export async function generateBotReply({ username, text, history, cfg }) {
  const ai = await llmReply({ username, text, history, cfg });
  return ai || ruleReply(text);
}
