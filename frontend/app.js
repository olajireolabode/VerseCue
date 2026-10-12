"use strict";



// ========================================

// VERSECUE CONFIGURATION

// ========================================



const API_BASE = "http://127.0.0.1:8000/api";

const API_URL = `${API_BASE}/history`;

const HEALTH_URL = `${API_BASE}/health`;

const SYSTEM_STATUS_URL = `${API_BASE}/status`;

const BIBLES_URL = `${API_BASE}/bibles`;

const BIBLE_PASSAGE_URL = `${API_BASE}/bible`;

const CONTEXT_SEARCH_URL = `${API_BASE}/context-search`;

const PROJECTION_URL = `${API_BASE}/projection`;

const DETECT_URL = `${API_BASE}/detect`;

const DEFAULT_BIBLE_ID = "63097d2a0a2f7db3-01";



// ========================================

// DASHBOARD ELEMENTS

// ========================================



const backendStatusDot = document.getElementById("backend-status-dot");

const backendStatusText = document.getElementById("backend-status-text");

const listenerStatusDot = document.getElementById("listener-status-dot");

const listenerStatusText = document.getElementById("listener-status-text");



const historyList = document.getElementById("history-list");

const totalCount = document.getElementById("total-count");

const latestReference = document.getElementById("latest-reference");

const lastUpdated = document.getElementById("last-updated");



const previewReference = document.getElementById("preview-reference");

const previewText = document.getElementById("preview-text");

const selectButton = document.getElementById("select-button");

const selectionMessage = document.getElementById("selection-message");

const errorMessage = document.getElementById("error-message");

const clearButton = document.getElementById("clear-button");



const translationSelect = document.getElementById("translation-select");

const translationStatus = document.getElementById("translation-status");

// Search field is created here so app.js is the only file you need to replace.
let translationSearchInput = document.getElementById("translation-search-input");
let availableBibles = [];



const scriptureSearchForm = document.getElementById("scripture-search-form");

const scriptureSearchInput = document.getElementById("scripture-search-input");

const scriptureSearchButton = document.getElementById("scripture-search-button");

const scriptureSearchStatus = document.getElementById("scripture-search-status");



const contextSearchForm = document.getElementById("context-search-form");

const contextSearchInput = document.getElementById("context-search-input");

const contextSearchButton = document.getElementById("context-search-button");

const contextSearchStatus = document.getElementById("context-search-status");

const contextSearchResults = document.getElementById("context-search-results");



const refreshButton = document.getElementById("refresh-button");



const recordButton = document.getElementById("hold-record-button");

const recordButtonLabel = document.getElementById("record-button-label");

const recordingTimer = document.getElementById("recording-timer");

const recordingStatus = document.getElementById("recording-status");

const recordingMessage = document.getElementById("recording-message");

const recordingTranscript = document.getElementById("recording-transcript");

const liveSuggestionsList = document.getElementById("live-suggestions-list");



// ========================================

// APPLICATION STATE

// ========================================



let selectedBibleId = DEFAULT_BIBLE_ID;

let selectedDetection = null;

let detections = [];



let passageRequestNumber = 0;

let historyRequestNumber = 0;

let contextRequestNumber = 0;



let mediaRecorder = null;

let microphoneStream = null;

let recordedChunks = [];

let recordingStartedAt = 0;

let timerInterval = null;

let isRecording = false;

let isProcessingRecording = false;

let pointerHeld = false;

let recordingRequestNumber = 0;



// ========================================

// GENERAL HELPERS

// ========================================



function formatTime(value) {

    if (!value) return "Time unavailable";



    const date = new Date(value);



    return Number.isNaN(date.getTime())

        ? "Time unavailable"

        : date.toLocaleTimeString([], {

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit"

        });

}



function formatDuration(milliseconds) {

    const seconds = Math.floor(milliseconds / 1000);

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;



    return `${String(minutes).padStart(2, "0")}:${String(

        remainingSeconds

    ).padStart(2, "0")}`;

}



