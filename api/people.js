// /api/people  — 인원(출입 허용자) 목록 관리
// GET    : 전체 인원 목록 조회
// POST   : 인원 추가 (1명 또는 배열로 여러명 일괄)
// PUT    : 인원 정보 수정 (id 필요)
// DELETE : 인원 삭제 (?id=xxx)

import { kv } from '@vercel/kv';

const KEY = 'access:people';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const people = (await kv.get(KEY)) || [];
      return res.status(200).json({ ok: true, people });
    }

    if (req.method === 'POST') {
      const people = (await kv.get(KEY)) || [];
      const incoming = Array.isArray(req.body) ? req.body : [req.body];

      const added = [];
      const skipped = [];
      for (const p of incoming) {
        if (!p.id || !p.name) { skipped.push(p); continue; }
        if (people.find(x => x.id === p.id)) { skipped.push(p); continue; }
        people.push({
          id: p.id,
          name: p.name,
          dept: p.dept || '',
          phone: p.phone || '',
          type: p.type || '정규직',
          startDate: p.startDate || null,
          endDate: p.endDate || null,
          status: 'active',
          note: p.note || '',
          createdAt: new Date().toISOString(),
        });
        added.push(p.id);
      }
      await kv.set(KEY, people);
      return res.status(200).json({ ok: true, added: added.length, skipped: skipped.length, people });
    }

    if (req.method === 'PUT') {
      const people = (await kv.get(KEY)) || [];
      const body = req.body;
      const idx = people.findIndex(x => x.id === body.id);
      if (idx < 0) return res.status(404).json({ ok: false, error: 'not_found' });
      const { newId, ...rest } = body;
      people[idx] = { ...people[idx], ...rest };
      if (newId && newId !== body.id) {
        people[idx].id = newId;
      }
      await kv.set(KEY, people);
      return res.status(200).json({ ok: true, people });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      let people = (await kv.get(KEY)) || [];
      people = people.filter(x => x.id !== id);
      await kv.set(KEY, people);
      return res.status(200).json({ ok: true, people });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
