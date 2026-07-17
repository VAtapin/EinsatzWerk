import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = process.cwd();
const sourceDir = path.join(root, ".local", "legacy");
const outputDir = path.join(root, ".local", "analysis", "workbooks");
await fs.mkdir(outputDir, { recursive: true });

const files = ["PLZ-Gebiet.xlsx", "Tourplan2017.xlsx"];
const result = {};

function normalizeValue(value) {
  if (value instanceof Date) {
    return { type: "date", value: value.toISOString() };
  }
  return value;
}

function analyzeMatrix(values) {
  const rows = values.length;
  const cols = values.reduce((max, row) => Math.max(max, row.length), 0);
  const nonEmptyByRow = [];
  const nonEmptyByColumn = Array(cols).fill(0);
  const cells = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = values[rowIndex] ?? [];
    let rowCount = 0;
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const value = row[colIndex];
      if (value !== null && value !== undefined && value !== "") {
        rowCount += 1;
        nonEmptyByColumn[colIndex] += 1;
        cells.push({
          row: rowIndex + 1,
          col: colIndex + 1,
          value: normalizeValue(value),
        });
      }
    }
    nonEmptyByRow.push(rowCount);
  }

  return {
    rows,
    cols,
    nonEmptyCellCount: cells.length,
    nonEmptyByRow,
    nonEmptyByColumn,
    cells,
  };
}

for (const filename of files) {
  const inputPath = path.join(sourceDir, filename);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
  const workbookInspect = await workbook.inspect({
    kind: "workbook,sheet,definedName,drawing",
    maxChars: 12000,
    tableMaxRows: 8,
    tableMaxCols: 16,
    tableMaxCellChars: 120,
  });

  const workbookResult = {
    inspectNdjson: workbookInspect.ndjson,
    sheets: [],
  };

  for (const sheet of workbook.worksheets.items) {
    const usedRange = sheet.getUsedRange(true);
    const values = usedRange ? usedRange.values : [];
    const formulasInspect = await workbook.inspect({
      kind: "formula",
      sheetId: sheet.name,
      maxChars: 6000,
      options: { maxResults: 200 },
    });
    const tablesInspect = await workbook.inspect({
      kind: "table",
      sheetId: sheet.name,
      maxChars: 4000,
      tableMaxRows: 8,
      tableMaxCols: 16,
      tableMaxCellChars: 120,
    });

    const sheetResult = {
      name: sheet.name,
      matrix: analyzeMatrix(values ?? []),
      formulasNdjson: formulasInspect.ndjson,
      tablesNdjson: tablesInspect.ndjson,
    };
    workbookResult.sheets.push(sheetResult);

    try {
      const preview = await workbook.render({
        sheetName: sheet.name,
        autoCrop: "all",
        scale: 1,
        format: "png",
      });
      const safeName = sheet.name.replace(/[<>:"/\\|?*]+/g, "_");
      const previewPath = path.join(
        outputDir,
        `${path.parse(filename).name}--${safeName}.png`,
      );
      await fs.writeFile(
        previewPath,
        new Uint8Array(await preview.arrayBuffer()),
      );
      sheetResult.preview = path.relative(root, previewPath);
    } catch (error) {
      sheetResult.previewError = String(error);
    }
  }

  result[filename] = workbookResult;
}

await fs.writeFile(
  path.join(outputDir, "workbook-profile.json"),
  JSON.stringify(result, null, 2),
  "utf8",
);

const summary = Object.fromEntries(
  Object.entries(result).map(([filename, workbook]) => [
    filename,
    workbook.sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.matrix.rows,
      cols: sheet.matrix.cols,
      nonEmptyCellCount: sheet.matrix.nonEmptyCellCount,
      preview: sheet.preview,
      previewError: sheet.previewError,
    })),
  ]),
);

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
