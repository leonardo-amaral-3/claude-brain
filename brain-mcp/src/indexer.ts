import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import matter from "gray-matter";
import type { DatabaseSync } from "node:sqlite";
import type { BrainConfig, RootConfig } from "./config.js";
import { removeDoc, clearAll } from "./db.js";
import { deriveMeta } from "./metadata.js";

interface Chunk {
  breadcrumb: string;
  text: string;
}

const MERGE_TARGET = 2200; // junta seções vizinhas até este tamanho
const SPLIT_LIMIT = 4800; // seções maiores que isto são quebradas
const PIECE_TARGET = 3200;

function splitByParagraphs(text: string, target: number): string[] {
  const paras = text.split(/\n{2,}/);
  const pieces: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > target) {
      pieces.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) pieces.push(cur);
  return pieces;
}

export function chunkMarkdown(content: string, title: string): Chunk[] {
  const lines = content.split("\n");
  interface Section {
    crumb: string[];
    lines: string[];
    level: number;
  }
  const sections: Section[] = [{ crumb: [], lines: [], level: 0 }];
  const stack: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      stack.length = level - 1;
      stack[level - 1] = m[2].trim();
      sections.push({ crumb: stack.slice(0, level), lines: [line], level });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  // materializa, quebra grandes, junta pequenas
  const raw: Chunk[] = [];
  for (const s of sections) {
    const text = s.lines.join("\n").trim();
    if (!text) continue;
    const crumb = [title, ...s.crumb.filter((c) => c && c !== title)].join(" > ");
    if (text.length > SPLIT_LIMIT) {
      const pieces = splitByParagraphs(text, PIECE_TARGET);
      pieces.forEach((p, i) => raw.push({ breadcrumb: i === 0 ? crumb : `${crumb} (cont. ${i + 1})`, text: p }));
    } else {
      raw.push({ breadcrumb: crumb, text });
    }
  }

  const merged: Chunk[] = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.text.length + c.text.length + 2 <= MERGE_TARGET) {
      prev.text += "\n\n" + c.text;
    } else {
      merged.push({ ...c });
    }
  }
  return merged;
}

export function chunkCode(content: string, relPath: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  let start = 0;
  let buf: string[] = [];
  let size = 0;
  const flush = (end: number) => {
    const text = buf.join("\n").trim();
    if (text) chunks.push({ breadcrumb: `${relPath}:${start + 1}-${end}`, text });
    buf = [];
    size = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    if (buf.length === 0) start = i;
    buf.push(lines[i]);
    size += lines[i].length + 1;
    const atBlank = lines[i].trim() === "";
    if ((buf.length >= 70 && atBlank) || size >= 3500 || buf.length >= 130) {
      flush(i + 1);
    }
  }
  flush(lines.length);
  return chunks;
}

interface WalkedFile {
  path: string;
  mtime: number;
  size: number;
}

function walk(dir: string, cfg: BrainConfig, root: RootConfig, out: WalkedFile[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (root.recursive === false) continue;
      if (cfg.excludeDirs.includes(e.name)) continue;
      walk(full, cfg, root, out);
    } else if (e.isFile()) {
      const isCode = root.kind === "code";
      const ext = extname(e.name).toLowerCase();
      if (isCode) {
        if (!cfg.codeExtensions.includes(ext)) continue;
      } else {
        if (ext !== ".md") continue;
      }
      if (cfg.excludeFiles.includes(e.name)) continue;
      if (root.excludeFiles?.includes(e.name)) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (isCode && st.size > cfg.maxCodeFileBytes) continue;
      out.push({ path: full, mtime: Math.floor(st.mtimeMs), size: st.size });
    }
  }
}

export interface ScanStats {
  scanned: number;
  indexed: number;
  removed: number;
  ms: number;
}

export class Indexer {
  private lastScan = 0;

  constructor(
    private db: DatabaseSync,
    private cfg: BrainConfig,
    // avisa quem depende do conteudo (indice vetorial, grafo) que a base mudou
    private aoMudar: () => void = () => {}
  ) {}

  get roots(): RootConfig[] {
    return this.cfg.roots;
  }

