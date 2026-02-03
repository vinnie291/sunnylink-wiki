
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './db/schema.ts',
    out: './drizzle',
    driver: 'better-sqlite',
    dbCredentials: {
        url: process.env.DB_FILE_NAME || 'sqlite.db',
    },
});
