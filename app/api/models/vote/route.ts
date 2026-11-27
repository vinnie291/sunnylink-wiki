import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import modelsData from '@/data/models.json';
import {
    generateVoterHash,
    checkRateLimit,
    calculateBlendedModelStats,
    recordVote,
    getAllModelVoteSummaries,
    createSignedVoterToken,
    verifySignedVoterToken,
    ensureCloudVotesHydrated,
    ModelSurveyAnswers,
} from '@/lib/modelVotes';

const MAX_BODY_BYTES = 16_384;
const MAX_FORWARDED_HEADER_LEN = 512;
const MAX_ANSWER_KEYS = 25;
const MAX_ANSWER_KEY_LEN = 64;
const MAX_STRING_VAL_LEN = 256;
const MAX_ARRAY_ITEMS = 20;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const VOTER_COOKIE_OPTIONS = {
    path: '/',
    maxAge: 31_536_000, // 1 year
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
};

function normalizeIpCandidate(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 64) return null;
    // Strip optional IPv4 :port suffix
    const ipv4PortMatch = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(trimmed);
    const candidate = ipv4PortMatch ? ipv4PortMatch[1] : trimmed;
    return net.isIP(candidate) !== 0 ? candidate : null;
}

export function getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded && forwarded.length <= MAX_FORWARDED_HEADER_LEN) {
        const validIps = forwarded
            .split(',')
            .slice(0, 16)
            .map(normalizeIpCandidate)
            .filter((ip): ip is string => ip !== null);

        if (validIps.length > 0) {
            // On Google Cloud Run, Google Front End appends the true client IP rightmost
            return process.env.K_SERVICE ? validIps[validIps.length - 1] : validIps[0];
        }
    }

    if (!process.env.K_SERVICE) {
        const realIp = req.headers.get('x-real-ip');
        if (realIp) {
            const validRealIp = normalizeIpCandidate(realIp);
            if (validRealIp) return validRealIp;
        }
    }

    return '127.0.0.1';
}

function getVoterToken(
    req: NextRequest,
    verifiedBodyToken?: string
): { token: string; shouldSetCookie: boolean; hadVerifiedToken: boolean } {
    const cookieToken = req.cookies.get('sl_voter_token')?.value;
    if (cookieToken && verifySignedVoterToken(cookieToken)) {
        return { token: cookieToken, shouldSetCookie: false, hadVerifiedToken: true };
    }
    if (verifiedBodyToken && verifySignedVoterToken(verifiedBodyToken)) {
        return { token: verifiedBodyToken, shouldSetCookie: true, hadVerifiedToken: true };
    }
    return { token: createSignedVoterToken(), shouldSetCookie: true, hadVerifiedToken: false };
}

function hasForbiddenOwnKeys(obj: object): boolean {
    for (const key of Object.getOwnPropertyNames(obj)) {
        if (FORBIDDEN_KEYS.has(key)) {
            return true;
        }
    }
    return false;
}

