const waitingScreen = document.getElementById("waiting-screen");
const verseScreen = document.getElementById("verse-screen");
const verseReference = document.getElementById("verse-reference");
const verseTranslation = document.getElementById("verse-translation");
const verseText = document.getElementById("verse-text");

const API_URL = "http://127.0.0.1:8000/api/projection";
let lastProjection = null;
let fitFrame = 0;

function fitVerseToScreen() {
    cancelAnimationFrame(fitFrame);

    fitFrame = requestAnimationFrame(() => {
        if (verseScreen.hidden || !verseText.textContent.trim()) return;

        const maxSize = Math.min(window.innerWidth * 0.033, 54);
        const minSize = 14;

        verseText.style.fontSize = `${maxSize}px`;

        const availableHeight = verseScreen.clientHeight;
        const availableWidth = verseScreen.clientWidth;

        let size = maxSize;

        while (
            size > minSize &&
            (
                verseText.scrollHeight > availableHeight ||
                verseText.scrollWidth > availableWidth
            )
        ) {
            size -= 1;
            verseText.style.fontSize = `${size}px`;
        }

        verseText.style.overflow = "visible";
        verseScreen.style.overflow = "hidden";
    });
}

function showVerse(reference, text, translation) {
    verseReference.textContent = reference || "";
    verseTranslation.textContent = translation || "NKJV";
    verseText.textContent = text || "";

    verseText.style.fontSize = "";
    waitingScreen.hidden = true;
    verseScreen.hidden = false;

    fitVerseToScreen();
}

function clearProjection() {
    verseReference.textContent = "";
    verseTranslation.textContent = "";
    verseText.textContent = "";
    verseText.style.fontSize = "";

    verseScreen.hidden = true;
    waitingScreen.hidden = false;
}

async function syncProjection() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        const projection = data.projection;

        if (!projection) {
            if (lastProjection !== null) {
                clearProjection();
            }

            lastProjection = null;
            return;
        }

        const key =
            `${projection.reference}|${projection.text}|${projection.translation}`;

        if (key !== lastProjection) {
            showVerse(
                projection.reference,
                projection.text,
                projection.translation
            );

            lastProjection = key;
        } else {
            fitVerseToScreen();
        }
    } catch (error) {
        console.error("Projection sync failed:", error);
    }
}

window.addEventListener("resize", fitVerseToScreen);

if (window.ResizeObserver) {
    new ResizeObserver(fitVerseToScreen).observe(verseScreen);
}

syncProjection();
setInterval(syncProjection, 1000);