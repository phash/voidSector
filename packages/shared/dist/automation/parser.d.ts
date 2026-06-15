import type { CompileError, Condition, Stmt } from './types.js';
export interface ParseResult {
    ast: Stmt[];
    errors: CompileError[];
}
export declare function parseProgram(source: string): ParseResult;
export declare function parseCondition(text: string, line: number, errors: CompileError[]): Condition;
//# sourceMappingURL=parser.d.ts.map