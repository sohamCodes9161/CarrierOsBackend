const API_BASE = window.location.origin + '/api/v1';

const SILENCE_THRESHOLD = 0.02; // RMS amplitude below this counts as "silence"
const SILENCE_DURATION_MS = 3000; // auto-submit after this much continuous silence
const QUEUE_GAP_MS = 500; // brief pause between queued audio clips
const AUDIO_POLL_INTERVAL_MS = 1500;
const AUDIO_POLL_TIMEOUT_MS = 30000; // background TTS can be slow (unofficial service) - give it real room

let accessToken = null;
let currentInterviewId = null;
let isAnswerInFlight = false; // guards against double-submission (VAD auto-submit racing a manual click, etc.)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Audio playback queue - prevents clips from overlapping (e.g. greeting +
// Q1 both trying to autoplay simultaneously).
// ---------------------------------------------------------------------
const audioQueue = [];
let isPlayingQueue = false;

function enqueueAudio(audioEl) {
  audioQueue.push(audioEl);
  if (!isPlayingQueue) playNextInQueue();
}

function playNextInQueue() {
  const next = audioQueue.shift();
  if (!next) {
    isPlayingQueue = false;
    return;
  }
  isPlayingQueue = true;

  next.addEventListener(
    'ended',
    () => setTimeout(playNextInQueue, QUEUE_GAP_MS),
    { once: true }
  );

  next.play().catch((err) => {
    console.warn('Audio playback blocked or failed, skipping:', err.message);
    setTimeout(playNextInQueue, QUEUE_GAP_MS);
  });
}

// ---------------------------------------------------------------------
// Conversation log + deferred audio ("pending" slots filled in once the
// background TTS synthesis finishes and polling picks it up).
// ---------------------------------------------------------------------
const pendingAudioSlots = new Map(); // key -> <audio> element awaiting a src

function logTurn({ label, text, audioUrl, audioPendingKey, className = '' }) {
  const div = document.createElement('div');
  div.className = `turn ${className}`;
  const willHaveAudio = Boolean(audioUrl || audioPendingKey);
  div.innerHTML = `
    <div class="label"></div>
    <div class="text"></div>
    ${willHaveAudio ? '<audio controls></audio>' : ''}
    ${audioPendingKey ? '<div class="audio-loading">🔊 audio loading...</div>' : ''}
  `;
  div.querySelector('.label').textContent = label;
  div.querySelector('.text').textContent = text; // textContent, never innerHTML, for AI-generated text
  $('conversation-log').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });

  if (audioUrl) {
    const audioEl = div.querySelector('audio');
    audioEl.src = audioUrl;
    enqueueAudio(audioEl);
  } else if (audioPendingKey) {
    const audioEl = div.querySelector('audio');
    pendingAudioSlots.set(audioPendingKey, { audioEl, loadingLabel: div.querySelector('.audio-loading') });
  }
}

function setStatus(elId, message, type = '') {
  const el = $(elId);
  el.textContent = message;
  el.className = `status ${type}`;
}

function setBusy(buttonIds, busy) {
  buttonIds.forEach((id) => {
    $(id).disabled = busy;
  });
}

// ---------------------------------------------------------------------
// Background audio polling - since TTS now runs after the response is
// sent (see interview.service.js), audioUrl fields start out null. Poll
// GET /interviews/:id until the fields we're waiting on show up, then
// attach them to their placeholder <audio> elements and queue playback.
// ---------------------------------------------------------------------
function resolveAudioUrlForKey(interview, key) {
  if (key === 'greeting') return interview.greetingAudioUrl;
  if (key === 'report') return interview.finalReport?.audioUrl || null;
  if (key.startsWith('question-')) {
    const qNum = Number(key.split('-')[1]);
    const q = interview.questions.find((q) => q.questionNumber === qNum);
    return q?.questionAudioUrl || null;
  }
  return null;
}