function setStatus(dot, textElement, isOnline, onlineText, offlineText) {

    if (!dot || !textElement) return;



    dot.classList.toggle("online", isOnline);

    dot.classList.toggle("offline", !isOnline);

    textElement.textContent = isOnline ? onlineText : offlineText;

}



function getSelectedTranslationName() {

    if (!translationSelect || translationSelect.selectedIndex < 0) {

        return "NKJV";

    }



    return translationSelect.options[

        translationSelect.selectedIndex

    ]?.textContent || "NKJV";

}



async function readResponse(response) {

    let data;



    try {

        data = await response.json();

    } catch {

        data = {};

    }



    if (!response.ok) {

        throw new Error(

            data.detail || `Request failed (${response.status})`

        );

    }



    return data;

}



function setRecordingMessage(message) {

    if (recordingMessage) recordingMessage.textContent = message;

}



function setRecordingStatus(message) {

    if (recordingStatus) recordingStatus.textContent = message;

}



function stopRecordingTimer() {

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;

    }

}



function stopMicrophoneStream() {

    if (microphoneStream) {

        microphoneStream.getTracks().forEach((track) => track.stop());

        microphoneStream = null;

    }

}



function getSupportedAudioType() {

    if (!window.MediaRecorder) return "";



    const types = [

        "audio/webm;codecs=opus",

        "audio/webm",

        "audio/ogg;codecs=opus",

        "audio/mp4"

    ];



    return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";

}



// ========================================

// BACKEND AND LISTENER STATUS

// ========================================



async function checkBackendStatus() {

    try {

        const response = await fetch(HEALTH_URL);

        const data = await readResponse(response);



        setStatus(

            backendStatusDot,

            backendStatusText,

            data.status === "ok",

            "Backend connected",

            "Backend issue"

        );

    } catch {

        setStatus(

            backendStatusDot,

            backendStatusText,

            false,

            "Backend connected",

            "Backend offline"

        );

    }

}



async function checkListenerStatus() {

    try {

        const response = await fetch(SYSTEM_STATUS_URL);

        const data = await readResponse(response);



        // Browser recording replaces the old continuous listener.

        const active = data.listener === "active";



        setStatus(

            listenerStatusDot,

            listenerStatusText,

            active,

            "Listener active",

            "Ready for manual recording"

        );

    } catch {

        setStatus(

            listenerStatusDot,

            listenerStatusText,

            false,

            "Listener active",

            "Listener status unavailable"

        );

    }

}



// ========================================

// VERSE PREVIEW

// ========================================



function setNoSelectionMessage() {

    selectedDetection = null;



    if (previewReference) {

        previewReference.textContent = "Select a verse";

    }



    if (previewText) {

        previewText.textContent =

            "Search for a Bible reference or select a suggestion or history item.";

    }



    if (selectionMessage) selectionMessage.textContent = "";

    if (selectButton) selectButton.disabled = true;

}



async function selectDetection(detection) {

    if (!detection || !detection.reference) return;



    const source = detection.source || "history";

    const selection = { ...detection, source };



    selectedDetection = selection;



    if (selectButton) selectButton.disabled = true;

    if (previewReference) previewReference.textContent = selection.reference;

    if (previewText) previewText.textContent = "Loading selected translation...";

    if (selectionMessage) selectionMessage.textContent = "";



    const requestNumber = ++passageRequestNumber;



    try {

        const params = new URLSearchParams();



        if (selectedBibleId) {

            params.set("bible_id", selectedBibleId);

        }



        const url =

            `${BIBLE_PASSAGE_URL}/${encodeURIComponent(selection.reference)}` +

            `?${params.toString()}`;



        const response = await fetch(url);

        const passage = await readResponse(response);



        if (requestNumber !== passageRequestNumber) return;



        selectedDetection = {

            ...selection,

            reference: passage.reference || selection.reference,

            text: passage.text || "",

            bible_id: passage.bible_id || selectedBibleId,

            source

        };



        if (previewReference) {

            previewReference.textContent = selectedDetection.reference;

        }



        if (previewText) previewText.textContent = selectedDetection.text;



        if (selectButton) {

            selectButton.disabled = !selectedDetection.text;

        }



        if (selectionMessage) {

            selectionMessage.textContent = selectedDetection.text

                ? "Translation loaded. Select the verse to project."

                : "The passage was returned without text.";

        }



        renderHistory();

    } catch (error) {

        if (requestNumber !== passageRequestNumber) return;



        if (previewText) {

            previewText.textContent = "Unable to load this translation.";

        }



        if (selectionMessage) {

            selectionMessage.textContent =

                `Could not retrieve the passage: ${error.message}`;

        }



        if (selectButton) selectButton.disabled = true;

    }

}



