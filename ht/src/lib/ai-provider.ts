import { getEnv } from "@/lib/env";

type AiTask = "review" | "tags" | "summary" | "recommendation";
type AiProvider = "deepseek" | "openai" | "none";

type AiResult = {
  configured: boolean;
  provider: AiProvider;
  score: number;
  summary: string;
  tags: string[];
};

function fallback(task: AiTask, content: string): AiResult {
  const trimmed = content.trim();
  const tags = trimmed
    ? Array.from(new Set(trimmed.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? [])).slice(0, 5)
    : ["demo"];

  return {
    configured: false,
    provider: "none",
    score: task === "review" ? 75 : 60,
    summary: `AI 未配置，返回本地演示 ${task} 结果。${trimmed ? `内容预览：${trimmed.slice(0, 80)}` : ""}`,
    tags
  };
}

async function callChatCompletion(input: {
  provider: "deepseek" | "openai";
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
}) {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${input.provider} request failed`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "AI 已返回结果，但内容为空。";
}

function getConfiguredProvider() {
  const env = getEnv();
  if (env.deepseekApiKey) {
    return {
      provider: "deepseek" as const,
      baseUrl: env.deepseekBaseUrl,
      apiKey: env.deepseekApiKey,
      model: env.deepseekModel
    };
  }
  if (env.openaiApiKey) {
    return {
      provider: "openai" as const,
      baseUrl: "https://api.openai.com",
      apiKey: env.openaiApiKey,
      model: env.openaiModel
    };
  }
  return null;
}

export async function runAiTask(task: AiTask, content: string): Promise<AiResult> {
  const configured = getConfiguredProvider();
  if (!configured) return fallback(task, content);
  const summary = await callChatCompletion({
    ...configured,
    messages: [
      { role: "system", content: "你是社区内容审核与运营助手。只输出简洁中文建议。判断重点是恶意、诈骗、违法、仇恨攻击、骚扰、诱导、垃圾内容等明显风险；不要因为内容普通、平庸、文笔一般或信息量不高就建议下架或不推荐。" },
      { role: "user", content: `任务：${task}\n内容：${content}\n如果任务是 review，请明确写出“建议通过”或“建议不通过”。如果任务是 recommendation，请明确写出“建议推荐”或“建议不推荐”。再给出评分、摘要、风险点和建议标签。` }
    ]
  });
  return { configured: true, provider: configured.provider, score: 80, summary, tags: [] };
}

type AiChatAudience = "admin" | "user";

export async function runAiChat(messages: Array<{ role: "user" | "assistant"; content: string }>, databaseContext = "", audience: AiChatAudience = "admin") {
  const latest = messages.at(-1)?.content.trim() || "";
  const configured = getConfiguredProvider();
  if (!latest) {
    return { configured: Boolean(configured), provider: configured?.provider ?? "none", content: "请输入要咨询的问题。" };
  }
  if (!configured) {
    const fallbackPrefix = audience === "admin"
      ? "AI 未配置。后台已实时检索数据库，但需要配置 DeepSeek 或 OpenAI Key 后才能基于检索结果生成自然语言回答。"
      : "AI 未配置。小程序端已实时检索可见社区内容，但需要配置 DeepSeek 或 OpenAI Key 后才能基于检索结果生成自然语言回答。";
    return {
      configured: false,
      provider: "none" as const,
      content: `${fallbackPrefix}\n\n本次问题：“${latest.slice(0, 80)}”\n\n${databaseContext ? databaseContext.slice(0, 1200) : ""}`
    };
  }
  const providerName = configured.provider === "deepseek" ? "DeepSeek" : "OpenAI";
  const systemContent = audience === "admin"
    ? `你是 Vitex 管理后台的 AI 助手，当前模型供应商是 ${providerName}。不要自称 ChatGPT，不要声称自己来自 OpenAI，除非用户明确询问供应商时只回答“当前接入的是 ${providerName}”。回答用简洁中文。你具备只读 RAG 能力：可以基于后端实时检索到的数据库上下文回答文章、热度、待审、用户、分类和运营问题。数据库上下文每次请求都会重新检索，不能使用过时印象。你不能执行删除、下架、修改、启用、停用等写操作；遇到写操作需求时，只能说明需要管理员在工作台确认执行。\n\n${databaseContext ? `实时数据库上下文：\n${databaseContext}` : "本次没有附加数据库上下文。"}`
    : `你是 Vitex 微信小程序里的普通用户 AI 助手，当前模型供应商是 ${providerName}。不要自称 ChatGPT，不要声称自己来自 OpenAI，除非用户明确询问供应商时只回答“当前接入的是 ${providerName}”。回答用简洁中文。你正在和普通用户聊天，不是管理员。你具备只读 RAG 能力：只能基于后端实时检索到的公开文章、用户自己的文章、用户自己的收藏和浏览历史回答。不能声称能访问后台、审核队列、其他用户草稿、管理员权限或执行删除/下架/审核等管理操作。可以帮用户理解文章、推荐公开内容、整理私信回复、给自己的文章和资料提供修改建议。\n\n${databaseContext ? `实时用户可见上下文：\n${databaseContext}` : "本次没有附加用户可见上下文。"}`;
  const content = await callChatCompletion({
    ...configured,
    messages: [
      {
        role: "system",
        content: systemContent
      },
      ...messages
    ]
  });
  return { configured: true, provider: configured.provider, content };
}

export async function runAiTitle(question: string) {
  const configured = getConfiguredProvider();
  const fallbackTitle = question.trim().replace(/\s+/g, " ").slice(0, 18) || "新对话";
  if (!configured) {
    return { configured: false, provider: "none" as const, title: fallbackTitle };
  }
  const title = await callChatCompletion({
    ...configured,
    temperature: 0,
    messages: [
      { role: "system", content: "只负责给对话生成标题。输出 6 到 14 个中文字符，不要标点，不要解释。" },
      { role: "user", content: question }
    ]
  });
  return {
    configured: true,
    provider: configured.provider,
    title: title.replace(/[，。！？、,.!?\s]/g, "").slice(0, 14) || fallbackTitle
  };
}

export async function runAiPostWriter(input: { title: string; content?: string }) {
  const title = input.title.trim();
  const content = input.content?.trim() || "";
  const configured = getConfiguredProvider();

  if (!configured) {
    const seed = content ? `\n\n基于你已有的想法：${content}` : "";
    return {
      configured: false,
      provider: "none" as const,
      content: `${title}\n\n${title} 是一个值得展开记录的话题。可以先从真实体验或观察写起，再补充背景、问题和自己的判断。${seed}\n\n建议从三个层次继续完善：第一，说明为什么关注这个主题；第二，写清楚过程中的关键细节；第三，给出你的结论、建议或后续计划。`
    };
  }

  const providerName = configured.provider === "deepseek" ? "DeepSeek" : "OpenAI";
  const generated = await callChatCompletion({
    ...configured,
    temperature: 0.7,
    messages: [
      { role: "system", content: `你是 Vitex 社区的中文文章写作助手，当前模型供应商是 ${providerName}。不要自称 ChatGPT，不要提供应商。只输出正文。` },
      { role: "user", content: `标题：${title}\n已有正文：${content || "无"}\n请生成一篇适合社区发布的完整正文，600 到 1000 字。` }
    ]
  });

  return { configured: true, provider: configured.provider, content: generated };
}
