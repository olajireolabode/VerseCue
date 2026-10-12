
import re
from dataclasses import dataclass


@dataclass
class BibleReference:
    book: str
    chapter: int
    verse: int | None = None


def parse_reference(reference: str) -> BibleReference:
    """Parse common Bible reference formats into book, chapter, and verse."""

    reference = reference.strip()
    if not reference:
        raise ValueError("Bible reference cannot be empty")

    # Example: John chapter 3 verse 16
    match = re.fullmatch(
        r"(.+?)\s+chapter\s+(\d+)\s+verse\s+(\d+)",
        reference,
        re.IGNORECASE,
    )

    # Example: John 3:16 or John 3:16-18
    if not match:
        match = re.fullmatch(
            r"(.+?)\s+(\d+):(\d+)(?:\s*-\s*\d+)?",
            reference,
            re.IGNORECASE,
        )

    # Example: John 3 16
    if not match:
        match = re.fullmatch(
            r"(.+?)\s+(\d+)\s+(\d+)",
            reference,
            re.IGNORECASE,
        )

    if match:
        book = match.group(1).strip()
        chapter = int(match.group(2))
        verse = int(match.group(3))

        return BibleReference(book=book, chapter=chapter, verse=verse)

    # Example: Psalm 23 or John chapter 3
    match = re.fullmatch(
        r"(.+?)\s+(?:chapter\s+)?(\d+)",
        reference,
        re.IGNORECASE,
    )

    if match:
        book = match.group(1).strip()
        chapter = int(match.group(2))

        return BibleReference(book=book, chapter=chapter, verse=None)

    raise ValueError(f"Invalid Bible reference: {reference}")


if __name__ == "__main__":
    examples = [
        "John 3:16",
        "John 3 16",
        "John chapter 3 verse 16",
        "1 Corinthians 13 4",
        "Psalm 23",
        "John chapter 3",
    ]

    for example in examples:
        try:
            print(f"{example} -> {parse_reference(example)}")
        except ValueError as error:
            print(f"{example} -> ERROR: {error}")