// ========================================

// DETECTION HISTORY

// ========================================



function renderHistory() {

    if (!historyList) return;



    historyList.replaceChildren();



    if (detections.length === 0) {

        const empty = document.createElement("div");

        empty.className = "empty-state";



        const title = document.createElement("h3");

        title.textContent = "No detections yet";



        const description = document.createElement("p");

        description.textContent =

            "Recorded suggestions and listener detections can appear here.";



        empty.append(title, description);

        historyList.appendChild(empty);

        return;

    }



    detections.forEach((detection) => {

        const item = document.createElement("button");

        item.type = "button";

        item.className = "history-item";



        if (

            selectedDetection?.source === "history" &&

            selectedDetection?.id === detection.id

        ) {

            item.classList.add("active");

        }



        const top = document.createElement("div");

        top.className = "history-item-top";



        const reference = document.createElement("span");

        reference.className = "history-reference";

        reference.textContent = detection.reference || "Unknown reference";



        const time = document.createElement("span");

        time.className = "history-time";

        time.textContent = formatTime(

            detection.detected_at || detection.timestamp

        );



        const snippet = document.createElement("div");

        snippet.className = "history-snippet";

        snippet.textContent = detection.text || "";



        top.append(reference, time);

        item.append(top, snippet);



        item.addEventListener("click", () => {

            selectDetection({ ...detection, source: "history" });

        });



        historyList.appendChild(item);

    });

}



async function loadHistory() {

    const requestNumber = ++historyRequestNumber;



    try {

        const response = await fetch(API_URL);

        const data = await readResponse(response);



        if (requestNumber !== historyRequestNumber) return;



        detections = Array.isArray(data.history) ? data.history : [];



        if (totalCount) {

            totalCount.textContent = data.count ?? detections.length;

        }



        if (latestReference) {

            latestReference.textContent =

                detections.length > 0 ? detections[0].reference : "—";

        }



        if (lastUpdated) {

            lastUpdated.textContent =

                `Updated ${new Date().toLocaleTimeString()}`;

        }



        if (errorMessage) errorMessage.textContent = "";



        if (selectedDetection?.source === "history") {

            const updatedSelection = detections.find(

                (item) => item.id === selectedDetection.id

            );



            if (!updatedSelection) setNoSelectionMessage();

        }



        renderHistory();

    } catch (error) {

        if (errorMessage) {

            errorMessage.textContent =

                `Cannot connect to VerseCue's backend. (${error.message})`;

        }



        if (lastUpdated) lastUpdated.textContent = "Connection failed";

    }

}



// ========================================

// BIBLE TRANSLATIONS

// ========================================



function setupTranslationSearch() {
    if (!translationSelect || translationSearchInput) return;
    const search = document.createElement("input");
    search.type = "search";
    search.id = "translation-search-input";
    search.className = "translation-search-input";
    search.placeholder = "Search Bible versions...";
    search.setAttribute("aria-label", "Search Bible translations");
    search.autocomplete = "off";
    Object.assign(search.style, {
        width: "100%", boxSizing: "border-box", marginBottom: "8px",
        padding: "9px 12px", border: "1px solid var(--border, #3b3b3b)",
        borderRadius: "8px", background: "var(--surface, #171717)",
        color: "var(--text, #ffffff)", font: "inherit"
    });
    translationSelect.parentElement.insertBefore(search, translationSelect);
    translationSearchInput = search;
    search.addEventListener("input", () => renderTranslationOptions(search.value));
}

