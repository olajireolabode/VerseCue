import re
from dataclasses import dataclass
from difflib import get_close_matches, SequenceMatcher

from bible_reference import is_valid_book


@dataclass
class DetectedReference:
    reference: str
    confidence: float


BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John",
    "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
    "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
    "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation"
]

ALIASES = {
    "ps": "Psalms", "psalm": "Psalms", "psalms": "Psalms",
    "rev": "Revelation", "revelation": "Revelation",
    "revelations": "Revelation", "revel": "Revelation",
    "song of songs": "Song of Solomon", "songs": "Song of Solomon",
    "canticles": "Song of Solomon",
    "matt": "Matthew", "mt": "Matthew", "mk": "Mark", "lk": "Luke",
    "jn": "John", "jhn": "John", "rom": "Romans", "ro": "Romans",
    "1 cor": "1 Corinthians", "i cor": "1 Corinthians",
    "1 corinthians": "1 Corinthians", "2 cor": "2 Corinthians",
    "2 corinthians": "2 Corinthians",
    "1 thess": "1 Thessalonians", "2 thess": "2 Thessalonians",
    "1 tim": "1 Timothy", "2 tim": "2 Timothy",
    "phil": "Philippians", "philip": "Philippians",
    "col": "Colossians", "eph": "Ephesians", "gal": "Galatians",
    "heb": "Hebrews", "jas": "James", "1 pet": "1 Peter",
    "2 pet": "2 Peter", "1 jn": "1 John", "2 jn": "2 John",
    "3 jn": "3 John", "1 sam": "1 Samuel", "2 sam": "2 Samuel",
    "1 kings": "1 Kings", "2 kings": "2 Kings",
    "1 chron": "1 Chronicles", "2 chron": "2 Chronicles",
    "neh": "Nehemiah", "est": "Esther", "prov": "Proverbs",
    "eccl": "Ecclesiastes", "isa": "Isaiah", "jer": "Jeremiah",
    "lam": "Lamentations", "ezek": "Ezekiel", "dan": "Daniel",
    "hos": "Hosea", "obad": "Obadiah", "zech": "Zechariah",
    "mal": "Malachi", "joel": "Joel", "mic": "Micah", "nah": "Nahum",
    "hab": "Habakkuk", "zeph": "Zephaniah", "hag": "Haggai",
    "deut": "Deuteronomy", "lev": "Leviticus", "num": "Numbers",
    "gen": "Genesis", "ex": "Exodus", "josh": "Joshua",
    "judg": "Judges", "phlm": "Philemon",
    "1 th": "1 Thessalonians", "2 th": "2 Thessalonians",
    "1 corinth": "1 Corinthians", "2 corinth": "2 Corinthians",
}

NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13,
    "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
    "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30,
    "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90,
}


def _key(value):
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def canonical_book(raw):
    key = _key(raw)

    if key in ALIASES:
        return ALIASES[key]

    for book in BOOKS:
        if _key(book) == key:
            return book

    choices = {_key(book): book for book in BOOKS}
    choices.update({_key(alias): book for alias, book in ALIASES.items()})

    matches = get_close_matches(key, list(choices.keys()), n=2, cutoff=0.78)

    if not matches:
        return None

    if len(matches) == 1:
        return choices[matches[0]]

    first_score = SequenceMatcher(None, key, matches[0]).ratio()
    second_score = SequenceMatcher(None, key, matches[1]).ratio()

    if first_score - second_score >= 0.08:
        return choices[matches[0]]

    return None


def parse_number_phrase(phrase):
    words = phrase.lower().replace("-", " ").split()

    if phrase.strip().isdigit():
        return int(phrase.strip())

    total = 0
    for word in words:
        if word in NUMBER_WORDS:
            total += NUMBER_WORDS[word]

    return total or None


BOOK_PATTERN = "|".join(
    re.escape(name)
    for name in sorted(
        set(BOOKS + list(ALIASES.keys())),
        key=len,
        reverse=True
    )
)

BOOK_PATTERN = rf"(?<![A-Za-z])({BOOK_PATTERN})(?![A-Za-z])"


def detect_references(transcript):
    if not transcript:
        return []

    text = transcript.replace("’", "'")
    candidates = []

    def add(raw_book, chapter_raw, verse_raw=None):
        book = canonical_book(raw_book)

        if not book:
            return

        chapter = parse_number_phrase(str(chapter_raw))

        if not chapter or chapter < 1:
            return

        if verse_raw is not None:
            verse = parse_number_phrase(str(verse_raw))

            if not verse or verse < 1:
                return

            candidates.append(f"{book} {chapter}:{verse}")
            return

        # For merged speech such as "John 316", try 3:16 and 31:6.
        digits = str(chapter_raw)

        for split in range(1, len(digits)):
            ch = int(digits[:split])
            vs = int(digits[split:])

            if ch > 0 and vs > 0:
                candidates.append(f"{book} {ch}:{vs}")

    # Standard formats: John 3:16 and John 3 verse 16.
    patterns = [
        rf"{BOOK_PATTERN}\s+(\d{{1,3}})\s*:\s*(\d{{1,3}})",
        rf"{BOOK_PATTERN}\s+(\d{{1,3}})\s+verse\s+(\d{{1,3}})",
        rf"{BOOK_PATTERN}\s+chapter\s+([A-Za-z-]+|\d{{1,3}})\s+verse\s+([A-Za-z-]+|\d{{1,3}})",
        rf"{BOOK_PATTERN}\s+([A-Za-z-]+|\d{{1,3}})\s+([A-Za-z-]+|\d{{1,3}})",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            add(match.group(1), match.group(2), match.group(3))

    # Merged references such as "John 316".
    pattern = rf"{BOOK_PATTERN}\s+(\d{{2,4}})(?!\s*[:\d])"

    for match in re.finditer(pattern, text, re.IGNORECASE):
        add(match.group(1), match.group(2))

    # Fuzzy fallback for a slightly misheard book name:
    # "revelaton 2 9" should suggest Revelation 2:9.
    tokens = list(re.finditer(r"[A-Za-z]+|\d{1,4}", text))

    for i in range(2, len(tokens)):
        if not tokens[i].group().isdigit():
            continue

        if not tokens[i - 1].group().isdigit():
            continue

        chapter_raw = tokens[i - 1].group()
        verse_raw = tokens[i].group()

        if len(chapter_raw) > 3 or len(verse_raw) > 3:
            continue

        for word_count in (3, 2, 1):
            start_i = i - 1 - word_count

            if start_i < 0:
                continue

            words = [token.group() for token in tokens[start_i:i - 1]]
            raw_book = " ".join(words)
            book = canonical_book(raw_book)

            if book:
                candidate = f"{book} {int(chapter_raw)}:{int(verse_raw)}"

                if candidate not in candidates:
                    candidates.append(candidate)

                break

    return list(dict.fromkeys(candidates))


def find_valid_references(transcript, bible_client):
    valid_references = []
    seen = set()

    for reference in detect_references(transcript):
        try:
            exists = bible_client.reference_exists(reference)
        except Exception:
            exists = False

        if exists and reference.casefold() not in seen:
            seen.add(reference.casefold())
            valid_references.append(
                DetectedReference(reference=reference, confidence=1.0)
            )

    return valid_references


if __name__ == "__main__":
    tests = [
        "rev 2 9",
        "revelations 2:9",
        "revelaton 2 9",
        "Esther 8 9",
        "1 cor 13 4",
        "ps 23 1",
        "John 3:16",
        "John chapter three verse sixteen",
        "John 316",
    ]

    for test in tests:
        print(test, "=>", detect_references(test))