/**
 * Roofing Knowledge Base - Technical definitions and field guidance
 * Provides immediate, detailed answers to common roofing questions
 */

const ROOFING_KNOWLEDGE = {
    "drip_edge": {
        definition: "Metal flashing installed along the edges of the roof (typically at the eaves and rakes) to direct water away from the fascia and into the gutters, protecting the underlying roofing components from water intrusion and rot.",
        codes: [
            "IRC Section R905.2.8.5 requires drip edge at eaves and gables",
            "Must extend not less than 2 inches onto roof deck", 
            "Fastened not more than 12 inches on center"
        ],
        whyItMatters: [
            "Insurance often omits drip edge - grounds for supplement",
            "GAF and other manufacturers require for warranty compliance",
            "Code compliance - will fail inspection if missing"
        ],
        templateSnippet: "Drip edge is a required component under IRC R905.2.8.5 and is necessary to direct water into the gutter system and prevent damage to fascia boards. Please revise the scope to include full perimeter replacement of drip edge to ensure code compliance and manufacturer warranty requirements are met.",
        nextSteps: [
            "Check insurance scope - is drip edge listed?",
            "Take photos of damaged or missing drip edge",
            "Request supplement if omitted from estimate"
        ]
    },
    
    "ice_and_water": {
        definition: "Self-adhering waterproof membrane installed in vulnerable areas like eaves, valleys, and around penetrations to prevent ice dams and water infiltration.",
        codes: [
            "IRC R905.2.7.1 requires ice barrier in areas with average January temp of 25°F or less",
            "Must extend from roof edge to 24 inches inside exterior wall",
            "Required in all valleys and around penetrations"
        ],
        whyItMatters: [
            "Prevents ice dam damage and water infiltration",
            "Required by code in cold climates (VA, MD, PA qualify)",
            "Insurance must cover if existing or code-required"
        ],
        templateSnippet: "Ice and water shield is required by IRC R905.2.7.1 in our climate zone and must extend from the roof edge to a point at least 24 inches inside the exterior wall line. This is essential for preventing ice dam damage and ensuring code compliance.",
        nextSteps: [
            "Verify if existing roof had ice & water shield",
            "Check local climate requirements",
            "Document need in estimate if missing"
        ]
    },
    
    "starter_shingles": {
        definition: "Specialized shingles installed along the eaves and rakes before the first course of field shingles to provide wind uplift resistance and proper water shedding.",
        codes: [
            "IRC R905.2.4 requires starter strips along eaves",
            "GAF requires starter shingles for warranty compliance",
            "Must provide minimum 3-inch exposure"
        ],
        whyItMatters: [
            "Prevents wind uplift of first course shingles",
            "Required by manufacturers for warranty",
            "Improves weather resistance at roof edges"
        ],
        templateSnippet: "Starter shingles are required by IRC R905.2.4 and GAF manufacturer specifications to provide proper wind resistance and weather protection along the roof perimeter. These are essential components that must be included in the replacement scope.",
        nextSteps: [
            "Check if insurance included starter shingles",
            "Verify manufacturer requirements",
            "Include in supplement if omitted"
        ]
    },
    
    "ridge_vent": {
        definition: "Ventilation system installed along the peak of the roof to allow hot air to escape from the attic, working with soffit vents to create proper airflow.",
        codes: [
            "IRC R806.2 requires 1 sq ft of ventilation per 150 sq ft of attic",
            "Balanced ventilation - 50% intake, 50% exhaust",
            "Ridge vent is most effective exhaust ventilation"
        ],
        whyItMatters: [
            "Prevents ice dams and moisture problems",
            "Required for energy efficiency and code compliance",
            "Extends shingle life by reducing attic heat"
        ],
        templateSnippet: "Ridge ventilation is required by IRC R806.2 to provide proper attic ventilation and prevent moisture and ice dam issues. Proper ventilation is essential for maintaining the new roofing system and ensuring code compliance.",
        nextSteps: [
            "Calculate ventilation requirements",
            "Check existing ventilation adequacy", 
            "Include ridge vent in scope if needed"
        ]
    },
    
    "step_flashing": {
        definition: "Individual pieces of metal flashing installed where the roof meets a vertical surface like a wall or chimney, with each piece lapped over the one below.",
        codes: [
            "IRC R905.2.8.2 requires flashing at wall/roof intersections",
            "Must extend at least 4 inches onto roof and up wall",
            "Each piece must overlap the one below by 2 inches minimum"
        ],
        whyItMatters: [
            "Critical for preventing water infiltration at wall intersections",
            "Insurance often overlooks step flashing replacement",
            "Improper installation is major source of leaks"
        ],
        templateSnippet: "Step flashing is required by IRC R905.2.8.2 at all wall-to-roof intersections and must be replaced when roofing is removed. This is essential weatherproofing that prevents water infiltration and structural damage.",
        nextSteps: [
            "Identify all wall-to-roof intersections",
            "Document existing step flashing condition",
            "Include replacement in roofing scope"
        ]
    },
    
    "valley_flashing": {
        definition: "Metal or membrane material installed in roof valleys where two roof slopes meet to channel water runoff and prevent leaks.",
        codes: [
            "IRC R905.2.8.3 requires valley flashing",
            "Open valleys require metal flashing minimum 24 inches wide",
            "Closed valleys require ice and water shield"
        ],
        whyItMatters: [
            "Valleys handle high water volume - critical for leak prevention",
            "Required by code and manufacturer specifications",
            "Must be replaced with roof system"
        ],
        templateSnippet: "Valley flashing is required by IRC R905.2.8.3 and manufacturer specifications to handle water runoff where roof slopes intersect. Proper valley protection is essential for preventing leaks in these high-volume water areas.",
        nextSteps: [
            "Identify all valley locations",
            "Determine open vs. closed valley requirements",
            "Include valley flashing in estimate"
        ]
    },
    
    "felt_underlayment": {
        definition: "Water-resistant barrier installed over the roof deck before shingles to provide secondary protection against water infiltration.",
        codes: [
            "IRC R905.2.3 requires underlayment over entire roof deck",
            "Minimum 15# felt or equivalent synthetic",
            "Must be lapped 2 inches at horizontal joints"
        ],
        whyItMatters: [
            "Secondary water protection beneath shingles",
            "Required by building codes",
            "Prevents deck damage if shingles fail"
        ],
        templateSnippet: "Underlayment is required by IRC R905.2.3 over the entire roof deck to provide secondary water protection. This is a critical component that must be included in any complete roofing system replacement.",
        nextSteps: [
            "Specify synthetic vs. felt underlayment",
            "Check manufacturer requirements",
            "Include in base roofing scope"
        ]
    },
    
    "gaf_guidelines": {
        definition: "Manufacturer specifications and installation requirements that must be followed to maintain warranty coverage on GAF roofing products.",
        codes: [
            "GAF Master Elite contractor requirements",
            "Specific installation procedures for each product",
            "Weather limitations and temperature requirements"
        ],
        whyItMatters: [
            "Insurance must follow manufacturer guidelines",
            "Warranty compliance requirements",
            "Professional installation standards"
        ],
        templateSnippet: "Per GAF manufacturer guidelines and installation requirements, [specific requirement] must be followed to ensure proper installation and warranty compliance. Insurance estimates must account for manufacturer specifications, not just minimum code requirements.",
        nextSteps: [
            "Reference specific GAF requirement",
            "Include manufacturer spec in estimate",
            "Use as basis for supplement requests"
        ]
    },
    
    "matching_requirements": {
        definition: "Insurance policy provisions requiring materials to match existing undamaged portions in color, texture, and appearance when partial replacement is performed.",
        codes: [
            "Maryland Insurance Administration requires matching",
            "Virginia fairness doctrine supports matching",
            "Most insurance policies include matching clauses"
        ],
        whyItMatters: [
            "Prevents patchwork appearance",
            "Required by most insurance policies",
            "Basis for full replacement arguments"
        ],
        templateSnippet: "Matching requirements per your insurance policy and state regulations require that any replacement materials match the existing undamaged portions in color, texture, and appearance. Since suitable matching materials are not available, full replacement is necessary to comply with policy provisions.",
        nextSteps: [
            "Document discontinued materials",
            "Use iTel report for matching proof",
            "Request full replacement based on matching"
        ]
    }
};

