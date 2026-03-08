import type { Options, DotType, CornerSquareType, CornerDotType } from 'qr-code-styling';

export interface QRCustomizerState {
    fgColor: string;
    bgColor: string;
    cornerSquareColor: string;
    cornerDotColor: string;
    dotStyle: DotType;
    cornerSquareStyle: CornerSquareType;
    cornerDotStyle: CornerDotType;
    logoDataUrl: string;
    useDefaultLogo: boolean;
    logoMargin: number;
    qrSize: number;
    downloadFormat: 'png' | 'svg';
}

export const DEFAULT_STATE: QRCustomizerState = {
    fgColor: '#000000',
    bgColor: '#ffffff',
    cornerSquareColor: '#000000',
    cornerDotColor: '#000000',
    dotStyle: 'square',
    cornerSquareStyle: 'square',
    cornerDotStyle: 'square',
    logoDataUrl: '',
    useDefaultLogo: false,
    logoMargin: 10,
    qrSize: 300,
    downloadFormat: 'png',
};

export interface ColorPreset {
    name: string;
    fg: string;
    bg: string;
    cornerSquare: string;
    cornerDot: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Classic',        fg: '#000000', bg: '#ffffff', cornerSquare: '#000000', cornerDot: '#000000' },
    { name: 'dURL Brand',     fg: '#8a00d4', bg: '#0a0a1a', cornerSquare: '#c95fff', cornerDot: '#00ffe0' },
    { name: 'Neon',           fg: '#00ffe0', bg: '#101023', cornerSquare: '#8a00d4', cornerDot: '#00ffe0' },
    { name: 'Ocean',          fg: '#023e8a', bg: '#90e0ef', cornerSquare: '#0077b6', cornerDot: '#023e8a' },
    { name: 'Ember',          fg: '#d62828', bg: '#fca311', cornerSquare: '#6a040f', cornerDot: '#d62828' },
    { name: 'Midnight',       fg: '#e0e0e0', bg: '#1a1a2e', cornerSquare: '#ffffff', cornerDot: '#c0c0c0' },
    { name: 'Forest',         fg: '#1b4332', bg: '#95d5b2', cornerSquare: '#2d6a4f', cornerDot: '#1b4332' },
    { name: 'Gold',           fg: '#5c4b00', bg: '#ffd60a', cornerSquare: '#8b6914', cornerDot: '#5c4b00' },
];

export const DOT_STYLES: { label: string; value: DotType }[] = [
    { label: 'Square',          value: 'square' },
    { label: 'Dots',            value: 'dots' },
    { label: 'Rounded',         value: 'rounded' },
    { label: 'Extra Rounded',   value: 'extra-rounded' },
    { label: 'Classy',          value: 'classy' },
    { label: 'Classy Rounded',  value: 'classy-rounded' },
];

export const CORNER_SQUARE_STYLES: { label: string; value: CornerSquareType }[] = [
    { label: 'Square',  value: 'square' },
    { label: 'Dot',     value: 'dot' },
    { label: 'Rounded', value: 'extra-rounded' },
];

export const CORNER_DOT_STYLES: { label: string; value: CornerDotType }[] = [
    { label: 'Square', value: 'square' },
    { label: 'Dot',    value: 'dot' },
];

export function toQROptions(state: QRCustomizerState, value: string): Options {
    const opts: Options = {
        width: state.qrSize,
        height: state.qrSize,
        data: value,
        type: 'canvas',
        margin: 5,
        qrOptions: {
            errorCorrectionLevel: 'H',
        },
        dotsOptions: {
            color: state.fgColor,
            type: state.dotStyle,
        },
        backgroundOptions: {
            color: state.bgColor,
        },
        cornersSquareOptions: {
            color: state.cornerSquareColor,
            type: state.cornerSquareStyle,
        },
        cornersDotOptions: {
            color: state.cornerDotColor,
            type: state.cornerDotStyle,
        },
    };

    opts.imageOptions = {
        crossOrigin: 'anonymous',
        margin: state.logoMargin,
        hideBackgroundDots: true,
    };

    if (state.logoDataUrl) {
        opts.image = state.logoDataUrl;
    }

    return opts;
}
