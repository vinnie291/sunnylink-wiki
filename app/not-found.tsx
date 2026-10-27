'use client';

import Link from 'next/link';
import TranslatedText from '@/components/TranslatedText';

export default function NotFound() {
    return (
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
            <p className="text-sm text-slate-500">404</p>
            <h1 className="mt-4 text-3xl font-bold"><TranslatedText text="Page not found" /></h1>
            <p className="mt-4 text-slate-400"><TranslatedText text="This page could not be found. Return to the wiki to continue browsing." /></p>
            <Link href="/" className="mt-8 inline-block rounded-xl bg-cyan-600 px-5 py-3 font-medium text-white">
                <TranslatedText text="Return to the wiki" />
            </Link>
        </main>
    );
}
