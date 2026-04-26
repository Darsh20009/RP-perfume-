import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail, Inbox, Send, Star, Trash2, Plus, RefreshCw, Search, Loader2,
  Reply, Forward, X, ChevronRight, Paperclip, AlertCircle, CheckCircle2,
  Settings as SettingsIcon, Server, ShieldCheck, Sparkles, UserCog, Save
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type MailAccount = {
  id: string; userId: string; email: string; displayName: string;
  provider: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number;
  color: string; isActive: boolean;
  lastSyncAt?: string; lastSyncStatus: string; lastSyncError?: string;
  unreadCount: number;
};
type MailMessage = {
  id: string; accountId: string; folder: string; uid: string; messageId: string;
  subject: string; fromEmail: string; fromName: string; toEmails: string[]; ccEmails: string[];
  date: string; snippet: string; isRead: boolean; isStarred: boolean;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
};

const FOLDERS = [
  { id: "INBOX",  label: "الوارد",   icon: Inbox },
  { id: "Sent",   label: "المُرسَل", icon: Send },
  { id: "Drafts", label: "المسودات", icon: Mail },
  { id: "Trash",  label: "المحذوفة", icon: Trash2 },
];

const PROVIDER_OPTIONS = [
  { id: "zoho",    label: "Zoho Mail",      desc: "imap.zoho.com" },
  { id: "gmail",   label: "Gmail",          desc: "imap.gmail.com" },
  { id: "outlook", label: "Outlook 365",    desc: "outlook.office365.com" },
  { id: "yandex",  label: "Yandex",         desc: "imap.yandex.com" },
  { id: "custom",  label: "خادم مخصص",      desc: "أدخل البيانات يدوياً" },
];

function fmtTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

