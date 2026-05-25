/**
 * Debug CSV import with a specific file
 */
function debugCsvImport() {
  // Use one of the recent CSV files that should have Capital One data
  const fileName = "job_listings_20251004_102231.csv";

  Logger.log(`=== DEBUGGING CSV IMPORT: ${fileName} ===\n`);

  // Find the file
  const files = DriveApp.searchFiles(`title = "${fileName}"`);

  if (!files.hasNext()) {
    Logger.log(`ERROR: File not found: ${fileName}`);
    return;
  }

  const file = files.next();
  Logger.log(`Found file: ${file.getName()}`);
  Logger.log(`File ID: ${file.getId()}\n`);

  // Read the CSV content
  const csvContent = file.getBlob().getDataAsString();
  Logger.log(`CSV content length: ${csvContent.length} characters\n`);

  // Show first 3 lines of raw CSV
  const lines = csvContent.split('\n');
  Logger.log('=== RAW CSV CONTENT (first 3 lines) ===');
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    Logger.log(`Line ${i}: ${lines[i]}`);
  }
  Logger.log('');

  // Parse with Utilities.parseCsv()
  Logger.log('=== PARSING WITH Utilities.parseCsv() ===');
  const rows = Utilities.parseCsv(csvContent);
  Logger.log(`Parsed ${rows.length} rows\n`);

  // Check header
  Logger.log('=== HEADER ROW ===');
  Logger.log(`Header has ${rows[0].length} columns`);
  Logger.log(`Headers: ${rows[0].join(' | ')}\n`);

  // Check first data row
  if (rows.length > 1) {
    Logger.log('=== FIRST DATA ROW ===');
    Logger.log(`Data row has ${rows[1].length} values\n`);

    Logger.log('All values in first data row:');
    for (let i = 0; i < rows[1].length; i++) {
      Logger.log(`  [${i}] ${rows[0][i]}: "${rows[1][i]}"`);
    }
    Logger.log('');

    // Expected mapping
    Logger.log('=== EXPECTED vs ACTUAL ===');
    Logger.log(`Expected 17 columns, got ${rows[1].length} columns`);
    Logger.log(`Company (should be "Capital One"): "${rows[1][0]}"`);
    Logger.log(`Company Description (should be empty): "${rows[1][1]}"`);
    Logger.log(`Job Title (should be "Director, Technical Program Manager..."): "${rows[1][2]}"`);
    Logger.log(`Location (should be "Richmond, VA"): "${rows[1][3]}"`);
    Logger.log(`Email Title (col 15, should have text): "${rows[1][15] || 'UNDEFINED'}"`);
    Logger.log(`Jobs Found (col 16, should be "6"): "${rows[1][16] || 'UNDEFINED'}"`);
    Logger.log('');
  }

  // Now test the mapping function
  Logger.log('=== TESTING COLUMN MAPPING ===');
  const columnMap = createCsvColumnMap(rows[0]);
  Logger.log('Column map:');
  for (const [field, index] of Object.entries(columnMap)) {
    Logger.log(`  ${field} -> column ${index}`);
  }
  Logger.log('');

  // Test job object creation
  if (rows.length > 1) {
    Logger.log('=== TESTING JOB OBJECT CREATION ===');
    const job = createJobFromCsvRow(rows[1], columnMap);
    Logger.log('Created job object:');
    Logger.log(`  Company: "${job["Company"]}"`);
    Logger.log(`  Company Description: "${job["Company Description"]}"`);
    Logger.log(`  Job Title: "${job["Job Title"]}"`);
    Logger.log(`  Location: "${job["Location"]}"`);
    Logger.log(`  Email Received Date: "${job["Email Received Date"]}"`);
    Logger.log(`  Email Source: "${job["Email Source"]}"`);
    Logger.log(`  Email Title: "${job["Email Title"]}"`);
    Logger.log(`  Jobs Found In Email: "${job["Jobs Found In Email"]}"`);
  }
}
