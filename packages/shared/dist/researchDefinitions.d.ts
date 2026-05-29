export interface ResearchNode {
    id: string;
    name: string;
    branch: string;
    description: string;
    effect: Record<string, number>;
    wissenCost: number;
    prerequisiteModuleId: string;
    prerequisiteResearchId?: string;
}
export declare const RESEARCH_DEFINITIONS: ResearchNode[];
//# sourceMappingURL=researchDefinitions.d.ts.map