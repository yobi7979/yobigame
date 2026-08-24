# qc_vision.py — 8084 멀티모달 llama-server로 이미지 QC
# 사용: python qc_vision.py <이미지경로> "<질문>" [max_tokens]
import base64, io, json, sys, urllib.request
from PIL import Image

img_path = sys.argv[1]
question = sys.argv[2]
max_tokens = int(sys.argv[3]) if len(sys.argv) > 3 else 3000

im = Image.open(img_path).convert('RGB')
w, h = im.size
im = im.resize((w // 2, h // 2))
buf = io.BytesIO()
im.save(buf, 'JPEG', quality=80)
b64 = base64.b64encode(buf.getvalue()).decode()

payload = {
    "model": "local",
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            {"type": "text", "text": question},
        ],
    }],
    "max_tokens": max_tokens,
    "temperature": 0.1,
}
req = urllib.request.Request(
    "http://192.168.201.104:8084/v1/chat/completions",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=180) as r:
    data = json.loads(r.read().decode())
msg = data["choices"][0]["message"]
print("FINISH:", data["choices"][0].get("finish_reason"))
c = (msg.get("content") or "").strip()
if c:
    print("CONTENT:", c[:2000])
rc = (msg.get("reasoning_content") or "").strip()
if rc:
    print("REASONING_TAIL:", rc[-2500:])
