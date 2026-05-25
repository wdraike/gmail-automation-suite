/**
 * Test CSV parsing with quoted commas
 */
function testCsvParsingWithQuotes() {
  // Test case with quoted commas (exactly like our real CSV)
  const testCsv = 'Company,Company Description,Job Title,Location,Minimum Salary,Maximum Salary,Salary Period,Job URL,URL Status,Careers URL,Careers URL Status,Email Received Date,Email Source,Date Added,Interest,Email Title,Jobs Found In Email\n' +
    'Capital One,,"Director, Technical Program Manager (Integrations)","Richmond, VA",,,,,Not found,,Inferred,2025-10-02 21:58:52,indeed,2025-10-04 10:22:31,,"Capital One is hiring for Director, Technical Program Manager. 5 more jobs in Richmond, VA.",6';

  Logger.log('=== Testing Utilities.parseCsv() ===');
  Logger.log('Test CSV:');
  Logger.log(testCsv);
  Logger.log('');

  const rows = Utilities.parseCsv(testCsv);

  Logger.log(`Parsed ${rows.length} rows`);
  Logger.log(`Header row has ${rows[0].length} columns`);
  Logger.log(`Data row has ${rows[1].length} columns`);
  Logger.log('');

  Logger.log('Expected: 17 columns per row');
  Logger.log('');

  Logger.log('Data row values:');
  for (let i = 0; i < rows[1].length; i++) {
    Logger.log(`  Column ${i}: "${rows[1][i]}"`);
  }
  Logger.log('');

  Logger.log('Key values:');
  Logger.log(`  Company (col 0): "${rows[1][0]}"`);
  Logger.log(`  Job Title (col 2): "${rows[1][2]}"`);
  Logger.log(`  Location (col 3): "${rows[1][3]}"`);
  Logger.log(`  Email Title (col 15): "${rows[1][15]}"`);
  Logger.log(`  Jobs Found (col 16): "${rows[1][16]}"`);
}

/**
 * Test importing actual CSV file from Drive
 */
function testActualCsvImport() {
  // Get a recent CSV file
  const files = DriveApp.searchFiles('title contains "job_listings_20251004" and mimeType="text/csv"');

  if (!files.hasNext()) {
    Logger.log('No CSV files found');
    return;
  }

  const file = files.next();
  Logger.log(`Testing file: ${file.getName()}`);

  const csvContent = file.getBlob().getDataAsString();
  Logger.log(`CSV content length: ${csvContent.length}`);
  Logger.log('First 500 chars:');
  Logger.log(csvContent.substring(0, 500));
  Logger.log('');

  const rows = Utilities.parseCsv(csvContent);
  Logger.log(`Parsed ${rows.length} rows`);
  Logger.log(`Header has ${rows[0].length} columns`);

  if (rows.length > 1) {
    Logger.log(`First data row has ${rows[1].length} columns`);
    Logger.log('First data row:');
    for (let i = 0; i < Math.min(rows[1].length, 17); i++) {
      Logger.log(`  [${i}]: "${rows[1][i]}"`);
    }
  }
}
