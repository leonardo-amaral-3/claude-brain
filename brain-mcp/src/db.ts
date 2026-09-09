import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = DatabaseSync;

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  // Várias sessões compartilham o mesmo .db. 30 s, e não os 5 s de antes, porque a
  // reindexação completa é UMA transação de 9,3 s (medido em 2026-09-09 sobre o índice de
  // 137 MB): com 5 s, escrita concorrente durante um reindex falhava por construção, não
  // por azar. 30 s cobre a operação mais longa com folga de 3x.
  db.exec("PRAGMA busy_timeout = 30000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      source TEXT NOT NULL,
      indexed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      repo TEXT,
      feature TEXT,
      doc_type TEXT NOT NULL,
      status TEXT,
      data TEXT,
      frontmatter_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_docs_feature ON docs(feature);
    CREATE INDEX IF NOT EXISTS idx_docs_source ON docs(source);
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      doc_id INTEGER NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
      breadcrumb TEXT NOT NULL,
      ord INTEGER NOT NULL,
      text TEXT NOT NULL,
      token_est INTEGER NOT NULL,
      embedding BLOB
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
    CREATE TABLE IF NOT EXISTS entidades (
      id INTEGER PRIMARY KEY,
      tipo TEXT NOT NULL,
      chave TEXT NOT NULL UNIQUE,
      titulo TEXT,
      repo TEXT,
      status TEXT,
      data TEXT,
      doc_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ent_tipo ON entidades(tipo);
    CREATE TABLE IF NOT EXISTS arestas (
      id INTEGER PRIMARY KEY,
      de INTEGER NOT NULL REFERENCES entidades(id) ON DELETE CASCADE,
      para INTEGER NOT NULL REFERENCES entidades(id) ON DELETE CASCADE,
      rel TEXT NOT NULL,
      origem TEXT,
      UNIQUE(de, para, rel)
    );
    CREATE INDEX IF NOT EXISTS idx_arestas_de ON arestas(de);
    CREATE INDEX IF NOT EXISTS idx_arestas_para ON arestas(para);
    CREATE TABLE IF NOT EXISTS decisoes (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,
      data TEXT NOT NULL,
      tipo TEXT NOT NULL,
      escopo TEXT,
      fato TEXT NOT NULL,
      porque TEXT,
      alternativas TEXT,
      refs TEXT,
      doc_path TEXT,
      supersede INTEGER,
      supersedida_por INTEGER,
      embedding BLOB
    );
    CREATE INDEX IF NOT EXISTS idx_decisoes_escopo ON decisoes(escopo);
    CREATE TABLE IF NOT EXISTS uso (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,
      tool TEXT NOT NULL,
      args TEXT,
      ms INTEGER NOT NULL,
      resp_chars INTEGER NOT NULL,
      vazio INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_uso_ts ON uso(ts);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      text, breadcrumb, title,
      tokenize='unicode61 remove_diacritics 2'
    );
    -- Quem detém o direito de fazer o trabalho pesado do índice (ver lease.ts). Uma linha só,
    -- garantida pelo CHECK. Aditiva: banco antigo abre e ganha a tabela vazia, sem backfill.
    CREATE TABLE IF NOT EXISTS lider (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      instancia TEXT NOT NULL,
      pid INTEGER NOT NULL,
      host TEXT NOT NULL,
      inicio INTEGER NOT NULL,
      expira_em INTEGER NOT NULL
    );
    -- Chave/valor do índice. Hoje guarda só versao_indice, o contador que diz a um processo
    -- seguidor que o cache vetorial dele envelheceu.
    CREATE TABLE IF NOT EXISTS meta (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
  return db;
}

export function removeDoc(db: DatabaseSync, path: string): void {
  const doc = db.prepare("SELECT id FROM docs WHERE path = ?").get(path) as { id: number } | undefined;
  if (doc) {
    db.prepare(
      "DELETE FROM chunks_fts WHERE rowid IN (SELECT id FROM chunks WHERE doc_id = ?)"
    ).run(doc.id);
    db.prepare("DELETE FROM chunks WHERE doc_id = ?").run(doc.id);
    db.prepare("DELETE FROM docs WHERE id = ?").run(doc.id);
  }
  db.prepare("DELETE FROM files WHERE path = ?").run(path);
}

export function clearAll(db: DatabaseSync): void {
  db.exec("DELETE FROM chunks_fts; DELETE FROM chunks; DELETE FROM docs; DELETE FROM files;");
}

/**
 * Contador de versão do conteúdo do índice. Existe para o VectorIndex de um processo SEGUIDOR
 * saber que o cache em memória dele ficou velho: ele nunca varre, então nada mais o avisaria.
 * String, e não número, porque é o valor cru da tabela e só se compara por igualdade.
 */
export function versaoIndice(db: DatabaseSync): string {
  const r = db.prepare("SELECT valor FROM meta WHERE chave = 'versao_indice'").get() as unknown as
    | { valor: string }
    | undefined;
  return r ? String(r.valor) : "";
}

/** Só o líder chama: é ele quem muda o conteúdo do índice. */
export function bumpVersaoIndice(db: DatabaseSync): void {
  db.exec(
    "INSERT INTO meta (chave, valor) VALUES ('versao_indice', '1') " +
      "ON CONFLICT(chave) DO UPDATE SET valor = CAST(valor AS INTEGER) + 1"
  );
}
