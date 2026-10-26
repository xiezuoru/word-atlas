import { exportBackup } from "../store/store";

/* 云端备份（QuickForm，混合方案）：
   - 保存：multipart POST，gzip+base64 的进度数据放 data 字段（请求体上限约
     62KB，超限按 save_id 分片），同时把未压缩的备份原文作为 .txt 附件上传，
     作为可在 QuickForm 网页手动下载的归档副本（浏览器因 CORS 无法自动读取）。
   - 读取：GET /all 按 id 过滤，按 save_id 分组重组 data 字段。 */

const ENDPOINT = "https://qf.zmrobo.com/api/dvfesnblum";
const LIST_ENDPOINT = `${ENDPOINT}/all`;
const ORIGIN = "https://qf.zmrobo.com";
/** 单个分片的安全大小（服务器拒绝约 62KB 以上的请求体）。 */
const CHUNK = 48_000;

const canCompress = typeof CompressionStream !== "undefined";

async function gzipToBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzipFromBase64(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export interface CloudSave {
  saveId: string;
  note: string;
  /** 服务器时间（最后一个分片的 submitted_at），如 "2026-10-26 20:00:41"。 */
  time: string;
  cards: number;
  /** 还原后的备份 JSON 文本，可直接交给 importBackup()。 */
  backup: string;
  /** 归档附件的完整 URL（仅首个分片上传，供手动下载恢复）。 */
  attachmentUrl?: string;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
/** 兼容 JSON（number）与 multipart（数字字符串）两种提交形式的整数。 */
const int = (v: unknown) => {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v)) return Number(v);
  return NaN;
};

export async function saveToCloud(id: string, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const backup = JSON.stringify(JSON.parse(exportBackup()));
  let fmt = "raw";
  let payload = backup;
  if (canCompress) {
    try {
      payload = await gzipToBase64(backup);
      fmt = "gz";
    } catch {
      /* 压缩失败时退回原文 */
    }
  }
  const parts: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK) parts.push(payload.slice(i, i + CHUNK));
  if (fmt === "raw" && parts.length > 1) return { ok: false, error: "进度数据太大，且此浏览器不支持压缩，无法保存到 QuickForm。可改用本地导出备份。" };
  const saveId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  for (let c = 0; c < parts.length; c++) {
    const form = new FormData();
    form.set("id", id);
    form.set("note", note);
    form.set("save_id", saveId);
    form.set("chunk", String(c));
    form.set("total", String(parts.length));
    form.set("fmt", fmt);
    form.set("data", parts[c]);
    /* 未压缩原文作归档附件（服务器不接受 .json，用 .txt；仅首个分片携带）。 */
    if (c === 0) form.set("attachment", new Blob([backup], { type: "text/plain" }), "word-atlas-backup.txt");
    let res: Response;
    try {
      res = await fetch(ENDPOINT, { method: "POST", body: form });
    } catch {
      return { ok: false, error: "无法连接 QuickForm，请检查网络后重试。" };
    }
    if (!res.ok) return { ok: false, error: `QuickForm 返回 ${res.status}，保存失败。` };
  }
  return { ok: true };
}

export async function listCloudSaves(id: string): Promise<{ ok: true; saves: CloudSave[] } | { ok: false; error: string }> {
  let rows: Row[];
  try {
    const res = await fetch(LIST_ENDPOINT);
    if (!res.ok) return { ok: false, error: `QuickForm 返回 ${res.status}，读取失败。` };
    const data: unknown = await res.json();
    const subs = data && typeof data === "object" && Array.isArray((data as Row).submissions) ? (data as Row).submissions : [];
    rows = subs as Row[];
  } catch {
    return { ok: false, error: "无法连接 QuickForm，请检查网络后重试。" };
  }
  const want = id.trim().toLowerCase();
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    if (str(r.id).trim().toLowerCase() !== want) continue;
    const key = str(r.save_id);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const saves: CloudSave[] = [];
  for (const [saveId, list] of groups) {
    list.sort((a, b) => int(a.chunk) - int(b.chunk));
    const total = int(list[0].total);
    if (!Number.isInteger(total) || total < 1 || list.length !== total || list.some((r) => int(r.total) !== total)) continue;
    let payload = "";
    let complete = true;
    for (let i = 0; i < total; i++) {
      const data = str(list[i].data);
      if (int(list[i].chunk) !== i || !data) {
        complete = false;
        break;
      }
      payload += data;
    }
    if (!complete) continue;
    const gz = str(list[0].fmt) === "gz" || !payload.startsWith("{");
    let text: string;
    try {
      text = gz ? await gunzipFromBase64(payload) : payload;
    } catch {
      continue;
    }
    let backup: Row | null = null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") backup = parsed as Row;
    } catch {
      /* 跳过损坏的记录 */
    }
    if (!backup || backup.app !== "word-atlas" || backup.version !== 2) continue;
    const progress = backup.progress;
    const cards = progress && typeof progress === "object" && typeof (progress as Row).cards === "object" ? Object.keys((progress as Row).cards as object).length : 0;
    const time = list.reduce((m, r) => (str(r.submitted_at) > m ? str(r.submitted_at) : m), "");
    const att = list.map((r) => str(r.attachment)).find(Boolean);
    saves.push({ saveId, note: str(list[0].note), time, cards, backup: text, attachmentUrl: att ? `${ORIGIN}${att}` : undefined });
  }
  saves.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  return { ok: true, saves };
}
