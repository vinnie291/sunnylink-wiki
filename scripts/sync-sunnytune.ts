import fs from 'fs';
import path from 'path';

const CARS_JSON_PATH = path.join(process.cwd(), 'data/cars.json');

interface SunnyTuneConfig {
    shareToken: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: string;
    name: string;
}

async function syncSunnyTune() {
    console.log('Fetching shared configs from SunnyTune...');
    try {
        const url = 'https://sunny-tune.vercel.app/api/explore?sort=trending&page=1&limit=50';
        const response = await fetch(url);
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${body}`);
        }
        const data = await response.json();
        const configs: SunnyTuneConfig[] = data.configs || [];
        console.log(`Found ${configs.length} configs on SunnyTune.`);

        const carsData = JSON.parse(fs.readFileSync(CARS_JSON_PATH, 'utf-8'));
        let updatedCount = 0;

        for (const vehicle of carsData.vehicles) {
            // Find matching config on SunnyTune
            const match = configs.find(c => {
                const makeMatch = c.vehicleMake?.toLowerCase() === vehicle.make?.toLowerCase();
                if (!makeMatch) return false;

                // Simple fuzzy match for model
                const stModel = c.vehicleModel?.toLowerCase().replace(/[^a-z0-9]/g, '');
                const ourModel = vehicle.model?.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // Also check if year matches the range
                const stYear = parseInt(c.vehicleYear);
                const yearsArray = vehicle.years.split('-').map((y: string) => parseInt(y.trim()));
                const startYear = yearsArray[0];
                const endYear = yearsArray[1] || startYear;
                const yearMatch = !isNaN(stYear) && stYear >= startYear && stYear <= endYear;

                return stModel && ourModel && (stModel.includes(ourModel) || ourModel.includes(stModel)) && (yearMatch || !stYear);
            });

            if (match) {
                const newUrl = `https://sunny-tune.vercel.app/shared/${match.shareToken}`;
                if (vehicle.sunnyTuneUrl !== newUrl) {
                    vehicle.sunnyTuneUrl = newUrl;
                    updatedCount++;
                }
            }
        }

        if (updatedCount > 0) {
            fs.writeFileSync(CARS_JSON_PATH, JSON.stringify(carsData, null, 4));
            console.log(`Updated ${updatedCount} vehicles with SunnyTune links.`);
        } else {
            console.log('No new updates found.');
        }

    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncSunnyTune();
