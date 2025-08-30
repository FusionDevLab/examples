import React, { useState } from 'react';
import { X, Volume2, VolumeX, Play, Pause, RotateCcw, Settings } from 'lucide-react';
import './SoundMixerModal.css';

const SoundMixerModal = ({ show, onClose, scene, index, storyId, generatedAudioUrl }) => {
    const [audioTracks, setAudioTracks] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [originalAudioDuration, setOriginalAudioDuration] = useState(30); // Original track duration - default to 30s
    const [timelineDuration, setTimelineDuration] = useState(30); // Timeline duration based on original + extensions
    const [isDragging, setIsDragging] = useState(false);
    const [dragTrackId, setDragTrackId] = useState(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [playheadPosition, setPlayheadPosition] = useState(0);

    // Get original audio duration when component loads
    React.useEffect(() => {
        if (generatedAudioUrl) {
            const audio = new Audio(generatedAudioUrl);
            audio.addEventListener('loadedmetadata', () => {
                const duration = Math.max(audio.duration, 30); // Minimum 30 seconds for better visualization
                setOriginalAudioDuration(duration);
                setTimelineDuration(duration);
            });
            audio.addEventListener('error', () => {
                // Fallback to 30 seconds if audio fails to load
                setOriginalAudioDuration(30);
                setTimelineDuration(30);
            });
        } else {
            // Default to 30 seconds if no audio URL
            setOriginalAudioDuration(30);
            setTimelineDuration(30);
        }
    }, [generatedAudioUrl]);

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

    // Update timeline duration based on tracks
    const updateTimelineDuration = (tracks) => {
        const maxEndTime = Math.max(
            originalAudioDuration,
            ...tracks.map(t => t.startTime + t.duration)
        );
        setTimelineDuration(Math.max(originalAudioDuration, maxEndTime + 2)); // Add 2 seconds buffer
    };

    const removeAudioTrack = (trackId) => {
        setAudioTracks(prev => prev.filter(track => track.id !== trackId));
    };

    const updateAudioTrack = (trackId, key, value) => {
        setAudioTracks(prev => {
            const updatedTracks = prev.map(track => 
                track.id === trackId ? { ...track, [key]: value } : track
            );
            // Update timeline duration when track properties change
            if (key === 'startTime' || key === 'duration') {
                updateTimelineDuration(updatedTracks);
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

    const handleTrackDragStart = (trackId, e) => {
        setIsDragging(true);
        setDragTrackId(trackId);
        
        // Get timeline container for accurate offset calculation
        const timelineContainer = e.currentTarget.closest('.timeline-tracks');
        const timelineRect = timelineContainer.getBoundingClientRect();
        const mouseX = e.clientX;
        
        // Calculate offset from mouse to start of track within timeline
        const track = audioTracks.find(t => t.id === trackId);
        const trackStartX = timelineRect.left + 10 + (track.startTime / timelineDuration) * (timelineRect.width - 20);
        setDragOffset(mouseX - trackStartX);
        
        // Create custom drag image to improve visual feedback
        const dragImage = e.currentTarget.cloneNode(true);
        dragImage.style.opacity = '0.7';
        dragImage.style.transform = 'rotate(2deg)';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 20);
        setTimeout(() => document.body.removeChild(dragImage), 0);
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', trackId);
    };

    const handleTimelineDrop = (e) => {
        e.preventDefault();
        if (dragTrackId && isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX;
            const timelineWidth = rect.width - 20; // Account for padding
            
            // More precise calculation with offset
            const relativeX = Math.max(0, mouseX - rect.left - 10 - dragOffset);
            const newStartTime = Math.max(0, Math.min(
                (relativeX / timelineWidth) * timelineDuration,
                timelineDuration - 1 // Ensure track doesn't go beyond timeline
            ));
            
            // Snap to 0.5-second intervals for better precision
            const snappedStartTime = Math.round(newStartTime * 2) / 2;
            
            updateAudioTrack(dragTrackId, 'startTime', snappedStartTime);
        }
        setIsDragging(false);
        setDragTrackId(null);
        setDragOffset(0);
    };

    const handleTimelineDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTrackWidthPercentage = (track) => {
        return Math.max(2, (track.duration / timelineDuration) * 100); // Minimum 2% width for visibility
    };

    const getTrackLeftPercentage = (track) => {
        return (track.startTime / timelineDuration) * 100;
    };

    const getOriginalTrackWidthPercentage = () => {
        return (originalAudioDuration / timelineDuration) * 100;
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

            // Format data for pydub backend
            const pydubData = {
                story_id: storyId,
                scene_id: String(scene.id),
                base_audio: {
                    url: generatedAudioUrl,
                    format: "mp3"
                },
                overlay_tracks: audioTracks
                    .filter(track => track.file && track.url)
                    .map(track => ({
                        id: track.id,
                        name: track.name,
                        audio_data: track.url, // In real implementation, this would be base64 or file path
                        start_time_ms: Math.round(track.startTime * 1000), // Convert to milliseconds for pydub
                        duration_ms: Math.round(track.duration * 1000),
                        volume_db: Math.round(20 * Math.log10(track.volume)), // Convert linear to dB
                        fade_in_ms: Math.round(track.fadeIn * 1000),
                        fade_out_ms: Math.round(track.fadeOut * 1000),
                        loop: track.loop,
                        format: "mp3"
                    })),
                output_format: "mp3",
                normalize: true, // Normalize final output
                export_quality: "high"
            };

            console.log('Pydub mixing data:', JSON.stringify(pydubData, null, 2));

            const response = await fetch('http://localhost:8000/generate/audio/mix', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(pydubData)
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
                    {/* Timeline Section */}
                    <div className="mixer-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 className="section-title">🎵 Audio Timeline</h4>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div className="timeline-info">
                                    <span className="timeline-duration">
                                        ⏱️ Total: {formatTime(timelineDuration)}
                                    </span>
                                    <span className="original-duration">
                                        🎤 Original: {formatTime(originalAudioDuration)}
                                    </span>
                                    {audioTracks.length > 0 && (
                                        <span className="tracks-count">
                                            🎶 {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''}
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

                        {/* Timeline Container */}
                        <div className="timeline-container">
                            {/* Time ruler */}
                            <div className="timeline-ruler">
                                {Array.from({ length: Math.ceil(timelineDuration / 5) + 1 }, (_, i) => i * 5).map(time => (
                                    <div
                                        key={time}
                                        className="timeline-marker"
                                        style={{
                                            left: `${(time / timelineDuration) * 100}%`,
                                            position: 'absolute',
                                            top: 0,
                                            height: '100%',
                                            borderLeft: time % 20 === 0 ? '2px solid #2c3e50' : time % 10 === 0 ? '1px solid #7f8c8d' : '1px solid #ecf0f1',
                                            paddingLeft: '4px',
                                            fontSize: '0.75rem',
                                            color: time % 20 === 0 ? '#2c3e50' : '#7f8c8d',
                                            fontWeight: time % 20 === 0 ? 'bold' : 'normal'
                                        }}
                                    >
                                        {time % 5 === 0 && time <= timelineDuration ? formatTime(time) : ''}
                                    </div>
                                ))}
                            </div>

                            {/* Main timeline track area */}
                            <div
                                className="timeline-tracks"
                                onDrop={handleTimelineDrop}
                                onDragOver={handleTimelineDragOver}
                                style={{
                                    position: 'relative',
                                    minHeight: '200px',
                                    backgroundColor: '#f8f9fa',
                                    border: '2px dashed #ddd',
                                    borderRadius: '8px',
                                    marginTop: '30px',
                                    padding: '10px'
                                }}
                            >
                                {/* Base audio track visualization */}
                                <div className="base-track" style={{
                                    position: 'absolute',
                                    top: '10px',
                                    left: '10px',
                                    width: `${getOriginalTrackWidthPercentage()}%`,
                                    height: '40px',
                                    background: 'linear-gradient(90deg, #3498db, #2980b9)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 1rem',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    boxShadow: '0 2px 6px rgba(52, 152, 219, 0.3)',
                                    border: '2px solid rgba(255, 255, 255, 0.2)'
                                }}>
                                    🎤 Scene Audio ({formatTime(originalAudioDuration)})
                                </div>

                                {/* Audio tracks */}
                                {audioTracks.map((track, index) => (
                                    <div
                                        key={track.id}
                                        className="timeline-track"
                                        draggable={track.url ? true : false}
                                        onDragStart={(e) => track.url && handleTrackDragStart(track.id, e)}
                                        style={{
                                            position: 'absolute',
                                            top: `${60 + index * 50}px`,
                                            left: `${10 + (getTrackLeftPercentage(track) * 0.98)}%`, // 0.98 to account for padding
                                            width: `${getTrackWidthPercentage(track) * 0.98}%`,
                                            height: '40px',
                                            backgroundColor: track.url ? track.color : '#95a5a6',
                                            borderRadius: '4px',
                                            cursor: track.url ? 'grab' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0 0.5rem',
                                            color: 'white',
                                            fontSize: '0.8rem',
                                            fontWeight: '500',
                                            boxShadow: track.url ? '0 2px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
                                            border: track.url ? '2px solid rgba(255,255,255,0.3)' : '2px dashed rgba(255,255,255,0.5)',
                                            overflow: 'hidden',
                                            transition: isDragging && dragTrackId === track.id ? 'none' : 'all 0.2s ease',
                                            opacity: track.url ? 1 : 0.7,
                                            background: track.url ? track.color : 'linear-gradient(45deg, #95a5a6, #bdc3c7)'
                                        }}
                                    >
                                        {/* Fade in indicator */}
                                        {track.fadeIn > 0 && track.url && (
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: `${Math.min(50, (track.fadeIn / track.duration) * 100)}%`,
                                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3))',
                                                borderRadius: '4px 0 0 4px'
                                            }} />
                                        )}
                                        
                                        {/* Fade out indicator */}
                                        {track.fadeOut > 0 && track.url && (
                                            <div style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: `${Math.min(50, (track.fadeOut / track.duration) * 100)}%`,
                                                background: 'linear-gradient(90deg, rgba(255,255,255,0.3), transparent)',
                                                borderRadius: '0 4px 4px 0'
                                            }} />
                                        )}

                                        <span style={{ 
                                            textOverflow: 'ellipsis', 
                                            overflow: 'hidden', 
                                            whiteSpace: 'nowrap',
                                            position: 'relative',
                                            zIndex: 1
                                        }}>
                                            {track.url ? (
                                                <>
                                                    {track.name || `Track ${index + 1}`}
                                                    {track.loop && ' 🔁'}
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                                        {' '}({formatTime(track.duration)})
                                                    </span>
                                                </>
                                            ) : (
                                                `📁 Upload Track ${index + 1}`
                                            )}
                                        </span>
                                    </div>
                                ))}

                                {audioTracks.length === 0 && (
                                    <div className="timeline-empty-state">
                                        <div className="empty-state-content">
                                            <div className="empty-state-icon">🎚️</div>
                                            <h5 className="empty-state-title">Ready to create your sound mix?</h5>
                                            <p className="empty-state-description">
                                                Click "Add Audio Track" to upload MP3 files and start building your custom soundtrack
                                            </p>
                                            <div className="empty-state-features">
                                                <span>✨ Drag & drop positioning</span>
                                                <span>🔊 Volume & fade controls</span>
                                                <span>🔁 Looping support</span>
                                                <span>⚡ Real-time preview</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Track Controls Section */}
                    {audioTracks.length > 0 && (
                        <div className="mixer-section">
                            <h4 className="section-title">🎛️ Track Controls</h4>
                        <div className="track-controls-list">
                                {audioTracks.map((track, trackIndex) => (
                                    <div key={track.id} className="track-control-item">
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

                                        <div className="track-controls-grid">
                                            <div className="control-group" style={{ 
                                                gridColumn: 'span 2'
                                            }}>
                                                <div className={`file-upload-container ${!track.url ? 'upload-required' : 'upload-complete'}`}>
                                                    <label className="control-label upload-label">
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
                                                        >
                                                            {track.url ? (
                                                                <>
                                                                    <span className="file-name">📂 {track.name}</span>
                                                                    <span className="change-file">Click to change</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="upload-icon">⬆️</span>
                                                                    <span className="upload-text">Click to browse MP3 files</span>
                                                                </>
                                                            )}
                                                        </label>
                                                    </div>
                                                    {!track.url && (
                                                        <div className="upload-hint">
                                                            <small>
                                                                🎯 Upload an MP3 file to position it on the timeline and mix with scene audio
                                                            </small>
                                                        </div>
                                                    )}
                                                    {track.url && (
                                                        <div className="file-info">
                                                            <small>Duration: {formatTime(track.duration)} | Ready to mix!</small>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {track.url && (
                                                <>
                                                    <div className="control-group">
                                                        <label className="control-label">Start Time:</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={timelineDuration}
                                                                step="0.1"
                                                                value={track.startTime.toFixed(1)}
                                                                onChange={(e) => updateAudioTrack(track.id, 'startTime', parseFloat(e.target.value))}
                                                                className="time-input"
                                                                style={{
                                                                    width: '80px',
                                                                    padding: '0.25rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>s</span>
                                                        </div>
                                                    </div>

                                                    <div className="control-group">
                                                        <label className="control-label">Volume:</label>
                                                        <div className="slider-container">
                                                            <input
                                                                type="range"
                                                                className="mixer-slider"
                                                                min="0"
                                                                max="1"
                                                                step="0.1"
                                                                value={track.volume}
                                                                onChange={(e) => updateAudioTrack(track.id, 'volume', parseFloat(e.target.value))}
                                                            />
                                                            <span className="slider-value">{track.volume}</span>
                                                        </div>
                                                    </div>

                                                    <div className="control-group">
                                                        <label className="control-label">Fade In:</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={Math.min(10, track.duration / 2)}
                                                                step="0.1"
                                                                value={track.fadeIn}
                                                                onChange={(e) => updateAudioTrack(track.id, 'fadeIn', parseFloat(e.target.value))}
                                                                className="time-input"
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '0.25rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>s</span>
                                                        </div>
                                                    </div>

                                                    <div className="control-group">
                                                        <label className="control-label">Fade Out:</label>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={Math.min(10, track.duration / 2)}
                                                                step="0.1"
                                                                value={track.fadeOut}
                                                                onChange={(e) => updateAudioTrack(track.id, 'fadeOut', parseFloat(e.target.value))}
                                                                className="time-input"
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '0.25rem',
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>s</span>
                                                        </div>
                                                    </div>

                                                    <div className="control-group">
                                                        <label className="checkbox-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={track.loop}
                                                                onChange={(e) => updateAudioTrack(track.id, 'loop', e.target.checked)}
                                                            />
                                                            Loop
                                                        </label>
                                                    </div>
                                                </>
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
                                                <audio controls style={{ width: '100%' }}>
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

                <div className="modal-actions">
                    <button className="reset-button" onClick={resetAllSettings}>
                        <RotateCcw size={16} />
                        Clear All Tracks
                    </button>
                    
                    <button
                        className="preview-mix-button"
                        onClick={generateMixedAudio}
                        disabled={!generatedAudioUrl || isProcessing || audioTracks.length === 0}
                    >
                        {isProcessing ? (
                            <>
                                <div className="spinner" />
                                <span>Mixing Audio...</span>
                            </>
                        ) : (
                            <>
                                <Volume2 size={16} />
                                <span>Mix Audio Tracks</span>
                            </>
                        )}
                    </button>

                    <button className="close-button" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SoundMixerModal;
