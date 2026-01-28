'use client';

import { useState } from 'react';

interface FlagFeedbackProps {
    settingKey: string;
    settingLabel: string;
    onClose: () => void;
}

export default function FlagFeedback({ settingKey, settingLabel, onClose }: FlagFeedbackProps) {
    const [feedbackType, setFeedbackType] = useState<string>('');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const feedbackTypes = [
        { id: 'incorrect', label: '❌ Incorrect Information', color: 'rose' },
        { id: 'outdated', label: '📅 Outdated', color: 'amber' },
        { id: 'confusing', label: '❓ Confusing', color: 'violet' },
        { id: 'missing', label: '📝 Missing Details', color: 'blue' },
        { id: 'suggestion', label: '💡 Suggestion', color: 'emerald' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!feedbackType) {
            setError('Please select a feedback type');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Google Apps Script Web App URL - user will need to replace this
            const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || '';

            if (!GOOGLE_SCRIPT_URL) {
                // If no URL configured, simulate success for demo
                console.log('Feedback submitted:', { settingKey, settingLabel, feedbackType, comment });
                await new Promise(resolve => setTimeout(resolve, 500));
                setSubmitted(true);
                return;
            }

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Required for Google Apps Script
                headers: {
                    'Content-Type': 'text/plain', // Avoids preflight CORS issues
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    settingKey,
                    settingLabel,
                    feedbackType,
                    comment,
                    userAgent: navigator.userAgent,
                }),
            });

            // no-cors mode doesn't give us response status, assume success
            setSubmitted(true);
        } catch (err) {
            console.error('Failed to submit feedback:', err);
            setError('Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-3xl">✓</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
                    <p className="text-slate-400 mb-6">Your feedback has been submitted and will help improve this wiki.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Flag This Setting</h3>
                        <p className="text-sm text-slate-400 mt-1">{settingLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Feedback Type Selection */}
                    <div className="mb-4">
                        <label className="block text-sm text-slate-400 mb-2">What&apos;s the issue?</label>
                        <div className="grid gap-2">
                            {feedbackTypes.map((type) => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setFeedbackType(type.id)}
                                    className={`
                    w-full px-4 py-3 rounded-xl text-left text-sm font-medium
                    transition-all duration-200 border
                    ${feedbackType === type.id
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                                            : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                                        }
                  `}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comment Field */}
                    <div className="mb-4">
                        <label className="block text-sm text-slate-400 mb-2">
                            Additional details (optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us more about the issue..."
                            rows={3}
                            className="
                w-full px-4 py-3 rounded-xl
                bg-slate-700/50 border border-slate-600/50
                text-white placeholder-slate-500
                focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                resize-none
              "
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p className="text-rose-400 text-sm mb-4">{error}</p>
                    )}

                    {/* Submit Button */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="
                flex-1 px-4 py-2.5 rounded-xl font-medium
                bg-gradient-to-r from-cyan-500 to-cyan-600 text-white
                hover:from-cyan-400 hover:to-cyan-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </div>
                </form>

                {/* Privacy Note */}
                <p className="text-xs text-slate-500 text-center mt-4">
                    Feedback is anonymous and helps improve the wiki for everyone.
                </p>
            </div>
        </div>
    );
}
