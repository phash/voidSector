/** A pre-built ship script the player can load into the AUTOMAT editor. */
export interface ProgramTemplate {
    /** Display name (German) */
    name: string;
    /** Minimum ship computer level (MK.I=1 … MK.V=5) required to run this script. */
    minLevel: number;
    /** Short German description of what the script does. */
    description: string;
    /** DSL source code, ready to compile. */
    source: string;
}
/** Five ready-to-use AUTOMAT scripts covering common automation scenarios. */
export declare const PROGRAM_TEMPLATES: ProgramTemplate[];
//# sourceMappingURL=templates.d.ts.map