function renderTranslationOptions(query = "") {
    if (!translationSelect) return;

    const normalizedQuery = query.trim().toLowerCase();

    const matches = availableBibles.filter((bible) => {
        const searchableText = [
            bible.name,
            bible.abbreviation,
            bible.language?.name,
            bible.language?.nameLocal,
            bible.language?.nameLocalScript
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchableText.includes(normalizedQuery);
    });

    translationSelect.replaceChildren();

    if (matches.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No matching translations";

        translationSelect.appendChild(option);
        translationSelect.disabled = true;

        if (translationStatus) {
            translationStatus.textContent =
                "No Bible versions match your search.";
        }

        return;
    }

    translationSelect.disabled = false;

    matches.forEach((bible) => {
        const option = document.createElement("option");

        option.value = bible.id;
        option.textContent = bible.abbreviation
            ? `${bible.name} (${bible.abbreviation})`
            : bible.name;

        translationSelect.appendChild(option);
    });

    // Preserve the active translation only if it matches the search.
    if (matches.some((bible) => bible.id === selectedBibleId)) {
        translationSelect.value = selectedBibleId;
    } else {
        translationSelect.selectedIndex = -1;
    }

    if (translationStatus) {
        translationStatus.textContent =
            `${matches.length} matching Bible version(s).`;
    }
}

async function loadTranslations() {
    if (!translationSelect || !translationStatus) return;
    setupTranslationSearch();
    try {
        translationStatus.textContent = "Loading available Bible versions...";
        const response = await fetch(BIBLES_URL);
        const data = await readResponse(response);
        availableBibles = Array.isArray(data.bibles) ? data.bibles : [];
        if (availableBibles.some((bible) => bible.id === DEFAULT_BIBLE_ID)) {
            selectedBibleId = DEFAULT_BIBLE_ID;
        } else if (availableBibles.length > 0) {
            selectedBibleId = availableBibles[0].id;
        } else {
            throw new Error("No Bible translations were returned.");
        }
        renderTranslationOptions(translationSearchInput?.value || "");
    } catch (error) {
        translationSelect.replaceChildren();
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Could not load translations";
        translationSelect.appendChild(option);
        translationStatus.textContent = `Could not load translations. ${error.message}`;
    }
}

if (translationSelect) {

    translationSelect.addEventListener("change", () => {

        if (!translationSelect.value) return;
        selectedBibleId = translationSelect.value;



        if (translationStatus) {

            translationStatus.textContent =

                `Selected: ${getSelectedTranslationName()}`;

        }



        if (selectedDetection && selectedBibleId) {

            selectDetection({ ...selectedDetection });

        }

    });

}



// ========================================

// SCRIPTURE SEARCH

// ========================================



if (scriptureSearchForm) {

    scriptureSearchForm.addEventListener("submit", async (event) => {

        event.preventDefault();



        const reference = scriptureSearchInput.value.trim();

        if (!reference) return;



        scriptureSearchButton.disabled = true;

        scriptureSearchStatus.textContent = "Loading passage...";



        try {

            await selectDetection({

                id: `reference-search-${Date.now()}`,

                reference,

                source: "reference-search"

            });



            if (selectedDetection?.text) {

                scriptureSearchStatus.textContent =

                    `Loaded ${selectedDetection.reference}.`;

            } else {

                scriptureSearchStatus.textContent =

                    "Could not load that passage. Check the reference.";

            }

        } finally {

            scriptureSearchButton.disabled = false;

        }

    });

}



// ========================================

// CONTEXT SEARCH

// ========================================



function createContextResultCard(result, index) {

    const card = document.createElement("article");

    card.className = "context-result";



    const heading = document.createElement("h3");

    heading.textContent = result.reference || "Bible passage";



    const meta = document.createElement("p");

    meta.className = "result-meta";

    meta.textContent = `Result ${index + 1}`;



    const passageText = document.createElement("p");

    passageText.textContent = result.text || "Text unavailable.";



    const chooseButton = document.createElement("button");

    chooseButton.type = "button";

    chooseButton.className = "primary-button";

    chooseButton.textContent = "Preview this passage";

    chooseButton.disabled = !result.reference;



    chooseButton.addEventListener("click", async () => {

        chooseButton.disabled = true;

        contextSearchStatus.textContent =

            `Loading ${result.reference} in ${getSelectedTranslationName()}...`;



        try {

            await selectDetection({

                id: `context-search-${Date.now()}-${index}`,

                reference: result.reference,

                text: result.text || "",

                source: "context-search"

            });



            contextSearchStatus.textContent = selectedDetection?.text

                ? `${selectedDetection.reference} loaded into Verse Preview. Click Select verse to project it.`

                : `Could not load ${result.reference}.`;

        } finally {

            chooseButton.disabled = false;

        }

    });



    card.append(heading, meta, passageText, chooseButton);

    return card;

}



if (contextSearchForm) {

    contextSearchForm.addEventListener("submit", async (event) => {

        event.preventDefault();



        const query = contextSearchInput.value.trim();



        if (query.length < 3) {

            contextSearchStatus.textContent =

                "Enter at least 3 characters to search.";

            return;

        }



        contextSearchButton.disabled = true;

        contextSearchStatus.textContent = "Searching the Bible...";

        contextSearchResults.replaceChildren();



        const requestNumber = ++contextRequestNumber;



        try {

            const params = new URLSearchParams({

                query,

                limit: "10"

            });



            if (selectedBibleId) {

                params.set("bible_id", selectedBibleId);

            }



            const response = await fetch(

                `${CONTEXT_SEARCH_URL}?${params.toString()}`

            );



            const data = await readResponse(response);



            if (requestNumber !== contextRequestNumber) return;



            const results = Array.isArray(data.results) ? data.results : [];



            if (results.length === 0) {

                contextSearchStatus.textContent =

                    "No matches found. Try fewer or different words.";

                return;

            }



            contextSearchStatus.textContent =

                `Found ${data.total ?? results.length} matching results.`;



            results.forEach((result, index) => {

                contextSearchResults.appendChild(

                    createContextResultCard(result, index)

                );

            });

        } catch (error) {

            if (requestNumber !== contextRequestNumber) return;



            contextSearchStatus.textContent =

                `Context search failed: ${error.message}`;

        } finally {

            if (requestNumber === contextRequestNumber) {

                contextSearchButton.disabled = false;

            }

        }

    });

}



// ========================================

// HOLD-TO-RECORD

// ========================================



function setRecordButtonState(recording, processing = false) {

    if (!recordButton) return;



    recordButton.classList.toggle("recording", recording);

    recordButton.classList.toggle("processing", processing);

    recordButton.setAttribute("aria-pressed", String(recording));



    recordButton.disabled = processing;



    if (recordButtonLabel) {

        recordButtonLabel.textContent = processing

            ? "Processing..."

            : recording

                ? "Recording — release to stop"

                : "Hold to Record";

    }

}



function renderSuggestions(references) {

    if (!liveSuggestionsList) return;



    liveSuggestionsList.replaceChildren();



    if (!references.length) {

        const empty = document.createElement("p");

        empty.textContent =

            "No Bible references were detected. Try recording a clearer or longer excerpt.";

        liveSuggestionsList.appendChild(empty);

        return;

    }



    references.forEach((reference, index) => {

        const card = document.createElement("article");

        card.className = "context-result live-suggestion-card";



        const heading = document.createElement("h3");

        heading.textContent = reference.reference || "Possible reference";



        const text = document.createElement("p");

        text.textContent = reference.text || "Passage text unavailable.";



        const confidence = document.createElement("p");

        confidence.className = "result-meta";

        confidence.textContent = "Suggested reference — confirm before projection.";



        const previewButton = document.createElement("button");

        previewButton.type = "button";

        previewButton.className = "primary-button";

        previewButton.textContent = "Preview this verse";



        previewButton.addEventListener("click", () => {

            selectDetection({

                id: `recording-suggestion-${Date.now()}-${index}`,

                reference: reference.reference,

                text: reference.text || "",

                source: "recording-suggestion"

            });

        });



        card.append(heading, text, confidence, previewButton);

        liveSuggestionsList.appendChild(card);

    });

}



async function startRecording() {

    if (isRecording || isProcessingRecording) return;



    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {

        setRecordingMessage(

            "Audio recording is not supported in this browser. Try a current version of Chrome or Edge."

        );

        setRecordingStatus("Recording unavailable");

        return;

    }



    try {

        setRecordingMessage("Requesting microphone access...");



        microphoneStream = await navigator.mediaDevices.getUserMedia({

            audio: {

                echoCancellation: true,

                noiseSuppression: true,

                autoGainControl: true

            }

        });



        // The button may have been released while permission was pending.

        if (!pointerHeld) {

            stopMicrophoneStream();

            setRecordingMessage("Recording cancelled.");

            setRecordingStatus("Ready to record");

            return;

        }



        const mimeType = getSupportedAudioType();



        mediaRecorder = mimeType

            ? new MediaRecorder(microphoneStream, { mimeType })

            : new MediaRecorder(microphoneStream);



        recordedChunks = [];



        mediaRecorder.addEventListener("dataavailable", (event) => {

            if (event.data && event.data.size > 0) {

                recordedChunks.push(event.data);

            }

        });



        mediaRecorder.addEventListener("error", () => {

            setRecordingMessage("A recording error occurred. Please try again.");

            setRecordingStatus("Recording error");

        });



        mediaRecorder.addEventListener("stop", () => {

            const type = mediaRecorder?.mimeType || mimeType || "audio/webm";

            const blob = new Blob(recordedChunks, { type });



            stopRecordingTimer();

            stopMicrophoneStream();



            isRecording = false;

            setRecordButtonState(false);



            if (blob.size === 0) {

                setRecordingStatus("No audio captured");

                setRecordingMessage("No audio was captured. Hold the button longer and try again.");

                return;

            }



            uploadRecording(blob, type);

        });



        mediaRecorder.start(250);



        isRecording = true;

        recordingStartedAt = Date.now();



        setRecordButtonState(true);

        setRecordingStatus("Recording");

        setRecordingMessage("Recording audio. Release the button when you are finished.");



        if (recordingTimer) recordingTimer.textContent = "00:00";



        stopRecordingTimer();

        timerInterval = setInterval(() => {

            if (recordingTimer) {

                recordingTimer.textContent =

                    formatDuration(Date.now() - recordingStartedAt);

            }

        }, 250);

    } catch (error) {

        stopMicrophoneStream();

        isRecording = false;

        setRecordButtonState(false);

        setRecordingStatus("Microphone unavailable");

        setRecordingMessage(

            `Could not start recording: ${error.message}. Check microphone permissions.`

        );

    }

}



function stopRecording() {

    if (!isRecording || !mediaRecorder) return;



    if (mediaRecorder.state !== "inactive") {

        mediaRecorder.stop();

    }

}



async function uploadRecording(blob, mimeType) {

    isProcessingRecording = true;

    setRecordButtonState(false, true);

    setRecordingStatus("Processing recording");

    setRecordingMessage("Uploading audio and detecting Bible references...");



    if (recordingTimer) {

        recordingTimer.textContent =

            formatDuration(Date.now() - recordingStartedAt);

    }



    const requestNumber = ++recordingRequestNumber;



    try {

        const extension = mimeType.includes("ogg")

            ? "ogg"

            : mimeType.includes("mp4")

                ? "m4a"

                : "webm";



        const formData = new FormData();

        formData.append("audio", blob, `versecue-recording.${extension}`);



        const response = await fetch(DETECT_URL, {

            method: "POST",

            body: formData

        });



        const data = await readResponse(response);



        if (requestNumber !== recordingRequestNumber) return;



        if (recordingTranscript) {

            recordingTranscript.textContent =

                data.transcript || "No speech was recognized in this recording.";

        }



        const references = Array.isArray(data.references)

            ? data.references

            : [];



        renderSuggestions(references);



        setRecordingStatus("Processing complete");

        setRecordingMessage(

            references.length

                ? `Found ${references.length} possible Bible reference(s). Preview one to review it.`

                : "Recording processed, but no Bible references were detected."

        );



        // Do not project automatically. Suggestions only become previews.

        await loadHistory();

    } catch (error) {

        if (requestNumber !== recordingRequestNumber) return;



        setRecordingStatus("Processing failed");

        setRecordingMessage(

            `Could not process the recording: ${error.message}`

        );

    } finally {

        isProcessingRecording = false;

        setRecordButtonState(false);

    }

}



if (recordButton) {

    // Pointer events support mouse, touch, and pen input.

    recordButton.addEventListener("pointerdown", (event) => {

        if (event.button !== undefined && event.button !== 0) return;

        if (isRecording || isProcessingRecording) return;



        event.preventDefault();

        pointerHeld = true;



        try {

            recordButton.setPointerCapture(event.pointerId);

        } catch {

            // Pointer capture is optional.

        }



        startRecording();

    });



    recordButton.addEventListener("pointerup", () => {

        pointerHeld = false;

        stopRecording();

    });



    recordButton.addEventListener("pointercancel", () => {

        pointerHeld = false;

        stopRecording();

    });



    recordButton.addEventListener("lostpointercapture", () => {

        if (pointerHeld) {

            pointerHeld = false;

            stopRecording();

        }

    });



    recordButton.addEventListener("contextmenu", (event) => {

        event.preventDefault();

    });



    window.addEventListener("blur", () => {

        if (pointerHeld) {

            pointerHeld = false;

            stopRecording();

        }

    });

}



// ========================================

// REFRESH HISTORY

// ========================================



if (refreshButton) {

    refreshButton.addEventListener("click", loadHistory);

}



// ========================================

// PROJECT SELECTED VERSE MANUALLY

// ========================================



if (selectButton) {

    selectButton.disabled = true;



    selectButton.addEventListener("click", async () => {

        if (!selectedDetection?.text) {

            if (selectionMessage) {

                selectionMessage.textContent =

                    "Select a verse and wait for its text to load first.";

            }

            return;

        }



        selectButton.disabled = true;



        if (selectionMessage) {

            selectionMessage.textContent = "Sending verse to projection...";

        }



        try {

            const response = await fetch(PROJECTION_URL, {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({

                    reference: selectedDetection.reference,

                    text: selectedDetection.text,

                    translation: getSelectedTranslationName()

                })

            });



            await readResponse(response);



            if (selectionMessage) {

                selectionMessage.textContent =

                    `${selectedDetection.reference} approved for projection.`;

            }

        } catch (error) {

            if (selectionMessage) {

                selectionMessage.textContent =

                    `Could not update projection: ${error.message}`;

            }

        } finally {

            selectButton.disabled = !selectedDetection?.text;

        }

    });

}



// ========================================

// CLEAR PROJECTION

// ========================================



if (clearButton) {

    clearButton.addEventListener("click", async () => {

        clearButton.disabled = true;



        if (selectionMessage) {

            selectionMessage.textContent = "Clearing projection...";

        }



        try {

            const response = await fetch(PROJECTION_URL, {

                method: "DELETE"

            });



            await readResponse(response);



            if (selectionMessage) {

                selectionMessage.textContent = "Projection screen cleared.";

            }

        } catch (error) {

            if (selectionMessage) {

                selectionMessage.textContent =

                    `Could not clear projection: ${error.message}`;

            }

        } finally {

            clearButton.disabled = false;

        }

    });

}



// ========================================

// START VERSECUE

// ========================================



checkBackendStatus();

setInterval(checkBackendStatus, 3000);



checkListenerStatus();

setInterval(checkListenerStatus, 3000);



loadTranslations();

loadHistory();

setInterval(loadHistory, 2000);