function validateAndSanitizeAnswers(
    rawAnswers: unknown
): { ok: true; answers: ModelSurveyAnswers } | { ok: false; error: string } {
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
        return { ok: false, error: 'Invalid request: answers must be an object' };
    }
    if (hasForbiddenOwnKeys(rawAnswers)) {
        return { ok: false, error: 'Invalid request: forbidden property key in answers' };
    }

    const keys = Object.getOwnPropertyNames(rawAnswers);
    if (keys.length > MAX_ANSWER_KEYS) {
        return { ok: false, error: `Invalid request: answers cannot exceed ${MAX_ANSWER_KEYS} keys` };
    }

    const sanitized: ModelSurveyAnswers = {};
    for (const key of keys) {
        if (key.length === 0 || key.length > MAX_ANSWER_KEY_LEN) {
            return { ok: false, error: 'Invalid request: answer key length out of bounds' };
        }
        const val = (rawAnswers as Record<string, unknown>)[key];
        if (typeof val === 'string') {
            if (val.length > MAX_STRING_VAL_LEN) {
                return { ok: false, error: 'Invalid request: answer string value too long' };
            }
            sanitized[key] = val;
        } else if (typeof val === 'number') {
            if (!Number.isFinite(val) || val < -1000 || val > 1000) {
                return { ok: false, error: 'Invalid request: answer numeric value out of bounds' };
            }
            sanitized[key] = val;
        } else if (typeof val === 'boolean') {
            sanitized[key] = val;
        } else if (Array.isArray(val)) {
            if (val.length > MAX_ARRAY_ITEMS) {
                return { ok: false, error: 'Invalid request: answer array has too many items' };
            }
            const cleanArr: string[] = [];
            for (const item of val) {
                if (typeof item !== 'string' || item.length > MAX_STRING_VAL_LEN) {
                    return { ok: false, error: 'Invalid request: answer array must contain short strings' };
                }
                cleanArr.push(item);
            }
            sanitized[key] = cleanArr;
        } else {
            return { ok: false, error: 'Invalid request: unsupported answer value type' };
        }
    }

    return { ok: true, answers: sanitized };
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
        await ensureCloudVotesHydrated();

        const ip = getClientIp(req);
        const { token, shouldSetCookie } = getVoterToken(req);
        const voterHash = generateVoterHash(ip, token);

        const url = new URL(req.url);
        const requestedModel = url.searchParams.get('model');
        if (requestedModel !== null && requestedModel.length > 120) {
            return NextResponse.json(
                { success: false, error: 'Invalid model query parameter' },
                { status: 400 }
            );
        }

        let data: unknown;

        if (requestedModel) {
            const found = findModelInDataset(requestedModel.trim());
            const stats = calculateBlendedModelStats(
                found?.name ?? requestedModel.trim(),
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

        if (shouldSetCookie) {
            res.cookies.set('sl_voter_token', token, VOTER_COOKIE_OPTIONS);
        }

        return res;
    } catch (err: unknown) {
        console.error('[API /api/models/vote GET] Error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const contentLengthHeader = req.headers.get('content-length');
        if (contentLengthHeader !== null) {
            const declaredBytes = Number(contentLengthHeader);
            if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BODY_BYTES) {
                return NextResponse.json(
                    { success: false, error: 'Payload too large' },
                    { status: 413 }
                );
            }
        }

        const rawText = await req.text();
        if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
            return NextResponse.json(
                { success: false, error: 'Payload too large' },
                { status: 413 }
            );
        }

        let parsedBody: unknown;
        try {
            parsedBody = JSON.parse(rawText);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request body' },
                { status: 400 }
            );
        }

        if (hasForbiddenOwnKeys(parsedBody)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request: forbidden property key' },
                { status: 400 }
            );
        }

        const { modelName, answers, voterToken: bodyToken } = parsedBody as {
            modelName?: unknown;
            answers?: unknown;
            voterToken?: unknown;
        };

        if (!modelName || typeof modelName !== 'string' || modelName.trim().length === 0 || modelName.length > 120) {
            return NextResponse.json(
                { success: false, error: 'Invalid request: modelName and answers required' },
                { status: 400 }
            );
        }

        const answerValidation = validateAndSanitizeAnswers(answers);
        if (!answerValidation.ok) {
            return NextResponse.json(
                { success: false, error: answerValidation.error },
                { status: 400 }
            );
        }

        if (bodyToken !== undefined && bodyToken !== null && bodyToken !== '') {
            if (typeof bodyToken !== 'string' || !verifySignedVoterToken(bodyToken)) {
                return NextResponse.json(
                    { success: false, error: 'Invalid or unsigned voter token' },
                    { status: 400 }
                );
            }
        }

        const found = findModelInDataset(modelName.trim());
        if (!found) {
            return NextResponse.json(
                { success: false, error: 'Unknown driving model' },
                { status: 404 }
            );
        }

        await ensureCloudVotesHydrated();

        const ip = getClientIp(req);
        const { token, shouldSetCookie, hadVerifiedToken } = getVoterToken(
            req,
            typeof bodyToken === 'string' && bodyToken.length > 0 ? bodyToken : undefined
        );
        const voterHash = generateVoterHash(ip, token);

        if (!checkRateLimit(voterHash) || (!hadVerifiedToken && !checkRateLimit(`ip:${ip}`, 30))) {
            return NextResponse.json(
                { success: false, error: 'Too many voting requests. Please try again in a minute.' },
                { status: 429 }
            );
        }

        const { stats, userVote } = recordVote(
            found.name,
            voterHash,
            answerValidation.answers,
            found.communityScore,
            found.totalVotes,
            found.sentiment
        );

        const res = NextResponse.json({
            success: true,
            stats,
            userVote,
            voterToken: token,
        });

        if (shouldSetCookie) {
            res.cookies.set('sl_voter_token', token, VOTER_COOKIE_OPTIONS);
        }

        return res;
    } catch (err: unknown) {
        console.error('[API /api/models/vote POST] Error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
