import { MetadataRoute } from 'next';
import modelsData from '@/data/models.json';
import togglesData from '@/data/toggles.json';
import carsData from '@/data/cars.json';
import featuresData from '@/data/features.json';

const HIGH_VALUE_SETTING_KEYS = [
    'AdjustCameraOffset',
    'DrivingModel',
    'MadsEnabled',
    'NeuralNetworkLateralControl',
    'DynamicExperimentalControl',
    'ExperimentalMode',
    'VisionBasedTurnSpeedControl',
    'SpeedLimitAssistMode',
];

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://sunnylink.wiki';

    // Surface real dataset timestamps so search engines and AI crawlers
    // can trust lastModified headers and only re-crawl updated content.
    const modelsLastModified = new Date(modelsData.lastUpdated);
    const togglesLastModified = new Date(togglesData.lastUpdated);
    const carsLastModified = new Date(carsData.lastUpdated);
    const featuresLastModified = new Date(featuresData.lastUpdated);

    const existingSettingKeys = new Set(
        togglesData.categories.flatMap((c) => c.settings.map((s) => s.key))
    );

    const settingDeepLinks: MetadataRoute.Sitemap = HIGH_VALUE_SETTING_KEYS
        .filter((key) => existingSettingKeys.has(key))
        .map((key) => ({
            url: `${baseUrl}/?setting=${encodeURIComponent(key)}`,
            lastModified: togglesLastModified,
            changeFrequency: 'monthly',
            priority: 0.72,
        }));

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
            url: `${baseUrl}/wizard/classic`,
            lastModified: togglesLastModified,
            changeFrequency: 'monthly',
            priority: 0.65,
        },
        {
            url: `${baseUrl}/new-sim`,
            lastModified: modelsLastModified,
            changeFrequency: 'monthly',
            priority: 0.78,
        },
        {
            url: `${baseUrl}/model-replay`,
            lastModified: modelsLastModified,
            changeFrequency: 'monthly',
            priority: 0.75,
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
        ...settingDeepLinks,
    ];
}
