import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.sunnylink.wiki'; // Assuming deployment URL, should ideally be env var

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/models`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
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
