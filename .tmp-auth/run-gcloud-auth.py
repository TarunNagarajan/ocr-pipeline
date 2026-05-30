import os, subprocess, threading, time
root = r"C:\Users\ultim\Documents\Codex\2026-05-27\summer-internship-assessment-https-www-notion"
out_path = os.path.join(root, '.tmp-auth', 'gcloud-auth.out.txt')
url_path = os.path.join(root, '.tmp-auth', 'gcloud-auth.url.txt')
code_path = os.path.join(root, '.tmp-auth', 'gcloud-auth.code.txt')
python = r"C:\Users\ultim\AppData\Local\Programs\Python\Python310\python.exe"
gcloud = os.path.join(root, '.gcloud-sdk-py', 'google-cloud-sdk', 'bin', 'gcloud.cmd')
env = os.environ.copy()
env['CLOUDSDK_PYTHON'] = python
proc = subprocess.Popen([gcloud, 'auth', 'login', '--update-adc', '--no-launch-browser'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env, bufsize=1)
lines = []
url_written = False
for line in proc.stdout:
    lines.append(line)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(''.join(lines))
    if ('https://accounts.google.com/o/oauth2/auth?' in line) and not url_written:
        with open(url_path, 'w', encoding='utf-8') as f:
            f.write(line.strip())
        url_written = True
        break
# continue collecting asynchronously while waiting for code

def drain():
    for line in proc.stdout:
        lines.append(line)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(''.join(lines))
threading.Thread(target=drain, daemon=True).start()
for _ in range(900):
    if os.path.exists(code_path) and os.path.getsize(code_path) > 0:
        with open(code_path, 'r', encoding='utf-8') as f:
            code = f.read().strip()
        proc.stdin.write(code + '\n')
        proc.stdin.flush()
        break
    time.sleep(1)
proc.wait(timeout=300)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(''.join(lines))
    f.write(f'\nEXIT={proc.returncode}\n')
