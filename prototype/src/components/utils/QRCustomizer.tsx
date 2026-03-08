import { useCallback, useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { useDebounce } from 'hooks/useDebounce';
import {
    QRCustomizerState, DEFAULT_STATE,
    COLOR_PRESETS, DOT_STYLES, CORNER_SQUARE_STYLES, CORNER_DOT_STYLES,
    toQROptions,
} from './qrPresets';
import { QR_DEBOUNCE_MS, QR_LOGO_MAX_BYTES, QR_SIZE_MIN, QR_SIZE_MAX } from 'config';

type Tab = 'style' | 'logo' | 'export';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

interface QRCustomizerProps {
    value: string;
}

function QRCustomizer({ value }: QRCustomizerProps) {
    const [state, setState] = useState<QRCustomizerState>(DEFAULT_STATE);
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('style');
    const [dragOver, setDragOver] = useState(false);
    const [logoError, setLogoError] = useState('');

    const qrRef = useRef<HTMLDivElement>(null);
    const qrInstance = useRef<QRCodeStyling | null>(null);
    const prevHadLogo = useRef(false);
    const debounced = useDebounce(state, QR_DEBOUNCE_MS);

    // Create QR instance once, append to the ref div
    useEffect(() => {
        const qr = new QRCodeStyling(toQROptions(DEFAULT_STATE, value));
        qrInstance.current = qr;
        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qr.append(qrRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update QR whenever debounced state or value changes
    // Recreate instance when logo is removed since .update() can't clear the image
    useEffect(() => {
        if (!qrRef.current) return;
        const opts = toQROptions(debounced, value);
        const hasLogo = !!debounced.logoDataUrl;
        const logoRemoved = prevHadLogo.current && !hasLogo;
        prevHadLogo.current = hasLogo;

        if (qrInstance.current && !logoRemoved) {
            qrInstance.current.update(opts);
        } else {
            const qr = new QRCodeStyling(opts);
            qrInstance.current = qr;
            qrRef.current.innerHTML = '';
            qr.append(qrRef.current);
        }
    }, [debounced, value]);

    const update = useCallback(<K extends keyof QRCustomizerState>(key: K, val: QRCustomizerState[K]) => {
        setState(s => ({ ...s, [key]: val }));
    }, []);

    const applyPreset = useCallback((preset: typeof COLOR_PRESETS[number]) => {
        setState(s => ({
            ...s,
            fgColor: preset.fg,
            bgColor: preset.bg,
            cornerSquareColor: preset.cornerSquare,
            cornerDotColor: preset.cornerDot,
        }));
    }, []);

    const processLogoFile = useCallback((file: File) => {
        setLogoError('');
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setLogoError('Accepted formats: PNG, JPEG, SVG, WebP');
            return;
        }
        if (file.size > QR_LOGO_MAX_BYTES) {
            setLogoError('Logo must be under 512 KB');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setState(s => ({ ...s, logoDataUrl: reader.result as string, useDefaultLogo: false }));
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processLogoFile(file);
    }, [processLogoFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processLogoFile(file);
    }, [processLogoFile]);

    const removeLogo = useCallback(() => {
        setState(s => ({ ...s, logoDataUrl: '', useDefaultLogo: false }));
        setLogoError('');
    }, []);

    const restoreDefaultLogo = useCallback(() => {
        fetch(`${process.env.PUBLIC_URL}/durl_logo.png`)
            .then(r => r.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => {
                    setState(s => ({ ...s, logoDataUrl: reader.result as string, useDefaultLogo: true }));
                };
                reader.readAsDataURL(blob);
            })
            .catch(() => setLogoError('Could not load default logo'));
    }, []);

    const handleDownload = useCallback(() => {
        if (!qrInstance.current) return;
        const slug = value.split('/').pop() || 'qr';
        qrInstance.current.download({
            name: slug,
            extension: state.downloadFormat,
        });
    }, [value, state.downloadFormat]);

    const resetDefaults = useCallback(() => {
        setState(DEFAULT_STATE);
    }, []);

    return (
        <div className={`qr-wrapper ${expanded ? 'qr-wrapper--expanded' : ''}`}>
            {/* Preview — always mounted so qrRef stays alive */}
            <div className="qr-preview">
                <div ref={qrRef} className="qr-preview-canvas" />
                <div className="qr-preview-actions">
                    <button className="btn btn-outline-light btn-sm" onClick={handleDownload}>
                        <i className="fas fa-download" /> Download {expanded ? state.downloadFormat.toUpperCase() : ''}
                    </button>
                    <button
                        className="btn btn-outline-light btn-sm"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded
                            ? <><i className="fas fa-compress-alt" /> Simple</>
                            : <><i className="fas fa-sliders-h" /> Customize</>
                        }
                    </button>
                </div>
            </div>

            {/* Controls — only shown when expanded */}
            {expanded && (
                <div className="qr-controls">
                    <div className="qr-tabs">
                        {(['style', 'logo', 'export'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                className={`qr-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                <i className={`fas fa-${tab === 'style' ? 'palette' : tab === 'logo' ? 'image' : 'download'}`} />
                                {' '}{tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="qr-tab-content">
                        {activeTab === 'style' && (
                            <>
                                <label className="qr-section-label">Color Presets</label>
                                <div className="qr-color-presets">
                                    {COLOR_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            className={`qr-preset-swatch ${state.fgColor === p.fg && state.bgColor === p.bg ? 'active' : ''}`}
                                            onClick={() => applyPreset(p)}
                                            title={p.name}
                                        >
                                            <span className="swatch-half swatch-half--left" style={{ backgroundColor: p.fg }} />
                                            <span className="swatch-half swatch-half--right" style={{ backgroundColor: p.bg }} />
                                        </button>
                                    ))}
                                </div>

                                <label className="qr-section-label">Custom Colors</label>
                                <div className="qr-color-inputs">
                                    <div className="qr-color-input">
                                        <input type="color" value={state.fgColor} onChange={e => update('fgColor', e.target.value)} />
                                        <span>Foreground</span>
                                    </div>
                                    <div className="qr-color-input">
                                        <input type="color" value={state.bgColor} onChange={e => update('bgColor', e.target.value)} />
                                        <span>Background</span>
                                    </div>
                                    <div className="qr-color-input">
                                        <input type="color" value={state.cornerSquareColor} onChange={e => update('cornerSquareColor', e.target.value)} />
                                        <span>Corner Outer</span>
                                    </div>
                                    <div className="qr-color-input">
                                        <input type="color" value={state.cornerDotColor} onChange={e => update('cornerDotColor', e.target.value)} />
                                        <span>Corner Inner</span>
                                    </div>
                                </div>

                                <label className="qr-section-label">Dot Style</label>
                                <div className="qr-style-grid">
                                    {DOT_STYLES.map(s => (
                                        <button
                                            key={s.value}
                                            className={`qr-style-btn ${state.dotStyle === s.value ? 'active' : ''}`}
                                            onClick={() => update('dotStyle', s.value)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>

                                <label className="qr-section-label">Corner Square Style</label>
                                <div className="qr-style-grid">
                                    {CORNER_SQUARE_STYLES.map(s => (
                                        <button
                                            key={s.value}
                                            className={`qr-style-btn ${state.cornerSquareStyle === s.value ? 'active' : ''}`}
                                            onClick={() => update('cornerSquareStyle', s.value)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>

                                <label className="qr-section-label">Corner Dot Style</label>
                                <div className="qr-style-grid">
                                    {CORNER_DOT_STYLES.map(s => (
                                        <button
                                            key={s.value}
                                            className={`qr-style-btn ${state.cornerDotStyle === s.value ? 'active' : ''}`}
                                            onClick={() => update('cornerDotStyle', s.value)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeTab === 'logo' && (
                            <>
                                <label className="qr-section-label">Logo</label>
                                <div className="qr-logo-options">
                                    <button
                                        className={`qr-style-btn ${state.useDefaultLogo ? 'active' : ''}`}
                                        onClick={restoreDefaultLogo}
                                    >
                                        <i className="fas fa-star" /> dURL Logo
                                    </button>
                                    <button
                                        className={`qr-style-btn ${!state.useDefaultLogo && state.logoDataUrl ? 'active' : ''}`}
                                        onClick={() => document.getElementById('qr-logo-input')?.click()}
                                    >
                                        <i className="fas fa-upload" /> Custom
                                    </button>
                                    <button
                                        className={`qr-style-btn ${!state.logoDataUrl ? 'active' : ''}`}
                                        onClick={removeLogo}
                                    >
                                        <i className="fas fa-ban" /> None
                                    </button>
                                </div>

                                <div
                                    className={`qr-logo-dropzone ${dragOver ? 'drag-over' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('qr-logo-input')?.click()}
                                >
                                    <input
                                        id="qr-logo-input"
                                        type="file"
                                        accept={ACCEPTED_TYPES.join(',')}
                                        onChange={handleFileInput}
                                        style={{ display: 'none' }}
                                    />
                                    {state.logoDataUrl && !state.useDefaultLogo ? (
                                        <img src={state.logoDataUrl} alt="Logo preview" className="qr-logo-thumb" />
                                    ) : (
                                        <>
                                            <i className="fas fa-cloud-upload-alt" />
                                            <p>Drag & drop or click to upload</p>
                                            <span className="small text-muted">PNG, JPEG, SVG, WebP — max 512 KB</span>
                                        </>
                                    )}
                                </div>
                                {logoError && <p className="qr-logo-error">{logoError}</p>}

                                <label className="qr-section-label">Logo Margin</label>
                                <div className="qr-range-row">
                                    <input
                                        type="range"
                                        className="qr-size-slider"
                                        min={0}
                                        max={20}
                                        value={state.logoMargin}
                                        onChange={e => update('logoMargin', Number(e.target.value))}
                                    />
                                    <span className="qr-range-value">{state.logoMargin}px</span>
                                </div>
                            </>
                        )}

                        {activeTab === 'export' && (
                            <>
                                <label className="qr-section-label">Format</label>
                                <div className="qr-format-toggle">
                                    <button
                                        className={`qr-style-btn ${state.downloadFormat === 'png' ? 'active' : ''}`}
                                        onClick={() => update('downloadFormat', 'png')}
                                    >
                                        PNG
                                    </button>
                                    <button
                                        className={`qr-style-btn ${state.downloadFormat === 'svg' ? 'active' : ''}`}
                                        onClick={() => update('downloadFormat', 'svg')}
                                    >
                                        SVG
                                    </button>
                                </div>

                                <label className="qr-section-label">Size</label>
                                <div className="qr-range-row">
                                    <input
                                        type="range"
                                        className="qr-size-slider"
                                        min={QR_SIZE_MIN}
                                        max={QR_SIZE_MAX}
                                        step={50}
                                        value={state.qrSize}
                                        onChange={e => update('qrSize', Number(e.target.value))}
                                    />
                                    <span className="qr-range-value">{state.qrSize}px</span>
                                </div>

                                <div className="qr-download-section">
                                    <button className="btn btn-outline-light qr-reset-btn" onClick={resetDefaults}>
                                        <i className="fas fa-undo" /> Reset to Defaults
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default QRCustomizer;
