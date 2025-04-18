import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';

const DATA_DIR = path.join(__dirname, '../data/previous_registrations');
const OUTPUT_FILE = path.join(__dirname, '../data/invite_list.csv');

// Exact column headers and matching logic as provided by the user
const EMAIL_HEADER = 'E-postadresse';
const NAME_HEADER = 'First Name';
const OPTIN_HEADER = 'My contact information may in addition be kept and used by KrUltra to...';
const OPTIN_PHRASE = 'Notify me';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));
  const invitees: { name: string; email: string; year: string }[] = [];

  for (const file of files) {
    const yearMatch = file.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : '';
    const workbook = XLSX.readFile(path.join(DATA_DIR, file));
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) continue;

    // Use exact columns
    const optInCol = OPTIN_HEADER;
    const emailCol = EMAIL_HEADER;
    const nameCol = NAME_HEADER;

    if (!rows[0].hasOwnProperty(optInCol) || !rows[0].hasOwnProperty(emailCol) || !rows[0].hasOwnProperty(nameCol)) {
      console.warn(`Could not find required columns in ${file}. Skipping.`);
      continue;
    }

    for (const row of rows) {
      const optInValue = (row[optInCol] || '').toString();
      if (optInValue.includes(OPTIN_PHRASE)) {
        invitees.push({
          name: row[nameCol],
          email: normalizeEmail(row[emailCol]),
          year,
        });
      }
    }
  }

  // Deduplicate by email
  const uniqueInvitees = Object.values(
    invitees.reduce((acc, cur) => {
      acc[cur.email] = cur;
      return acc;
    }, {} as Record<string, { name: string; email: string; year: string }>)
  );

  // Write to CSV
  const csvWriter = createObjectCsvWriter({
    path: OUTPUT_FILE,
    header: [
      { id: 'name', title: 'Name' },
      { id: 'email', title: 'Email' },
      { id: 'year', title: 'Year' }
    ],
  });
  await csvWriter.writeRecords(uniqueInvitees);
  console.log(`Extracted ${uniqueInvitees.length} invitees to ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error('Error extracting invitees:', e);
  process.exit(1);
});
