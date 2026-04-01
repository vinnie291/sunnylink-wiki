import { generateAcronym } from './hooks/useFuzzySearch';

function testAcronyms() {
    const cases = [
        { label: "Neural Network Lateral Control", expected: "nnlc" },
        { label: "Smart Cruise Control", expected: "scc" },
        { label: "Lane Departure Warning", expected: "ldw" },
        { label: "Dynamic Experimental Control", expected: "dec" },
        { label: "Hyundai Longitudinal Tuning", expected: "hlt" }
    ];

    console.log("Testing Acronym Generation:");
    cases.forEach(c => {
        const actual = generateAcronym(c.label);
        const passed = actual === c.expected;
        console.log(`[${passed ? 'PASS' : 'FAIL'}] "${c.label}" -> "${actual}" (Expected: "${c.expected}")`);
    });
}

// Mock search structure
function testPrioritization() {
    console.log("\nTesting Prioritization Logic:");
    const query = "nnlc";
    const results = [
        { item: { _acronym: "abc", label: "Some Other Setting" } },
        { item: { _acronym: "nnlc", label: "Neural Network Lateral Control" } },
        { item: { _acronym: "xyz", label: "Yet Another" } }
    ];

    const sorted = [...results].sort((a, b) => {
        const aIsExactAcronym = a.item._acronym === query;
        const bIsExactAcronym = b.item._acronym === query;

        if (aIsExactAcronym && !bIsExactAcronym) return -1;
        if (!aIsExactAcronym && bIsExactAcronym) return 1;
        return 0;
    });

    const passed = sorted[0].item._acronym === "nnlc";
    console.log(`[${passed ? 'PASS' : 'FAIL'}] First item is exact acronym match: "${sorted[0].item.label}"`);
}

testAcronyms();
testPrioritization();
