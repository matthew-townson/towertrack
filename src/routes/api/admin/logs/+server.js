import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db.js';

const allowedTypes = new Set(['All', 'Info', 'Error', 'Success', 'Warn', 'Debug']);

export async function GET({ url, locals }) {
	if (!locals.user || locals.user.permission !== 0) {
		throw error(401, 'Unauthorized');
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const pageSize = Math.min(500, Math.max(1, parseInt(url.searchParams.get('pageSize') || '100', 10)));
	const selectedType = url.searchParams.get('type') || 'All';
	const sortByType = url.searchParams.get('sortByType') === 'true';
	const sortAsc = url.searchParams.get('sortAsc') === 'true';
	const search = (url.searchParams.get('search') || '').trim();

	if (!allowedTypes.has(selectedType)) {
		throw error(400, 'Invalid log type filter');
	}

	const whereClauses = [];
	const params = [];

	if (selectedType !== 'All') {
		whereClauses.push('type = ?');
		params.push(selectedType.toUpperCase());
	}

	if (search) {
		whereClauses.push('text LIKE ?');
		params.push(`%${search}%`);
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
	const orderSql = sortByType
		? `ORDER BY type ${sortAsc ? 'ASC' : 'DESC'}, id DESC`
		: 'ORDER BY id DESC';
	const offset = (page - 1) * pageSize;

	try {
		const [[{ total }]] = await db.execute(
			`SELECT COUNT(*) as total FROM Log ${whereSql}`,
			params
		);

		const [logs] = await db.execute(
			`SELECT id, type, timestamp, text
			 FROM Log
			 ${whereSql}
			 ${orderSql}
			 LIMIT ${pageSize} OFFSET ${offset}`,
			params
		);

		return json({
			logs,
			total,
			page,
			pageSize
		});
	} catch (err) {
		console.error('Failed to load logs page:', err);
		throw error(500, 'Failed to load logs');
	}
}