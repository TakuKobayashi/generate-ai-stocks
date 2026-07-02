export interface TableRow {
  [key: string]: string;
}

export interface ParsedTable {
  headers: string[];
  rows: TableRow[];
  rawMarkdown: string;
}

/**
 * Fetch the raw README.md content from a public GitHub repository.
 */
export async function fetchGitHubReadme(
  owner: string,
  repo: string
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "github-kv-chat/1.0",
      Accept: "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch README: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

/**
 * Extract all markdown tables from a README string.
 * Returns an array of ParsedTable objects.
 *
 * Markdown table format:
 * | Header1 | Header2 | Header3 |
 * |---------|---------|---------|
 * | value1  | value2  | value3  |
 */
export function parseMarkdownTables(markdown: string): ParsedTable[] {
  const tables: ParsedTable[] = [];

  // Split into lines and scan for table blocks
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // A markdown table row starts and ends with |
    if (!isTableRow(line)) {
      i++;
      continue;
    }

    // Collect the full block of table lines
    const tableLines: string[] = [];
    while (i < lines.length && isTableRow(lines[i].trim())) {
      tableLines.push(lines[i].trim());
      i++;
    }

    if (tableLines.length < 2) continue; // need header + separator at minimum

    const parsed = parseTableBlock(tableLines);
    if (parsed) {
      tables.push(parsed);
    }
  }

  return tables;
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  // Separator rows look like: |---|---|---| or |:---:|---:|:---|
  return /^\|[\s|:\-]+\|$/.test(line);
}

function parseTableBlock(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  const separatorLine = lines[1];

  if (!isSeparatorRow(separatorLine)) return null;

  const headers = splitTableRow(headerLine);
  if (headers.length === 0) return null;

  const rows: TableRow[] = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]);
    const row: TableRow = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    rawMarkdown: lines.join("\n"),
  };
}

function splitTableRow(line: string): string[] {
  // Remove leading and trailing |, then split by |
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * TODO: Implement your own table selection logic here.
 * This function receives all parsed tables from the README and should
 * return the specific table data you want to store in KV.
 *
 * Example: return tables[0] to get the first table.
 * Or filter by header names: tables.find(t => t.headers.includes("Name"))
 */
export function selectTargetTable(
  tables: ParsedTable[]
): ParsedTable | undefined {
  // TODO: customize this to select the right table
  return tables[0];
}
