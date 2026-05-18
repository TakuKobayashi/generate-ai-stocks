'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/styles/RecordingApp.module.css';

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping' | 'done';
type AudioSource = 'screen' | 'microphone' | 'none';

interface TranscriptEntry {
  id: number;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RecordingApp() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioSource, setAudioSource] = useState<AudioSource>('screen');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState('video/webm');
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [sttActive, setSttActive] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [browserLang, setBrowserLang] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const speechRecRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimeRef = useRef(0);
  const recordingStateRef = useRef<RecordingState>('idle');
  const entryIdRef = useRef(0);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // ── Initialise browser-only state ─────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttAvailable(!!SR);
    setBrowserLang(navigator.language ?? '');
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStreams();
      stopSpeechRecognition();
    };
  }, []); // refs are stable, browser APIs are stable — empty deps is intentional

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  // ── Stream helpers ────────────────────────────────────────────────────────
  const stopStreams = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current = null;
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
  };

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = () => {
    recordingTimeRef.current = 0;
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      recordingTimeRef.current += 1;
      setRecordingTime(recordingTimeRef.current);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Speech Recognition ────────────────────────────────────────────────────
  const stopSpeechRecognition = () => {
    try {
      speechRecRef.current?.abort();
    } catch {
      // ignore
    }
    speechRecRef.current = null;
    setSttActive(false);
    setInterimText('');
  };

  const startSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'ja-JP';

    recognition.onstart = () => {
      setSttActive(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText.trim()) {
        const timestamp = formatTimestamp(recordingTimeRef.current);
        const id = ++entryIdRef.current;
        setTranscriptEntries((prev) => [...prev, { id, text: finalText.trim(), timestamp, isFinal: true }]);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      // non-fatal: log and continue
      console.warn('SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      // Restart automatically while recording
      if (recordingStateRef.current === 'recording') {
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      } else {
        setSttActive(false);
        setInterimText('');
      }
    };

    try {
      recognition.start();
      speechRecRef.current = recognition;
    } catch {
      // ignore
    }
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    setVideoUrl(null);
    setTranscriptEntries([]);
    setInterimText('');
    setFileSize(null);
    entryIdRef.current = 0;
    setRecordingState('requesting');

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: audioSource === 'screen',
      });

      screenStreamRef.current = screenStream;

      let finalStream: MediaStream;

      if (audioSource === 'microphone') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
        finalStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...micStream.getAudioTracks(),
        ]);
      } else {
        finalStream = screenStream;
      }

      // Show preview (muted — avoids echo)
      if (previewRef.current) {
        previewRef.current.srcObject = screenStream;
        previewRef.current.muted = true;
        previewRef.current.play().catch(() => {});
      }

      const mimeType = getSupportedMimeType();
      setVideoMimeType(mimeType);

      const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setFileSize(blob.size);
        setVideoUrl(URL.createObjectURL(blob));
        setRecordingState('done');
        stopTimer();
        stopStreams();
        stopSpeechRecognition();
      };

      // Handle user ending share from browser UI
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recordingStateRef.current === 'recording') {
          stopRecordingInternal();
        }
      });

      recorder.start(500);
      setRecordingState('recording');
      startTimer();
      startSpeechRecognition();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          setError(err.message);
        } else if (err.name === 'NotAllowedError') {
          setError('Screen sharing permission was denied.');
        }
      }
      setRecordingState('idle');
      stopStreams();
    }
  };

  const stopRecordingInternal = useCallback(() => {
    setRecordingState('stopping');
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const stopRecording = () => stopRecordingInternal();

  // ── Post-recording actions ────────────────────────────────────────────────
  const downloadVideo = () => {
    if (!videoUrl) return;
    const ext = videoMimeType.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;
    a.click();
  };

  const downloadTranscript = () => {
    const text = transcriptEntries.map((e) => `[${e.timestamp}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetRecording = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setFileSize(null);
    setRecordingTime(0);
    setTranscriptEntries([]);
    setInterimText('');
    setRecordingState('idle');
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const isIdle = recordingState === 'idle';
  const isRequesting = recordingState === 'requesting';
  const isRecording = recordingState === 'recording';
  const isStopping = recordingState === 'stopping';
  const isDone = recordingState === 'done';

  const stateLabel: Record<RecordingState, string> = {
    idle: 'READY',
    requesting: 'WAITING FOR PERMISSION…',
    recording: 'RECORDING',
    stopping: 'PROCESSING…',
    done: 'COMPLETE',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoDot} data-state={recordingState} aria-hidden="true" />
          <span className={styles.logoText}>
            REC<span>STUDIO</span>
          </span>
        </div>

        <div className={styles.statusBar} role="status" aria-live="polite">
          <span className={styles.statusLabel} data-state={recordingState}>
            {stateLabel[recordingState]}
          </span>
          {isRecording && (
            <span className={styles.timer} aria-label={`Recording time: ${formatTime(recordingTime)}`}>
              {formatTime(recordingTime)}
            </span>
          )}
        </div>

        <div className={styles.headerRight}>
          <span className={styles.buildTag}>Browser-native · No server</span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>
        {/* ── Left sidebar: Controls ── */}
        <aside className={styles.sidebar} aria-label="Recording controls">
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Audio Source</h2>
            <div className={styles.radioGroup} role="radiogroup" aria-label="Select audio source">
              {(['screen', 'microphone', 'none'] as AudioSource[]).map((src) => (
                <label
                  key={src}
                  className={`${styles.radioItem} ${audioSource === src ? styles.radioSelected : ''}`}
                  onClick={() => !isRecording && setAudioSource(src)}
                  aria-checked={audioSource === src}
                  role="radio"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isRecording) setAudioSource(src);
                    }
                  }}
                >
                  <span className={styles.radioMark} />
                  <span className={styles.radioIcon} aria-hidden="true">
                    {src === 'screen' && '🖥'}
                    {src === 'microphone' && '🎙'}
                    {src === 'none' && '🔇'}
                  </span>
                  <span className={styles.radioLabel}>
                    {src === 'screen' && 'Screen Audio'}
                    {src === 'microphone' && 'Microphone'}
                    {src === 'none' && 'No Audio'}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Speech-to-Text
              {sttAvailable && (
                <span className={`${styles.badge} ${sttActive ? styles.badgeActive : ''}`}>
                  {sttActive ? 'LIVE' : 'AUTO'}
                </span>
              )}
            </h2>
            {sttAvailable ? (
              <p className={styles.sectionNote}>
                Transcription starts automatically with recording. Language detected from browser
                settings{browserLang ? ` (${browserLang})` : ''}.
              </p>
            ) : (
              <p className={styles.sectionNote} style={{ color: 'var(--amber)' }}>
                Not supported in this browser. Try Chrome or Edge.
              </p>
            )}
          </section>

          {/* ── Action buttons ── */}
          <div className={styles.controlActions}>
            {isIdle && (
              <button className={styles.btnRecord} onClick={startRecording} aria-label="Start recording">
                <span className={styles.btnDot} aria-hidden="true" />
                Start Recording
              </button>
            )}

            {isRequesting && (
              <button className={styles.btnRecord} disabled aria-label="Requesting screen share permission">
                <span className={`${styles.btnDot} ${styles.btnDotPulse}`} aria-hidden="true" />
                Requesting…
              </button>
            )}

            {isRecording && (
              <button
                className={`${styles.btnRecord} ${styles.btnStop}`}
                onClick={stopRecording}
                aria-label="Stop recording"
              >
                <span className={styles.btnSquare} aria-hidden="true" />
                Stop Recording
              </button>
            )}

            {isStopping && (
              <button className={styles.btnRecord} disabled aria-label="Processing recording">
                <span className={`${styles.btnDot} ${styles.btnDotPulse}`} aria-hidden="true" />
                Processing…
              </button>
            )}

            {isDone && (
              <div className={styles.doneActions}>
                <button className={styles.btnDownload} onClick={downloadVideo} aria-label="Download video file">
                  <DownloadIcon />
                  Save Video
                  {fileSize != null && (
                    <span className={styles.fileSize}>
                      {(fileSize / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                </button>
                <button
                  className={styles.btnReset}
                  onClick={resetRecording}
                  aria-label="Start a new recording"
                >
                  <ResetIcon />
                  New Recording
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">
              <ErrorIcon />
              {error}
            </div>
          )}
        </aside>

        {/* ── Center: Preview / Playback ── */}
        <section className={styles.center} aria-label="Video preview">
          <div className={styles.previewWrap}>
            {/* Live preview */}
            <video
              ref={previewRef}
              className={`${styles.video} ${isRecording ? styles.videoVisible : styles.videoHidden}`}
              muted
              playsInline
              aria-label="Screen recording preview"
            />

            {/* Playback after recording */}
            {isDone && videoUrl && (
              <video
                key={videoUrl}
                className={`${styles.video} ${styles.videoVisible}`}
                src={videoUrl}
                controls
                playsInline
                aria-label="Recorded video playback"
              />
            )}

            {/* Idle / requesting placeholder */}
            {(isIdle || isRequesting) && (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon} aria-hidden="true">
                  <MonitorIcon />
                </div>
                <p className={styles.placeholderText}>
                  {isRequesting
                    ? 'Select the screen area to record…'
                    : 'Click "Start Recording" to begin'}
                </p>
                {isRequesting && (
                  <div className={styles.spinnerRow}>
                    <span className={styles.spinner} aria-label="Loading" />
                  </div>
                )}
              </div>
            )}

            {/* Processing placeholder */}
            {isStopping && (
              <div className={styles.placeholder}>
                <div className={styles.spinnerRow}>
                  <span className={styles.spinner} aria-label="Processing" />
                </div>
                <p className={styles.placeholderText}>Finalizing recording…</p>
              </div>
            )}

            {/* Recording overlay */}
            {isRecording && (
              <div className={styles.recOverlay} aria-hidden="true">
                <span className={styles.recPulse} />
                <span className={styles.recLabel}>REC</span>
                <span className={styles.recTime}>{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>

          {/* Video metadata bar */}
          {isDone && (
            <dl className={styles.videoMeta}>
              <div className={styles.metaItem}>
                <dt className={styles.metaKey}>Duration</dt>
                <dd className={styles.metaVal}>{formatTime(recordingTime)}</dd>
              </div>
              <span className={styles.metaDivider} aria-hidden="true" />
              <div className={styles.metaItem}>
                <dt className={styles.metaKey}>Format</dt>
                <dd className={styles.metaVal}>{videoMimeType.includes('mp4') ? 'MP4' : 'WebM'}</dd>
              </div>
              {fileSize != null && (
                <>
                  <span className={styles.metaDivider} aria-hidden="true" />
                  <div className={styles.metaItem}>
                    <dt className={styles.metaKey}>Size</dt>
                    <dd className={styles.metaVal}>{(fileSize / 1024 / 1024).toFixed(2)} MB</dd>
                  </div>
                </>
              )}
            </dl>
          )}
        </section>

        {/* ── Right sidebar: Transcript ── */}
        <aside className={`${styles.sidebar} ${styles.transcriptSidebar}`} aria-label="Transcript">
          <div className={styles.transcriptHeader}>
            <h2 className={styles.sectionTitle}>
              Transcript
              {sttActive && <span className={styles.liveDot} aria-label="Live transcription active" />}
            </h2>
            {transcriptEntries.length > 0 && (
              <button
                className={styles.btnSmall}
                onClick={downloadTranscript}
                aria-label="Download transcript as text file"
              >
                <DownloadIcon size={11} />
                .txt
              </button>
            )}
          </div>

          <div className={styles.transcriptBody} ref={transcriptRef} aria-live="polite" aria-label="Transcript content">
            {!sttAvailable && (
              <p className={styles.transcriptEmpty}>
                Speech recognition is not available in this browser.
              </p>
            )}

            {sttAvailable && transcriptEntries.length === 0 && !interimText && (
              <p className={styles.transcriptEmpty}>
                {isIdle || isDone
                  ? 'Transcript will appear here during recording.'
                  : 'Listening…'}
              </p>
            )}

            {transcriptEntries.map((entry) => (
              <div key={entry.id} className={styles.transcriptEntry}>
                <span className={styles.transcriptTs}>{entry.timestamp}</span>
                <span className={styles.transcriptText}>{entry.text}</span>
              </div>
            ))}

            {interimText && (
              <div className={`${styles.transcriptEntry} ${styles.transcriptInterim}`} aria-live="off">
                <span className={styles.transcriptTs}>…</span>
                <span className={styles.transcriptText}>{interimText}</span>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

// ── Icon components ────────────────────────────────────────────────────────────

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.3" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
