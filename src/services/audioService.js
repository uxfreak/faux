/**
 * Audio recording and transcription service using Groq API
 */

class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
  }

  /**
   * Check if browser supports audio recording
   */
  isSupported() {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording() {
    if (!this.isSupported()) {
      throw new Error('Audio recording is not supported in this browser');
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder with webm format (browser native)
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];
      
      // Collect audio data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording: ' + error.message);
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Stop all tracks to release microphone
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        this.isRecording = false;
        this.audioChunks = [];
        
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      
      // Stop all tracks to release microphone
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      this.isRecording = false;
      this.audioChunks = [];
    }
  }

  /**
   * Transcribe audio using Groq API
   */
  async transcribeAudio(audioBlob) {
    if (!this.groqApiKey) {
      throw new Error('Groq API key not configured');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-large-v3-turbo'); // Faster model
    formData.append('response_format', 'json');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Transcription failed');
      }

      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio: ' + error.message);
    }
  }

  /**
   * Get recording status
   */
  getIsRecording() {
    return this.isRecording;
  }

  /**
   * Get duration of audio blob in seconds
   */
  async getAudioDuration(audioBlob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.src = URL.createObjectURL(audioBlob);
    });
  }
}

// Export singleton instance
export const audioService = new AudioService();