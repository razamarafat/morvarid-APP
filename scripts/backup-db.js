import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database Backup Script (ESM Compatible)
 * Uses pg_dump to create a backup of the Supabase/PostgreSQL database.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Database connection details from .env
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL or SUPABASE_DB_URL not found in .env file.');
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const fileName = `backup-${timestamp}.sql`;
const filePath = path.join(backupDir, fileName);

console.log(`🚀 Starting database backup...`);
console.log(`📁 Destination: ${filePath}`);

// Command: pg_dump [connection_url] > [file_path]
const command = `pg_dump "${dbUrl}" > "${filePath}"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Backup failed: ${error.message}`);
        return;
    }
    if (stderr) {
        console.warn(`⚠️ Warning: ${stderr}`);
    }

    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);

    console.log(`✅ Backup completed successfully!`);
    console.log(`📄 File: ${fileName}`);
    console.log(`⚖️ Size: ${fileSizeInKB} KB`);
});
