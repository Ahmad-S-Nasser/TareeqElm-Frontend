import { useState, useCallback, useRef } from 'react';
import i18n from '@/i18n';
import { useToast } from './use-toast';

// Minimal Web Speech API typings (not yet part of lib.dom).
interface SpeechRecognitionAlternativeLike {
    transcript: string;
}
interface SpeechRecognitionResultLike {
    length: number;
    [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
    results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
    error: string;
}
interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export const useVoiceRecognition = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const transcriptRef = useRef('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const { toast } = useToast();

    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopListening = useCallback(() => {
        console.log("Stopping voice recognition...");
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.error("Error stopping recognition:", e);
            }
            recognitionRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        setIsListening(false);
        setVolume(0);
    }, []);

    const startListening = useCallback((onResult?: (text: string) => void) => {
        const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            toast({
                title: i18n.t('dashboard:voice.notSupportedTitle'),
                description: i18n.t('dashboard:voice.notSupported'),
                variant: "destructive"
            });
            return;
        }

        setError(null);
        stopListening();

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        // Follow the active UI language.
        recognition.lang = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';

        const resetSilenceTimer = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                console.log("Silence timeout reached");
                recognition.stop();
            }, 3000);
        };

        recognition.onstart = () => {
            console.log("Voice recognition onstart");
            setIsListening(true);
            setTranscript('');
            transcriptRef.current = '';
            resetSilenceTimer();
        };

        // Separate volume analysis to not block recognition start
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const audioContext = new AudioContext();
                const analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 256;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const updateVolume = () => {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const average = sum / dataArray.length;
                    setVolume(average);
                    if (average > 10) resetSilenceTimer(); // Lowered threshold for speech detection
                    animationFrameRef.current = requestAnimationFrame(updateVolume);
                };
                audioContextRef.current = audioContext;
                updateVolume();
            })
            .catch(err => {
                console.warn("Visual volume pulse disabled (Microphone likely used by Speech Engine only)", err);
            });

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            resetSilenceTimer();
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }
            if (fullTranscript) {
                setTranscript(fullTranscript);
                transcriptRef.current = fullTranscript;
                console.log("Transcript updated:", fullTranscript);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            console.error("Speech Recognition Error Event:", event.error, event);
            setError(event.error);
            setIsListening(false);

            let description = i18n.t('dashboard:voice.errors.generic');
            if (event.error === 'not-allowed') description = i18n.t('dashboard:voice.errors.notAllowed');
            else if (event.error === 'no-speech') description = i18n.t('dashboard:voice.errors.noSpeech');
            else if (event.error === 'network') description = i18n.t('dashboard:voice.errors.network');
            else if (event.error === 'aborted') description = i18n.t('dashboard:voice.errors.aborted');

            toast({
                title: i18n.t('dashboard:voice.errorTitle'),
                description: description,
                variant: "destructive"
            });
            stopListening();
        };

        recognition.onend = () => {
            console.log("Voice recognition onend");
            const final = transcriptRef.current.trim();
            if (final && onResult) {
                console.log("Executing onResult callback with:", final);
                onResult(final);
            }
            stopListening();
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Critical error starting recognition:", e);
            stopListening();
        }
    }, [toast, stopListening]);

    return {
        isListening,
        transcript,
        volume,
        error,
        startListening,
        stopListening,
        setTranscript
    };
};
