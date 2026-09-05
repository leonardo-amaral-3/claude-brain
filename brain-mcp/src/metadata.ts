import { basename, relative, sep } from "node:path";
import type { RootConfig } from "./config.js";

export interface DocMeta {
  title: string;
  source: string;
  repo: string | null;
  feature: string | null;
  docType: string;
  status: string | null;
  data: string | null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

export function deriveMeta(
  absPath: string,
  root: RootConfig,
  content: string,
  frontmatter: Record<string, unknown>,
  mtimeMs: number
): DocMeta {
  const rel = relative(root.path, absPath).split(sep).join("/");
  const segments = rel.split("/");
  const fileName = basename(absPath);
  const lowerName = fileName.toLowerCase();
  const source = root.source;

  // github: repo e tipo vêm do caminho data/github/docs/<repo>/<cards|prs>/<n>.md
  let repo = root.repo;
  if (source === "github" && segments.length > 2) {
    repo = segments[0];
  }

  // feature: primeira pasta sob um root de planning/docs (pulando _arquivo)
  let feature: string | null = null;
  if ((source === "planning" || source === "docs") && root.recursive !== false && segments.length > 1) {
    feature = segments[0] === "_arquivo" ? (segments.length > 2 ? segments[1] : null) : segments[0];
  }

  // doc_type
  let docType = "doc";
  if (source === "diario") docType = "diario";
  else if (source === "memoria") docType = "memoria";
  else if (source === "mapa") docType = "mapa";
  else if (source === "decisao") docType = "decisao";
  else if (source === "git") docType = "commit";
  else if (source === "code") docType = "code";
  else if (source === "notas") docType = "nota";
  else if (source === "github") docType = segments[1] === "cards" ? "card" : "pr";
  else if (lowerName === "prd.md") docType = "prd";
  else if (lowerName.startsWith("tech-spec")) docType = "tech-spec";
  else if (lowerName === "spec.md") docType = "spec";
  else if (lowerName.startsWith("handoff")) docType = "handoff";
  else if (lowerName.startsWith("changelog")) docType = "changelog";
  else if (lowerName.startsWith("readme")) docType = "readme";
  else if (rel.includes("/tasks/") || segments.includes("tasks")) docType = "task";

  // status
  let status: string | null = null;
  if (source === "github") {
    status = typeof frontmatter.estado === "string" ? frontmatter.estado : null;
  } else if (rel.startsWith("_arquivo/") || rel.includes("/_arquivo/")) {
    status = "arquivado";
  } else if (docType === "task" || docType === "spec" || docType === "tech-spec") {
    const head = content.split("\n", 15);
    for (const line of head) {
      const m = line.match(/status\s*[:：]\s*(.+)/i);
      if (m) {
        status = m[1].replace(/\*/g, "").trim().slice(0, 120);
        break;
      }
    }
  }

  // title
  let title: string;
  if (source === "code") {
    title = rel;
  } else if (source === "memoria" && typeof frontmatter.name === "string") {
    title = frontmatter.name;
  } else {
    const h1 = content.match(/^#\s+(.+)$/m);
    title = h1 ? h1[1].trim() : fileName.replace(/\.md$/i, "");
  }

  // data
  const data =
    toIsoDate(frontmatter.data) ??
    toIsoDate(fileName.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]) ??
    new Date(mtimeMs).toISOString().slice(0, 10);

  return { title, source, repo, feature, docType, status, data };
}
