# VerseCue 🎤📖

**Get your Bible verses right on cue.**

## What is VerseCue?

VerseCue is a Bible verse detection and projection tool designed to help church media teams during sermons and services.

When a preacher mentions a Bible reference, VerseCue can help identify the possible reference, find the Bible passage, and show it to an operator. The operator can review the verse before sending it to the projector.

The goal is to make displaying Bible verses easier, faster, and more reliable during church services.

## Why I Built This Project

I wanted to build a tool that could help church media teams find Bible verses without having to search for every verse manually.

I also wanted to learn how different technologies can work together to solve a real problem.

VerseCue combines speech recognition, Bible passage search, a web dashboard, and a projection screen in one project.

## Main Features

- **Speech recognition:** Records audio through a microphone and uses Whisper to turn speech into text.
- **Bible reference detection:** Looks for possible Bible references in the recognized speech.
- **Bible passage search:** Retrieves Bible passages using a Bible API.
- **Translation selection:** Allows the operator to search for and select an available Bible translation.
- **Verse preview:** Lets the operator review the passage before projecting it.
- **Context search:** Searches for Bible passages using words or phrases.
- **Detection history:** Keeps a list of detected references.
- **Projector screen:** Displays the selected Bible passage on a separate screen.
- **Manual controls:** Allows the operator to search for a verse, approve it, and clear the projection.

## How It Works

1. The operator records a short section of speech.
2. Whisper converts the recording into text.
3. VerseCue looks for possible Bible references.
4. The operator chooses a reference to review.
5. VerseCue retrieves the passage in the selected translation.
6. The operator approves the verse.
7. The projector screen displays the approved passage.

**Important:** VerseCue suggests possible references. The operator should check the passage before displaying it.

## Technologies Used

- **Python:** Runs the main application logic.
- **FastAPI:** Connects the web dashboard to the backend.
- **Whisper:** Recognizes speech from audio recordings.
- **JavaScript:** Makes the dashboard and projector interactive.
- **HTML and CSS:** Build and style the screens.
- **API.Bible:** Retrieves Bible translations and passages.
- **FFmpeg:** Helps process audio formats used for speech recognition.

## Challenges I Faced

### 1. Speech recognition mistakes

Speech recognition does not always understand spoken Bible references correctly. For example, saying “John three sixteen” can be interpreted as a different number.

**What I changed:** I improved the reference detection logic and added support for different ways of writing or saying Bible references. The app can also present possible references for the operator to review.

### 2. Choosing the correct Bible translation

A verse can have different wording in different Bible translations. I needed to make sure the selected translation was used when retrieving and displaying a passage.

**What I changed:** I added a translation selector and then improved it with a search field so the operator can find a translation more easily.

### 3. Connecting the different parts

The dashboard, Python backend, Bible API, and projector screen all need to communicate correctly.

**What I changed:** I connected these parts through API requests and added status messages, error handling, and manual controls.

### 4. Making the tool easier to use

A tool used during a church service needs a simple interface. The operator should be able to review a verse and decide when to display it.

**What I changed:** I improved the dashboard, added a verse preview, made it possible to search for passages manually, and kept the final projection under the operator's control.

## Project Structure

The project has two main parts: the **backend**, which handles the processing, and the **frontend**, which contains the screens the operator uses.

### Backend files

| File | What it does |
|---|---|
| `main.py` | Runs the FastAPI backend and provides the routes the frontend uses. |
| `verse_detector.py` | Looks for Bible references in recognized speech. |
| `bible_api.py` | Handles requests to retrieve Bible passages from the Bible API. |
| `verse_service.py` | Runs Whisper on uploaded audio and passes the transcript to the detector. |
| `bible_reference.py` | Maps Bible book names to the API's book IDs. |
| `parser.py` | Parses written references such as "John 3:16" into book, chapter and verse. |
| `listener.py` | Optional continuous-listening mode that posts detections to the backend. |
| `mic.py` | Small helper for recording audio from a microphone. |
| `requirements.txt` | Lists the Python packages needed to run the backend. |
| `.env` | Stores private settings such as the Bible API key. This file must not be uploaded to GitHub. |
| `.env.example` | Shows which settings are needed without containing real secret keys. |

### Frontend files

| File | What it does |
|---|---|
| `index.html` | Builds the main VerseCue dashboard. |
| `style.css` | Controls the dashboard's appearance. |
| `app.js` | Handles the dashboard's interactions, searches, recording, verse preview, translation selection, and projection requests. |
| `projector.html` | Builds the separate screen used to display Bible passages. |
| `projector.css` | Controls the projector screen's appearance. |
| `projector.js` | Retrieves projection information and updates the displayed passage. |

### Other important files

| File | What it does |
|---|---|
| `.gitignore` | Tells Git which files should not be uploaded, such as private settings and Python's virtual environment. |
| `README.md` | Explains the project and how to install and run it. |

## What I Learned

Building VerseCue helped me understand how to connect a Python backend to a web interface, use speech recognition, work with an external API, handle audio recordings, and improve an application through testing.

I also learned that recognizing speech is not the same as understanding it perfectly. Human review is important when the result needs to be accurate.

## Current Limitations

- Speech recognition can make mistakes, especially with Bible book names and spoken numbers.
- The operator should confirm the passage before projecting it.
- Available Bible translations depend on the Bible API and its access rules.
- Audio processing speed depends on the computer's hardware.
- The application currently requires setup of the backend, frontend, and supporting software.

## Future Improvements

- Improve reference detection accuracy.
- Make speech detection faster for live services.
- Improve handling of ambiguous Bible references.
- Add keyboard shortcuts and a passage queue.
- Make installation easier on new computers.
- Improve error recovery and projector reliability.

## Running VerseCue

### Requirements

- Python 3.10 or newer
- [FFmpeg](https://ffmpeg.org/download.html) (Whisper needs it to read audio)
- A free API key from [API.Bible](https://scripture.api.bible/)

### 1. Install the backend

```bash
git clone https://github.com/olajireolabode/VerseCue.git
cd VerseCue/backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Add your API key

Copy `.env.example` to `.env` and put your API.Bible key in it:

```
BIBLE_API_KEY=your_api_key_here
```

### 3. Start the backend

```bash
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive docs are at `http://127.0.0.1:8000/docs`.

### 4. Open the dashboard

Serve the `frontend/` folder on port 5500 (for example with the VS Code Live Server extension), then open:

- `index.html` for the operator dashboard
- `projector.html` on the projector screen

The first transcription downloads the Whisper model, so it takes longer than later ones.

## Acknowledgements

VerseCue uses open-source software and external Bible services. Please follow the relevant software licences, Bible translation permissions, and attribution requirements.
