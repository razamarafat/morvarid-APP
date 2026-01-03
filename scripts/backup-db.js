import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Database Backup Script (ESM Compatible) - V3.7.0
 * Lightweight: Parses .env manually and validates connection string.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const envFiles = ['.env.local', '.env.development', '.env'];
const backupDir = path.join(rootDir, 'backups');

const envPath = envFiles.map(f => path.join(rootDir, f)).find(p => fs.existsSync(p));

let dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;

if (envPath) {
    console.log(`🔍 Reading environment from: ${path.basename(envPath)}`);
    try {
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Handle BOM
        if (envContent.charCodeAt(0) === 0xFEFF) {
            envContent = envContent.slice(1);
        }

        const lines = envContent.split(/\r?\n/);
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;

            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const k = key.trim();
                const v = valueParts.join('=').trim().replace(/^["']|["']$/g, '');

                if (['SUPABASE_DB_URL', 'DATABASE_URL', 'DIRECT_URL', 'VITE_DATABASE_URL'].includes(k)) {
                    dbUrl = v;
                    console.log(`✅ Found database key: ${k}`);
                }
            }
        }
    } catch (err) {
        console.error(`⚠️ Warning: Failed to read ${envPath}: ${err.message}`);
    }
}

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

if (!dbUrl) {
    console.error('❌ Error: Database URL not found.');
    process.exit(1);
}

// Validation: Connection string must start with postgres:// or postgresql://
if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    console.error('❌ Error: Invalid Connection String format.');
    console.error('   معادل "https://..." برای pg_dump مناسب نیست.');
    console.error('   لطفاً از بخش Supabase -> Settings -> Database -> Connection string -> URI استفاده کنید.');
    console.error(`   رشته فعلی: ${dbUrl.substring(0, 10)}...`);
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
const dateStr = timestamp[0];
const timeStr = timestamp[1].split('Z')[0];
const fileName = `backup-${dateStr}_${timeStr}.sql`;
const filePath = path.join(backupDir, fileName);

console.log(`🚀 Starting database backup...`);
console.log(`📁 Destination: ${filePath}`);

// Command: pg_dump [connection_url] > [file_path]
const command = `pg_dump "${dbUrl}" > "${filePath}"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        if (error.message.includes('not recognized')) {
            console.error('❌ Error: pg_dump command not found.');
            console.error('   ابزار PostgreSQL در سیستم شما نصب نیست یا در PATH قرار ندارد.');
            console.error('   راهنما: ادمین باید PostgreSQL Client را نصب کند.');
        } else {
            console.error(`❌ Backup failed: ${error.message}`);
        }
        return;
    }

    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            console.error('❌ Error: Backup file is empty. Check your credentials.');
            fs.unlinkSync(filePath); // Delete empty file
        } else {
            const fileSizeInKB = (stats.size / 1024).toFixed(2);
            console.log(`✅ Backup completed successfully!`);
            console.log(`📄 File: ${fileName}`);
            console.log(`⚖️ Size: ${fileSizeInKB} KB`);
        }
    }
});
