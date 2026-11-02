import fs from "node:fs";
import path from "node:path";

const source = path.join(process.cwd(), "agent-context");

const target = process.env.EISENHOWER_ONEDRIVE_PATH;

if (!target) {
  console.log(
    "EISENHOWER_ONEDRIVE_PATH non défini : synchronisation OneDrive ignorée."
  );
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });

const files = [
  "code.md",
  "database.md",
  "project.md",
  "roadmap.md",
];

for (const file of files) {
  fs.copyFileSync(
    path.join(source, file),
    path.join(target, file)
  );

  console.log(`Copié vers OneDrive : ${file}`);
}

console.log("Synchronisation locale OneDrive terminée.");