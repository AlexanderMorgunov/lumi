import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.agents/skills');
const folders = await readdir(root, { withFileTypes: true });
const failures = [];
let localOnlyLinks = 0;
for (const folder of folders.filter((entry) => entry.isDirectory())) {
  const file = path.join(root, folder.name, 'SKILL.md');
  const text = await readFile(file, 'utf8');
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (
    !header ||
    !/^name: .+/m.test(header[1]) ||
    !/^description: .+/m.test(header[1])
  )
    failures.push(`${folder.name}: missing frontmatter`);
  const name = header?.[1].match(/^name: (.+)$/m)?.[1].trim();
  if (name !== folder.name)
    failures.push(`${folder.name}: name does not match directory`);
  // Only local Markdown targets; upstream examples and HTTP URLs are not files.
  for (const match of text.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
    if (/^https?:/.test(match[1])) continue;
    try {
      await access(path.resolve(path.dirname(file), match[1]));
    } catch (error) {
      const target = path.resolve(path.dirname(file), match[1]);
      const localOnly =
        target.startsWith(path.resolve('docs') + path.sep) ||
        target === path.resolve('MASTER_PLAN.md');
      // These authoring documents deliberately stay outside Git. Still validate
      // all skill-owned references and every document present in the workspace.
      if (error.code === 'ENOENT' && localOnly) {
        localOnlyLinks++;
        continue;
      }
      failures.push(`${folder.name}: broken link ${match[1]}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Validated ${folders.filter((entry) => entry.isDirectory()).length} skill entrypoints and available Markdown links (${localOnlyLinks} local-only documents absent).`,
  );