const ROOFING_TERMS_MAP = {
    // Common variations and search terms
    "drip edge": "drip_edge",
    "dripedge": "drip_edge", 
    "drip-edge": "drip_edge",
    "edge flashing": "drip_edge",
    
    "ice and water": "ice_and_water",
    "ice & water": "ice_and_water",
    "ice and water shield": "ice_and_water",
    "ice barrier": "ice_and_water",
    "ice dam protection": "ice_and_water",
    
    "starter shingles": "starter_shingles",
    "starter strip": "starter_shingles",
    "starter course": "starter_shingles",
    
    "ridge vent": "ridge_vent",
    "ridge ventilation": "ridge_vent",
    "roof vent": "ridge_vent",
    "exhaust vent": "ridge_vent",
    
    "step flashing": "step_flashing",
    "wall flashing": "step_flashing",
    "sidewall flashing": "step_flashing",
    
    "valley flashing": "valley_flashing",
    "valley": "valley_flashing",
    "roof valley": "valley_flashing",
    
    "felt": "felt_underlayment",
    "underlayment": "felt_underlayment",
    "tar paper": "felt_underlayment",
    "synthetic underlayment": "felt_underlayment",
    
    "gaf": "gaf_guidelines",
    "gaf requirements": "gaf_guidelines",
    "manufacturer guidelines": "gaf_guidelines",
    "warranty requirements": "gaf_guidelines",
    
    "matching": "matching_requirements",
    "color matching": "matching_requirements",
    "material matching": "matching_requirements"
};

