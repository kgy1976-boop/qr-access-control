// /api/log  — 출입 스캔 로그
// GET  : 최근 로그 조회 (?limit=100)
// POST : 로그 1건 추가
// DELETE: 전체 로그 삭제

import { kv } from '@vercel/kv';

const KEY = 'access:log';
const MAX_LOG = 500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const limit = parseInt(req.query.limit) || 100;
      const log = (await kv.get(KEY)) || [];
      return res.status(200).json({ ok: true, log: log.slice(0, limit) });
    }

    if (req.method === 'POST') {
      const entry = req.body;
      const log = (await kv.get(KEY)) || [];
      log.unshift({ ...entry, ts: new Date().toISOString() });
      if (log.length > MAX_LOG) log.length = MAX_LOG;
      await kv.set(KEY, log);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await kv.set(KEY, []);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
