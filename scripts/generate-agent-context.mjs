import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const outputDir = path.join(root, "public", "agent");

fs.mkdirSync(outputDir, { recursive: true });

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return `[Fichier absent : ${relativePath}]`;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function page(title, sections) {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "development";

  const body = sections
    .map(
      ({ title, content }) => `
        <section>
          <h2>${escapeHtml(title)}</h2>
          <pre>${escapeHtml(content)}</pre>
        </section>
      `
    )
    .join("\\n");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="Documentation technique publique de Ma Matrice Eisenhower"
  >

  <style>
    body {
      max-width: 1100px;
      margin: 40px auto;
      padding: 0 24px;
      font-family: Arial, sans-serif;
      color: #0f172a;
      line-height: 1.5;
    }

    h1, h2 {
      color: #0f172a;
    }

    .commit {
      padding: 12px;
      background: #f1f5f9;
      border-radius: 8px;
    }

    section {
      margin-top: 36px;
    }

    pre {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 20px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: auto;
    }
  </style>
</head>

<body>

<h1>${escapeHtml(title)}</h1>

<p class="commit">
  Version Git :
  ${escapeHtml(commit)}
</p>

${body}

</body>
</html>`;
}

const projectPage = page(
  "Ma Matrice Eisenhower - Contexte produit",
  [
    {
      title: "Vision produit",
      content: read("docs/PRODUCT_VISION.md"),
    },
    {
      title: "Architecture",
      content: read("docs/ARCHITECTURE.md"),
    },
    {
      title: "Décisions",
      content: read("docs/DECISIONS.md"),
    },
  ]
);

const databasePage = page(
  "Ma Matrice Eisenhower - Base de données",
  [
    {
      title: "Database",
      content: read("docs/DATABASE.md"),
    },
  ]
);

const roadmapPage = page(
  "Ma Matrice Eisenhower - Roadmap",
  [
    {
      title: "Roadmap",
      content: read("docs/ROADMAP.md"),
    },
  ]
);

const codePage = page(
  "Ma Matrice Eisenhower - État actuel du code",
  [
    {
      title: "src/App.jsx",
      content: read("src/App.jsx"),
    },
    {
      title: "src/index.css",
      content: read("src/index.css"),
    },
    {
      title: "src/supabase.js",
      content: read("src/supabase.js"),
    },
    {
      title: "src/ReloadPrompt.jsx",
      content: read("src/ReloadPrompt.jsx"),
    },
    {
      title: "package.json",
      content: read("package.json"),
    },
    {
      title: "vite.config.js",
      content: read("vite.config.js"),
    },
  ]
);

fs.writeFileSync(
  path.join(outputDir, "project.html"),
  projectPage
);

fs.writeFileSync(
  path.join(outputDir, "database.html"),
  databasePage
);

fs.writeFileSync(
  path.join(outputDir, "roadmap.html"),
  roadmapPage
);

fs.writeFileSync(
  path.join(outputDir, "code.html"),
  codePage
);

console.log("Agent context generated.");
