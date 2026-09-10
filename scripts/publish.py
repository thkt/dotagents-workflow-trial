import argparse, base64, hashlib, json, os, subprocess, tempfile, time, sys, urllib.request, urllib.error

def run(args, data=None, env=None):
    p = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=120)
    if p.returncode:
        raise RuntimeError('Command failed: ' + args[0] + ' (exit ' + str(p.returncode) + ')')
    return p.stdout

def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=')

def api(path, token, method='GET', body=None):
    if path.startswith('/app'):
        req = urllib.request.Request('https://api.github.com' + path, data=None if body is None else json.dumps(body).encode(), method=method, headers={'Authorization':'Bearer ' + token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json', 'User-Agent':'dotagents-trial-read-check'})
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            raise RuntimeError('GitHub ' + path + ': HTTP ' + str(e.code)) from None
    env = dict(os.environ)
    env['GH_TOKEN'] = token
    env.pop('GH_DEBUG', None)
    args = ['gh', 'api', '--hostname', 'github.com', '-X', method, path]
    if body is not None:
        args += ['--input', '-']
    output = run(args, None if body is None else json.dumps(body).encode(), env)
    return json.loads(output) if output else None

def main():
    parser = argparse.ArgumentParser(description='Create a trial PR as the GitHub App.')
    parser.add_argument('--head', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--body-file', required=True)
    args = parser.parse_args()
    if not args.head.strip() or args.head == 'main' or not args.title.strip():
        parser.error('A non-main head and a non-empty title are required')
    body_file = os.path.abspath(args.body_file)
    with open(body_file, encoding='utf-8') as f:
        if not f.read().strip():
            parser.error('PR body must not be empty')
    with tempfile.TemporaryDirectory(prefix='dotagents-key-') as d:
        path = os.path.join(d, 'key.pem')
        key = run(['/usr/bin/security','find-generic-password','-s','thkt.dotagents-workflow-trial.github-app','-a','4881432','-w',os.path.expanduser('~/Library/Keychains/login.keychain-db')])
        if not key.startswith(b'-----BEGIN'):
            key = bytes.fromhex(key.decode().strip())
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as f:
            f.write(key)
        pub = run(['openssl','rsa','-in',path,'-pubout','-outform','DER'])
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(pub).digest()).decode()
        if fingerprint != 'SHA256:j3DolAZcTa3JO6mnUyYzIdoS5+T5lt9rGedZ1hY+uqo=':
            raise RuntimeError('Unexpected key fingerprint')
        now = int(time.time())
        payload = b64(json.dumps({'alg':'RS256','typ':'JWT'}).encode()) + b'.' + b64(json.dumps({'iat':now-60,'exp':now+300,'iss':'Iv23liEl9AuQXWekODVl'}).encode())
        signature = run(['openssl','dgst','-sha256','-sign',path], payload)
        jwt = (payload + b'.' + b64(signature)).decode()
    app = api('/app', jwt)
    assert app['id'] == 4881432
    installation = api('/app/installations/160237952', jwt)
    assert installation['account']['login'] == 'thkt'
    issued = api('/app/installations/160237952/access_tokens', jwt, 'POST', {'repository_ids':[1362242696], 'permissions':{'pull_requests':'write','contents':'read','metadata':'read'}})
    token = issued['token']
    try:
        env = dict(os.environ)
        env['GH_TOKEN'] = token
        env.pop('GH_DEBUG', None)
        existing = json.loads(run(['gh', 'pr', 'list', '--repo', 'thkt/dotagents-workflow-trial',
                                  '--state', 'open', '--head', args.head, '--base', 'main',
                                  '--json', 'url'], env=env))
        if existing:
            print('Existing PR: ' + existing[0]['url'])
        else:
            output = run(['gh', 'pr', 'create', '--repo', 'thkt/dotagents-workflow-trial',
                          '--base', 'main', '--head', args.head, '--title', args.title,
                          '--body-file', body_file], env=env)
            print(output.decode().strip())
    finally:
        api('/installation/token', token, 'DELETE')
        print('Temporary installation token revoked.')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('Publish failed: ' + (str(e) if isinstance(e, RuntimeError) else type(e).__name__), file=sys.stderr)
        sys.exit(1)