async function pollForPendingAudio(interviewId, keys) {
  const stillWaiting = new Set(keys.filter((k) => pendingAudioSlots.has(k)));
  const startTime = Date.now();

  while (stillWaiting.size > 0 && Date.now() - startTime < AUDIO_POLL_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, AUDIO_POLL_INTERVAL_MS));

    let interview;
    try {
      const res = await fetch(`${API_BASE}/interviews/${interviewId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.success) continue;
      interview = json.data.interview;
    } catch (err) {
      console.warn('Audio poll request failed, will retry:', err.message);
      continue;
    }

    for (const key of [...stillWaiting]) {
      const url = resolveAudioUrlForKey(interview, key);
      if (!url) continue;

      const slot = pendingAudioSlots.get(key);
      if (slot) {
        slot.audioEl.src = url;
        slot.loadingLabel?.remove();
        enqueueAudio(slot.audioEl);
        pendingAudioSlots.delete(key);
      }
      stillWaiting.delete(key);
    }
  }

  for (const key of stillWaiting) {
    const slot = pendingAudioSlots.get(key);
    if (slot) {
      slot.loadingLabel.textContent = '⚠ audio unavailable (took too long or failed)';
    }
    pendingAudioSlots.delete(key);
  }
}

// --- 1. Login ---
$('login-btn').addEventListener('click', async () => {
  setBusy(['login-btn'], true);
  setStatus('login-status', 'Logging in...');
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Login failed');

    accessToken = json.data.accessToken;
    setStatus('login-status', `Logged in as ${json.data.user.email}`, 'success');
    $('start-section').hidden = false;
  } catch (err) {
    setStatus('login-status', err.message, 'error');
  } finally {
    setBusy(['login-btn'], false);
  }
});

// --- 2. Start interview ---
$('start-btn').addEventListener('click', async () => {
  setBusy(['start-btn'], true);
  setStatus('start-status', 'Starting interview...');
  try {
    const targetSkills = $('targetSkills').value.split(',').map((s) => s.trim()).filter(Boolean);
    const voiceEnabled = $('voiceEnabled').checked;

    const res = await fetch(`${API_BASE}/interviews/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        role: $('role').value,
        difficulty: $('difficulty').value,
        interviewType: $('interviewType').value,
        targetSkills,
        totalQuestions: Number($('totalQuestions').value),
        voiceEnabled,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to start interview');

    currentInterviewId = json.data.interview._id;
    setStatus('start-status', 'Interview started', 'success');
    $('interview-section').hidden = false;

    const firstQuestion = json.data.interview.questions[0];

    if (voiceEnabled) {
      logTurn({ label: 'AI Interviewer (greeting)', text: '(spoken greeting)', audioPendingKey: 'greeting' });
      logTurn({
        label: `Question 1 - ${firstQuestion.focusArea}`,
        text: firstQuestion.questionText,
        audioPendingKey: 'question-1',
      });
      pollForPendingAudio(currentInterviewId, ['greeting', 'question-1']);
    } else {
      logTurn({ label: `Question 1 - ${firstQuestion.focusArea}`, text: firstQuestion.questionText });
    }
  } catch (err) {
    setStatus('start-status', err.message, 'error');
  } finally {
    setBusy(['start-btn'], false);
  }
});

// ---------------------------------------------------------------------
// 3a. Record answer via microphone, with Voice Activity Detection (VAD)
// controlling auto-stop, PLUS live in-browser speech recognition running
// in parallel so the transcript is usually already done by the time
// recording stops - see the "why" note in README Module 4d.
// ---------------------------------------------------------------------
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
let analyser = null;
let vadRafId = null;
let silenceTimer = null;
let hasDetectedSpeech = false;
let isStoppingRecording = false; // guards against double-stop (VAD timer + manual click racing)

// --- Live speech recognition (the actual latency fix) ---
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let speechRecognizer = null;
let liveFinalTranscript = '';
let recognitionShouldStayActive = false; // true while we want it running/auto-restarting

