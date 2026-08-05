"""
Vercel Serverless Function (Python)
POST /api/generate_report

Input JSON:
  {
    "skinType": str, "concern": str, "freeText": str,
    "recommendations": [ { "ingredient": str, ... }, ... ],
    "budget": str
  }

Output JSON (200):
  {
    "weeks": [ { "label": str, "plan": str }, ... ],
    "caution": str,
    "shareSummary": str
  }

Output JSON (400/500): { "error": str }

Note: in this course project, "unlocking" this endpoint is simulated on the
client (see js/report.js). A production deployment would verify a completed
payment (e.g. a Stripe session) before calling this function.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import requests

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-5"
REQUEST_TIMEOUT_SECONDS = 20


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
        budget = (body.get("budget") or "Mid-range").strip()
        recommendations = body.get("recommendations") or []

        if not skin_type or not concern or not recommendations:
            self._send(400, {"error": "We need your Skin Story results first — please redo the diagnosis."})
            return

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            self._send(500, {"error": "The AI service isn't configured yet. Please try again later."})
            return

        prompt = build_prompt(skin_type, concern, free_text, recommendations, budget)

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
                    "max_tokens": 900,
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

        if not isinstance(data.get("weeks"), list) or not data["weeks"]:
            self._send(502, {"error": "We couldn't build a routine this time. Please try again."})
            return

        self._send(200, data)

    def _send(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def build_prompt(skin_type, concern, free_text, recommendations, budget):
    ingredient_names = ", ".join(
        r.get("ingredient", "") for r in recommendations if r.get("ingredient")
    )
    return f"""You are K-Muse, an assistant that turns K-beauty ingredient matches
into a simple, followable routine for someone new to K-beauty.

Skin type: {skin_type}
Main concern: {concern}
Extra context from the user: {free_text or "(none given)"}
Ingredients already matched to this person: {ingredient_names or "(none given)"}
Budget tier: {budget}

Write a 4-week routine plan that gradually introduces these ingredients
(don't add everything on day one — build up so the skin can adjust). For
each week give a short AM/PM plan in plain English. Also give one short
caution note about ingredient combinations to avoid or space out. Finally
write one short, shareable one-sentence summary of this whole routine.

Reply with ONLY valid JSON, no commentary, no markdown fences, matching this
exact shape:
{{
  "weeks": [
    {{ "label": "Week 1", "plan": "..." }},
    {{ "label": "Week 2", "plan": "..." }},
    {{ "label": "Week 3", "plan": "..." }},
    {{ "label": "Week 4", "plan": "..." }}
  ],
  "caution": "...",
  "shareSummary": "..."
}}
"""


def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return json.loads(text)
