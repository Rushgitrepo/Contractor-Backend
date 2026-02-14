const fs = require('fs');

async function debugJson() {
    let data;
    try {
        console.log('Reading fixed file...');
        data = fs.readFileSync('src/data/companies_fixed.json', 'utf8');

        console.log('Parsing JSON...');
        const parsed = JSON.parse(data);
        console.log('JSON is valid syntax.');
        console.log(`Type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
        console.log(`Length: ${parsed.length}`);

        if (!Array.isArray(parsed)) {
            console.error('Error: Root element is not an array.');
            return;
        }

        let missingCategory = 0;
        let missingId = 0;
        let missingName = 0;
        const idMap = new Map();
        let duplicates = 0;

        console.log('--- Key Analysis (Item 0) ---');
        console.log(Object.keys(parsed[0]).join(', '));
        console.log('ID:', parsed[0].id);
        console.log('Professional Category:', parsed[0].professional_category);

        console.log('Analyzing items...');
        parsed.forEach((item, index) => {
            if (!item.company_name) missingName++;

            if (!item.id) {
                missingId++;
            } else {
                if (idMap.has(item.id)) {
                    duplicates++;
                } else {
                    idMap.set(item.id, index);
                }
            }

            if (!item.professional_category) missingCategory++;
        });

        console.log('--- Structure Analysis ---');
        console.log(`Total Items: ${parsed.length}`);
        console.log(`Missing ID: ${missingId}`);
        console.log(`Duplicate IDs: ${duplicates}`);
        console.log(`Missing Name: ${missingName}`);
        console.log(`Missing Professional Category: ${missingCategory}`);

    } catch (e) {
        console.error('JSON Error:', e.message);
    }
}

debugJson();
