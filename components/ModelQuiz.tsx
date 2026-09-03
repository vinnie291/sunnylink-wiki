'use client';

import { useLanguage } from '../lib/i18n';

export default function ModelQuiz() {
    const { t } = useLanguage();
    return (
        <div className="py-20 text-center">
            <span className="text-5xl mb-6 block">🧭</span>
            <h1 className="text-3xl font-bold text-slate-100 mb-4">{t('quiz.title') || 'Model Finder Quiz'}</h1>
            <p className="text-slate-400 text-lg">{t('quiz.comingSoon') || 'Coming soon — find your perfect driving model in 3 questions.'}</p>
        </div>
    );
}
