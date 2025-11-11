// Function to toggle the full feedback display
function toggleFullFeedback(button) {
    const fullFeedbackDiv = button.parentNode.nextElementSibling;
    const toggleIcon = button.querySelector('.toggle-icon');

    if (fullFeedbackDiv.style.display === 'none') {
        fullFeedbackDiv.style.display = 'block';
        toggleIcon.textContent = '−';
        button.innerHTML = button.innerHTML.replace('Show Full Feedback', 'Hide Full Feedback');
    } else {
        fullFeedbackDiv.style.display = 'none';
        toggleIcon.textContent = '+';
        button.innerHTML = button.innerHTML.replace('Hide Full Feedback', 'Show Full Feedback');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const setupPanel = document.getElementById('setup-panel');
    const interviewPanel = document.getElementById('interview-panel');
    const summaryPanel = document.getElementById('summary-panel');

    const jobRoleSelect = document.getElementById('job-role');
    const customRoleGroup = document.getElementById('custom-role-group');
    const customRoleInput = document.getElementById('custom-role');
    const interviewTypeSelect = document.getElementById('interview-type');
    const positionLevelSelect = document.getElementById('position-level');
    const numQuestionsInput = document.getElementById('num-questions');

    const startInterviewBtn = document.getElementById('start-interview');
    const recordBtn = document.getElementById('record-btn');
    const recordingStatus = document.getElementById('recording-status');
    const nextQuestionBtn = document.getElementById('next-question');
    const finishInterviewBtn = document.getElementById('finish-interview');
    const newInterviewBtn = document.getElementById('new-interview');

    const questionNumber = document.getElementById('question-number');
    const currentQuestion = document.getElementById('current-question');
    const answerText = document.getElementById('answer-text');
    const feedbackText = document.getElementById('feedback-text');

    const playFeedbackBtn = document.getElementById('play-feedback');
    const playFollowupBtn = document.getElementById('play-followup');
    const playFollowupFeedbackBtn = document.getElementById('play-followup-feedback');

    const followUpContainer = document.getElementById('follow-up-container');
    const followUpQuestion = document.getElementById('follow-up-question');
    const followUpRecordBtn = document.getElementById('follow-up-record-btn');
    const followUpRecordingStatus = document.getElementById('follow-up-recording-status');
    const followUpAnswer = document.getElementById('follow-up-answer');
    const followUpFeedback = document.getElementById('follow-up-feedback');

    const interviewSummary = document.getElementById('interview-summary');
    const faceMonitor = document.getElementById('face-monitor');

    // State variables
    let currentQuestionIndex = 0;
    let questions = [];
    let answers = [];
    let feedbacks = [];
    let followUps = [];
    let followUpAnswers = [];
    let followUpFeedbacks = [];
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let stream = null;
    let videoStream = null;
    let feedbackPlayed = false;
    let followupFeedbackPlayed = false;
    let autoPlayFollowupTimeout = null;

    // Audio cache and control variables
    let audioCache = {};
    let currentAudio = null;
    let pauseFeedbackBtn = document.getElementById('pause-feedback');
    let pauseFollowupFeedbackBtn = document.getElementById('pause-followup-feedback');

    // Show/hide custom role input based on selection
    jobRoleSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customRoleGroup.style.display = 'block';
        } else {
            customRoleGroup.style.display = 'none';
        }
    });

    // Start Interview Button
    startInterviewBtn.addEventListener('click', function() {
        const jobRole = jobRoleSelect.value === 'custom' ? customRoleInput.value : jobRoleSelect.value;
        const interviewType = interviewTypeSelect.value;
        const positionLevel = positionLevelSelect.value;
        const numQuestions = parseInt(numQuestionsInput.value);

        if (jobRoleSelect.value === 'custom' && !customRoleInput.value.trim()) {
            alert('Please enter a custom job role');
            return;
        }

        if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 10) {
            alert('Please enter a valid number of questions (1-10)');
            return;
        }

        // Start the interview
        startInterview(jobRole, interviewType, positionLevel, numQuestions);
    });

    // Record Button
    recordBtn.addEventListener('click', function() {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    // Follow-up Record Button
    followUpRecordBtn.addEventListener('click', function() {
        if (!isRecording) {
            startRecording(true);
        } else {
            stopRecording(true);
        }
    });

    // Next Question Button
    nextQuestionBtn.addEventListener('click', function() {
        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // Clean up audio for the current question
        cleanupQuestionAudio(currentQuestionIndex);

        currentQuestionIndex++;
        displayQuestion();

        // Reset UI elements
        answerText.innerHTML = '<p class="placeholder">Your transcribed answer will appear here...</p>';
        feedbackText.innerHTML = '<p class="placeholder">Feedback will appear here after you answer...</p>';

        // Reset follow-up container and its contents
        followUpContainer.style.display = 'none';
        followUpAnswer.innerHTML = '<p class="placeholder">Your follow-up answer will appear here...</p>';
        followUpFeedback.innerHTML = '<p class="placeholder">Follow-up feedback will appear here...</p>';
        followUpRecordingStatus.textContent = 'Not recording';
        followUpRecordingStatus.style.color = '';

        // Reset pause buttons
        pauseFeedbackBtn.disabled = true;
        pauseFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
        pauseFollowupFeedbackBtn.disabled = true;
        pauseFollowupFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';

        nextQuestionBtn.disabled = true;

        if (currentQuestionIndex === questions.length - 1) {
            finishInterviewBtn.style.display = 'block';
        }
    });

    // Finish Interview Button
    finishInterviewBtn.addEventListener('click', function() {
        finishInterview();
    });

    // New Interview Button
    newInterviewBtn.addEventListener('click', function() {
        resetInterview();
    });

    // Play Feedback Button
    playFeedbackBtn.addEventListener('click', function() {
        if (feedbacks[currentQuestionIndex]) {
            // Get the feedback summary from the data attribute
            const feedbackSummary = playFeedbackBtn.getAttribute('data-feedback-summary') ||
                                   "Here's my feedback on your answer.";

            // Stop any currently playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            // Play the feedback summary from cache if available, otherwise generate it
            const cacheKey = `feedback_${currentQuestionIndex}`;
            if (audioCache[cacheKey]) {
                playAudioFromCache(cacheKey);
            } else {
                playAndCacheAudio(feedbackSummary, cacheKey);
            }

            feedbackPlayed = true;
            pauseFeedbackBtn.disabled = false;

            // Cancel any scheduled auto-play of follow-up question
            if (autoPlayFollowupTimeout) {
                clearTimeout(autoPlayFollowupTimeout);
                autoPlayFollowupTimeout = null;
            }
        }
    });

    // Pause Feedback Button
    pauseFeedbackBtn.addEventListener('click', function() {
        if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play();
                pauseFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
            } else {
                currentAudio.pause();
                pauseFeedbackBtn.innerHTML = '<span class="play-icon"></span> Resume';
            }
        }
    });

    // Play Follow-up Question Button
    playFollowupBtn.addEventListener('click', function() {
        if (followUps[currentQuestionIndex] && followUps[currentQuestionIndex].length > 0) {
            // Stop any currently playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const cacheKey = `followup_question_${currentQuestionIndex}`;
            if (audioCache[cacheKey]) {
                playAudioFromCache(cacheKey);
            } else {
                playAndCacheAudio(followUps[currentQuestionIndex][0], cacheKey);
            }
        }
    });

    // Play Follow-up Feedback Button
    playFollowupFeedbackBtn.addEventListener('click', function() {
        if (followUpFeedbacks[currentQuestionIndex] && followUpFeedbacks[currentQuestionIndex].length > 0) {
            // Stop any currently playing audio
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }

            const cacheKey = `followup_feedback_${currentQuestionIndex}`;
            if (audioCache[cacheKey]) {
                playAudioFromCache(cacheKey);
            } else {
                playAndCacheAudio(followUpFeedbacks[currentQuestionIndex][0], cacheKey);
            }

            followupFeedbackPlayed = true;
            pauseFollowupFeedbackBtn.disabled = false;
        }
    });

    // Pause Follow-up Feedback Button
    pauseFollowupFeedbackBtn.addEventListener('click', function() {
        if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play();
                pauseFollowupFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
            } else {
                currentAudio.pause();
                pauseFollowupFeedbackBtn.innerHTML = '<span class="play-icon"></span> Resume';
            }
        }
    });

    // Start the interview process
    async function startInterview(jobRole, interviewType, positionLevel, numQuestions) {
        try {
            // Show loading state
            startInterviewBtn.disabled = true;
            startInterviewBtn.textContent = 'Loading...';

            // Request questions from the server
            const response = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    job_role: jobRole,
                    interview_type: interviewType,
                    position_level: positionLevel,
                    num_questions: numQuestions
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate questions');
            }

            const data = await response.json();
            questions = data.questions;

            if (!questions || questions.length === 0) {
                throw new Error('No questions received');
            }

            // Initialize arrays for storing interview data
            answers = new Array(questions.length).fill('');
            feedbacks = new Array(questions.length).fill('');
            followUps = new Array(questions.length).fill([]);
            followUpAnswers = new Array(questions.length).fill([]);
            followUpFeedbacks = new Array(questions.length).fill([]);

            // Start face monitoring
            startFaceMonitoring();

            // Switch to interview panel
            setupPanel.style.display = 'none';
            interviewPanel.style.display = 'block';

            // Display the first question
            currentQuestionIndex = 0;
            displayQuestion();

        } catch (error) {
            console.error('Error starting interview:', error);
            alert('Failed to start interview: ' + error.message);
            startInterviewBtn.disabled = false;
            startInterviewBtn.textContent = 'Start Interview';
        }
    }

    // Display the current question
    function displayQuestion() {
        questionNumber.textContent = `Question ${currentQuestionIndex + 1}`;
        currentQuestion.textContent = questions[currentQuestionIndex];

        // Reset feedback flags
        feedbackPlayed = false;
        followupFeedbackPlayed = false;

        // Reset play buttons
        playFeedbackBtn.disabled = true;
        playFollowupFeedbackBtn.disabled = true;

        // Text-to-speech for the question
        const cacheKey = `question_${currentQuestionIndex}`;
        if (audioCache[cacheKey]) {
            playAudioFromCache(cacheKey);
        } else {
            playAndCacheAudio(questions[currentQuestionIndex], cacheKey);
        }
    }

    // Start recording audio
    async function startRecording(isFollowUp = false) {
        try {
            // Request microphone access
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Update UI
            if (isFollowUp) {
                followUpRecordBtn.querySelector('.btn-text').textContent = 'Stop Recording';
                followUpRecordingStatus.textContent = 'Recording...';
                followUpRecordingStatus.style.color = 'red';
            } else {
                recordBtn.querySelector('.btn-text').textContent = 'Stop Recording';
                recordingStatus.textContent = 'Recording...';
                recordingStatus.style.color = 'red';
            }

            // Set up media recorder
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                processRecording(isFollowUp);
            });

            // Start recording
            mediaRecorder.start();
            isRecording = true;

        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Failed to access microphone: ' + error.message);
        }
    }

    // Stop recording audio
    function stopRecording(isFollowUp = false) {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;

            // Update UI
            if (isFollowUp) {
                followUpRecordBtn.querySelector('.btn-text').textContent = 'Press to Record';
                followUpRecordingStatus.textContent = 'Processing...';
                followUpRecordingStatus.style.color = 'blue';
            } else {
                recordBtn.querySelector('.btn-text').textContent = 'Press to Record';
                recordingStatus.textContent = 'Processing...';
                recordingStatus.style.color = 'blue';
            }

            // Stop the microphone stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    // Process the recorded audio
    async function processRecording(isFollowUp = false) {
        try {
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

            // Create form data for upload
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('question', isFollowUp ?
                followUpQuestion.textContent :
                questions[currentQuestionIndex]);
            formData.append('question_index', currentQuestionIndex);
            formData.append('is_follow_up', isFollowUp);

            if (isFollowUp) {
                formData.append('follow_up_index',
                    followUps[currentQuestionIndex].indexOf(followUpQuestion.textContent));
            }

            // Send to server for processing
            const response = await fetch('/api/process-answer', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to process answer');
            }

            const data = await response.json();

            // Update UI with transcription and feedback
            if (isFollowUp) {
                // Handle follow-up answer
                followUpAnswer.innerHTML = `<p>${data.transcription}</p>`;
                followUpFeedback.innerHTML = formatFeedback(data.feedback);

                // Store the follow-up data
                if (!Array.isArray(followUpAnswers[currentQuestionIndex])) {
                    followUpAnswers[currentQuestionIndex] = [];
                }
                if (!Array.isArray(followUpFeedbacks[currentQuestionIndex])) {
                    followUpFeedbacks[currentQuestionIndex] = [];
                }

                const followUpIndex = followUps[currentQuestionIndex].indexOf(followUpQuestion.textContent);
                followUpAnswers[currentQuestionIndex][followUpIndex] = data.transcription;
                followUpFeedbacks[currentQuestionIndex][followUpIndex] = data.feedback;

                // Enable the play feedback button
                playFollowupFeedbackBtn.disabled = false;

                // Reset follow-up feedback played flag
                followupFeedbackPlayed = false;

                // Pre-generate the audio for the follow-up feedback
                const followupFeedbackCacheKey = `followup_feedback_${currentQuestionIndex}`;
                fetch('/api/text-to-speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: data.feedback })
                })
                .then(response => response.json())
                .then(audioData => {
                    if (audioData.success && audioData.audio_data) {
                        audioCache[followupFeedbackCacheKey] = `data:${audioData.mime_type};base64,${audioData.audio_data}`;
                    }
                })
                .catch(error => {
                    console.error('Error pre-generating follow-up feedback audio:', error);
                });

                followUpRecordingStatus.textContent = 'Completed';
                followUpRecordingStatus.style.color = 'green';

                // Enable next question button
                nextQuestionBtn.disabled = false;

            } else {
                // Handle main question answer
                answerText.innerHTML = `<p>${data.transcription}</p>`;

                // Format the feedback with better structure
                feedbackText.innerHTML = formatFeedback(data.feedback);

                // Store the answer and feedback
                answers[currentQuestionIndex] = data.transcription;
                feedbacks[currentQuestionIndex] = data.feedback;

                // Enable the play feedback button
                playFeedbackBtn.disabled = false;

                // Store the feedback summary in the button's data attribute
                playFeedbackBtn.setAttribute('data-feedback-summary', data.feedback_summary);

                // Reset feedback played flag
                feedbackPlayed = false;

                // Pre-generate the audio for the feedback
                const feedbackCacheKey = `feedback_${currentQuestionIndex}`;
                fetch('/api/text-to-speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: data.feedback_summary })
                })
                .then(response => response.json())
                .then(audioData => {
                    if (audioData.success && audioData.audio_data) {
                        audioCache[feedbackCacheKey] = `data:${audioData.mime_type};base64,${audioData.audio_data}`;
                    }
                })
                .catch(error => {
                    console.error('Error pre-generating feedback audio:', error);
                });

                recordingStatus.textContent = 'Completed';
                recordingStatus.style.color = 'green';

                // Show follow-up questions if available
                if (data.follow_up_questions && data.follow_up_questions.length > 0) {
                    followUps[currentQuestionIndex] = data.follow_up_questions;
                    followUpQuestion.textContent = data.follow_up_questions[0];
                    followUpContainer.style.display = 'block';

                    // Pre-generate the audio for the follow-up question
                    const followupQuestionCacheKey = `followup_question_${currentQuestionIndex}`;
                    fetch('/api/text-to-speech', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ text: data.follow_up_questions[0] })
                    })
                    .then(response => response.json())
                    .then(audioData => {
                        if (audioData.success && audioData.audio_data) {
                            audioCache[followupQuestionCacheKey] = `data:${audioData.mime_type};base64,${audioData.audio_data}`;
                        }
                    })
                    .catch(error => {
                        console.error('Error pre-generating follow-up question audio:', error);
                    });

                    // Set up auto-play of follow-up question if feedback isn't played
                    autoPlayFollowupTimeout = setTimeout(() => {
                        if (!feedbackPlayed) {
                            playAudioFromCache(followupQuestionCacheKey);
                        }
                    }, 5000); // Wait 5 seconds after feedback
                } else {
                    // No follow-ups, enable next question button
                    nextQuestionBtn.disabled = false;
                }
            }

        } catch (error) {
            console.error('Error processing recording:', error);
            alert('Failed to process recording: ' + error.message);

            if (isFollowUp) {
                followUpRecordingStatus.textContent = 'Error';
                followUpRecordingStatus.style.color = 'red';
            } else {
                recordingStatus.textContent = 'Error';
                recordingStatus.style.color = 'red';
            }
        }
    }

    // Start face monitoring
    async function startFaceMonitoring() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            faceMonitor.srcObject = videoStream;

            // Notify the server that face monitoring has started
            fetch('/api/start-face-monitoring', {
                method: 'POST'
            }).catch(error => {
                console.error('Error starting face monitoring on server:', error);
            });

        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Failed to access camera. Face monitoring will not be available.');
        }
    }

    // Stop face monitoring
    function stopFaceMonitoring() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());

            // Notify the server that face monitoring has stopped
            fetch('/api/stop-face-monitoring', {
                method: 'POST'
            }).catch(error => {
                console.error('Error stopping face monitoring on server:', error);
            });
        }
    }

    // Finish the interview and show summary
    async function finishInterview() {
        try {
            // Show loading state
            finishInterviewBtn.disabled = true;
            finishInterviewBtn.textContent = 'Generating Summary...';

            // Request interview summary from the server
            const response = await fetch('/api/generate-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    questions: questions,
                    answers: answers,
                    feedbacks: feedbacks,
                    follow_ups: followUps,
                    follow_up_answers: followUpAnswers,
                    follow_up_feedbacks: followUpFeedbacks
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate summary');
            }

            const data = await response.json();

            // Stop face monitoring
            stopFaceMonitoring();

            // Switch to summary panel
            interviewPanel.style.display = 'none';
            summaryPanel.style.display = 'block';

            // Display the summary
            interviewSummary.innerHTML = data.summary;

            // Add a play button for the summary
            const playSummaryBtn = document.createElement('button');
            playSummaryBtn.className = 'btn btn-play';
            playSummaryBtn.innerHTML = '<span class="play-icon"></span> Play Summary';
            playSummaryBtn.style.marginTop = '20px';
            playSummaryBtn.onclick = function() {
                speakText(data.condensed_summary);
            };

            // Add the button to the summary panel
            interviewSummary.appendChild(document.createElement('br'));
            interviewSummary.appendChild(playSummaryBtn);

        } catch (error) {
            console.error('Error finishing interview:', error);
            alert('Failed to generate interview summary: ' + error.message);
            finishInterviewBtn.disabled = false;
            finishInterviewBtn.textContent = 'Finish Interview';
        }
    }

    // Reset the interview to start a new one
    function resetInterview() {
        // Stop any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // Reset state variables
        currentQuestionIndex = 0;
        questions = [];
        answers = [];
        feedbacks = [];
        followUps = [];
        followUpAnswers = [];
        followUpFeedbacks = [];
        feedbackPlayed = false;
        followupFeedbackPlayed = false;

        // Clear audio cache
        audioCache = {};

        // Clear any pending timeouts
        if (autoPlayFollowupTimeout) {
            clearTimeout(autoPlayFollowupTimeout);
            autoPlayFollowupTimeout = null;
        }

        // Reset UI elements
        answerText.innerHTML = '<p class="placeholder">Your transcribed answer will appear here...</p>';
        feedbackText.innerHTML = '<p class="placeholder">Feedback will appear here after you answer...</p>';
        followUpContainer.style.display = 'none';
        followUpAnswer.innerHTML = '<p class="placeholder">Your follow-up answer will appear here...</p>';
        followUpFeedback.innerHTML = '<p class="placeholder">Follow-up feedback will appear here...</p>';

        recordBtn.querySelector('.btn-text').textContent = 'Press to Record';
        recordingStatus.textContent = 'Not recording';
        recordingStatus.style.color = '';

        followUpRecordBtn.querySelector('.btn-text').textContent = 'Press to Record';
        followUpRecordingStatus.textContent = 'Not recording';
        followUpRecordingStatus.style.color = '';

        // Reset buttons
        playFeedbackBtn.disabled = true;
        playFollowupFeedbackBtn.disabled = true;

        nextQuestionBtn.disabled = true;
        finishInterviewBtn.disabled = true;
        finishInterviewBtn.style.display = 'none';
        startInterviewBtn.disabled = false;
        startInterviewBtn.textContent = 'Start Interview';

        // Clean up temporary files on the server
        fetch('/api/cleanup', {
            method: 'POST'
        }).catch(error => {
            console.error('Error cleaning up resources:', error);
        });

        // Switch back to setup panel
        summaryPanel.style.display = 'none';
        setupPanel.style.display = 'block';
    }

    // Function to play audio from cache
    function playAudioFromCache(cacheKey) {
        if (audioCache[cacheKey]) {
            // Stop any currently playing audio
            if (currentAudio) {
                currentAudio.pause();
            }

            // Create a new audio element from the cached data
            currentAudio = new Audio(audioCache[cacheKey]);

            // Add event listener for when audio ends
            currentAudio.addEventListener('ended', function() {
                currentAudio = null;

                // Reset pause buttons when audio ends
                if (cacheKey.startsWith('feedback_')) {
                    pauseFeedbackBtn.disabled = true;
                    pauseFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
                } else if (cacheKey.startsWith('followup_feedback_')) {
                    pauseFollowupFeedbackBtn.disabled = true;
                    pauseFollowupFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
                }
            });

            // Play the audio
            currentAudio.play().catch(error => {
                console.error('Error playing cached audio:', error);
                currentAudio = null;
            });
        }
    }

    // Function to play and cache audio
    function playAndCacheAudio(text, cacheKey) {
        fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.audio_data) {
                // Create the data URI
                const audioDataUri = `data:${data.mime_type};base64,${data.audio_data}`;

                // Cache the audio data
                audioCache[cacheKey] = audioDataUri;

                // Create an audio element
                currentAudio = new Audio(audioDataUri);

                // Add event listener for when audio ends
                currentAudio.addEventListener('ended', function() {
                    currentAudio = null;

                    // Reset pause buttons when audio ends
                    if (cacheKey.startsWith('feedback_')) {
                        pauseFeedbackBtn.disabled = true;
                        pauseFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
                    } else if (cacheKey.startsWith('followup_feedback_')) {
                        pauseFollowupFeedbackBtn.disabled = true;
                        pauseFollowupFeedbackBtn.innerHTML = '<span class="pause-icon"></span> Pause';
                    }
                });

                // Play the audio
                currentAudio.play().catch(error => {
                    console.error('Error playing audio:', error);
                    currentAudio = null;
                });
            }
        })
        .catch(error => {
            console.error('Error with text-to-speech:', error);
        });
    }

    // Function to clean up audio for a specific question
    function cleanupQuestionAudio(questionIndex) {
        // Remove cached audio for this question
        const keysToRemove = [
            `question_${questionIndex}`,
            `feedback_${questionIndex}`,
            `followup_question_${questionIndex}`,
            `followup_feedback_${questionIndex}`
        ];

        keysToRemove.forEach(key => {
            if (audioCache[key]) {
                delete audioCache[key];
            }
        });

        // Notify the server to clean up files for this question
        fetch('/api/cleanup-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question_index: questionIndex })
        }).catch(error => {
            console.error('Error cleaning up question audio on server:', error);
        });
    }

    // Legacy text-to-speech function (kept for compatibility)
    function speakText(text) {
        playAndCacheAudio(text, 'temp_' + Date.now());
    }

    // Function to format feedback in a more structured and readable way
    function formatFeedback(feedbackText) {
        if (!feedbackText) return '';

        // Store the original feedback text for the full view
        const originalFeedback = feedbackText;

        // Extract sections from the feedback
        const sections = [];

        // Extract Content Quality score
        const contentQualityMatch = feedbackText.match(/\*\*Content Quality \(0-10\):\s*(\d+)\*\*/);
        const contentQualityScore = contentQualityMatch ? parseInt(contentQualityMatch[1]) : 0;

        // Extract Relevance score
        const relevanceMatch = feedbackText.match(/\*\*Relevance to Question \(0-10\):\s*(\d+)\*\*/);
        const relevanceScore = relevanceMatch ? parseInt(relevanceMatch[1]) : 0;

        // Extract Completeness score
        const completenessMatch = feedbackText.match(/\*\*Completeness \(0-10\):\s*(\d+)\*\*/);
        const completenessScore = completenessMatch ? parseInt(completenessMatch[1]) : 0;

        // Create the overview section
        let html = `
            <div class="feedback-section">
                <div class="feedback-section-title">Performance Overview</div>
                <div>
                    <span>Content Quality: </span>
                    <span class="feedback-score ${getScoreClass(contentQualityScore)}">${contentQualityScore}/10</span>
                </div>
                <div>
                    <span>Relevance: </span>
                    <span class="feedback-score ${getScoreClass(relevanceScore)}">${relevanceScore}/10</span>
                </div>
                <div>
                    <span>Completeness: </span>
                    <span class="feedback-score ${getScoreClass(completenessScore)}">${completenessScore}/10</span>
                </div>
            </div>
        `;

        // Extract Sentiment Analysis
        const sentimentMatch = feedbackText.match(/\*\*Sentiment Analysis:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (sentimentMatch && sentimentMatch[1].trim()) {
            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Sentiment Analysis</div>
                    <div>${sentimentMatch[1].trim()}</div>
                </div>
            `;
        }

        // Extract Strengths
        const strengthsMatch = feedbackText.match(/\*\*Strengths:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (strengthsMatch && strengthsMatch[1].trim()) {
            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Strengths</div>
                    <div>${strengthsMatch[1].trim()}</div>
                </div>
            `;
        }

        // Extract Areas for Improvement
        const improvementMatch = feedbackText.match(/\*\*Areas for Improvement:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (improvementMatch) {
            const improvementText = improvementMatch[1];

            // Extract sub-sections if they exist
            const subSections = [];

            // Knowledge of Financial Metrics
            const metricsMatch = improvementText.match(/\*\*Knowledge of Financial Metrics:\*\*(.*?)(?=\*\*|$)/s);
            if (metricsMatch) {
                subSections.push({
                    title: "Knowledge of Financial Metrics",
                    content: metricsMatch[1].trim()
                });
            }

            // ROI Analysis Techniques
            const roiMatch = improvementText.match(/\*\*ROI Analysis Techniques:\*\*(.*?)(?=\*\*|$)/s);
            if (roiMatch) {
                subSections.push({
                    title: "ROI Analysis Techniques",
                    content: roiMatch[1].trim()
                });
            }

            // Communication Skills
            const commMatch = improvementText.match(/\*\*Communication Skills:\*\*(.*?)(?=\*\*|$)/s);
            if (commMatch) {
                subSections.push({
                    title: "Communication Skills",
                    content: commMatch[1].trim()
                });
            }

            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Areas for Improvement</div>
            `;

            if (subSections.length > 0) {
                subSections.forEach(section => {
                    html += `
                        <div style="margin-top: 10px; margin-bottom: 10px;">
                            <strong>${section.title}:</strong> ${section.content}
                        </div>
                    `;
                });
            } else {
                html += `<div>${improvementText.trim()}</div>`;
            }

            html += `</div>`;
        }

        // Extract Specific Feedback
        const specificFeedbackMatch = feedbackText.match(/\*\*Specific Feedback:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (specificFeedbackMatch && specificFeedbackMatch[1].trim()) {
            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Specific Feedback</div>
                    <div class="feedback-highlight">${specificFeedbackMatch[1].trim()}</div>
                </div>
            `;
        }

        // Extract Overall Impression
        const overallMatch = feedbackText.match(/\*\*Overall Impression:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (overallMatch && overallMatch[1].trim()) {
            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Overall Impression</div>
                    <div>${overallMatch[1].trim()}</div>
                </div>
            `;
        }

        // Extract Additional Insights
        const insightsMatch = feedbackText.match(/\*\*Additional Insights:\*\*(.*?)(?=\d+\.\s+\*\*|$)/s);
        if (insightsMatch && insightsMatch[1].trim()) {
            html += `
                <div class="feedback-section">
                    <div class="feedback-section-title">Additional Insights</div>
                    <div>${insightsMatch[1].trim()}</div>
                </div>
            `;
        }

        // Add the full feedback text in a collapsible section
        html += `
            <div class="feedback-section">
                <div class="feedback-section-title">
                    <button class="btn-toggle-full-feedback" onclick="toggleFullFeedback(this)">
                        <span class="toggle-icon">+</span> Show Full Feedback
                    </button>
                </div>
                <div class="full-feedback" style="display: none;">
                    <div class="feedback-full-text">${formatFullFeedback(originalFeedback)}</div>
                </div>
            </div>
        `;

        return html;
    }

    // Helper function to determine score class
    function getScoreClass(score) {
        if (score <= 3) return 'score-low';
        if (score <= 7) return 'score-medium';
        return 'score-high';
    }

    // Helper function to format the full feedback text
    function formatFullFeedback(text) {
        if (!text) return '';

        // Replace newlines with <br>
        text = text.replace(/\n/g, '<br>');

        // Make section titles bold
        text = text.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>');

        // Add spacing after numbered points
        text = text.replace(/(\d+\.\s+)/g, '<br>$1');

        return text;
    }
});
