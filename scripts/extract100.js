const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../src/data/companies.json');
const outputPath = path.join(__dirname, '../scripts/extracted_100.json');

try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const subset = data.slice(0, 100);
    fs.writeFileSync(outputPath, JSON.stringify(subset, null, 2));
    console.log('Successfully extracted 100 companies to scripts/extracted_100.json');
} catch (err) {
    console.error('Error:', err.message);
}
