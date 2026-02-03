
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
});

export const models = sqliteTable('models', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: text('category_id').references(() => categories.id).notNull(),
    name: text('name').notNull(),
    date: text('date').notNull(),
    badge: text('badge'),
    tags: text('tags', { mode: 'json' }).$type<string[]>(),
    consensus: text('consensus'),
    vibe: text('vibe'),
    communityScore: integer('community_score'),
    totalVotes: integer('total_votes'),
    sentiment: text('sentiment', { mode: 'json' }).$type<{
        great: number;
        good: number;
        ok: number;
        bad: number;
    }>(),
    bestFor: text('best_for'),
    testedOn: text('tested_on', { mode: 'json' }).$type<string[]>(),
    steeringFeel: text('steering_feel'),
    note: text('note'),
    forumUrl: text('forum_url'),
});

export const vibeGuides = sqliteTable('vibe_guides', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    includes: text('includes'),
    vibe: text('vibe').notNull(),
    bestFor: text('best_for').notNull(),
    recommendation: text('recommendation'),
});
