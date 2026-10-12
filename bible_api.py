import os
import requests
from dotenv import load_dotenv
from dataclasses import dataclass
from bible_reference import resolve_reference
from parser import parse_reference

load_dotenv()

@dataclass
class BiblePassage:
    reference: str
    text: str

class BibleClient:
    BASE_URL = "https://rest.api.bible/v1"


    def __init__(self, bible_id=None):
        self.api_key = os.getenv("BIBLE_API_KEY")

        if not self.api_key:
            raise RuntimeError("BIBLE_API_KEY is not configured")

        self.bible_id = bible_id or "63097d2a0a2f7db3-01"

        self.session = requests.Session()
        self.session.headers.update({
            "api-key": self.api_key
        })


    def get_bibles(self):
        response = self.session.get(
            f"{self.BASE_URL}/bibles",
            timeout=10
        )

        response.raise_for_status()
        return response.json()

    def get_passage(self, passage_id):
        response = self.session.get(
            f"{self.BASE_URL}/bibles/{self.bible_id}/passages/{passage_id}",
            params={
                "content-type": "json"
            },
            timeout=10
        )

        response.raise_for_status()

        data = response.json()["data"]

        text_parts = []

        def extract_text(items):
            for item in items:
                if item["type"] == "text" and "verseId" in item.get("attrs", {}):
                    text_parts.append(item["text"])

                if "items" in item:
                    extract_text(item["items"])

        extract_text(data["content"])

        return BiblePassage(
            reference=data["reference"],
            text="".join(text_parts).strip()
        )

    def get_passage_by_reference(self, book, chapter, verse):
        passage_id = resolve_reference(book, chapter, verse)

        return self.get_passage(passage_id)

    def get_passage_from_text(self, reference):
        parsed = parse_reference(reference)

        return self.get_passage_by_reference(
            parsed.book,
            parsed.chapter,
            parsed.verse
        )

    def reference_exists(self, reference):
        try:
            passage = self.get_passage_from_text(reference)
            return passage is not None

        except Exception:
            return False

    
    def search_text(self, query, limit=10, fuzziness=1):
        response = self.session.get(
            f"{self.BASE_URL}/bibles/{self.bible_id}/search",
            params={
                "query": query,
                "limit": limit,
                "fuzziness": fuzziness
            },
            timeout=15
        )

        response.raise_for_status()
        return response.json()


if __name__ == "__main__":
    client = BibleClient()

    references = [
        "John 3:16",
        "John 31:6"
    ]

    for reference in references:
        exists = client.reference_exists(reference)

        print(f"{reference}: {exists}")