  scanIfStale(maxAgeMs: number): void {
    if (Date.now() - this.lastScan > maxAgeMs) {
      try {
        this.scan();
      } catch (err) {
        console.error("[brain] staleness scan falhou:", err);
      }
    }
  }

  fullReindex(): ScanStats {
    clearAll(this.db);
    return this.scan();
  }

  scan(): ScanStats {
    const t0 = Date.now();
    const seen = new Map<string, { file: WalkedFile; root: RootConfig }>();
    for (const root of this.cfg.roots) {
      if (!existsSync(root.path)) continue;
      const files: WalkedFile[] = [];
      walk(root.path, this.cfg, root, files);
      for (const f of files) {
        // primeiro root que reivindica o arquivo vence (roots de code não pegam .md, então não colidem com docs)
        if (!seen.has(f.path)) seen.set(f.path, { file: f, root });
      }
    }

    const known = new Map<string, { mtime: number; size: number }>();
    const rows = this.db.prepare("SELECT path, mtime, size FROM files").all() as {
      path: string;
      mtime: number;
      size: number;
    }[];
    for (const r of rows) known.set(r.path, { mtime: r.mtime, size: r.size });

    let indexed = 0;
    let removed = 0;
    this.db.exec("BEGIN");
    try {
      for (const [path, { file, root }] of seen) {
        const prev = known.get(path);
        if (!prev || prev.mtime !== file.mtime || prev.size !== file.size) {
          this.indexFile(file, root);
          indexed++;
        }
      }
      for (const path of known.keys()) {
        if (!seen.has(path)) {
          removeDoc(this.db, path);
          removed++;
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
    this.lastScan = Date.now();
    if (indexed || removed) this.aoMudar();
    return { scanned: seen.size, indexed, removed, ms: Date.now() - t0 };
  }

  private indexFile(file: WalkedFile, root: RootConfig): void {
    removeDoc(this.db, file.path);
    const rawContent = readFileSync(file.path, "utf8");
    const isCode = root.kind === "code";

    let body = rawContent;
    let fm: Record<string, unknown> = {};
    if (!isCode) {
      try {
        const parsed = matter(rawContent);
        body = parsed.content;
        fm = parsed.data ?? {};
      } catch {
        // frontmatter inválido: indexa o conteúdo cru
      }
    }

    const meta = deriveMeta(file.path, root, body, fm, file.mtime);

    // descrição de notas de memória entra no texto indexado (ajuda o recall)
    if (root.source === "memoria" && typeof fm.description === "string") {
      body = fm.description + "\n\n" + body;
    }

    const relPath = relative(root.path, file.path).split(sep).join("/");
    const chunks = isCode ? chunkCode(body, relPath) : chunkMarkdown(body, meta.title);

    const docRes = this.db
      .prepare(
        `INSERT INTO docs (path, title, source, repo, feature, doc_type, status, data, frontmatter_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        file.path,
        meta.title,
        meta.source,
        meta.repo,
        meta.feature,
        meta.docType,
        meta.status,
        meta.data,
        Object.keys(fm).length ? JSON.stringify(fm) : null
      );
    const docId = Number(docRes.lastInsertRowid);

    const insChunk = this.db.prepare(
      "INSERT INTO chunks (doc_id, breadcrumb, ord, text, token_est) VALUES (?, ?, ?, ?, ?)"
    );
    const insFts = this.db.prepare(
      "INSERT INTO chunks_fts (rowid, text, breadcrumb, title) VALUES (?, ?, ?, ?)"
    );
    chunks.forEach((c, i) => {
      const res = insChunk.run(docId, c.breadcrumb, i, c.text, Math.ceil(c.text.length / 4));
      insFts.run(Number(res.lastInsertRowid), c.text, c.breadcrumb, meta.title);
    });

    this.db
      .prepare(
        "INSERT INTO files (path, mtime, size, source, indexed_at) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, size=excluded.size, source=excluded.source, indexed_at=excluded.indexed_at"
      )
      .run(file.path, file.mtime, file.size, root.source, Date.now());
  }
}
