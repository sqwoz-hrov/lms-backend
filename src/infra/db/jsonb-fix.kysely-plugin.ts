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

function isPlainObject(v: unknown): v is Record<string, unknown> {
	if (v === null || typeof v !== 'object') return false;
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
}

export class JsonbFixPlugin implements KyselyPlugin {
	private jsonbArrayColumns: Set<string>;

	constructor(jsonbArrayColumns: JsonbArrayColumn[] = []) {
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
		if (!isPlainObject(row)) return row;

		const fixed: any = {};
		for (const [key, value] of Object.entries(row)) {
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
			isPlainObject(value) &&
			Object.keys(value).length === 0 &&
			Array.from(this.jsonbArrayColumns).some(col => col.endsWith(`.${columnName}`))
		);
	}

	private fixJsonbValue(value: any): any {
		if (Array.isArray(value)) {
			return value.map(item => this.fixJsonbValue(item));
		}
		// Only recurse into plain JSON-like objects.
		if (isPlainObject(value)) {
			return this.fixJsonbInRow(value);
		}
		// Dates, Buffers, Uint8Arrays, BigInts wrapped, etc. are returned as-is.
		return value;
	}
}
