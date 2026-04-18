import argparse
import asyncio
import gradium
import os
import wave
import signal
import sys
from pathlib import Path

def wav_audio_generator(path: Path, chunk_frames: int = 960):
    """Yields PCM audio chunks from a WAV file."""
    with wave.open(str(path), "rb") as wf:
        assert wf.getsampwidth() == 2, "expected 16-bit PCM"
        assert wf.getcomptype() == "NONE", "expected uncompressed PCM"
        while True:
            data = wf.readframes(chunk_frames)
            if not data:
                break
            yield data

def mic_audio_generator(samplerate=16000, channels=1, chunk_frames=960, verbose=False):
    """Yields PCM audio chunks from the microphone."""
    try:
        import sounddevice as sd
        import numpy as np
        import queue
    except Exception as e:
        raise RuntimeError("sounddevice and numpy are required for mic input") from e

    q = queue.Queue()

    def callback(indata, frames, time, status):
        if status and verbose:
            print("InputStream status:", status, file=sys.stderr)
        # Try to copy data safely regardless of type
        try:
            payload = indata.copy()
        except Exception:
            try:
                payload = bytes(indata)
            except Exception:
                payload = np.frombuffer(indata, dtype=np.int16).copy()
        q.put(payload)

    stream = sd.RawInputStream(
        samplerate=samplerate,
        channels=channels,
        dtype="int16",
        blocksize=chunk_frames,
        callback=callback,
    )
    stream.start()
    try:
        while True:
            data = q.get()
            if data is None:
                break
            if verbose:
                print(f"mic -> chunk bytes: {len(data)}", file=sys.stderr)
            yield data
    finally:
        try:
            stream.stop()
            stream.close()
        except Exception:
            pass

async def async_wrap(gen):
    """Wraps a blocking generator as an async generator."""
    loop = asyncio.get_running_loop()
    try:
        while True:
            chunk = await loop.run_in_executor(None, lambda: next(gen, None))
            if chunk is None:
                break
            yield chunk
    except asyncio.CancelledError:
        return

async def main():
    parser = argparse.ArgumentParser(description="Live STT streamer")
    parser.add_argument("--file", "-f", type=Path, help="Path to 16-bit PCM WAV file to stream")
    parser.add_argument("--mic", "-m", action="store_true", help="Use microphone input (sounddevice required)")
    parser.add_argument("--model", default="default", help="STT model name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug output")
    args = parser.parse_args()

    api_key = os.getenv("GRADIUM_API_KEY")
    if not api_key:
        print("Set GRADIUM_API_KEY in environment", file=sys.stderr)
        return 2

    client = gradium.client.GradiumClient(api_key=api_key)

    # Pick audio source
    if args.file:
        if not args.file.exists():
            print(f"File not found: {args.file}", file=sys.stderr)
            return 2
        audio_gen = wav_audio_generator(args.file)
    elif args.mic:
        audio_gen = mic_audio_generator(verbose=args.verbose)
    else:
        print("Specify --mic or --file <path.wav>", file=sys.stderr)
        return 2

    # Signal handling for graceful shutdown
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    # Start STT streaming
    stream = await client.stt_stream(
        {"model_name": args.model, "input_format": "pcm"},
        async_wrap(audio_gen),
    )

    async def consume_text():
        try:
            async for message in stream.iter_text():
                print(message)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print("Consumer error:", e, file=sys.stderr)

    consumer = asyncio.create_task(consume_text())

    # Wait for signal to stop
    await stop_event.wait()

    # Cleanup
    consumer.cancel()
    await asyncio.gather(consumer, return_exceptions=True)
    try:
        if hasattr(stream, "aclose"):
            await stream.aclose()
        elif hasattr(stream, "close"):
            stream.close()
    except Exception:
        pass
    try:
        await asyncio.get_running_loop().run_in_executor(None, lambda: getattr(audio_gen, "close", lambda: None)())
    except Exception:
        pass

    print("Interrupted, exiting cleanly")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("Interrupted by user", file=sys.stderr)
        raise SystemExit(1)
