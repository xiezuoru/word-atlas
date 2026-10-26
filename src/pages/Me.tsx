import { CloudDownload, CloudUpload, Download, FileDown, RotateCcw, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { listCloudSaves, saveToCloud, type CloudSave } from "../lib/quickform";
import { isMastered } from "../store/srs";
import { dayKey, exportBackup, importBackup, resetProgress, store, useStore, type Settings } from "../store/store";
import { toast } from "../ui/Toast";
import { streakOf } from "./Today";

export function Me({ privateAvailable }: { privateAvailable: boolean }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const saveError = useStore((s) => s.saveError);
  const file = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const cards = Object.values(progress.cards);
    const days = Object.values(progress.days);
    const r = days.reduce((n, d) => n + d.r, 0);
    const c = days.reduce((n, d) => n + d.c, 0);
    const t = days.reduce((n, d) => n + d.t, 0);
    const now = Date.now();
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() + i);
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      return cards.filter((x) => (i === 0 ? x.due <= end.getTime() : x.due >= start.getTime() && x.due <= end.getTime())).length;
    });
    void now;
    return { learned: cards.length, mastered: cards.filter(isMastered).length, reviews: r, accuracy: r ? Math.round((c / r) * 100) : 0, minutes: Math.round(t / 60), forecast };
  }, [progress]);

  const set = (patch: Partial<Settings>) => store.settings(patch);
  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `word-atlas-backup-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const restore = async (f: File) => {
    if (f.size > 30 * 1024 * 1024) return toast("文件太大，不像是学习备份。", "warn");
    const r = importBackup(await f.text());
    toast(r.ok ? `已恢复 ${r.cards} 个词的记忆` : r.error, r.ok ? "ok" : "warn");
  };
  const maxF = Math.max(1, ...stats.forecast);

  return (
    <div className="page me">
      <header className="page-head">
        <p className="eyebrow">我的</p>
        <h1 className="display">你的星空</h1>
      </header>

      <section className="stat-strip">
        <div>
          <dt>连续学习</dt>
          <dd>
            {streakOf(progress.days)}
            <small>天</small>
          </dd>
        </div>
        <div>
          <dt>已点亮</dt>
          <dd>{stats.learned.toLocaleString()}</dd>
        </div>
        <div>
          <dt>长期记住</dt>
          <dd>{stats.mastered.toLocaleString()}</dd>
        </div>
        <div>
          <dt>首次正确率</dt>
          <dd>
            {stats.accuracy}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>学习时长</dt>
          <dd>
            {stats.minutes}
            <small>分钟</small>
          </dd>
        </div>
      </section>

      <div className="me-grid">
        <section className="panel">
          <h3 className="eyebrow">过去 20 周</h3>
          <Heatmap days={progress.days} />
          <p className="muted">一格是一天，颜色越深，那天答得越多。「长期记住」指记忆稳定度超过 21 天。</p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">未来 7 天的复习量</h3>
          <ol className="forecast">
            {stats.forecast.map((n, i) => (
              <li key={i}>
                <span style={{ height: `${(n / maxF) * 100}%` }} />
                <b>{n}</b>
                <small>{i === 0 ? "今天" : i === 1 ? "明天" : `+${i}`}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel settings">
          <h3 className="eyebrow">学习设置</h3>
          <Field label="每日新词" hint="复习不设上限，算法只安排快要遗忘的词。">
            <div className="segmented">
              {[5, 10, 15, 20, 30].map((n) => (
                <button key={n} className={settings.dailyNew === n ? "is-on" : ""} onClick={() => set({ dailyNew: n })}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="从哪个难度开始" hint="跳过已经熟悉的低级别词。">
            <div className="segmented">
              {atlas.cefr.map((l, i) => (
                <button key={l} className={settings.startLevel === i ? "is-on" : ""} onClick={() => set({ startLevel: i })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="目标记忆率" hint="越高复习越频繁。90% 是大多数人的甜点。">
            <div className="segmented">
              {[0.85, 0.9, 0.95].map((n) => (
                <button key={n} className={settings.retention === n ? "is-on" : ""} onClick={() => set({ retention: n })}>
                  {Math.round(n * 100)}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="发音">
            <div className="segmented">
              <button className={settings.accent === "uk" ? "is-on" : ""} onClick={() => set({ accent: "uk" })}>
                英式
              </button>
              <button className={settings.accent === "us" ? "is-on" : ""} onClick={() => set({ accent: "us" })}>
                美式
              </button>
            </div>
          </Field>
          <Field label="外观">
            <div className="segmented">
              {(
                [
                  ["system", "跟随系统"],
                  ["light", "浅色"],
                  ["dark", "深色"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? "is-on" : ""} onClick={() => set({ theme: k })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Toggle label="自动播放发音" on={settings.autoplay} set={(v) => set({ autoplay: v })} />
          <Toggle label="界面音效" on={settings.sfx} set={(v) => set({ sfx: v })} />
          <Toggle label="开屏动画（每天一次）" on={settings.splash} set={(v) => set({ splash: v })} />
          <Toggle label="复习时加入拼写题" on={settings.spell} set={(v) => set({ spell: v })} />
          {privateAvailable && (
            <Field label="词库" hint="私人词库只在本机开发服务器中可用，不会被打包发布。">
              <div className="segmented">
                <button className={settings.dataset === "open" ? "is-on" : ""} onClick={() => set({ dataset: "open" })}>
                  开放图鉴
                </button>
                <button className={settings.dataset === "private" ? "is-on" : ""} onClick={() => set({ dataset: "private" })}>
                  私人 8000
                </button>
              </div>
            </Field>
          )}
        </section>

        <section className="panel">
          <h3 className="eyebrow">数据（本地）</h3>
          <p className="muted">进度只存在这台设备的浏览器里。换设备时，可以导出备份再导入，或保存到 QuickForm。</p>
          {saveError && <p className="warn-text">浏览器拒绝保存（可能是隐私模式或空间已满）。请尽快导出备份。</p>}
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={download}>
              <Download size={18} /> 导出备份
            </button>
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>
              <Upload size={18} /> 导入备份
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0]).finally(() => (e.target.value = ""))} />
            <button
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (confirm("确定清空这个词库的全部学习记录？此操作无法撤销，建议先导出备份。")) {
                  resetProgress();
                  toast("学习记录已清空");
                }
              }}
            >
              <RotateCcw size={18} /> 清空记录
            </button>
          </div>
        </section>

        <section className="panel">
          <QuickFormCard />
        </section>
      </div>
    </div>
  );
}

/* ---------- 数据（QuickForm）---------- */

const QF_KEY = "word-atlas:quickform";

function readQf(): { id?: string; note?: string } {
  try {
    const v = JSON.parse(localStorage.getItem(QF_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function QuickFormCard() {
  const [id, setId] = useState(readQf().id ?? "");
  const [note, setNote] = useState(readQf().note ?? "");
  const [busy, setBusy] = useState<"save" | "load" | null>(null);
  const [error, setError] = useState("");
  const [saves, setSaves] = useState<CloudSave[] | null>(null);

  const remember = () => {
    try {
      localStorage.setItem(QF_KEY, JSON.stringify({ id: id.trim(), note: note.trim() }));
    } catch {
      /* 隐私模式下静默跳过 */
    }
  };

  const save = async () => {
    const email = id.trim();
    if (!email) return setError("请先填写你的邮箱 id。");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("id 需要使用邮箱地址。");
    setError("");
    setBusy("save");
    const r = await saveToCloud(email, note.trim().slice(0, 100));
    setBusy(null);
    if (r.ok) {
      remember();
      toast("进度已保存到 QuickForm。", "ok");
    } else setError(r.error);
  };

  const load = async () => {
    const email = id.trim();
    if (!email) return setError("请先填写你的邮箱 id。");
    setError("");
    setBusy("load");
    setSaves(null);
    const r = await listCloudSaves(email);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    remember();
    setSaves(r.saves);
  };

  const restore = (s: CloudSave) => {
    if (!confirm(`导入 ${s.time}（${s.note || "无说明"}）的进度？当前本机的学习记录会被覆盖。`)) return;
    const r = importBackup(s.backup);
    toast(r.ok ? `已恢复 ${r.cards} 个词的记忆` : r.error, r.ok ? "ok" : "warn");
  };

  return (
    <>
      <h3 className="eyebrow">数据（QuickForm）</h3>
      <p className="muted">可以将学习进度保存到 QuickForm，随时导入。请使用自己的邮箱地址作为 id，并简要写一句进度说明（如，在温科高AI科创中心）。</p>
      <div className="qf-fields">
        <label>
          <span>id（邮箱）</span>
          <input type="email" value={id} maxLength={100} placeholder="you@example.com" onChange={(e) => setId(e.target.value)} />
        </label>
        <label>
          <span>进度说明</span>
          <input type="text" value={note} maxLength={100} placeholder="如：在温科高AI科创中心" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="data-actions">
        <button className="btn btn-ghost" onClick={save} disabled={busy !== null}>
          <CloudUpload size={18} /> 保存进度
        </button>
        <button className="btn btn-ghost" onClick={load} disabled={busy !== null}>
          <CloudDownload size={18} /> 读取进度
        </button>
      </div>
      {busy === "save" && <p className="muted qf-status">正在保存…</p>}
      {busy === "load" && <p className="muted qf-status">正在读取…</p>}
      {error && <p className="warn-text qf-status">{error}</p>}
      {saves && saves.length === 0 && <p className="muted qf-status">没有找到这个 id 的进度。确认 id 无误后，先在原设备保存。</p>}
      {saves && saves.length > 0 && (
        <ul className="qf-saves">
          {saves.map((s) => (
            <li key={s.saveId}>
              <div>
                <b>{s.time}</b>
                <small>
                  {s.note || "（无说明）"} · {s.cards} 词
                </small>
              </div>
              <div className="qf-item-actions">
                {s.attachmentUrl && (
                  <a
                    className="btn btn-ghost"
                    href={s.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="下载归档文件（浏览器无法自动读取时，可手动下载后用本地导入恢复）"
                  >
                    <FileDown size={18} />
                  </a>
                )}
                <button className="btn btn-ghost" onClick={() => restore(s)} disabled={busy !== null}>
                  导入
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="field toggle">
      <b>{label}</b>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

function Heatmap({ days }: { days: Record<string, { r: number }> }) {
  const weeks = 20;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay());
  const cells: { k: string; v: number; future: boolean }[] = [];
  const d = new Date(start);
  for (let i = 0; i < (weeks + 1) * 7; i++) {
    const k = dayKey(d);
    cells.push({ k, v: days[k]?.r ?? 0, future: d > end });
    d.setDate(d.getDate() + 1);
  }
  const lvl = (v: number) => (v === 0 ? 0 : v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : 4);
  return (
    <div className="heatmap" role="img" aria-label="学习热力图">
      {cells.map((c) => (
        <span key={c.k} className={`h${c.future ? "x" : lvl(c.v)}`} title={`${c.k} · ${c.v} 题`} />
      ))}
    </div>
  );
}
