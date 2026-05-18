import fs from "fs/promises";

export async function syncReadme() {
  const raw = await fs.readFile("portfolio/projects.json", "utf8");

  const projects = JSON.parse(raw);

  const table =
    projects.length > 0
      ? projects
          .map(
            (p: any) =>
              `| [${p.slug}](./projects/${p.slug}/) | ${p.description || ""} | ${p.status || "incubating"} |`,
          )
          .join("\n")
      : "| No projects found |  |  |";

  const template = await fs.readFile("templates/README.template.md", "utf8");

  const output = template.replace("{{PROJECT_TABLE}}", table);

  await fs.writeFile("README.md", output, "utf8");

  console.log("README synced.");
}
