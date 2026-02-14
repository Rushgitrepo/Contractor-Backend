const fs = require('fs');

async function fixJson() {
    try {
        console.log('Reading file...');
        const data = fs.readFileSync('src/data/companies.json', 'utf8');
        const parsed = JSON.parse(data);

        console.log(`Original item count: ${parsed.length}`);
        let fixedCount = 0;

        const fixed = parsed.map((item, index) => {
            const newItem = { ...item };

            // Fix 1: Ensure unique ID
            if (!newItem.id) {
                newItem.id = `c-${index + 1}`;
                fixedCount++;
            }

            // Fix 2: Ensure professional_category
            if (!newItem.professional_category) {
                // Heuristic: Check name/description for keywords
                const text = (item.company_name + ' ' + (item.description || '')).toLowerCase();
                if (text.includes('general contractor') || text.includes('construction management')) {
                    newItem.professional_category = 'General Contractor';
                } else if (text.includes('architect') || text.includes('design')) {
                    newItem.professional_category = 'Architects & Building Designers';
                } else if (text.includes('subcontractor') || text.includes('plumbing') || text.includes('electric') || text.includes('roofing')) {
                    newItem.professional_category = 'Subcontractor'; // Or specific trade
                } else {
                    newItem.professional_category = 'Other';
                }
            }

            return newItem;
        });

        console.log(`Fixed ${fixedCount} items (added IDs/Categories).`);

        console.log('Writing fixed file to src/data/companies_fixed.json...');
        fs.writeFileSync('src/data/companies_fixed.json', JSON.stringify(fixed, null, 2));
        console.log('Done.');

    } catch (e) {
        console.error('Error:', e);
    }
}

fixJson();