export default function AdminInbox() {
  const { toast } = useToast();
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [search, setSearch] = useState("");
  const [openMessageId, setOpenMessageId] = useState<string>("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", cc: "", subject: "", body: "", inReplyTo: "" });
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  // ─── Accounts ────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<MailAccount[]>({
    queryKey: ["/api/admin/inbox/accounts"],
    refetchInterval: 30_000,
  });

  // Auto-select first account
  const currentAccount = useMemo(() => {
    if (activeAccountId) return accounts.find(a => a.id === activeAccountId);
    return accounts[0];
  }, [accounts, activeAccountId]);
  const accountId = currentAccount?.id || "";

  // ─── Messages ────────────────────────────────────────────────────────
  const { data: messagesResp, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{ items: MailMessage[]; total: number }>({
    queryKey: ["/api/admin/inbox/messages", accountId, activeFolder, filter, search],
    queryFn: async () => {
      if (!accountId) return { items: [], total: 0 };
      const params = new URLSearchParams({ accountId, folder: activeFolder, filter, q: search });
      const r = await fetch(`/api/admin/inbox/messages?${params}`, { credentials: "include" });
      if (!r.ok) return { items: [], total: 0 };
      return r.json();
    },
    enabled: !!accountId,
    refetchInterval: 60_000,
  });
  const messages = messagesResp?.items || [];

  const { data: openMessage } = useQuery<MailMessage & { htmlBody: string; textBody: string }>({
    queryKey: ["/api/admin/inbox/messages", openMessageId, "detail"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/inbox/messages/${openMessageId}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!openMessageId,
  });

  // ─── Mutations ───────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/inbox/accounts/${accountId}/sync`, { folder: activeFolder }),
    onSuccess: (r: any) => {
      toast({ title: "تمت المزامنة", description: `تم جلب ${r.stored || 0} رسالة جديدة` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/accounts"] });
    },
    onError: (e: any) => toast({ title: "فشلت المزامنة", description: e?.message, variant: "destructive" }),
  });

  const flagMutation = useMutation({
    mutationFn: async ({ id, isRead, isStarred }: { id: string; isRead?: boolean; isStarred?: boolean }) =>
      apiRequest("PATCH", `/api/admin/inbox/messages/${id}`, { isRead, isStarred }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/accounts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/inbox/messages/${id}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      setOpenMessageId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/messages"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: any) => apiRequest("POST", "/api/admin/inbox/send", payload),
    onSuccess: () => {
      toast({ title: "✅ تم الإرسال" });
      setComposeOpen(false);
      setComposeData({ to: "", cc: "", subject: "", body: "", inReplyTo: "" });
    },
    onError: (e: any) => toast({ title: "فشل الإرسال", description: e?.message, variant: "destructive" }),
  });

  // ─── Handlers ────────────────────────────────────────────────────────
  const openMessage_ = (m: MailMessage) => {
    setOpenMessageId(m.id);
    if (!m.isRead) flagMutation.mutate({ id: m.id, isRead: true });
  };
  const handleReply = () => {
    if (!openMessage) return;
    setComposeData({
      to: openMessage.fromEmail,
      cc: "",
      subject: openMessage.subject.startsWith("Re:") ? openMessage.subject : `Re: ${openMessage.subject}`,
      body: `\n\n----- الرسالة الأصلية -----\nمن: ${openMessage.fromName || openMessage.fromEmail}\nالموضوع: ${openMessage.subject}\n\n${openMessage.textBody || ""}`,
      inReplyTo: openMessage.messageId,
    });
    setComposeOpen(true);
  };
  const handleForward = () => {
    if (!openMessage) return;
    setComposeData({
      to: "", cc: "",
      subject: openMessage.subject.startsWith("Fwd:") ? openMessage.subject : `Fwd: ${openMessage.subject}`,
      body: `\n\n----- بريد مُعاد توجيهه -----\nمن: ${openMessage.fromName || openMessage.fromEmail}\nالتاريخ: ${new Date(openMessage.date).toLocaleString("ar-SA")}\nالموضوع: ${openMessage.subject}\n\n${openMessage.textBody || ""}`,
      inReplyTo: "",
    });
    setComposeOpen(true);
  };
  const handleSend = () => {
    if (!composeData.to || !composeData.subject) {
      toast({ title: "حقول ناقصة", description: "أدخل المستلم والموضوع", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      accountId,
      to: composeData.to.split(",").map(s => s.trim()).filter(Boolean),
      cc: composeData.cc ? composeData.cc.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      subject: composeData.subject,
      text: composeData.body,
      html: `<div dir="auto" style="font-family:Tahoma,Arial,sans-serif;white-space:pre-wrap;">${composeData.body.replace(/</g, "&lt;")}</div>`,
      inReplyTo: composeData.inReplyTo || undefined,
    });
  };

  // ─── Empty state: no accounts yet ────────────────────────────────────
  if (!accountsLoading && accounts.length === 0) {
    return (
      <div className="space-y-6" dir="rtl">
        <Card className="rounded-2xl border-2 border-dashed border-[#DFB369]/40 bg-gradient-to-br from-[#FFFFFF] to-white">
          <CardContent className="p-10 text-center">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#DFB369] to-[#c89853] flex items-center justify-center mb-5 shadow-lg">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-[#2B2B60] mb-2">صندوق بريد الموظفين</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              أضف صناديق بريد الموظفين (مثل <span className="font-mono font-bold text-[#DFB369]">sales@rfperfume.sa</span>) لقراءة وإرسال الرسائل من داخل لوحة التحكم مباشرة.
            </p>
            <div className="flex gap-3 justify-center flex-wrap mb-8">
              <Button onClick={() => setAccountDialogOpen(true)} className="bg-[#2B2B60] hover:bg-[#2B2B60]/90 text-white rounded-xl px-6 h-12 gap-2 font-black">
                <Plus className="w-4 h-4" /> إضافة صندوق بريد
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto text-right">
              {[
                { icon: ShieldCheck, t: "مشفّر بالكامل", d: "كلمات المرور محفوظة بـ AES-256" },
                { icon: Server, t: "يدعم كل المزوّدين", d: "Zoho • Gmail • Outlook" },
                { icon: Sparkles, t: "مزامنة تلقائية", d: "كل دقيقتين تلقائياً" },
              ].map((f, i) => (
                <div key={i} className="p-4 rounded-xl bg-white border border-slate-200">
                  <f.icon className="w-5 h-5 text-[#DFB369] mb-2" />
                  <p className="text-xs font-black text-[#2B2B60]">{f.t}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{f.d}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <AccountDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2B2B60] to-[#243154] flex items-center justify-center">
            <Mail className="w-5 h-5 text-[#DFB369]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#2B2B60]">صندوق بريد الموظفين</h2>
            <p className="text-[10px] text-slate-500">قراءة وإرسال الرسائل عبر النطاق المخصص</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setComposeOpen(true)} disabled={!accountId} className="bg-[#DFB369] hover:bg-[#c89853] text-white rounded-xl gap-2 h-10 font-black">
            <Plus className="w-4 h-4" /> رسالة جديدة
          </Button>
          <Button onClick={() => setAccountDialogOpen(true)} variant="outline" className="rounded-xl gap-2 h-10 font-black border-slate-300">
            <SettingsIcon className="w-4 h-4" /> إدارة الصناديق
          </Button>
        </div>
      </div>

      {/* Layout: 3 columns */}
      <div className="grid grid-cols-12 gap-4 min-h-[70vh]">

        {/* Sidebar: accounts + folders */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <Card className="rounded-2xl border border-slate-200 bg-white">
            <CardContent className="p-3 space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1.5">الصناديق</p>
              {accounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setActiveAccountId(a.id); setOpenMessageId(""); }}
                  data-testid={`button-account-${a.id}`}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all ${
                    a.id === accountId ? "bg-[#DFB369]/10 border border-[#DFB369]/30" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: a.color }}>
                    {a.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-[#2B2B60] truncate">{a.displayName}</p>
                    <p className="text-[9px] text-slate-400 truncate font-mono">{a.email}</p>
                  </div>
                  {a.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#DFB369] text-white text-[9px] font-black">
                      {a.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {currentAccount && (
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="p-3 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1.5">المجلدات</p>
                {FOLDERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setActiveFolder(f.id); setOpenMessageId(""); }}
                    data-testid={`button-folder-${f.id}`}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all ${
                      f.id === activeFolder ? "bg-[#2B2B60] text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <f.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-bold flex-1">{f.label}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {currentAccount && (
            <div className="px-3 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5">
                {currentAccount.lastSyncStatus === "ok" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                ) : currentAccount.lastSyncStatus === "error" ? (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                <span>آخر مزامنة: {currentAccount.lastSyncAt ? fmtTime(currentAccount.lastSyncAt) : "—"}</span>
              </div>
              {currentAccount.lastSyncError && (
                <p className="text-red-500 text-[9px] mt-1 leading-relaxed">{currentAccount.lastSyncError.slice(0, 100)}</p>
              )}
            </div>
          )}
        </div>

        {/* Message list */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="rounded-2xl border border-slate-200 bg-white h-full flex flex-col">
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="بحث في الرسائل..."
                  className="h-9 pr-9 rounded-xl text-xs"
                  data-testid="input-search-messages"
                />
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: "all", label: "الكل" },
                  { id: "unread", label: "غير مقروء" },
                  { id: "starred", label: "مميّز" },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      filter === f.id ? "bg-[#2B2B60] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || !accountId}
                  className="mr-auto p-1.5 rounded-lg text-slate-400 hover:text-[#DFB369] hover:bg-slate-50 transition-all disabled:opacity-40"
                  title="مزامنة"
                  data-testid="button-sync-inbox"
                >
                  {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {messagesLoading ? (
                <div className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : messages.length === 0 ? (
                <div className="p-10 text-center">
                  <Inbox className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-xs text-slate-400">لا توجد رسائل</p>
                  <button onClick={() => syncMutation.mutate()} className="mt-3 text-[10px] text-[#DFB369] font-bold hover:underline">
                    اضغط للمزامنة الآن
                  </button>
                </div>
              ) : (
                messages.map(m => (
                  <button
                    key={m.id}
                    onClick={() => openMessage_(m)}
                    data-testid={`button-message-${m.id}`}
                    className={`w-full text-right px-3 py-3 border-b border-slate-100 transition-all ${
                      openMessageId === m.id ? "bg-[#DFB369]/5 border-r-2 border-r-[#DFB369]" : "hover:bg-slate-50"
                    } ${!m.isRead ? "bg-blue-50/40" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); flagMutation.mutate({ id: m.id, isStarred: !m.isStarred }); }}
                        className="shrink-0 mt-0.5"
                      >
                        <Star className={`w-3.5 h-3.5 ${m.isStarred ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className={`text-xs truncate ${!m.isRead ? "font-black text-[#2B2B60]" : "font-semibold text-slate-700"}`}>
                            {m.fromName || m.fromEmail}
                          </p>
                          <span className="text-[9px] text-slate-400 shrink-0 tabular-nums">{fmtTime(m.date)}</span>
                        </div>
                        <p className={`text-[11px] truncate ${!m.isRead ? "font-bold text-[#2B2B60]" : "text-slate-500"}`}>
                          {m.subject || "(بدون موضوع)"}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{m.snippet}</p>
                        {m.attachments?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                            <span className="text-[9px] text-slate-400">{m.attachments.length} مرفق</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Message preview */}
        <div className="col-span-12 lg:col-span-5">
          <Card className="rounded-2xl border border-slate-200 bg-white h-full flex flex-col">
            {openMessage ? (
              <>
                <div className="p-4 border-b border-slate-100 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[#2B2B60] text-base mb-1">{openMessage.subject || "(بدون موضوع)"}</h3>
                    <p className="text-xs text-slate-600">
                      <span className="font-bold">{openMessage.fromName || openMessage.fromEmail}</span>
                      <span className="text-slate-400 mr-2 font-mono text-[10px]">&lt;{openMessage.fromEmail}&gt;</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">إلى: {openMessage.toEmails?.join(", ")}</p>
                    <p className="text-[10px] text-slate-400">التاريخ: {new Date(openMessage.date).toLocaleString("ar-SA")}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={handleReply} size="sm" variant="outline" className="h-8 rounded-lg gap-1 font-bold text-xs" data-testid="button-reply"><Reply className="w-3 h-3" /> رد</Button>
                    <Button onClick={handleForward} size="sm" variant="outline" className="h-8 rounded-lg gap-1 font-bold text-xs" data-testid="button-forward"><Forward className="w-3 h-3" /> إعادة توجيه</Button>
                    <Button onClick={() => deleteMutation.mutate(openMessage.id)} size="sm" variant="outline" className="h-8 rounded-lg gap-1 font-bold text-xs text-red-600 border-red-200 hover:bg-red-50" data-testid="button-delete-message"><Trash2 className="w-3 h-3" /></Button>
                    <Button onClick={() => setOpenMessageId("")} size="sm" variant="ghost" className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {openMessage.htmlBody ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(openMessage.htmlBody, {
                          FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "meta"],
                          FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit", "formaction"],
                          ALLOW_DATA_ATTR: false,
                        }),
                      }}
                    />
                  ) : (
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{openMessage.textBody}</pre>
                  )}
                  {openMessage.attachments?.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">المرفقات</p>
                      <div className="flex flex-wrap gap-2">
                        {openMessage.attachments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                            <Paperclip className="w-3 h-3 text-slate-400" />
                            <span className="font-bold">{a.filename}</span>
                            <span className="text-[10px] text-slate-400">{(a.size / 1024).toFixed(1)} KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <Mail className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400 font-bold">اختر رسالة لعرضها</p>
                  <p className="text-[10px] text-slate-300 mt-1">انقر على أي رسالة من القائمة</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right font-black text-[#2B2B60]">رسالة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">من</Label>
              <Input value={currentAccount?.email || ""} disabled className="h-10 rounded-lg font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs font-bold">إلى *</Label>
              <Input value={composeData.to} onChange={e => setComposeData({ ...composeData, to: e.target.value })} placeholder="email@example.com" dir="ltr" className="h-10 rounded-lg" data-testid="input-compose-to" />
            </div>
            <div>
              <Label className="text-xs font-bold">نسخة (CC)</Label>
              <Input value={composeData.cc} onChange={e => setComposeData({ ...composeData, cc: e.target.value })} placeholder="email1@..., email2@..." dir="ltr" className="h-10 rounded-lg" />
            </div>
            <div>
              <Label className="text-xs font-bold">الموضوع *</Label>
              <Input value={composeData.subject} onChange={e => setComposeData({ ...composeData, subject: e.target.value })} className="h-10 rounded-lg" data-testid="input-compose-subject" />
            </div>
            <div>
              <Label className="text-xs font-bold">المحتوى</Label>
              <Textarea value={composeData.body} onChange={e => setComposeData({ ...composeData, body: e.target.value })} rows={10} className="rounded-lg font-sans" data-testid="input-compose-body" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setComposeOpen(false)} variant="outline">إلغاء</Button>
            <Button onClick={handleSend} disabled={sendMutation.isPending} className="bg-[#2B2B60] text-white gap-2" data-testid="button-send-message">
              {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Management */}
      <AccountDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} accounts={accounts} />
    </div>
  );
}

// ─── Account Dialog (add/manage) ──────────────────────────────────────────
function AccountDialog({ open, onOpenChange, accounts = [] }: { open: boolean; onOpenChange: (b: boolean) => void; accounts?: MailAccount[] }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["admin", "assistant_manager", "tech_support"].includes((user as any)?.role);
  const [showAddForm, setShowAddForm] = useState(accounts.length === 0);
  const [provider, setProvider] = useState("zoho");
  const [form, setForm] = useState({ email: "", password: "", displayName: "", userId: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465 });
  const [testing, setTesting] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Fetch employees (admin only)
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin && open,
  });
  const staffOptions = (employees || []).filter((u: any) =>
    ["admin", "assistant_manager", "tech_support", "accountant", "legal_consultant", "employee", "cashier", "support"].includes(u.role)
  );

  const employeeName = (uid: string) => {
    if (!uid) return "غير معيّن (مشترك)";
    const u = staffOptions.find((x: any) => (x.id || x._id) === uid);
    return u ? `${u.fullName || u.username || u.phone}${u.role ? ` (${u.role})` : ""}` : "غير معروف";
  };

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const presets: any = {
      zoho:    { imapHost: "imap.zoho.com",         imapPort: 993, smtpHost: "smtp.zoho.com",         smtpPort: 465 },
      gmail:   { imapHost: "imap.gmail.com",        imapPort: 993, smtpHost: "smtp.gmail.com",        smtpPort: 465 },
      outlook: { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com",    smtpPort: 587 },
      yandex:  { imapHost: "imap.yandex.com",       imapPort: 993, smtpHost: "smtp.yandex.com",       smtpPort: 465 },
      custom:  { imapHost: "",                       imapPort: 993, smtpHost: "",                       smtpPort: 465 },
    };
    setForm({ ...form, ...presets[p] });
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      setTesting(true);
      const r = await fetch("/api/admin/inbox/accounts/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      return r.json();
    },
    onSuccess: (r: any) => {
      setTesting(false);
      if (r.ok) toast({ title: "✅ الاتصال يعمل", description: "IMAP و SMTP متصلين بنجاح" });
      else toast({ title: "فشل الاتصال", description: r.error || "تحقق من البيانات", variant: "destructive" });
    },
    onError: () => setTesting(false),
  });

  const addMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/inbox/accounts", { ...form, provider }),
    onSuccess: () => {
      toast({ title: "✅ تمت الإضافة", description: "جاري مزامنة الرسائل..." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/accounts"] });
      setForm({ email: "", password: "", displayName: "", userId: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465 });
      setShowAddForm(false);
    },
    onError: (e: any) => toast({ title: "فشلت الإضافة", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/inbox/accounts/${id}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/accounts"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) =>
      apiRequest("PATCH", `/api/admin/inbox/accounts/${id}`, { userId }),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث الإسناد" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/accounts"] });
    },
    onError: (e: any) => toast({ title: "فشل الإسناد", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right font-black text-[#2B2B60]">إدارة صناديق البريد</DialogTitle>
        </DialogHeader>

        {!showAddForm && accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map(a => {
              const pending = assignments[a.id];
              const currentAssign = pending !== undefined ? pending : (a.userId || "");
              return (
                <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2" data-testid={`row-account-${a.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ background: a.color }}>
                      {a.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-[#2B2B60] text-sm">{a.displayName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{a.email}</p>
                    </div>
                    <Badge className="bg-slate-200 text-slate-700">{a.provider}</Badge>
                    <Button onClick={() => deleteMutation.mutate(a.id)} size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" data-testid={`button-delete-account-${a.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <UserCog className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <Label className="text-[10px] font-bold text-slate-500 shrink-0">الموظف:</Label>
                      <Select
                        value={currentAssign || "__none__"}
                        onValueChange={(v) => setAssignments({ ...assignments, [a.id]: v === "__none__" ? "" : v })}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-assign-${a.id}`}>
                          <SelectValue placeholder="اختر موظف" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— غير معيّن (مشترك) —</SelectItem>
                          {staffOptions.map((u: any) => (
                            <SelectItem key={u.id || u._id} value={u.id || u._id}>
                              {u.fullName || u.username || u.phone} · {u.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => assignMutation.mutate({ id: a.id, userId: currentAssign })}
                        disabled={assignMutation.isPending || pending === undefined || pending === (a.userId || "")}
                        size="sm"
                        className="h-8 gap-1 bg-[#2B2B60] text-white text-[10px] font-bold"
                        data-testid={`button-save-assign-${a.id}`}
                      >
                        <Save className="w-3 h-3" /> حفظ
                      </Button>
                    </div>
                  )}
                  {!isAdmin && a.userId && (
                    <p className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-200">
                      <UserCog className="w-3 h-3 inline ml-1" /> معيّن لـ: {employeeName(a.userId)}
                    </p>
                  )}
                </div>
              );
            })}
            <Button onClick={() => setShowAddForm(true)} className="w-full bg-[#DFB369] hover:bg-[#c89853] text-white rounded-xl gap-2 h-11 font-black" data-testid="button-show-add-form">
              <Plus className="w-4 h-4" /> إضافة صندوق جديد
            </Button>
          </div>
        )}

        {showAddForm && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-black mb-2 block">المزوّد</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROVIDER_OPTIONS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-3 rounded-xl border-2 text-right transition-all ${
                      provider === p.id ? "border-[#DFB369] bg-[#DFB369]/10" : "border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid={`button-provider-${p.id}`}
                  >
                    <p className="font-black text-xs text-[#2B2B60]">{p.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">البريد الإلكتروني *</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sales@rfperfume.sa" dir="ltr" className="h-10 rounded-lg" data-testid="input-account-email" />
              </div>
              <div>
                <Label className="text-xs font-bold">الاسم المعروض</Label>
                <Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="قسم المبيعات" className="h-10 rounded-lg" />
              </div>
            </div>

            {isAdmin && (
              <div>
                <Label className="text-xs font-bold">إسناد لموظف</Label>
                <Select value={form.userId || "__none__"} onValueChange={(v) => setForm({ ...form, userId: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="h-10 rounded-lg" data-testid="select-account-user">
                    <SelectValue placeholder="اختر الموظف الذي يملك هذا الصندوق" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— غير معيّن (يراه الأدمن فقط) —</SelectItem>
                    {staffOptions.map((u: any) => (
                      <SelectItem key={u.id || u._id} value={u.id || u._id}>
                        {u.fullName || u.username || u.phone} · {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400 mt-1">الموظف يرى رسائل الإيميل المُسند له فقط. الأدمن يرى كل الإيميلات.</p>
              </div>
            )}

            <div>
              <Label className="text-xs font-bold">App Password *</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="كلمة مرور التطبيق (App Password)" dir="ltr" className="h-10 rounded-lg" data-testid="input-account-password" />
              <p className="text-[10px] text-amber-700 mt-1.5 leading-relaxed">
                ⚠️ استخدم <span className="font-bold">App Password</span> (ليس كلمة المرور الأصلية). تنشأ من إعدادات الحساب في {provider === "zoho" ? "accounts.zoho.com → Security → App Passwords" : provider === "gmail" ? "myaccount.google.com → Security → 2-Step Verification → App passwords" : "إعدادات الأمان للحساب"}.
              </p>
            </div>

            {provider === "custom" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <Label className="text-[10px] font-bold">IMAP Host</Label>
                  <Input value={form.imapHost} onChange={e => setForm({ ...form, imapHost: e.target.value })} dir="ltr" className="h-9 rounded-lg text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold">IMAP Port</Label>
                  <Input type="number" value={form.imapPort} onChange={e => setForm({ ...form, imapPort: +e.target.value })} className="h-9 rounded-lg text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold">SMTP Host</Label>
                  <Input value={form.smtpHost} onChange={e => setForm({ ...form, smtpHost: e.target.value })} dir="ltr" className="h-9 rounded-lg text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold">SMTP Port</Label>
                  <Input type="number" value={form.smtpPort} onChange={e => setForm({ ...form, smtpPort: +e.target.value })} className="h-9 rounded-lg text-xs font-mono" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => testMutation.mutate()}
                disabled={!form.email || !form.password || testing}
                variant="outline"
                className="flex-1 rounded-xl gap-2 font-bold border-slate-300 h-11"
                data-testid="button-test-connection"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                اختبار الاتصال
              </Button>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!form.email || !form.password || addMutation.isPending}
                className="flex-1 bg-[#2B2B60] hover:bg-[#2B2B60]/90 text-white rounded-xl gap-2 font-black h-11"
                data-testid="button-save-account"
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                حفظ وإضافة
              </Button>
            </div>

            {accounts.length > 0 && (
              <button onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-[#2B2B60] font-bold">
                ← عودة للقائمة
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
