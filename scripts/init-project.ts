import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

export async function addProject(
  name: string,
  description = ""
) {
  const projectDir = path.join("projects", name);

  await fs.mkdir(projectDir, {
    recursive: true
  });

  const template = {
    name,
    slug: name,
    description,
    status: "incubating",
    repo: "",
    tags: []
  };

  await fs.writeFile(
    path.join(projectDir, "project.yml"),
    yaml.dump(template),
    "utf8"
  );

  await fs.writeFile(
    path.join(projectDir, "README.md"),
    `# ${name}\n\n${description}\n`,
    "utf8"
  );
}