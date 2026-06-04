"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

type ApiResult<T> = { success: boolean; data: T; message?: string };
type ChatMessage = { role: "user" | "assistant"; content: string; createdAt: string };
type Conversation = { id: string; title: string; messages: ChatMessage[]; updatedAt: string; aiTitled?: boolean };

const STORAGE_KEY = "vitex-admin-ai-conversations:v1";

function welcomeMessage(): ChatMessage {
  return {
    role: "assistant",
    content: "我是 Vitex 管理后台 AI 助手。当前已接入模型对话、历史会话和数据库 RAG 检索，可以基于实时文章、热度、待审、用户、分类等数据回答问题；我不会直接修改数据库。",
    createdAt: new Date().toISOString()
  };
}

async function readJson<T>(response: Response) {
  const json = (await response.json()) as ApiResult<T>;
  if (!response.ok || !json.success) throw new Error(json.message || "请求失败");
  return json.data;
}

function createConversation(title = "新对话"): Conversation {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, messages: [welcomeMessage()], updatedAt: now };
}

function normalizeConversations(items: Conversation[]) {
  return items.map((conversation) => ({
    ...conversation,
    title: conversation.title || "新对话",
    messages: conversation.messages.map((message, index) => {
      const oldWelcome = index === 0 && message.role === "assistant" && message.content.includes("ChatGPT");
      return oldWelcome ? welcomeMessage() : message;
    })
  }));
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminAiPage() {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState("");

  const active = useMemo(() => conversations.find((item) => item.id === activeId) ?? conversations[0], [activeId, conversations]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("admin_token") || "";
    if (!savedToken) {
      setToken("");
      router.replace("/admin");
      return;
    }
    setToken(savedToken);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Conversation[]) : [];
    const initial = parsed.length ? normalizeConversations(parsed) : [createConversation()];
    setConversations(initial);
    setActiveId(initial[0].id);
  }, [router]);

  useEffect(() => {
    if (conversations.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }, [activeId, active?.messages.length, busy]);

  const updateConversation = (id: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((current) => current.map((conversation) => conversation.id === id ? updater(conversation) : conversation));
  };

  const newConversation = () => {
    const next = createConversation(`对话 ${conversations.length + 1}`);
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setInput("");
    setMeta("");
  };

  const deleteConversation = (id: string) => {
    if (conversations.length <= 1) {
      const reset = createConversation();
      setConversations([reset]);
      setActiveId(reset.id);
      return;
    }
    setConversations((current) => {
      const next = current.filter((item) => item.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  const renameConversation = (id: string, title: string) => {
    updateConversation(id, (conversation) => ({ ...conversation, title: title.trim() || "未命名对话", aiTitled: true, updatedAt: new Date().toISOString() }));
  };

  const generateTitle = async (conversationId: string, question: string) => {
    if (!token) return;
    try {
      const data = await fetch("/api/admin/ai/title", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      }).then((res) => readJson<{ title: { title: string } }>(res));
      updateConversation(conversationId, (conversation) => conversation.aiTitled ? conversation : { ...conversation, title: data.title.title, aiTitled: true });
    } catch {
      updateConversation(conversationId, (conversation) => conversation.aiTitled ? conversation : { ...conversation, title: question.slice(0, 18) || conversation.title, aiTitled: true });
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy || !token || !active) return;
    const conversationId = active.id;
    const shouldGenerateTitle = !active.aiTitled && active.messages.filter((message) => message.role === "user").length === 0;
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { role: "user", content, createdAt: now };
    const nextMessages = [...active.messages, userMessage];

    updateConversation(conversationId, (conversation) => ({ ...conversation, title: shouldGenerateTitle ? "正在生成标题..." : conversation.title, messages: nextMessages, updatedAt: now }));
    setInput("");
    setBusy(true);
    if (shouldGenerateTitle) void generateTitle(conversationId, content);

    try {
      const data = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })).slice(-16) })
      }).then((res) => readJson<{ reply: { configured: boolean; provider: string; content: string }; sources?: Array<{ id: string; title: string }> }>(res));
      setMeta(`${data.reply.provider}${data.reply.configured ? " 已配置" : " 未配置"} / 已实时检索 ${data.sources?.length ?? 0} 条数据`);
      const assistantMessage: ChatMessage = { role: "assistant", content: data.reply.content, createdAt: new Date().toISOString() };
      updateConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, assistantMessage], updatedAt: assistantMessage.createdAt }));
    } catch (error) {
      const assistantMessage: ChatMessage = { role: "assistant", content: error instanceof Error ? error.message : "AI 对话失败", createdAt: new Date().toISOString() };
      updateConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, assistantMessage], updatedAt: assistantMessage.createdAt }));
    } finally {
      setBusy(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  };

  if (token === null) return <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500">正在检查管理员登录状态...</div>;

  return (
    <div className="grid h-[calc(100dvh-122px)] min-h-[560px] gap-5 overflow-hidden lg:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">AI 对话</h1>
            <p className="mt-1 text-sm text-slate-500">管理员专用会话</p>
          </div>
          <button className="rounded-2xl bg-[#2f5d62] px-4 py-2 text-sm font-black text-white" onClick={newConversation}>新建</button>
        </div>
        {meta && <p className="mt-4 shrink-0 rounded-2xl bg-[#eef4f3] px-4 py-3 text-sm font-bold text-[#2f5d62]">{meta}</p>}
        <div className="admin-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {conversations.map((conversation) => (
            <button key={conversation.id} className={`w-full rounded-2xl border p-4 text-left transition ${conversation.id === active?.id ? "border-[#2f5d62] bg-[#eef4f3]" : "border-slate-200 bg-white hover:border-[#2f5d62]"}`} onClick={() => setActiveId(conversation.id)}>
              <span className="block truncate font-black text-slate-950">{conversation.title}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">{conversation.messages.at(-1)?.content || "暂无消息"}</span>
              <span className="mt-2 block text-xs font-bold text-slate-400">{timeLabel(conversation.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 p-4">
          <input className="min-w-0 flex-1 rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-lg font-black text-slate-950 outline-none focus:border-[#2f5d62]" value={active?.title ?? ""} onChange={(event) => active && renameConversation(active.id, event.target.value)} />
          {active && <button className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600" onClick={() => deleteConversation(active.id)}>删除对话</button>}
        </div>
        <div ref={messageListRef} className="admin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {(active?.messages ?? []).map((message, index) => (
            <div key={`${message.createdAt}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-[#2f5d62] text-white" : "bg-white text-slate-800"}`}>{message.content}</div>
            </div>
          ))}
          {busy && <div className="text-sm font-bold text-slate-400">AI 正在回复...</div>}
        </div>
        <div className="shrink-0 border-t border-slate-100 p-4">
          <textarea className="min-h-24 w-full resize-none rounded-2xl border border-[#d9e1df] px-4 py-3 text-sm outline-none focus:border-[#2f5d62] disabled:bg-slate-50" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} placeholder={busy ? "AI 正在回复..." : "输入给 AI 的管理提示词，Enter 发送，Shift+Enter 换行"} disabled={busy} />
        </div>
      </section>
    </div>
  );
}
