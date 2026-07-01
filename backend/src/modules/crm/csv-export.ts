export type ExportColumnMap = Record<string, string | number | null | undefined>;

export function toCsv(rows: ExportColumnMap[]): string {
  if (rows.length === 0) {
    return '';
  }

  const firstRow = rows[0];
  if (!firstRow) {
    return '';
  }
  const headers = Object.keys(firstRow);
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ];

  return `${lines.join('\n')}\n`;
}

export function toSpreadsheetXml(rows: ExportColumnMap[]): string {
  const firstRow = rows[0];
  const headers = firstRow ? Object.keys(firstRow) : [];
  const tableRows = [
    headers,
    ...rows.map((row) => headers.map((header) => String(row[header] ?? '')))
  ];

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Prospects" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Table>
${tableRows
  .map(
    (row) =>
      `      <Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`
  )
  .join('\n')}
    </Table>
  </Worksheet>
</Workbook>
`;
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? '');

  return `"${text.replaceAll('"', '""')}"`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
