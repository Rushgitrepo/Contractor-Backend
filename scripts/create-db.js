const { Client } = require('pg');

const createDatabase = async () => {

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'ali980',
    database: 'postgres', // Connect to default database
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'contractorlist'"
    );

    if (result.rows.length === 0) {
      // Create database
      await client.query('CREATE DATABASE contractorlist');
      console.log('✅ Database "contractorlist" created successfully');
    } else {
      console.log('✅ Database "contractorlist" already exists');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createDatabase();
