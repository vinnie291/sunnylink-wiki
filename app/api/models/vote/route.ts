import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import modelsData from '@/data/models.json';
import {
    generateVoterHash,
    checkRateLimit,
    calculateBlendedModelStats,
    recordVote,
    getAllModelVoteSummaries,
    ModelSurveyAnswers,
} from '@/lib/modelVotes';

function getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }
    return '127.0.0.1';
}

function getVoterToken(req: NextRequest, bodyToken?: string): { token: string; isNew: boolean } {
    const cookieToken = req.cookies.get('sl_voter_token')?.value;
    if (cookieToken && cookieToken.length >= 10) {
        return { token: cookieToken, isNew: false };
    }
    if (bodyToken && bodyToken.length >= 10) {
        return { token: bodyToken, isNew: false };
    }
    return { token: crypto.randomUUID(), isNew: true };
}

interface FlatModel {
    name: string;
    communityScore?: number;
    totalVotes?: number;
    sentiment?: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
}

function findModelInDataset(modelName: string): FlatModel | undefined {
    const target = modelName.toLowerCase();
    for (const cat of (modelsData.categories as { models: FlatModel[] }[])) {
        for (const m of cat.models) {
            if (m.name.toLowerCase() === target) {
                return m;
            }
        }
    }
    return undefined;
}

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const { token, isNew } = getVoterToken(req);
        const voterHash = generateVoterHash(ip, token);

        const url = new URL(req.url);
        const requestedModel = url.searchParams.get('model');

        let data: unknown;

        if (requestedModel) {
            const found = findModelInDataset(requestedModel);
            const stats = calculateBlendedModelStats(
                requestedModel,
                found?.communityScore,
                found?.totalVotes,
                found?.sentiment,
                voterHash
            );
            data = { stats, userVote: stats.userVote };
        } else {
            // Collect all unique models
            const allModels: FlatModel[] = [];
            const seen = new Set<string>();
            for (const cat of (modelsData.categories as { models: FlatModel[] }[])) {
                for (const m of cat.models) {
                    if (!seen.has(m.name.toLowerCase())) {
                        seen.add(m.name.toLowerCase());
                        allModels.push(m);
                    }
                }
            }
            data = getAllModelVoteSummaries(voterHash, allModels);
        }

        const res = NextResponse.json({
            success: true,
            data,
            voterToken: token,
        });

        if (isNew) {
            res.cookies.set('sl_voter_token', token, {
                path: '/',
                maxAge: 60 * 60 * 24 * 365, // 1 year
                sameSite: 'lax',
                httpOnly: false,
            });
        }

        return res;
    } catch (err: any) {
        console.error('[API /api/models/vote GET] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { modelName, answers, voterToken: bodyToken } = body as {
            modelName: string;
            answers: Partial<ModelSurveyAnswers>;
            voterToken?: string;
        };

        if (!modelName || typeof modelName !== 'string' || !answers || typeof answers !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid request: modelName and answers required' },
                { status: 400 }
            );
        }

        const ip = getClientIp(req);
        const { token, isNew } = getVoterToken(req, bodyToken);
        const voterHash = generateVoterHash(ip, token);

        if (!checkRateLimit(voterHash)) {
            return NextResponse.json(
                { success: false, error: 'Too many voting requests. Please try again in a minute.' },
                { status: 429 }
            );
        }

        const found = findModelInDataset(modelName);
        const { stats, userVote } = recordVote(
            modelName,
            voterHash,
            answers,
            found?.communityScore,
            found?.totalVotes,
            found?.sentiment
        );

        const res = NextResponse.json({
            success: true,
            stats,
            userVote,
            voterToken: token,
        });

        if (isNew) {
            res.cookies.set('sl_voter_token', token, {
                path: '/',
                maxAge: 60 * 60 * 24 * 365, // 1 year
                sameSite: 'lax',
                httpOnly: false,
            });
        }

        return res;
    } catch (err: any) {
        console.error('[API /api/models/vote POST] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
