"""Production smoke test: temporary login users, read-only data calls, cleanup.

Never prints credentials, cookies, API keys or returned records. No notifications
are sent. Temporary users and their sessions are removed in finally blocks.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import secrets
import sqlite3
import time
import urllib.request
import urllib.parse

import bcrypt


def call(url, headers=None, body=None):
    request = urllib.request.Request(url, headers=headers or {}, data=json.dumps(body).encode() if body is not None else None)
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read())
        return payload, response.headers, round((time.perf_counter() - started) * 1000, 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8890')
    args = parser.parse_args()
    tenants = json.loads(Path('/home/valk/valk/tenant.json').read_text())
    reports, isolation = [], []
    for tenant in tenants:
        raw = Path(tenant['db_uri'][len('sqlite:///'):])
        path = raw if raw.is_absolute() else Path('/home/valk') / raw
        db = sqlite3.connect(path, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        user_id = None
        username = 'performance-smoke-' + secrets.token_hex(10)
        password = secrets.token_urlsafe(32)
        tenant_id = tenant.get('id') or re.sub('[^a-z0-9]+', '-', tenant['name'].lower()).strip('-')
        try:
            user_id = db.execute('INSERT INTO users(username,password_hash,is_admin,active,role,must_change_password) VALUES(?,?,1,1,\'admin\',0)', (username, bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode())).lastrowid
            db.commit()
            payload, headers, duration = call(args.base_url + '/api/session/login', {'Content-Type': 'application/json', 'Origin': args.base_url}, {'username': username, 'password': password, 'tenantId': tenant_id})
            assert payload.get('ok') and payload['tenant']['id'] == tenant_id
            cookie = next(value.split(';')[0] for value in headers.get_all('Set-Cookie') if value.startswith('valk_dashboard_session='))
            report = {'tenant': tenant['name'], 'login_ms': duration, 'requests': []}
            for endpoint in ['/api/bff/home', '/api/bff/data-explorer?table=event&options=1', '/api/bff/data-explorer?table=event&search=performance-smoke-nonexistent&page=2&page_size=25', '/api/bgs-alerts?limit=2']:
                data, _, ms = call(args.base_url + endpoint, {'Cookie': cookie})
                if 'options=1' in endpoint:
                    assert data['data'] == [] and data['meta']['filter_options']['events']
                if 'search=' in endpoint:
                    assert data['data'] == [] and data['pagination']['total'] == 0
                report['requests'].append({'path': endpoint, 'status': 200, 'duration_ms': ms})
            reports.append(report)
            expected = dict(db.execute('SELECT * FROM event ORDER BY id DESC LIMIT 1').fetchone())
            isolation.append((tenant, expected))
            preferences = [json.loads(row[0]) for row in db.execute("SELECT payload_json FROM dashboard_view_preference WHERE view_key='bgs-system-watchlist'")]
            systems = max(([entry['system'] for entry in preference.get('systems', []) if isinstance(entry, dict) and entry.get('system')] for preference in preferences), key=len, default=[])[:100]
            if systems:
                data, _, ms = call('http://127.0.0.1:5000/api/system-watchlist-data', {'apikey': tenant['api_key'], 'apiversion': str(tenant.get('api_version', '1.8.0')), 'Content-Type': 'application/json'}, {'systems': systems, 'history_days': 7})
                assert len(data['data']) == len(systems)
                report['watchlist'] = {'systems': len(systems), 'status': 200, 'duration_ms': ms}
        finally:
            if user_id is not None:
                db.execute('DELETE FROM dashboard_session WHERE userId=?', (user_id,))
                db.execute('DELETE FROM dashboard_account WHERE userId=?', (user_id,))
                db.execute('DELETE FROM users WHERE id=? AND username=?', (user_id, username))
                db.commit()
                assert db.execute('SELECT COUNT(*) FROM users WHERE username=?', (username,)).fetchone()[0] == 0
            db.close()

    def check(item):
        tenant, expected = item
        query = urllib.parse.urlencode({'page': 1, 'filters': json.dumps([{'field': 'id', 'operator': 'eq', 'value': expected['id']}])})
        data, _, ms = call('http://127.0.0.1:5000/api/table/event?' + query, {'apikey': tenant['api_key'], 'apiversion': str(tenant.get('api_version', '1.8.0'))})
        assert data['data'] == [expected], 'Concurrent tenant isolation mismatch'
        return {'tenant': tenant['name'], 'matched': True, 'duration_ms': ms}

    with ThreadPoolExecutor(max_workers=3) as pool:
        parallel = list(pool.map(check, isolation * 4))
    print(json.dumps({'measured_at': datetime.now(timezone.utc).isoformat(), 'base_url': args.base_url, 'logins_and_bff': reports, 'parallel_tenant_reads': parallel, 'temporary_users_removed': True}, indent=2))


if __name__ == '__main__':
    main()
