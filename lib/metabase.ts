// Metabase Public API Service
// Fetches dashboard data from the public Metabase API

const METABASE_BASE_URL = 'https://metabase.sunnypilot.ai/api/public/dashboard';
const DASHBOARD_UUID = '8d0ca494-6ab3-4d4c-9642-7deb493c4fac';

export interface MetabaseCard {
    id: number;
    name: string;
}

export interface DashboardData {
    activeUsers: number;
    totalDistance: number;
    onlineDevices: number;
    branchDistribution: { name: string; value: number }[];
    topModels: { name: string; value: number }[];
    recentActivity: { version: string; count: number; date: string }[];
}

// Transform raw Metabase rows to chart-compatible format
function transformToChartData(rows: unknown[][]): { name: string; value: number }[] {
    if (!rows || rows.length === 0) return [];

    return rows
        .filter(row => row[0] && row[0] !== '') // Filter out empty names
        .map(row => ({
            name: String(row[0] || 'Unknown'),
            value: Number(row[1]) || 0
        }))
        .sort((a, b) => b.value - a.value) // Sort by value descending
        .slice(0, 10); // Limit to top 10
}

// Fetch dashboard metadata to get card IDs
async function fetchDashboardMetadata(): Promise<MetabaseCard[]> {
    try {
        const response = await fetch(`${METABASE_BASE_URL}/${DASHBOARD_UUID}`, {
            next: { revalidate: 300 }, // Cache for 5 minutes
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.error('Failed to fetch dashboard metadata:', response.status);
            return [];
        }

        const data = await response.json();

        // Extract cards from dashcards (not ordered_cards)
        const cards: MetabaseCard[] = (data.dashcards || [])
            .filter((dc: { card?: { id?: number; name?: string } }) => dc.card?.id && dc.card?.name)
            .map((dc: { card: { id: number; name: string } }) => ({
                id: dc.card.id,
                name: dc.card.name
            }));

        console.log('Found cards:', cards.map(c => c.name));
        return cards;
    } catch (error) {
        console.error('Error fetching dashboard metadata:', error);
        return [];
    }
}

// Fetch data for a specific card
async function fetchCardData(cardId: number): Promise<unknown[][]> {
    try {
        const response = await fetch(`${METABASE_BASE_URL}/${DASHBOARD_UUID}/card/${cardId}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({}),
            next: { revalidate: 300 }
        });

        if (!response.ok) {
            console.error(`Failed to fetch card ${cardId}:`, response.status);
            return [];
        }

        const data = await response.json();
        console.log(`Card ${cardId} returned ${data.data?.rows?.length || 0} rows`);
        return data.data?.rows || [];
    } catch (error) {
        console.error(`Error fetching card ${cardId}:`, error);
        return [];
    }
}

// Main function to get all dashboard data
export async function getDashboardData(): Promise<DashboardData> {
    const defaultData: DashboardData = {
        activeUsers: 0,
        totalDistance: 0,
        onlineDevices: 0,
        branchDistribution: [],
        topModels: [],
        recentActivity: []
    };

    try {
        const cards = await fetchDashboardMetadata();

        if (cards.length === 0) {
            console.log('No cards found in dashboard');
            return defaultData;
        }

        // Find specific cards by their exact names from the API
        const activeUsersCard = cards.find(c => c.name === 'Active Users'); // ID 39
        const modelSplitCard = cards.find(c => c.name === 'Model Split (by amount of routes)'); // ID 40
        const routesByPlatformCard = cards.find(c => c.name === 'Routes by platform'); // ID 42
        const uniqueDevicesCard = cards.find(c => c.name === 'Unique Devices'); // ID 43
        const brandBranchCard = cards.find(c => c.name === 'Brand x Branch split'); // ID 45

        console.log('Mapping cards:', {
            activeUsers: activeUsersCard?.id,
            modelSplit: modelSplitCard?.id,
            routesByPlatform: routesByPlatformCard?.id,
            uniqueDevices: uniqueDevicesCard?.id,
            brandBranch: brandBranchCard?.id
        });

        // Fetch card data in parallel
        const [activeUsersRows, modelSplitRows, routesRows, uniqueDevicesRows, brandBranchRows] = await Promise.all([
            activeUsersCard ? fetchCardData(activeUsersCard.id) : Promise.resolve([]),
            modelSplitCard ? fetchCardData(modelSplitCard.id) : Promise.resolve([]),
            routesByPlatformCard ? fetchCardData(routesByPlatformCard.id) : Promise.resolve([]),
            uniqueDevicesCard ? fetchCardData(uniqueDevicesCard.id) : Promise.resolve([]),
            brandBranchCard ? fetchCardData(brandBranchCard.id) : Promise.resolve([])
        ]);

        // Calculate active users from the most recent data point in the time series
        // Active Users card returns [timestamp, count] pairs
        const latestActiveUsers = activeUsersRows.length > 0
            ? Number(activeUsersRows[activeUsersRows.length - 1]?.[1]) || 0
            : 0;

        // Calculate total unique devices from the sum of device types
        const totalDevices = uniqueDevicesRows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);

        // Transform model split for pie chart (branchDistribution)
        const branchDistribution = transformToChartData(modelSplitRows);

        // Transform routes by platform for bar chart (topModels as car models)
        const topModels = transformToChartData(routesRows);

        // Create recent activity from brand x branch data
        const recentActivity = brandBranchRows.slice(0, 5).map((row) => ({
            version: String(row[0] || 'Unknown') + ' - ' + String(row[1] || ''),
            count: Number(row[2]) || 0,
            date: new Date().toLocaleDateString()
        }));

        const result = {
            activeUsers: latestActiveUsers,
            totalDistance: 0, // Not available in current dashboard
            onlineDevices: totalDevices,
            branchDistribution,
            topModels,
            recentActivity
        };

        console.log('Dashboard data result:', {
            activeUsers: result.activeUsers,
            onlineDevices: result.onlineDevices,
            branchDistribution: result.branchDistribution.length,
            topModels: result.topModels.length,
            recentActivity: result.recentActivity.length
        });

        return result;
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return defaultData;
    }
}
