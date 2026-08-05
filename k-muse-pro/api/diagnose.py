"""
Vercel Serverless Function (Python)
POST /api/diagnose

Input JSON:
  { "skinType": str, "concern": str, "freeText": str }

Output JSON (200):
  {
    "recommendations": [
      { "ingredient": str, "korean": str, "scientificName": str,
        "effect": str, "reason": str }
    ],
    "brandSlot": { "brand": str, "product": str, "korean": str, "tagline": str } | null
  }

Output JSON (400/500):
  { "error": str }
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import requests

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-5"
REQUEST_TIMEOUT_SECONDS = 15


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "We couldn't read that request. Please try again."})
            return

        skin_type = (body.get("skinType") or "").strip()
        concern = (body.get("concern") or "").strip()
        free_text = (body.get("freeText") or "").strip()

        # failure mode: empty required input
        if not skin_type or not concern:
            self._send(400, {"error": "Please choose a skin type and a main concern."})
            return

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            self._send(500, {"error": "The AI service isn't configured yet. Please try again later."})
            return

        prompt = build_prompt(skin_type, concern, free_text)

        try:
            resp = requests.post(
                ANTHROPIC_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 700,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except requests.exceptions.Timeout:
            self._send(504, {"error": "The AI is taking longer than expected. Please try again."})
            return
        except requests.exceptions.RequestException:
            self._send(502, {"error": "We couldn't reach the AI service. Please try again."})
            return

        if resp.status_code >= 400:
            self._send(502, {"error": "The AI service returned an error. Please try again shortly."})
            return

        try:
            text = resp.json()["content"][0]["text"]
            data = extract_json(text)
        except (KeyError, IndexError, ValueError):
            self._send(502, {"error": "We couldn't understand the AI's response. Please try again."})
            return

        if not isinstance(data.get("recommendations"), list) or not data["recommendations"]:
            self._send(502, {"error": "We couldn't generate a match this time. Please try again."})
            return

        self._send(200, data)

    def _send(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def build_prompt(skin_type, concern, free_text):
    return f"""You are K-Muse, an assistant that explains K-beauty ingredients to
someone who has never encountered them before, in plain, warm English.

User's skin type: {skin_type}
User's main concern: {concern}
User's own words: {free_text or "(no additional detail given)"}

Recommend 2 to 3 real K-beauty ingredients that genuinely suit this profile
(e.g. Centella Asiatica / Cica, Mugwort, Rice Bran, Snail Mucin, Propolis,
Houttuynia Cordata, Ginseng, Niacinamide, Beta-Glucan). For each one, briefly
explain in one sentence why it fits THIS person specifically, referencing
their own words if they gave any.

Reply with ONLY valid JSON, no commentary, no markdown fences, matching this
exact shape:
{{
  "recommendations": [
    {{
      "ingredient": "English/common name, e.g. Cica",
      "korean": "the Korean word, e.g. 병풀",
      "scientificName": "e.g. Centella Asiatica",
      "effect": "one short sentence on what it does",
      "reason": "one short sentence on why it fits this person"
    }}
  ]
}}
"""


def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return json.loads(text)
