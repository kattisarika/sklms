import asyncio
import base64
import json
import os
import sys
import traceback

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from google import genai
from google.genai import types

# Force unbuffered output so prints show in concurrently logs
sys.stdout.reconfigure(line_buffering=True)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TUTOR_INSTRUCTION = """You are a personal tutor for the student. You speak like a real human — not a robot, not an AI assistant. Think of yourself as a friendly senior who's sitting next to the student and explaining things casually.

=== HOW YOU SOUND ===

You talk like a real person in a real conversation:
- Use SHORT sentences. 1-2 sentences at a time, then pause.
- Use natural fillers sparingly: "hmm...", "so basically...", "right?", "okay so..."
- Take natural breaths — don't rush through explanations.
- Use contractions: "don't", "it's", "you'll", "that's" — never "do not", "it is".
- Sound like you're THINKING with the student, not reading from a script.
- Vary your pace — slow down on important parts, speed up on obvious stuff.

STRICT RULE: Keep every response to 2-3 sentences MAX. Then stop and let the student respond. If they need more, they'll ask. Do NOT give long answers. Short, punchy, human.

=== CONVERSATIONAL TEACHING ===

Core Rule: Talk like a human, not a textbook.

Every response:
1. ONE idea, 2-3 sentences max
2. Then stop. Ask if it makes sense, or just pause.

When Student Asks a Doubt:
Answer DIRECTLY. Don't lecture.
1. "Oh so you're asking about..." (1 sentence)
2. Clear answer with a simple analogy (1-2 sentences)
3. "Does that click?" or "Clear?"

=== FEYNMAN METHOD ===

Always explain with everyday analogies FIRST:
- "Think of it like..." before any definition
- Use: cooking, traffic, water, sports, phone apps — stuff everyone knows

No jargon until the idea lands in plain language.

=== EMOTIONAL AWARENESS ===

If frustrated: "Yeah, this part is genuinely annoying. Let me try differently."
If confused: "Okay, let me come at this from a totally different angle."
If they say "I'm stupid": "Nah, this stuff is just hard. Seriously. Let's go slower."

NEVER say: "You should know this", "This is basic", "As I mentioned"

=== LANGUAGE ===
- Match the student's language. If they speak Hindi/Hinglish, you speak Hindi/Hinglish.
- Keep technical terms in English even when speaking Hindi.
- Be warm, casual, human. Like a friend helping out.

=== PAGE CONTEXT ===
- You may receive a screenshot and text from the PDF page the student is viewing.
- Use it as context. Reference what's on the page when relevant.
- Don't describe the page unless asked — just use it to understand their question."""

api_key = os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

LIVE_CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
        )
    ),
    system_instruction=types.Content(
        parts=[types.Part(text=TUTOR_INSTRUCTION)]
    ),
    input_audio_transcription=types.AudioTranscriptionConfig(),
    output_audio_transcription=types.AudioTranscriptionConfig(),
)


@app.websocket("/ws/{session_id}")
async def voice_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"[ws] {session_id} connected", flush=True)

    pending_image = None

    try:
        async with client.aio.live.connect(
            model="gemini-2.5-flash-native-audio-latest", config=LIVE_CONFIG
        ) as session:
            print(f"[ws] gemini connected", flush=True)
            await websocket.send_json({"type": "ready"})

            stop = asyncio.Event()

            async def upstream():
                nonlocal pending_image
                try:
                    while not stop.is_set():
                        msg = await websocket.receive()
                        if msg.get("type") == "websocket.disconnect":
                            break

                        if "bytes" in msg:
                            await session.send_realtime_input(
                                audio=types.Blob(mime_type="audio/pcm;rate=16000", data=msg["bytes"])
                            )
                        elif "text" in msg:
                            data = json.loads(msg["text"])
                            mt = data.get("type")
                            if mt == "store_context":
                                img = data.get("image")
                                pending_image = base64.b64decode(img) if img else None
                            elif mt == "activity_start":
                                if pending_image:
                                    try:
                                        await session.send_realtime_input(
                                            media=types.Blob(mime_type="image/jpeg", data=pending_image)
                                        )
                                    except Exception as e:
                                        print(f"[ws] image err: {e}", flush=True)
                                    pending_image = None
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    print(f"[upstream] {e}", flush=True)
                finally:
                    stop.set()

            async def downstream():
                try:
                    async for resp in session.receive():
                        if stop.is_set():
                            break
                        if resp.data:
                            await websocket.send_bytes(resp.data)

                        sc = resp.server_content
                        if not sc:
                            continue

                        if sc.output_transcription and sc.output_transcription.text:
                            await websocket.send_json({
                                "type": "output_transcript",
                                "text": sc.output_transcription.text,
                                "finished": bool(sc.output_transcription.finished),
                            })
                        if sc.input_transcription and sc.input_transcription.text:
                            await websocket.send_json({
                                "type": "input_transcript",
                                "text": sc.input_transcription.text,
                                "finished": bool(sc.input_transcription.finished),
                            })
                        if sc.turn_complete:
                            await websocket.send_json({"type": "turn_complete"})
                        if sc.interrupted:
                            await websocket.send_json({"type": "interrupted"})

                except Exception as e:
                    if "1000" not in str(e):
                        print(f"[downstream] {e}", flush=True)
                finally:
                    stop.set()

            async def keepalive():
                """Send tiny silence every 3s to keep Gemini session alive."""
                silence = b'\x00' * 1600  # 50ms of silence
                while not stop.is_set():
                    await asyncio.sleep(3)
                    if stop.is_set():
                        break
                    try:
                        await session.send_realtime_input(
                            audio=types.Blob(mime_type="audio/pcm;rate=16000", data=silence)
                        )
                    except Exception:
                        break

            tasks = [
                asyncio.create_task(upstream()),
                asyncio.create_task(downstream()),
                asyncio.create_task(keepalive()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            stop.set()
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ws] error: {e}", flush=True)
        traceback.print_exc()
    finally:
        print(f"[ws] {session_id} ended", flush=True)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
