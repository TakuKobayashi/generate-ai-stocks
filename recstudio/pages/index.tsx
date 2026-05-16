import Head from 'next/head';
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from '../styles/Home.module.css';

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
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function Home() {
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
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttAvailable(!!SR);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStreams();
      stopSpeechRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptEntries, interimText]);

  const stopStreams = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current = null;
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
  };

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

  const stopSpeechRecognition = () => {
    try {
      speechRecRef.current?.abort();
    } catch {}
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
        setTranscriptEntries((prev) => [
          ...prev,
          { id, text: finalText.trim(), timestamp, isFinal: true },
        ]);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
    };

    recognition.onend = () => {
      if (recordingStateRef.current === 'recording') {
        try {
          recognition.start();
        } catch {}
      } else {
        setSttActive(false);
        setInterimText('');
      }
    };

    try {
      recognition.start();
      speechRecRef.current = recognition;
    } catch {}
  }, []);

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

      // Preview
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
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setFileSize(blob.size);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setRecordingState('done');
        stopTimer();
        stopStreams();
        stopSpeechRecognition();
      };

      // User stops screen share
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recordingStateRef.current === 'recording') {
          stopRecording();
        }
      });

      recorder.start(500);
      setRecordingState('recording');
      startTimer();
      startSpeechRecognition();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        setError(err.message);
      } else if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Screen sharing permission denied.');
      }
      setRecordingState('idle');
      stopStreams();
    }
  };

  const stopRecording = useCallback(() => {
    setRecordingState('stopping');
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const downloadVideo = () => {
    if (!videoUrl) return;
    const ext = videoMimeType.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;
    a.click();
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

  const downloadTranscript = () => {
    const text = transcriptEntries
      .map((e) => `[${e.timestamp}] ${e.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRecording = recordingState === 'recording';
  const isIdle = recordingState === 'idle';
  const isDone = recordingState === 'done';
  const isRequesting = recordingState === 'requesting';
  const isStopping = recordingState === 'stopping';

  const stateLabel = {
    idle: 'READY',
    requesting: 'WAITING FOR PERMISSION...',
    recording: 'RECORDING',
    stopping: 'PROCESSING...',
    done: 'COMPLETE',
  }[recordingState];

  return (
    <>
      <Head>
        <title>RecStudio — Screen Recorder</title>
        <meta name="description" content="Browser-based screen recorder with transcription" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.app}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoDot} data-state={recordingState} />
            <span className={styles.logoText}>REC<span>STUDIO</span></span>
          </div>
          <div className={styles.statusBar}>
            <span className={styles.statusLabel} data-state={recordingState}>
              {stateLabel}
            </span>
            {isRecording && (
              <span className={styles.timer}>{formatTime(recordingTime)}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.buildTag}>Browser-native · No server</span>
          </div>
        </header>

        {/* Main */}
        <main className={styles.main}>
          {/* Left Panel: Controls */}
          <aside className={styles.sidebar}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Audio Source</h2>
              <div className={styles.radioGroup}>
                {(['screen', 'microphone', 'none'] as AudioSource[]).map((src) => (
                  <label
                    key={src}
                    className={`${styles.radioItem} ${audioSource === src ? styles.radioSelected : ''}`}
                    onClick={() => !isRecording && setAudioSource(src)}
                  >
                    <span className={styles.radioMark} />
                    <span className={styles.radioIcon}>
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

            {sttAvailable && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Speech-to-Text
                  <span className={`${styles.badge} ${sttActive ? styles.badgeActive : ''}`}>
                    {sttActive ? 'LIVE' : 'AUTO'}
                  </span>
                </h2>
                <p className={styles.sectionNote}>
                  Transcription starts automatically with recording.
                  Language detected from browser settings ({navigator.language ?? '—'}).
                </p>
              </section>
            )}

            {!sttAvailable && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Speech-to-Text</h2>
                <p className={styles.sectionNote} style={{ color: 'var(--amber)' }}>
                  Not supported in this browser. Try Chrome or Edge.
                </p>
              </section>
            )}

            <div className={styles.controlActions}>
              {isIdle && (
                <button className={styles.btnRecord} onClick={startRecording}>
                  <span className={styles.btnDot} />
                  Start Recording
                </button>
              )}

              {isRequesting && (
                <button className={styles.btnRecord} disabled>
                  <span className={`${styles.btnDot} ${styles.btnDotPulse}`} />
                  Requesting...
                </button>
              )}

              {isRecording && (
                <button className={`${styles.btnRecord} ${styles.btnStop}`} onClick={stopRecording}>
                  <span className={styles.btnSquare} />
                  Stop Recording
                </button>
              )}

              {(isStopping) && (
                <button className={styles.btnRecord} disabled>
                  <span className={`${styles.btnDot} ${styles.btnDotPulse}`} />
                  Processing...
                </button>
              )}

              {isDone && (
                <div className={styles.doneActions}>
                  <button className={styles.btnDownload} onClick={downloadVideo}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Save Video
                    {fileSize && <span className={styles.fileSize}>{(fileSize / 1024 / 1024).toFixed(1)}MB</span>}
                  </button>
                  <button className={styles.btnReset} onClick={resetRecording}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-4.3"/>
                    </svg>
                    New Recording
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}
          </aside>

          {/* Center: Preview / Playback */}
          <div className={styles.center}>
            <div className={styles.previewWrap}>
              {/* Recording preview */}
              <video
                ref={previewRef}
                className={`${styles.video} ${isRecording ? styles.videoVisible : styles.videoHidden}`}
                muted
                playsInline
              />

              {/* Playback after done */}
              {isDone && videoUrl && (
                <video
                  ref={playbackRef}
                  key={videoUrl}
                  className={`${styles.video} ${styles.videoVisible}`}
                  src={videoUrl}
                  controls
                  playsInline
                />
              )}

              {/* Idle state */}
              {(isIdle || isRequesting) && (
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <p className={styles.placeholderText}>
                    {isRequesting
                      ? 'Select the screen area to record...'
                      : 'Click "Start Recording" to begin'}
                  </p>
                  {isRequesting && <div className={styles.spinnerRow}><span className={styles.spinner} /></div>}
                </div>
              )}

              {isStopping && (
                <div className={styles.placeholder}>
                  <div className={styles.spinnerRow}><span className={styles.spinner} /></div>
                  <p className={styles.placeholderText}>Finalizing recording...</p>
                </div>
              )}

              {/* Recording overlay indicator */}
              {isRecording && (
                <div className={styles.recOverlay}>
                  <span className={styles.recPulse} />
                  <span className={styles.recLabel}>REC</span>
                  <span className={styles.recTime}>{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            {isDone && (
              <div className={styles.videoMeta}>
                <span className={styles.metaItem}>
                  <span className={styles.metaKey}>Duration</span>
                  <span className={styles.metaVal}>{formatTime(recordingTime)}</span>
                </span>
                <span className={styles.metaDivider} />
                <span className={styles.metaItem}>
                  <span className={styles.metaKey}>Format</span>
                  <span className={styles.metaVal}>{videoMimeType.includes('mp4') ? 'MP4' : 'WebM'}</span>
                </span>
                {fileSize && (
                  <>
                    <span className={styles.metaDivider} />
                    <span className={styles.metaItem}>
                      <span className={styles.metaKey}>Size</span>
                      <span className={styles.metaVal}>{(fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Transcript */}
          <aside className={`${styles.sidebar} ${styles.transcriptSidebar}`}>
            <div className={styles.transcriptHeader}>
              <h2 className={styles.sectionTitle}>
                Transcript
                {sttActive && <span className={styles.liveDot} />}
              </h2>
              {transcriptEntries.length > 0 && (
                <button className={styles.btnSmall} onClick={downloadTranscript}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  .txt
                </button>
              )}
            </div>

            <div className={styles.transcriptBody} ref={transcriptRef}>
              {!sttAvailable && (
                <p className={styles.transcriptEmpty}>
                  Speech recognition not available in this browser.
                </p>
              )}

              {sttAvailable && transcriptEntries.length === 0 && !interimText && (
                <p className={styles.transcriptEmpty}>
                  {isIdle || isDone
                    ? 'Transcript will appear here during recording.'
                    : 'Listening...'}
                </p>
              )}

              {transcriptEntries.map((entry) => (
                <div key={entry.id} className={styles.transcriptEntry}>
                  <span className={styles.transcriptTs}>{entry.timestamp}</span>
                  <span className={styles.transcriptText}>{entry.text}</span>
                </div>
              ))}

              {interimText && (
                <div className={`${styles.transcriptEntry} ${styles.transcriptInterim}`}>
                  <span className={styles.transcriptTs}>…</span>
                  <span className={styles.transcriptText}>{interimText}</span>
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}
