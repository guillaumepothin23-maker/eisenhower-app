import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// Sortie HTML actuelle pour Vercel
const htmlOutputDir = path.join(root, "public", "agent");

// Sortie Markdown destinée à OneDrive / Copilot
const mdOutputDir = path.join(root, "agent-context");

fs.mkdirSync(htmlOutputDir, { recursive: true });
fs.mkdirSync(mdOutputDir, { recursive: true });

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

function getCommit() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "development"
  );
}

/* =========================================================
   HTML - génération actuelle conservée pour Vercel
   ========================================================= */

function page(title, sections) {
  const commit = getCommit();

  const body = sections
    .map(
      ({ title, content }) => `
        <section>
          <h2>${escapeHtml(title)}</h2>
          <pre>${escapeHtml(content)}</pre>
        </section>
      `
    )
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="Documentation technique de Ma Matrice Eisenhower"
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

/* =========================================================
   MARKDOWN - connaissance structurée pour Copilot
   ========================================================= */

function markdownDocument(title, sections) {
  const commit = getCommit();

  const body = sections
    .map(
      ({ title, content, language = "" }) => `## ${title}

\`\`\`${language}
${content}
\`\`\`
`
    )
    .join("\n---\n\n");

  return `# ${title}

Version Git : ${commit}

${body}
`;
}

function codeDocument(files) {
  const commit = getCommit();

  const inventory = files
    .map(({ path: filePath }) => `- ${filePath}`)
    .join("\n");

  const body = files
    .map(
      ({ path: filePath, language }) => `# FILE: ${filePath}

Path: ${filePath}
Type: application source file

\`\`\`${language}
${read(filePath)}
\`\`\`
`
    )
    .join("\n---\n\n");

  return `# Ma Matrice Eisenhower - État actuel du code source

Ce document contient le code source actuel de l'application Ma Matrice Eisenhower.

Version Git : ${commit}

## Inventaire des fichiers source

${inventory}

---

${body}
`;
}

/* =========================================================
   Définition du code source
   ========================================================= */

const sourceFiles = [
  {
    path: "src/App.jsx",
    language: "jsx",
  },
  {
    path: "src/main.jsx",
    language: "jsx",
  },
  {
    path: "src/index.css",
    language: "css",
  },
  {
    path: "src/supabase.js",
    language: "javascript",
  },
  {
    path: "src/ReloadPrompt.jsx",
    language: "jsx",
  },
  {
    path: "package.json",
    language: "json",
  },
  {
    path: "vite.config.js",
    language: "javascript",
  },
];

/* =========================================================
   HTML
   ========================================================= */

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
  sourceFiles.map(({ path: filePath }) => ({
    title: filePath,
    content: read(filePath),
  }))
);

fs.writeFileSync(
  path.join(htmlOutputDir, "project.html"),
  projectPage
);

fs.writeFileSync(
  path.join(htmlOutputDir, "database.html"),
  databasePage
);

fs.writeFileSync(
  path.join(htmlOutputDir, "roadmap.html"),
  roadmapPage
);

fs.writeFileSync(
  path.join(htmlOutputDir, "code.html"),
  codePage
);

/* =========================================================
   MARKDOWN POUR COPILOT
   ========================================================= */

const projectMarkdown = markdownDocument(
  "Ma Matrice Eisenhower - Contexte produit",
  [
    {
      title: "Vision produit",
      content: read("docs/PRODUCT_VISION.md"),
      language: "markdown",
    },
    {
      title: "Architecture",
      content: read("docs/ARCHITECTURE.md"),
      language: "markdown",
    },
    {
      title: "Décisions",
      content: read("docs/DECISIONS.md"),
      language: "markdown",
    },
  ]
);

const databaseMarkdown = markdownDocument(
  "Ma Matrice Eisenhower - Base de données",
  [
    {
      title: "Database",
      content: read("docs/DATABASE.md"),
      language: "markdown",
    },
  ]
);

const roadmapMarkdown = markdownDocument(
  "Ma Matrice Eisenhower - Roadmap",
  [
    {
      title: "Roadmap",
      content: read("docs/ROADMAP.md"),
      language: "markdown",
    },
  ]
);

const codeMarkdown = codeDocument(sourceFiles);

fs.writeFileSync(
  path.join(mdOutputDir, "project.md"),
  projectMarkdown
);

fs.writeFileSync(
  path.join(mdOutputDir, "database.md"),
  databaseMarkdown
);

fs.writeFileSync(
  path.join(mdOutputDir, "roadmap.md"),
  roadmapMarkdown
);

fs.writeFileSync(
  path.join(mdOutputDir, "code.md"),
  codeMarkdown
);

console.log("Agent context generated.");
console.log(`HTML: ${htmlOutputDir}`);
console.log(`Markdown: ${mdOutputDir}`);