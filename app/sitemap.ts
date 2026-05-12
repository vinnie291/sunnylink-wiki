import { MetadataRoute } from 'next';
import modelsData from '@/data/models.json';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.sunnylink.wiki'; // Assuming deployment URL, should ideally be env var

    // Surface the dataset's actual lastUpdated so /models gets refreshed
    // in search-engine indexes whenever new openpilot models are added.
    const modelsLastModified = new Date(modelsData.lastUpdated);

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/models`,
            lastModified: modelsLastModified,
            changeFrequency: 'weekly',
            priority: 0.95,
        },
        {
            url: `${baseUrl}/features`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/wizard`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/stats`,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.8,
        },
    ];
}
