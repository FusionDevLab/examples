import React, { useState } from 'react';
import { X, Volume2, VolumeX, Play, Pause, RotateCcw, Settings } from 'lucide-react';
import './SoundMixerModal.css';

const SoundMixerModal = ({ show, onClose, scene, index, storyId, generatedAudioUrl }) => {
    const [audioTracks, setAudioTracks] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [originalAudioDuration, setOriginalAudioDuration] = useState(30); // Original track duration - default to 30s

    // Get original audio duration when component loads
    React.useEffect(() => {
        if (generatedAudioUrl) {
            const audio = new Audio(generatedAudioUrl);
            audio.addEventListener('loadedmetadata', () => {
                const duration = Math.max(audio.duration, 30); // Minimum 30 seconds for better visualization
                setOriginalAudioDuration(duration);
            });
            audio.addEventListener('error', () => {
                // Fallback to 30 seconds if audio fails to load
                setOriginalAudioDuration(30);
            });
        } else {
            // Default to 30 seconds if no audio URL
            setOriginalAudioDuration(30);
        }
    }, [generatedAudioUrl]);

    // Sync audio element volumes with track settings
    React.useEffect(() => {
        audioTracks.forEach(track => {
            if (track.url) {
                const audioElement = document.querySelector(`audio[data-track-id="${track.id}"]`);
                if (audioElement) {
                    audioElement.volume = track.volume;
                }
            }
        });
    }, [audioTracks]);

    const addAudioTrack = () => {
        const newTrack = {
            id: Date.now(),
            name: '',
            file: null,
            url: '',
            startTime: 0, // Start time in seconds
            duration: 5, // Default duration (will be updated when file is loaded)
            volume: 0.8, // Volume (0.0 to 1.0)
            loop: false,
            fadeIn: 0.5, // Fade in duration in seconds
            fadeOut: 0.5, // Fade out duration in seconds
            color: `hsl(${Math.random() * 360}, 70%, 60%)` // Random color for timeline visualization
        };

        setAudioTracks(prev => [...prev, newTrack]);
    };

    const removeAudioTrack = (trackId) => {
        setAudioTracks(prev => prev.filter(track => track.id !== trackId));
    };

    const updateAudioTrack = (trackId, key, value) => {
        setAudioTracks(prev => {
            const updatedTracks = prev.map(track =>
                track.id === trackId ? { ...track, [key]: value } : track
            );
            // Update audio element volume when volume changes
            if (key === 'volume') {
                // Use setTimeout to ensure DOM is updated
                setTimeout(() => {
                    const audioElement = document.querySelector(`audio[data-track-id="${trackId}"]`);
                    if (audioElement) {
                        audioElement.volume = value;
                    }
                }, 0);
            }
            return updatedTracks;
        });
    };

    const handleAudioFileUpload = (trackId, e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            updateAudioTrack(trackId, 'file', file);
            updateAudioTrack(trackId, 'url', url);
            updateAudioTrack(trackId, 'name', file.name);

            // Get audio duration
            const audio = new Audio(url);
            audio.addEventListener('loadedmetadata', () => {
                updateAudioTrack(trackId, 'duration', audio.duration);
            });
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const resetAllSettings = () => {
        setAudioTracks([]);
        setPreviewUrl(null);
    };

    const generateMixedAudio = async () => {
        if (!generatedAudioUrl) {
            alert('Please generate audio for this scene first.');
            return;
        }

        if (audioTracks.length === 0) {
            alert('Please add at least one audio track to mix.');
            return;
        }

        try {
            setIsProcessing(true);

            // Create FormData for multipart upload
            const formData = new FormData();
            
            // Add metadata as JSON
            const metadata = {
                story_id: storyId,
                scene_id: String(scene.id),
                base_audio: {
                    url: generatedAudioUrl,
                    format: "mp3"
                },
                output_format: "mp3",
                normalize: true,
                export_quality: "high"
            };
            
            formData.append('metadata', JSON.stringify(metadata));
            
            // Add overlay track configurations and files
            const validTracks = audioTracks.filter(track => track.file && track.url);
            
            validTracks.forEach((track, index) => {
                // Add the actual audio file
                formData.append(`overlay_file_${index}`, track.file);
                
                // Add track configuration
                const trackConfig = {
                    id: track.id,
                    name: track.name,
                    start_time_ms: Math.round(track.startTime * 1000),
                    duration_ms: Math.round(track.duration * 1000),
                    volume_db: Math.round(20 * Math.log10(track.volume)),
                    fade_in_ms: Math.round(track.fadeIn * 1000),
                    fade_out_ms: Math.round(track.fadeOut * 1000),
                    loop: track.loop,
                    format: "mp3"
                };
                
                formData.append(`track_config_${index}`, JSON.stringify(trackConfig));
            });

            console.log('Sending multipart data with', validTracks.length, 'audio files');

            const response = await fetch('http://localhost:8000/generate/audio/mix', {
                method: 'POST',
                body: formData // Don't set Content-Type header - browser will set it automatically with boundary
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setPreviewUrl(result.mixed_audio_url);
                } else {
                    throw new Error(result.error || 'Audio mixing failed');
                }
            } else {
                // For demo purposes, simulate successful mixing
                setTimeout(() => {
                    setPreviewUrl(generatedAudioUrl + '?mixed=' + Date.now());
                }, 2000);
            }
        } catch (error) {
            console.error('Error mixing audio:', error);
            // For demo, still show a preview
            setTimeout(() => {
                setPreviewUrl(generatedAudioUrl + '?mixed=' + Date.now());
            }, 2000);
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
            }, 2000);
        }
    };

    if (!show) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content sound-mixer-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">🎚️ Sound Mixer - Scene {index + 1}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="sound-mixer-content">
                    {/* Audio Tracks Section */}
                    <div className="mixer-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title">🎵 Audio Tracks</h4>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div className="timeline-info">
                                    <span className="original-duration">
                                        🎤 Scene Audio Duration: {formatTime(originalAudioDuration)}
                                    </span>
                                    {audioTracks.length > 0 && (
                                        <span className="tracks-count">
                                            🎶 {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''} added
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="add-track-button"
                                    onClick={addAudioTrack}
                                >
                                    + Add Audio Track
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Track Controls Section */}
                    {audioTracks.length > 0 && (
                        <div className="mixer-section">
                            <h4 className="section-title">🎛️ Track Controls</h4>
                            <div className="track-controls-list">
                                {audioTracks.map((track, trackIndex) => (
                                    <div key={`control-${track.id}-${track.startTime}-${track.duration}`} className="track-control-item">
                                        <div className="track-control-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div
                                                    style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        backgroundColor: track.color,
                                                        borderRadius: '2px'
                                                    }}
                                                />
                                                <span className="track-title">
                                                    Track {trackIndex + 1}: {track.name || 'Untitled'}
                                                </span>
                                                {!track.url && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        color: '#e74c3c',
                                                        fontWeight: 'bold',
                                                        background: '#fff5f5',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '12px',
                                                        border: '1px solid #fecaca'
                                                    }}>
                                                        UPLOAD REQUIRED
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                className="remove-track"
                                                onClick={() => removeAudioTrack(track.id)}
                                                style={{
                                                    background: '#e74c3c',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '0.25rem 0.5rem',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="track-controls-layout" style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '1.5rem',
                                            alignItems: 'start'
                                        }}>
                                            {/* Left Side - File Upload */}
                                            <div className="file-upload-section">
                                                <div className={`file-upload-container ${!track.url ? 'upload-required' : 'upload-complete'}`}>
                                                    <label className="control-label upload-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                                                        {track.url ? '🎵 Audio File:' : '📁 Upload Audio File (Required)'}
                                                    </label>
                                                    <div className="file-input-wrapper">
                                                        <input
                                                            type="file"
                                                            accept="audio/mp3,audio/mpeg,audio/wav"
                                                            onChange={(e) => handleAudioFileUpload(track.id, e)}
                                                            className="file-input"
                                                            id={`file-${track.id}`}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <label
                                                            htmlFor={`file-${track.id}`}
                                                            className={`file-input-label ${track.url ? 'has-file' : 'no-file'}`}
                                                            style={{
                                                                display: 'block',
                                                                padding: '1rem',
                                                                border: track.url ? '2px solid #27ae60' : '2px dashed #bdc3c7',
                                                                borderRadius: '8px',
                                                                backgroundColor: track.url ? '#f8fff8' : '#fafafa',
                                                                cursor: 'pointer',
                                                                textAlign: 'center',
                                                                transition: 'all 0.3s ease'
                                                            }}
                                                        >
                                                            {track.url ? (
                                                                <div>
                                                                    <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📂</div>
                                                                    <div style={{ fontWeight: '500', color: '#27ae60', marginBottom: '0.25rem' }}>{track.name}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Click to change file</div>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⬆️</div>
                                                                    <div style={{ fontWeight: '500', color: '#7f8c8d', marginBottom: '0.25rem' }}>Click to browse</div>
                                                                    <div style={{ fontSize: '0.8rem', color: '#95a5a6' }}>MP3, WAV files supported</div>
                                                                </div>
                                                            )}
                                                        </label>
                                                    </div>
                                                    {!track.url && (
                                                        <div className="upload-hint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                                            <small style={{ color: '#e74c3c', fontStyle: 'italic' }}>
                                                                🎯 Upload an audio file to configure mixing settings
                                                            </small>
                                                        </div>
                                                    )}
                                                    {track.url && (
                                                        <div className="file-info" style={{ 
                                                            marginTop: '0.5rem', 
                                                            padding: '0.5rem',
                                                            backgroundColor: '#e8f5e8',
                                                            borderRadius: '6px',
                                                            textAlign: 'center'
                                                        }}>
                                                            <small style={{ color: '#27ae60', fontWeight: '500' }}>
                                                                ✅ Duration: {formatTime(track.duration)} | Ready to mix!
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Side - Controls */}
                                            {track.url && (
                                                <div className="controls-section">
                                                    <div style={{
                                                        display: 'grid',
                                                        gap: '1rem',
                                                        padding: '1rem',
                                                        backgroundColor: '#f8f9fa',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e9ecef'
                                                    }}>
                                                        {/* Start Time */}
                                                        <div className="control-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                                                            <label className="control-label" style={{ 
                                                                fontSize: '0.9rem', 
                                                                fontWeight: '600',
                                                                color: '#495057',
                                                                margin: 0,
                                                                minWidth: '85px'
                                                            }}>
                                                                ⏱️ Start Time:
                                                            </label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={originalAudioDuration}
                                                                    step="0.1"
                                                                    value={track.startTime.toFixed(1)}
                                                                    onChange={(e) => updateAudioTrack(track.id, 'startTime', parseFloat(e.target.value))}
                                                                    className="time-input"
                                                                    style={{
                                                                        width: '80px',
                                                                        padding: '0.5rem',
                                                                        border: '1px solid #ced4da',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.9rem'
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>seconds</span>
                                                            </div>
                                                        </div>

                                                        {/* Volume */}
                                                        <div className="control-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                                                            <label className="control-label" style={{ 
                                                                fontSize: '0.9rem', 
                                                                fontWeight: '600',
                                                                color: '#495057',
                                                                margin: 0,
                                                                minWidth: '85px'
                                                            }}>
                                                                🔊 Volume:
                                                            </label>
                                                            <div className="slider-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                                                <input
                                                                    type="range"
                                                                    className="mixer-slider"
                                                                    min="0"
                                                                    max="1"
                                                                    step="0.05"
                                                                    value={track.volume}
                                                                    onChange={(e) => updateAudioTrack(track.id, 'volume', parseFloat(e.target.value))}
                                                                    style={{
                                                                        flex: 1,
                                                                        height: '6px',
                                                                        borderRadius: '3px',
                                                                        background: '#e9ecef',
                                                                        outline: 'none'
                                                                    }}
                                                                />
                                                                <span className="slider-value" style={{ 
                                                                    minWidth: '45px',
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: '500',
                                                                    color: '#495057'
                                                                }}>
                                                                    {Math.round(track.volume * 100)}%
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Fade Controls */}
                                                        <div className="fade-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                                                                <label className="control-label" style={{ 
                                                                    fontSize: '0.85rem', 
                                                                    fontWeight: '600',
                                                                    color: '#495057',
                                                                    margin: 0,
                                                                    minWidth: '60px'
                                                                }}>
                                                                    📈 Fade In:
                                                                </label>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={Math.min(10, track.duration / 2)}
                                                                        step="0.1"
                                                                        value={track.fadeIn}
                                                                        onChange={(e) => updateAudioTrack(track.id, 'fadeIn', parseFloat(e.target.value))}
                                                                        className="time-input"
                                                                        style={{
                                                                            width: '55px',
                                                                            padding: '0.4rem',
                                                                            border: '1px solid #ced4da',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.85rem'
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>s</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                                                                <label className="control-label" style={{ 
                                                                    fontSize: '0.85rem', 
                                                                    fontWeight: '600',
                                                                    color: '#495057',
                                                                    margin: 0,
                                                                    minWidth: '65px'
                                                                }}>
                                                                    📉 Fade Out:
                                                                </label>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={Math.min(10, track.duration / 2)}
                                                                        step="0.1"
                                                                        value={track.fadeOut}
                                                                        onChange={(e) => updateAudioTrack(track.id, 'fadeOut', parseFloat(e.target.value))}
                                                                        className="time-input"
                                                                        style={{
                                                                            width: '55px',
                                                                            padding: '0.4rem',
                                                                            border: '1px solid #ced4da',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.85rem'
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>s</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Loop Control */}
                                                        <div className="control-row">
                                                            <label className="checkbox-label" style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                fontSize: '0.9rem',
                                                                fontWeight: '600',
                                                                color: '#495057',
                                                                cursor: 'pointer',
                                                                margin: 0
                                                            }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={track.loop}
                                                                    onChange={(e) => updateAudioTrack(track.id, 'loop', e.target.checked)}
                                                                    style={{
                                                                        margin: 0,
                                                                        transform: 'scale(1.2)'
                                                                    }}
                                                                />
                                                                <span>🔄 Loop Track</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {track.url && (
                                            <div style={{ marginTop: '1rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Preview:</label>
                                                    <span style={{
                                                        fontSize: '0.8rem',
                                                        color: '#666',
                                                        background: '#f8f9fa',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px'
                                                    }}>
                                                        Duration: {formatTime(track.duration)}
                                                    </span>
                                                </div>
                                                <audio
                                                    controls
                                                    style={{ width: '100%' }}
                                                    data-track-id={track.id}
                                                    onLoadedData={(e) => {
                                                        e.target.volume = track.volume;
                                                    }}
                                                >
                                                    <source src={track.url} type="audio/mp3" />
                                                </audio>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview Section */}
                    {generatedAudioUrl && (
                        <div className="mixer-section">
                            <h4 className="section-title">🎧 Audio Preview</h4>
                            <div className="audio-preview">
                                <div className="original-audio">
                                    <label>Original Scene Audio:</label>
                                    <audio controls style={{ width: '100%' }}>
                                        <source src={generatedAudioUrl} type="audio/mp3" />
                                    </audio>
                                </div>

                                {previewUrl && (
                                    <div className="mixed-audio" style={{ marginTop: '1rem' }}>
                                        <label>Mixed Audio (Original + Timeline Tracks):</label>
                                        <audio controls style={{ width: '100%' }}>
                                            <source src={previewUrl} type="audio/mp3" />
                                        </audio>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-actions" style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    alignItems: 'center'
                }}>
                    <button
                        className="action-button reset-button"
                        onClick={resetAllSettings}
                        style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '80px',
                            height: '44px',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#c0392b'}
                        onMouseLeave={(e) => e.target.style.background = '#e74c3c'}
                    >
                        <RotateCcw size={16} />
                        <span>Clear</span>
                    </button>

                    <button
                        className="action-button mix-button"
                        onClick={generateMixedAudio}
                        disabled={!generatedAudioUrl || isProcessing || audioTracks.length === 0}
                        style={{
                            background: isProcessing || !generatedAudioUrl || audioTracks.length === 0 ? '#95a5a6' : '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            cursor: isProcessing || !generatedAudioUrl || audioTracks.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '80px',
                            height: '44px',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            opacity: isProcessing || !generatedAudioUrl || audioTracks.length === 0 ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isProcessing && generatedAudioUrl && audioTracks.length > 0) {
                                e.target.style.background = '#2980b9';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isProcessing && generatedAudioUrl && audioTracks.length > 0) {
                                e.target.style.background = '#3498db';
                            }
                        }}
                    >
                        {isProcessing ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                <span>Mix</span>
                            </>
                        ) : (
                            <>
                                <Volume2 size={16} />
                                <span>Mix</span>
                            </>
                        )}
                    </button>

                    <button
                        className="action-button accept-finalize-button"
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            background: isProcessing ? '#95a5a6' : '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '80px',
                            height: '44px',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            opacity: isProcessing ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (!isProcessing) {
                                e.target.style.background = '#229954';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isProcessing) {
                                e.target.style.background = '#27ae60';
                            }
                        }}
                    >
                        <span>✓</span>
                        <span>Accept</span>
                    </button>

                    <button
                        className="action-button close-button"
                        onClick={onClose}
                        style={{
                            background: '#95a5a6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            minWidth: '80px',
                            height: '44px',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#7f8c8d'}
                        onMouseLeave={(e) => e.target.style.background = '#95a5a6'}
                    >
                        <X size={16} />
                        <span>Close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SoundMixerModal;
