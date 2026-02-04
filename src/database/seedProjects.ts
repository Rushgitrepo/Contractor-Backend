
import pool from '../config/database';

const projectData = [
    {
        title: 'Modern Kitchen Overhaul',
        description: 'Complete gut renovation of a 300 sq ft kitchen. Including custom cabinetry, island installation, and luxury appliance integration.',
        type: 'kitchen_remodel',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
    },
    {
        title: 'Master Suite Sanctuary',
        description: 'Transforming a dated master bathroom into a spa-like retreat with a steam shower and heated floors.',
        type: 'bathroom_remodel',
        city: 'Round Rock',
        state: 'TX',
        zip: '78664'
    },
    {
        title: 'Whole House Flooring Upgrade',
        description: 'Replace 2500 sq ft of carpet with high-end engineered hardwood. Leveling required in some areas.',
        type: 'flooring',
        city: 'Cedar Park',
        state: 'TX',
        zip: '78613'
    },
    {
        title: 'Solar Prepared Roofing',
        description: 'Full roof replacement with reinforced structure for future solar panel installation.',
        type: 'roofing',
        city: 'Pflugerville',
        state: 'TX',
        zip: '78660'
    },
    {
        title: 'Modern Backyard Oasis',
        description: 'New pool deck, outdoor kitchen, and native drought-resistant landscaping.',
        type: 'landscaping',
        city: 'Bee Cave',
        state: 'TX',
        zip: '78738'
    },
    {
        title: 'Smart Home Electrical Upgrade',
        description: 'Full panel upgrade and installation of smart lighting throughout the property.',
        type: 'electrical',
        city: 'Austin',
        state: 'TX',
        zip: '78704'
    },
    {
        title: 'Custom Guest House Build',
        description: 'Construction of a 600 sq ft ADU (Accessory Dwelling Unit) with kitchenette and bath.',
        type: 'new_construction',
        city: 'Austin',
        state: 'TX',
        zip: '78751'
    },
    {
        title: 'HVAC System Modernization',
        description: 'Replacement of 20-year-old central air system with dual-zone high-efficiency heat pump.',
        type: 'hvac',
        city: 'Georgetown',
        state: 'TX',
        zip: '78626'
    },
    {
        title: 'Industrial Loft Painting',
        description: 'Professional painting of exposed brick and 20ft ceilings in a converted warehouse loft.',
        type: 'painting',
        city: 'Austin',
        state: 'TX',
        zip: '78702'
    },
    {
        title: 'Luxury Pool Installation',
        description: 'Inground infinity pool with saline system and integrated hot tub.',
        type: 'landscaping',
        city: 'Lakeway',
        state: 'TX',
        zip: '78734'
    },
    {
        title: 'Basement Conversion',
        description: 'Finishing a 1000 sq ft raw basement into a home theater and gym space.',
        type: 'new_construction',
        city: 'Dripping Springs',
        state: 'TX',
        zip: '78620'
    },
    {
        title: 'Historic Window Restoration',
        description: 'Restoration of 12 original wood sash windows in a 1920s craftsman bungalow.',
        type: 'renovation',
        city: 'Austin',
        state: 'TX',
        zip: '78703'
    },
    {
        title: 'Commercial Retail Fit-Out',
        description: 'Boutique clothing store renovation including partition walls, lighting, and change rooms.',
        type: 'commercial_renovation',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
    },
    {
        title: 'Eco-Friendly Decking',
        description: 'Installation of a 400 sq ft composite deck with integrated LED lighting.',
        type: 'flooring',
        city: 'San Marcos',
        state: 'TX',
        zip: '78666'
    },
    {
        title: 'Garage to Home Office',
        description: 'Insulating and converting a 2-car garage into a professional home office space.',
        type: 'renovation',
        city: 'Buda',
        state: 'TX',
        zip: '78610'
    },
    {
        title: 'Luxury Driveway Paving',
        description: 'Remove asphalt and install custom interlocking pavers for a 2000 sq ft driveway.',
        type: 'landscaping',
        city: 'West Lake Hills',
        state: 'TX',
        zip: '78746'
    },
    {
        title: 'Whole Home Repiping',
        description: 'Replacing old galvanized pipes with new PEX throughout a 2-story residence.',
        type: 'plumbing',
        city: 'Austin',
        state: 'TX',
        zip: '78758'
    },
    {
        title: 'Condo Interior Transformation',
        description: 'Modernizing a downtown condo with new lighting, paint, and trim work.',
        type: 'renovation',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
    },
    {
        title: 'Foundation Repair & Reinforcement',
        description: 'Leveling and pier installation for a sagging foundation on clay soil.',
        type: 'renovation',
        city: 'Hutto',
        state: 'TX',
        zip: '78634'
    },
    {
        title: 'Custom Wine Cellar Construction',
        description: 'Climate-controlled wine room with capacity for 500 bottles and tasting area.',
        type: 'new_construction',
        city: 'Spicewood',
        state: 'TX',
        zip: '78669'
    }
];

const seedMarketplaceProjects = async () => {
    try {
        console.log('Starting Marketplace projects seeding (projects table only)...');

        // Find an owner (Client or GC)
        const ownerResult = await pool.query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");

        if (ownerResult.rows.length === 0) {
            console.log('❌ No users found. Please seed users first.');
            process.exit(1);
        }

        const ownerId = ownerResult.rows[0].id;
        console.log(`Using user ID ${ownerId} as project owner.`);

        console.log(`Seeding 20 projects into 'projects' table...`);

        for (const data of projectData) {
            const budgetMin = Math.floor(Math.random() * 5000) + 5000;
            const budgetMax = budgetMin + Math.floor(Math.random() * 20000) + 5000;

            const bidDeadline = new Date();
            bidDeadline.setDate(bidDeadline.getDate() + 30 + Math.floor(Math.random() * 60));

            await pool.query(
                `INSERT INTO projects (
          owner_id, 
          title, 
          description, 
          project_type, 
          budget_min, 
          budget_max, 
          location_city, 
          location_state, 
          location_zip, 
          bid_deadline, 
          status,
          sector
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', 'private')`,
                [
                    ownerId,
                    data.title,
                    data.description,
                    data.type,
                    budgetMin,
                    budgetMax,
                    data.city,
                    data.state,
                    data.zip,
                    bidDeadline,
                ]
            );
        }

        console.log('✅ Marketplace projects seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedMarketplaceProjects();