/**
 * Search for roofing knowledge by term
 */
function findRoofingKnowledge(query) {
    const searchTerm = query.toLowerCase().trim();
    
    // Direct match
    if (ROOFING_TERMS_MAP[searchTerm]) {
        const key = ROOFING_TERMS_MAP[searchTerm];
        return ROOFING_KNOWLEDGE[key];
    }
    
    // Partial match search
    for (const [term, key] of Object.entries(ROOFING_TERMS_MAP)) {
        if (searchTerm.includes(term) || term.includes(searchTerm)) {
            return ROOFING_KNOWLEDGE[key];
        }
    }
    
    return null;
}

/**
 * Format roofing knowledge response
 */
function formatRoofingAnswer(knowledge, term) {
    if (!knowledge) return null;
    
    let response = `✅ **Immediate Answer**\n\n`;
    response += `${knowledge.definition}\n\n`;
    
    response += `🔎 **Supporting Evidence & Code**\n\n`;
    knowledge.codes.forEach(code => {
        response += `• ${code}\n`;
    });
    response += '\n';
    
    response += `🛠️ **Why It Matters for Roofing Claims**\n\n`;
    knowledge.whyItMatters.forEach(matter => {
        response += `• ${matter}\n`;
    });
    response += '\n';
    
    response += `📄 **Ready-to-Use Language (Template Snippet)**\n\n`;
    response += `Use this in an estimate request or supplement email:\n\n`;
    response += `"${knowledge.templateSnippet}"\n\n`;
    
    response += `🧭 **Next Steps**\n\n`;
    knowledge.nextSteps.forEach(step => {
        response += `✅ ${step}\n`;
    });
    response += '\n';
    
    response += `📧 Need a supplement email? I can help you draft one using your specific job info.`;
    
    return response;
}

export {
    ROOFING_KNOWLEDGE,
    ROOFING_TERMS_MAP,
    findRoofingKnowledge,
    formatRoofingAnswer
};