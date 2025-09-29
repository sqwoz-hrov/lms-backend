/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
	KyselyPlugin,
	PluginTransformQueryArgs,
	PluginTransformResultArgs,
	QueryResult,
	RootOperationNode,
	UnknownRow,
} from 'kysely';

interface JsonbArrayColumn {
	table: string;
	column: string;
}

export class JsonbFixPlugin implements KyselyPlugin {
	private jsonbArrayColumns: Set<string>;

	constructor(jsonbArrayColumns: JsonbArrayColumn[] = []) {
		// Store as "table.column" format for quick lookup
		this.jsonbArrayColumns = new Set(jsonbArrayColumns.map(col => `${col.table}.${col.column}`));
	}

	transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
		return args.node;
	}

	async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
		return {
			...args.result,
			rows: args.result.rows.map(row => this.fixJsonbInRow(row)),
		};
	}

	private fixJsonbInRow(row: any): any {
		if (!row || typeof row !== 'object') {
			return row;
		}

		const fixed: any = {};

		for (const [key, value] of Object.entries(row)) {
			// Check if this is a known JSONB array column
			if (this.shouldBeArray(key, value)) {
				fixed[key] = [];
			} else {
				fixed[key] = this.fixJsonbValue(value);
			}
		}

		return fixed;
	}

	private shouldBeArray(columnName: string, value: any): boolean {
		return (
			value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			Object.keys(value).length === 0 &&
			// Check if this column is registered as a JSONB array
			Array.from(this.jsonbArrayColumns).some(col => col.endsWith(`.${columnName}`))
		);
	}

	private fixJsonbValue(value: any): any {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return this.fixJsonbInRow(value);
		}

		if (Array.isArray(value)) {
			return value.map(item => this.fixJsonbValue(item));
		}

		return value;
	}
}