function startLiveSpeechRecognition() {
  if (!SpeechRecognitionImpl) return; // no live path available - the Whisper fallback will handle this answer
  liveFinalTranscript = '';
  recognitionShouldStayActive = true;

  speechRecognizer = new SpeechRecognitionImpl();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        liveFinalTranscript += `${piece} `;
      } else {
        interim += piece;
      }
    }
    const preview = (liveFinalTranscript + interim).trim();
    $('record-status').textContent = preview ? `Listening... "${preview}"` : 'Listening...';
  };

  speechRecognizer.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn('Live speech recognition error (will fall back to server-side transcription):', event.error);
    }
  };

  speechRecognizer.onend = () => {
    // Some browsers stop recognition after a pause even with continuous=true.
    // Restart automatically as long as we're still meant to be recording.
    if (recognitionShouldStayActive) {
      try {
        speechRecognizer.start();
      } catch {
        // Already running, or genuinely unavailable now - the recorded
        // audio blob is still there as a fallback either way.
      }
    }
  };

  try {
    speechRecognizer.start();
  } catch (err) {
    console.warn('Could not start live speech recognition, will use server-side transcription instead:', err.message);
    recognitionShouldStayActive = false;
  }
}

function stopLiveSpeechRecognition() {
  recognitionShouldStayActive = false;
  if (speechRecognizer) {
    speechRecognizer.onend = null; // prevent the auto-restart handler from firing on an intentional stop
    try {
      speechRecognizer.stop();
    } catch {
      // already stopped - fine
    }
    speechRecognizer = null;
  }
}

function computeRms(dataArray) {
  let sumSquares = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / dataArray.length);
}

function monitorVoiceActivity() {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function tick() {
    if (!analyser) return; // recording already stopped/cleaned up
    analyser.getByteTimeDomainData(dataArray);
    const rms = computeRms(dataArray);

    const meterBar = $('vad-meter-bar');
    meterBar.style.width = `${Math.min(rms * 400, 100)}%`;
    meterBar.classList.toggle('silent', rms < SILENCE_THRESHOLD);

    if (rms >= SILENCE_THRESHOLD) {
      hasDetectedSpeech = true;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    } else if (hasDetectedSpeech && !silenceTimer) {
      silenceTimer = setTimeout(() => stopRecordingAndSubmit(), SILENCE_DURATION_MS);
    }

    vadRafId = requestAnimationFrame(tick);
  }

  vadRafId = requestAnimationFrame(tick);
}

function cleanupRecordingResources(stream) {
  if (vadRafId) {
    cancelAnimationFrame(vadRafId);
    vadRafId = null;
  }
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  analyser = null;
  hasDetectedSpeech = false;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  $('vad-meter-bar').style.width = '0%';
}

$('record-btn').addEventListener('click', async () => {
  if (isAnswerInFlight) return; // previous answer still submitting - ignore

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecordingAndSubmit();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      cleanupRecordingResources(stream);
      stopLiveSpeechRecognition();

      const liveTranscript = liveFinalTranscript.trim();
      if (liveTranscript) {
        // Fast path: already transcribed live while the candidate was
        // speaking - no audio upload, no server-side Whisper wait.
        await submitTextAnswer(liveTranscript, 'live speech recognition');
      } else {
        // Fallback: live recognition wasn't available or produced nothing -
        // use the recorded audio with server-side Groq Whisper transcription.
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        await submitAudioAnswer(audioBlob);
      }
      isStoppingRecording = false;
    };

    isStoppingRecording = false;
    hasDetectedSpeech = false;
    mediaRecorder.start();
    monitorVoiceActivity();
    startLiveSpeechRecognition();

    $('record-btn').classList.add('recording');
    $('record-btn').textContent = '⏹ Stop recording';
    $('record-status').textContent = SpeechRecognitionImpl
      ? 'Listening...'
      : 'Listening... (this browser has no live transcription - will transcribe after you stop)';
    setBusy(['submit-text-btn'], true); // only one answer channel active at a time
  } catch (err) {
    setStatus('record-status', `Mic error: ${err.message}`, 'error');
  }
});

function stopRecordingAndSubmit() {
  if (isStoppingRecording || !mediaRecorder || mediaRecorder.state !== 'recording') return;
  isStoppingRecording = true;

  $('record-btn').classList.remove('recording');
  $('record-btn').textContent = '🎤 Record answer';

  mediaRecorder.stop(); // triggers onstop above, which does cleanup + submit
}

