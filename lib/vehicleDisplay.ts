/** Translate descriptive variants while preserving the make/model used for lookup. */
export function vehicleModelLabel(model: string, tx: (text: string) => string): string {
    return model.replace(/\((Hybrid|Early Access)\)/g, (_, variant: string) =>
        `(${variant === 'Hybrid' ? tx('Hybrid') : tx('Early Access')})`);
}
