// Speech-to-Text Subtitles for WebRTC Video Chat

class SubtitleManager {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.subtitlesEnabled = false;
    this.translationEnabled = false;
    this.manuallyStoppedRecognition = false;
    this.restartTimeout = null; // For debouncing restarts
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.remoteStream = null;
    this.targetLanguage = 'es'; // Default target language (Spanish)
    this.localSubtitleEl = document.querySelector("#local-subtitles");
    this.remoteSubtitleEl = document.querySelector("#remote-subtitles");
    this.toggleButton = document.querySelector("#toggle-subtitles");
    this.translateButton = document.querySelector("#translate");
    this.languageSelect = document.querySelector("#language-select");

    this.initializeSpeechRecognition();
    this.setupEventListeners();
  }

  initializeSpeechRecognition() {
    // Check for browser support
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.warn("Speech recognition not supported in this browser");
      this.toggleButton.disabled = true;
      this.toggleButton.textContent = "Not Supported";
      return;
    }

    // Create recognition instance
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US"; // You can change this to other languages

    // Handle recognition results
    this.recognition.onresult = (event) => {
      console.log("🎤 Speech recognition event triggered");
      console.log("📝 Event details:", {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length,
        timeStamp: event.timeStamp,
      });

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        console.log(`📋 Result ${i}:`, {
          transcript: transcript,
          confidence: confidence,
          isFinal: result.isFinal,
          length: transcript.length,
        });

        if (result.isFinal) {
          finalTranscript += transcript;
          console.log("✅ Final transcript added:", transcript);
        } else {
          interimTranscript += transcript;
          console.log("⏳ Interim transcript added:", transcript);
        }
      }

      const combinedTranscript = finalTranscript + interimTranscript;
      console.log("🔀 Combined transcript:", combinedTranscript);

      // Display the transcript in local subtitles
      this.displayLocalSubtitle(combinedTranscript);

      // Send final transcript to other peers via socket
      if (finalTranscript && socket && socket.connected) {
        console.log("📤 Sending final transcript to server:", {
          text: finalTranscript,
          userName: userName,
          timestamp: Date.now(),
        });

        socket.emit("subtitleText", {
          text: finalTranscript,
          userName: userName,
          timestamp: Date.now(),
        });
      } else if (finalTranscript) {
        console.warn(
          "⚠️ Final transcript available but socket not connected:",
          finalTranscript
        );
      }
    };

    this.recognition.onerror = (event) => {
      // Handle specific error types with different log levels
      switch (event.error) {
        case "aborted":
          // This is usually normal - happens when recognition is stopped/restarted
          console.log(
            "ℹ️ Speech recognition aborted (normal during stop/restart)"
          );
          // Don't restart automatically for aborted errors to avoid loops
          this.isListening = false;
          // Don't show error for normal abort operations
          if (!this.manuallyStoppedRecognition) {
            this.startListening();
          }
          break;

        case "audio-capture":
          console.error(
            "❌ Audio capture failed - check microphone permissions"
          );
          console.error("🎤 Error details:", {
            error: event.error,
            message: event.message,
            timeStamp: event.timeStamp,
          });
          this.showErrorMessage("Microphone access denied or unavailable");
          break;

        case "network":
          console.error("❌ Network error during speech recognition");
          console.error("🌐 Error details:", {
            error: event.error,
            message: event.message,
            timeStamp: event.timeStamp,
          });
          this.showErrorMessage("Network error - check internet connection");
          break;

        case "not-allowed":
          console.error("❌ Microphone permission not granted");
          console.error("🚫 Error details:", {
            error: event.error,
            message: event.message,
            timeStamp: event.timeStamp,
          });
          this.showErrorMessage(
            "Please allow microphone access to use subtitles"
          );
          break;

        case "no-speech":
          console.log("🤫 No speech detected - continuing to listen");
          break;

        default:
          console.error("❌ Unexpected speech recognition error:", {
            error: event.error,
            message: event.message,
            timeStamp: event.timeStamp,
          });
          break;
      }
    };

    this.recognition.onend = () => {
      console.log("🛑 Speech recognition ended");
      this.isListening = false; // Reset listening state

      // Clear any existing restart timeout
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;
      }

      if (this.subtitlesEnabled && !this.manuallyStoppedRecognition) {
        console.log("🔄 Scheduling speech recognition restart...");
        // Add a delay to prevent rapid restart cycles that cause "aborted" errors
        this.restartTimeout = setTimeout(() => {
          if (this.subtitlesEnabled && !this.isListening) {
            console.log("🔄 Actually restarting speech recognition now...");
            this.startListening();
          }
          this.restartTimeout = null;
        }, 1000); // Increased delay to 1 second
      } else {
        console.log(
          "ℹ️ Not restarting - subtitles disabled or manually stopped"
        );
      }
    };

    this.recognition.onstart = () => {
      console.log("🎬 Speech recognition started successfully");
    };

    this.recognition.onspeechstart = () => {
      console.log("🗣️ Speech detected");
    };

    this.recognition.onspeechend = () => {
      console.log("🤐 Speech ended");
    };

    this.recognition.onsoundstart = () => {
      console.log("🔊 Sound detected");
    };

    this.recognition.onsoundend = () => {
      console.log("🔇 Sound ended");
    };
  }

  setupEventListeners() {
    this.toggleButton.addEventListener("click", () => {
      this.toggleSubtitles();
    });

    this.translateButton.addEventListener("click", () => {
      this.toggleTranslation();
    });

    this.languageSelect.addEventListener("change", (e) => {
      this.targetLanguage = e.target.value;
      console.log("🌍 Target language changed to:", this.targetLanguage);
    });
  }

  async translateText(text) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${this.targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data[0][0][0];
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  }

  toggleTranslation() {
    this.translationEnabled = !this.translationEnabled;
    if (this.translationEnabled) {
      this.translateButton.textContent = "Original";
      this.translateButton.classList.remove("btn-info");
      this.translateButton.classList.add("btn-success");
      this.languageSelect.disabled = false;
    } else {
      this.translateButton.textContent = "Translate";
      this.translateButton.classList.remove("btn-success");
      this.translateButton.classList.add("btn-info");
      this.languageSelect.disabled = true;
    }
  }

  toggleSubtitles() {
    this.subtitlesEnabled = !this.subtitlesEnabled;
    console.log("🔄 Toggling subtitles:", {
      enabled: this.subtitlesEnabled,
      previousState: !this.subtitlesEnabled,
    });

    if (this.subtitlesEnabled) {
      console.log("✅ Enabling subtitles...");
      this.startListening();
      this.toggleButton.textContent = "Stop Subtitles";
      this.toggleButton.classList.remove("btn-secondary");
      this.toggleButton.classList.add("btn-success");
      // Make sure subtitle containers are visible
      this.localSubtitleEl.style.display = "block";
      this.remoteSubtitleEl.style.display = "block";
      console.log("✅ Subtitles enabled successfully");
    } else {
      console.log("❌ Disabling subtitles...");
      this.stopListening();
      this.toggleButton.textContent = "Subtitles";
      this.toggleButton.classList.remove("btn-success");
      this.toggleButton.classList.add("btn-secondary");
      // Hide subtitle containers
      this.localSubtitleEl.style.display = "none";
      this.remoteSubtitleEl.style.display = "none";
      this.clearSubtitles();
      console.log("❌ Subtitles disabled successfully");
    }
  }

  startListening() {
    if (this.recognition && !this.isListening) {
      try {
        console.log("🎬 Attempting to start speech recognition...");
        this.manuallyStoppedRecognition = false;
        
        // If we have a remote stream, make sure we're using it
        if (this.remoteStream && this.mediaStreamSource) {
          this.recognition.mediaStream = this.audioContext.createMediaStreamDestination().stream;
        }
        
        this.recognition.start();
        this.isListening = true;
        console.log("✅ Speech recognition start command sent");
      } catch (error) {
        console.error("❌ Error starting speech recognition:", error);
        this.isListening = false;

        // If recognition is already running, this is normal
        if (error.name === "InvalidStateError") {
          console.log("ℹ️ Speech recognition already running");
        }
      }
    } else if (this.isListening) {
      console.log("ℹ️ Speech recognition already listening");
    } else {
      console.log("⚠️ Cannot start listening - recognition not available");
    }
  }

  stopListening() {
    console.log("🛑 Manually stopping speech recognition...");
    this.manuallyStoppedRecognition = true;

    // Clear any pending restart timeouts
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
      console.log("🗑️ Cleared pending restart timeout");
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log("✅ Speech recognition stop command sent");

      // Clean up audio context if it exists
      if (this.mediaStreamSource) {
        this.mediaStreamSource.disconnect();
      }
    } else if (!this.isListening) {
      console.log("ℹ️ Speech recognition already stopped");
    } else {
      console.log("⚠️ Cannot stop listening - recognition not available");
    }
  }

  async displayLocalSubtitle(text) {
    // For local subtitles, we'll just display them briefly to show that speech is being detected
    console.log("📺 Displaying local subtitle:", {
      text: text,
      length: text.length,
      element: this.localSubtitleEl ? "found" : "not found",
    });

    if (this.localSubtitleEl) {
      this.localSubtitleEl.textContent = "Speaking...";
      this.autoHideSubtitle(this.localSubtitleEl);
    }
  }

  async displayRemoteSubtitle(text, userName) {
    // For remote subtitles, we'll show the actual transcribed text
    console.log("📺 Displaying remote subtitle:", {
      userName: userName,
      text: text,
      length: text.length,
      element: this.remoteSubtitleEl ? "found" : "not found",
    });

    if (this.remoteSubtitleEl) {
      if (this.translationEnabled) {
        const translatedText = await this.translateText(text);
        this.remoteSubtitleEl.textContent = translatedText;
      } else {
        this.remoteSubtitleEl.textContent = text;
      }
      this.autoHideSubtitle(this.remoteSubtitleEl);
    }
  }

  autoHideSubtitle(element) {
    console.log("⏰ Setting auto-hide timer for subtitle");

    // Clear any existing timeout
    if (element.hideTimeout) {
      clearTimeout(element.hideTimeout);
      console.log("🗑️ Cleared existing hide timeout");
    }

    // Make sure the subtitle is visible if it has content
    if (element.textContent.trim() !== "") {
      element.style.display = "block";
    }

    // Set new timeout to hide subtitle after 3 seconds
    element.hideTimeout = setTimeout(() => {
      if (element.textContent.trim() !== "") {
        console.log("🫥 Auto-hiding subtitle:", element.textContent);
        element.textContent = "";
        // Only hide if subtitles are disabled
        if (!this.subtitlesEnabled) {
          element.style.display = "none";
        }
      }
    }, 3000);
  }

  clearSubtitles() {
    console.log("🧹 Clearing all subtitles");
    this.localSubtitleEl.textContent = "";
    this.remoteSubtitleEl.textContent = "";
  }

  // Method to show error messages to the user
  showErrorMessage(message) {
    console.log("🚨 Showing error message:", message);

    // You can customize this to show errors in the UI
    if (this.toggleButton) {
      // Only change the button if subtitles are enabled
      if (this.subtitlesEnabled) {
        this.toggleButton.textContent = "Error - Click to retry";
        this.toggleButton.classList.remove("btn-success", "btn-secondary");
        this.toggleButton.classList.add("btn-danger");
      }

      // Show a tooltip with the error message
      this.toggleButton.title = message;

      // If it's a temporary error, try to recover after 5 seconds
      if (message.includes("network")) {
        setTimeout(() => {
          if (this.subtitlesEnabled) {
            console.log("🔄 Attempting to recover from error...");
            this.startListening();
          }
        }, 5000);
      }
    }

    // Optional: Show browser alert for critical errors
    // alert(`Subtitle Error: ${message}`);
  }

  // Method to handle incoming subtitle data from other peers
  handleRemoteSubtitle(data) {
    console.log("📥 Received remote subtitle data:", {
      text: data.text,
      userName: data.userName,
      timestamp: data.timestamp,
      subtitlesEnabled: this.subtitlesEnabled,
    });

    if (this.subtitlesEnabled) {
      this.displayRemoteSubtitle(data.text, data.userName);
    } else {
      console.log("⚠️ Subtitles disabled, not displaying remote subtitle");
    }
  }

  // Method to setup remote audio stream for speech recognition
  setupRemoteAudioRecognition(stream) {
    // Store the remote stream
    this.remoteStream = stream;

    // If we already have a recognition session running, stop it
    if (this.recognition && this.isListening) {
      this.stopListening();
    }

    // Initialize audio context if needed
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create a source node from the remote stream
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

    // Create a MediaStreamDestination to get a MediaStream we can use with speech recognition
    const destination = this.audioContext.createMediaStreamDestination();
    this.mediaStreamSource.connect(destination);

    // Configure recognition to use the remote audio
    if (this.recognition) {
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      
      // Override the default audio source
      this.recognition.mediaStream = destination.stream;

      // Start recognition if subtitles are enabled
      if (this.subtitlesEnabled && !this.isListening) {
        this.startListening();
      }
    }
  }
}

// Initialize subtitle manager when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Make it globally accessible
  window.subtitleManager = new SubtitleManager();
});