async function submitAudioAnswer(audioBlob) {
  if (isAnswerInFlight) return; // extra guard - should be unreachable given the checks above, but cheap insurance
  isAnswerInFlight = true;
  setBusy(['record-btn', 'submit-text-btn'], true);
  $('record-status').textContent = 'Uploading and transcribing (server-side)...';

  const formData = new FormData();
  formData.append('answer', audioBlob, 'answer.webm');

  try {
    const res = await fetch(`${API_BASE}/interviews/${currentInterviewId}/answer/audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to submit answer');

    $('record-status').textContent = '';
    handleAnswerResponse(json.data.interview, json.data.transcript, 'server-side Whisper');
  } catch (err) {
    setStatus('record-status', err.message, 'error');
  } finally {
    isAnswerInFlight = false;
    setBusy(['record-btn', 'submit-text-btn'], false);
  }
}

// --- 3b. Shared text-answer submission - used by both the live-speech fast
// path above and the manual "type instead" box below. ---
async function submitTextAnswer(answerText, source) {
  if (isAnswerInFlight) return;
  isAnswerInFlight = true;
  setBusy(['record-btn', 'submit-text-btn'], true);

  try {
    const res = await fetch(`${API_BASE}/interviews/${currentInterviewId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ answerText }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to submit answer');

    handleAnswerResponse(json.data.interview, answerText, source);
  } catch (err) {
    setStatus('record-status', err.message, 'error');
  } finally {
    isAnswerInFlight = false;
    setBusy(['record-btn', 'submit-text-btn'], false);
    $('record-status').textContent = '';
  }
}

$('submit-text-btn').addEventListener('click', () => {
  if (isAnswerInFlight) return;
  const answerText = $('text-answer').value.trim();
  if (!answerText) return;
  $('text-answer').value = '';
  submitTextAnswer(answerText, 'typed');
});

// --- Shared: render the evaluation + next question or final report ---
function handleAnswerResponse(interview, transcript, source) {
  const questions = interview.questions;
  const justAnswered = [...questions].reverse().find((q) => q.answerText !== null);

  if (transcript) {
    const label = source === 'typed' ? 'You typed' : `You said (${source})`;
    logTurn({ label, text: transcript, className: 'answer' });
  }

  if (justAnswered && justAnswered.evaluation) {
    const evalu = justAnswered.evaluation;
    logTurn({
      label: `Evaluation - correctness ${evalu.correctnessScore}/100, communication ${evalu.communicationScore}/100`,
      text: evalu.feedback,
    });
  }

  if (interview.status === 'completed') {
    const report = interview.finalReport;
    if (interview.voiceEnabled) {
      logTurn({
        label: `Final Report - overall score ${report.overallScore}/100 - ready for role: ${report.readyForRole}`,
        text: `${report.summary}\n\nRecommendation: ${report.recommendation}`,
        audioPendingKey: 'report',
        className: 'report',
      });
      pollForPendingAudio(currentInterviewId, ['report']);
    } else {
      logTurn({
        label: `Final Report - overall score ${report.overallScore}/100 - ready for role: ${report.readyForRole}`,
        text: `${report.summary}\n\nRecommendation: ${report.recommendation}`,
        className: 'report',
      });
    }
    $('answer-controls').style.display = 'none';
  } else {
    const nextQuestion = questions[questions.length - 1];
    if (interview.voiceEnabled) {
      const key = `question-${nextQuestion.questionNumber}`;
      logTurn({
        label: `Question ${nextQuestion.questionNumber} - ${nextQuestion.focusArea}`,
        text: nextQuestion.questionText,
        audioPendingKey: key,
      });
      pollForPendingAudio(currentInterviewId, [key]);
    } else {
      logTurn({
        label: `Question ${nextQuestion.questionNumber} - ${nextQuestion.focusArea}`,
        text: nextQuestion.questionText,
      });
    }
  }
}
