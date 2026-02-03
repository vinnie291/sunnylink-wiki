
import 'dotenv/config';
import { db } from '../lib/db';
import { categories, models, vibeGuides } from '../db/schema';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'models.json');

async function seed() {
    console.log('🌱 Seeding database...');

    const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
    const data = JSON.parse(rawData);

    // Seed Categories and Models
    console.log('Inserting categories and models...');
    for (const cat of data.categories) {
        await db.insert(categories).values({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
        }).onConflictDoUpdate({ target: categories.id, set: { name: cat.name, description: cat.description, icon: cat.icon } });

        if (cat.models && cat.models.length > 0) {
            for (const model of cat.models) {
                // Check if model exists to avoid duplicates or multiple runs issues (simple check by name/cat)
                // Ideally we'd have a unique constraint on name, but let's just insert for now.
                // For a seed script intended to be run once or with clean DB, direct insert is fine.
                await db.insert(models).values({
                    categoryId: cat.id,
                    name: model.name,
                    date: model.date,
                    badge: model.badge,
                    tags: model.tags,
                    consensus: model.consensus,
                    vibe: model.vibe,
                    communityScore: model.communityScore,
                    totalVotes: model.totalVotes,
                    sentiment: model.sentiment,
                    bestFor: model.bestFor,
                    testedOn: model.testedOn,
                    steeringFeel: model.steeringFeel,
                    note: model.note,
                    forumUrl: model.forumUrl,
                });
            }
        }
    }

    // Seed Vibe Guides
    console.log('Inserting vibe guides...');
    if (data.vibeGuide) {
        for (const [key, guide] of Object.entries(data.vibeGuide)) {
            const g = guide as any;
            await db.insert(vibeGuides).values({
                id: key,
                title: g.title,
                subtitle: g.subtitle,
                includes: g.includes,
                vibe: g.vibe,
                bestFor: g.bestFor,
                recommendation: g.recommendation,
            }).onConflictDoUpdate({ target: vibeGuides.id, set: { title: g.title, vibe: g.vibe } });
        }
    }

    console.log('✅ Seeding complete!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
