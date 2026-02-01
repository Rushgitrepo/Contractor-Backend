require('dotenv').config();
const { Client } = require('pg');

const createDatabase = async () => {

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'ali980',
    database: 'postgres', // Connect to default system database to create new DB
  });


  try {
    await client.connect();
    const dbName = process.env.DB_NAME || 'contractorlist';
    console.log(`Connected to PostgreSQL. Target database: ${dbName}`);

    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1", [dbName]
    );

    if (result.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }



    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createDatabase();
