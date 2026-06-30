// /api/verify  — QR 코드 스캔 검증 (서버 측 판정)
// POST { id, sig } → { ok, allow, reason, person }

import { kv } from '@vercel/kv';

const SECRET = 'HY-INDUSTRY-2024-SECRET-KEY';
const PEOPLE_KEY = 'access:people';
const LOG_KEY = 'access:log';

function signId(id) {
  let h = 0;
  const s = id + SECRET;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const { id, sig } = req.body;

    const logEntry = (type, name, dept, reason, pid) => {
      return kv.get(LOG_KEY).then(log => {
        log = log || [];
        log.unshift({ type, name, dept, reason, pid, ts: new Date().toISOString() });
        if (log.length > 500) log.length = 500;
        return kv.set(LOG_KEY, log);
      });
    };

    if (!id || !sig || signId(id) !== sig) {
      await logEntry('deny', '미등록', '-', '위조/미등록 QR', id || null);
      return res.status(200).json({ ok: true, allow: false, reason: 'invalid_signature' });
    }

    const people = (await kv.get(PEOPLE_KEY)) || [];
    const p = people.find(x => x.id === id);

    if (!p) {
      await logEntry('deny', '삭제됨', '-', '데이터 없음', id);
      return res.status(200).json({ ok: true, allow: false, reason: 'not_found' });
    }

    if (p.status === 'inactive') {
      await logEntry('deny', p.name, p.dept, '출입정지', p.id);
      return res.status(200).json({ ok: true, allow: false, reason: 'inactive', person: p });
    }

    const now = new Date();
    if (p.endDate && new Date(p.endDate + 'T23:59:59') < now) {
      await logEntry('deny', p.name, p.dept, '기간만료', p.id);
      return res.status(200).json({ ok: true, allow: false, reason: 'expired', person: p });
    }

    if (p.startDate && new Date(p.startDate) > now) {
      await logEntry('deny', p.name, p.dept, '기간미도래', p.id);
      return res.status(200).json({ ok: true, allow: false, reason: 'not_started', person: p });
    }

    await logEntry('allow', p.name, p.dept, '정상', p.id);
    return res.status(200).json({ ok: true, allow: true, reason: 'ok', person: p });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
