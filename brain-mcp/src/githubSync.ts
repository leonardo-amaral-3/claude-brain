import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface GithubConfig {
  repos: string[]; // "ICSF-Solutions/modulo-processos"
  syncIntervalMin: number;
  commentsSinceDays: number;
  maxItems: number;
}

interface Comment {
  id: number;
  autor: string;
  data: string;
  body: string;
  arquivo?: string; // review comment: arquivo comentado
}

interface Item {
  kind: "card" | "pr";
  number: number;
  title: string;
  body: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  closedAt?: string | null;
  author: string;
  labels: string[];
  headRefName?: string;
  baseRefName?: string;
  comments: Comment[];
}

interface RepoCache {
  items: Record<string, Item>;
}

interface SyncState {
  lastSyncIso: string | null;
  lastError: string | null;
  commentsSince: Record<string, string>;
}

export interface GithubSyncStats {
  repos: number;
  itemsWritten: number;
  newComments: number;
  errors: string[];
  ms: number;
}

function gh(args: string[]): string {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
}

function shortName(repo: string): string {
  return repo.split("/")[1] ?? repo;
}

function isoDay(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function itemToMarkdown(repoFull: string, item: Item): string {
  const kindUrl = item.kind === "pr" ? "pull" : "issues";
  const url = `https://github.com/${repoFull}/${kindUrl}/${item.number}`;
  const fm = [
    "---",
    `data: ${isoDay(item.updatedAt)}`,
    `tipo: ${item.kind}`,
    `numero: ${item.number}`,
    `estado: ${item.state}`,
    `autor: ${item.author}`,
    `criado: ${isoDay(item.createdAt)}`,
    item.mergedAt ? `mergeado: ${isoDay(item.mergedAt)}` : null,
    item.closedAt ? `fechado: ${isoDay(item.closedAt)}` : null,
    item.labels.length ? `labels: ${JSON.stringify(item.labels)}` : null,
    item.headRefName ? `branch: ${JSON.stringify(item.headRefName + " -> " + (item.baseRefName ?? ""))}` : null,
    `url: ${url}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const head = `# [${item.kind} #${item.number}] ${item.title}`;
  const parts = [fm, "", head, "", item.body?.trim() || "_(sem descrição)_"];
  if (item.comments.length) {
    parts.push("", "## Comentários", "");
    for (const c of [...item.comments].sort((a, b) => a.data.localeCompare(b.data))) {
      const where = c.arquivo ? ` (em \`${c.arquivo}\`)` : "";
      parts.push(`### ${c.autor} — ${isoDay(c.data)}${where}`, "", c.body?.trim() || "", "");
    }
  }
  return parts.join("\n") + "\n";
}

export class GithubSyncer {
  private running: Promise<GithubSyncStats> | null = null;

  constructor(
    private cfg: GithubConfig,
    private dataDir: string, // .../data/github
    private afterSync: () => void
  ) {}

  get docsDir(): string {
    return join(this.dataDir, "docs");
  }

  private get statePath(): string {
    return join(this.dataDir, "state.json");
  }

  readState(): SyncState {
    try {
      return JSON.parse(readFileSync(this.statePath, "utf8")) as SyncState;
    } catch {
      return { lastSyncIso: null, lastError: null, commentsSince: {} };
    }
  }

  isStale(): boolean {
    const st = this.readState();
    if (!st.lastSyncIso) return true;
    return Date.now() - Date.parse(st.lastSyncIso) > this.cfg.syncIntervalMin * 60_000;
  }

  /** Dispara sync em segundo plano se estiver velho. Retorna o estado da decisão. */
  kickIfStale(): "started" | "running" | "fresh" {
    if (this.running) return "running";
    if (!this.isStale()) return "fresh";
    this.running = this.doSync()
      .catch((err) => {
        console.error("[brain] sync GitHub falhou:", err);
        return { repos: 0, itemsWritten: 0, newComments: 0, errors: [String(err)], ms: 0 };
      })
      .finally(() => {
        this.running = null;
      });
    return "started";
  }

  async syncNow(): Promise<GithubSyncStats> {
    if (this.running) return this.running;
    this.running = this.doSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async doSync(): Promise<GithubSyncStats> {
    const t0 = Date.now();
    const startedIso = new Date().toISOString();
    const state = this.readState();
    const stats: GithubSyncStats = { repos: 0, itemsWritten: 0, newComments: 0, errors: [], ms: 0 };
    mkdirSync(join(this.dataDir, "cache"), { recursive: true });

    for (const repoFull of this.cfg.repos) {
      const short = shortName(repoFull);
      const cachePath = join(this.dataDir, "cache", `${short}.json`);
      let cache: RepoCache = { items: {} };
      try {
        if (existsSync(cachePath)) cache = JSON.parse(readFileSync(cachePath, "utf8")) as RepoCache;
      } catch {
        cache = { items: {} };
      }

      try {
        const max = String(this.cfg.maxItems);
        const issues = JSON.parse(
          gh([
            "issue", "list", "--repo", repoFull, "--state", "all", "--limit", max,
            "--json", "number,title,body,state,createdAt,updatedAt,closedAt,labels,author",
          ])
        ) as Array<Record<string, unknown>>;
        const prs = JSON.parse(
          gh([
            "pr", "list", "--repo", repoFull, "--state", "all", "--limit", max,
            "--json", "number,title,body,state,createdAt,updatedAt,mergedAt,labels,author,headRefName,baseRefName",
          ])
        ) as Array<Record<string, unknown>>;

        const changed = new Set<string>();
        const upsert = (raw: Record<string, unknown>, kind: "card" | "pr") => {
          const number = raw.number as number;
          const key = `${kind}-${number}`;
          const prev = cache.items[key];
          const item: Item = {
            kind,
            number,
            title: String(raw.title ?? ""),
            body: String(raw.body ?? ""),
            state: String(raw.state ?? ""),
            createdAt: String(raw.createdAt ?? ""),
            updatedAt: String(raw.updatedAt ?? ""),
            mergedAt: (raw.mergedAt as string) ?? null,
            closedAt: (raw.closedAt as string) ?? null,
            author: String((raw.author as { login?: string })?.login ?? ""),
            labels: ((raw.labels as Array<{ name: string }>) ?? []).map((l) => l.name),
            headRefName: (raw.headRefName as string) ?? undefined,
            baseRefName: (raw.baseRefName as string) ?? undefined,
            comments: prev?.comments ?? [],
          };
          cache.items[key] = item;
          if (!prev || prev.updatedAt !== item.updatedAt) changed.add(key);
        };
        for (const i of issues) upsert(i, "card");
        for (const p of prs) upsert(p, "pr");

        // comentários novos desde o último sync (issues+PRs conversas, e review comments de PR)
        const since =
          state.commentsSince[repoFull] ??
          new Date(Date.now() - this.cfg.commentsSinceDays * 86_400_000).toISOString();
        const parseNd = (out: string): Array<Record<string, unknown>> =>
          out
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => JSON.parse(l) as Record<string, unknown>);

        const issueComments = parseNd(
          gh(["api", `repos/${repoFull}/issues/comments?since=${since}&per_page=100`, "--paginate", "--jq", ".[]"])
        );
        const reviewComments = parseNd(
          gh(["api", `repos/${repoFull}/pulls/comments?since=${since}&per_page=100`, "--paginate", "--jq", ".[]"])
        );

        const addComment = (raw: Record<string, unknown>, fromReview: boolean) => {
          const srcUrl = String((fromReview ? raw.pull_request_url : raw.issue_url) ?? "");
          const number = Number(srcUrl.split("/").pop());
          if (!number) return;
          const key = fromReview
            ? `pr-${number}`
            : cache.items[`card-${number}`]
              ? `card-${number}`
              : `pr-${number}`;
          const item = cache.items[key];
          if (!item) return;
          const id = raw.id as number;
          if (item.comments.some((c) => c.id === id)) return;
          item.comments.push({
            id,
            autor: String((raw.user as { login?: string })?.login ?? ""),
            data: String(raw.created_at ?? ""),
            body: String(raw.body ?? ""),
            arquivo: fromReview ? String(raw.path ?? "") || undefined : undefined,
          });
          changed.add(key);
          stats.newComments++;
        };
        for (const c of issueComments) addComment(c, false);
        for (const c of reviewComments) addComment(c, true);

        // materializa arquivos .md dos itens alterados (ou ainda não escritos)
        for (const key of Object.keys(cache.items)) {
          const item = cache.items[key];
          const dir = join(this.docsDir, short, item.kind === "card" ? "cards" : "prs");
          const filePath = join(dir, `${item.number}.md`);
          if (!changed.has(key) && existsSync(filePath)) continue;
          mkdirSync(dir, { recursive: true });
          writeFileSync(filePath, itemToMarkdown(repoFull, item), "utf8");
          stats.itemsWritten++;
        }

        writeFileSync(cachePath, JSON.stringify(cache), "utf8");
        state.commentsSince[repoFull] = startedIso;
        stats.repos++;
      } catch (err) {
        stats.errors.push(`${repoFull}: ${(err as Error).message?.split("\n")[0]}`);
      }
    }

    state.lastSyncIso = startedIso;
    state.lastError = stats.errors.length ? stats.errors.join("; ") : null;
    writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf8");
    stats.ms = Date.now() - t0;
    try {
      this.afterSync();
    } catch (err) {
      console.error("[brain] scan pós-sync falhou:", err);
    }
    return stats;
  }
}
