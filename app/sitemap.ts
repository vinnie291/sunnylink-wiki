import { MetadataRoute } from 'next';
import modelsData from '@/data/models.json';
import togglesData from '@/data/toggles.json';
import carsData from '@/data/cars.json';
import featuresData from '@/data/features.json';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.sunnylink.wiki';

    // Surface real dataset timestamps so search engines and AI crawlers
    // can trust lastModified headers and only re-crawl updated content.
    const modelsLastModified = new Date(modelsData.lastUpdated);
    const togglesLastModified = new Date(togglesData.lastUpdated);
    const carsLastModified = new Date(carsData.lastUpdated);
    const featuresLastModified = new Date(featuresData.lastUpdated);

    return [
        {
            url: baseUrl,
            lastModified: togglesLastModified,
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/models`,
            lastModified: modelsLastModified,
            changeFrequency: 'weekly',
            priority: 0.95,
        },
        {
            url: `${baseUrl}/cars`,
            lastModified: carsLastModified,
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/features`,
            lastModified: featuresLastModified,
            changeFrequency: 'monthly',
            priority: 0.85,
        },
        {
            url: `${baseUrl}/wizard`,
            lastModified: togglesLastModified,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/quiz`,
            lastModified: modelsLastModified,
            changeFrequency: 'monthly',
            priority: 0.75,
        },
        {
            url: `${baseUrl}/stats`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.7,
        },
    ];
}
