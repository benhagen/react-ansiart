/**
 * SAUCE (Standard Architecture for Universal Comment Extensions) metadata
 * Provides file information, dimensions, and comments for ANSI art files
 */
type SauceMetadata = {
    /** Should be "SAUCE" */
    id: string;
    /** SAUCE version number */
    version: number;
    /** Title of the artwork */
    title: string;
    /** Author name */
    author: string;
    /** Group/organization name */
    group: string;
    /** Date in YYYYMMDD format */
    date: string;
    /** Original file size */
    fileSize: number;
    /** Data type (0=text, 1=character art) */
    dataType: number;
    /** File type (0=ASCII, 1=ANSI, 2=Ansimation, etc.) */
    fileType: number;
    /** Type-specific info 1 (width for ANSI files) */
    tInfo1: number;
    /** Type-specific info 2 (height for ANSI files) */
    tInfo2: number;
    /** Type-specific info 3 (font ID for ANSI files) */
    tInfo3: number;
    /** Type-specific info 4 (flags/aspect ratio for ANSI files) */
    tInfo4: number;
    /** Number of comment lines */
    comments: number;
    /** Type flags (ICE colors, letter spacing, etc.) */
    tFlags: number;
    /** Type-specific info string (22 bytes, zero-terminated) */
    tInfoS?: string;
    /** Comment lines (each up to 64 characters) */
    commentLines: string[];
};
declare const SAUCE_TRAILER_SIZE = 128;
declare const SAUCE_EOF = 26;
declare const COMMENT_SIZE = 64;
declare const COMMENT_ID_SIZE = 5;
/**
 * Check if bytes contain a SAUCE trailer
 */
declare function isSauceTrailer(bytes: Uint8Array): boolean;
/**
 * Parse SAUCE metadata from the 128-byte trailer
 * Follows PabloDraw's implementation
 * Returns undefined if no valid SAUCE data found
 */
declare function parseSauce(bytes: Uint8Array): SauceMetadata | undefined;
/**
 * Enhanced SAUCE metadata interpretation
 */
declare function getSauceInfo(sauce: SauceMetadata | undefined): {
    fileTypeDescription: string;
    hasDimensions: boolean;
    width: number | undefined;
    height: number | undefined;
    fontName: string | undefined;
    iceColors: boolean;
    letterSpacing: boolean;
    aspectRatio: {
        width: number;
        height: number;
    } | undefined;
    /** Should be "SAUCE" */
    id: string;
    /** SAUCE version number */
    version: number;
    /** Title of the artwork */
    title: string;
    /** Author name */
    author: string;
    /** Group/organization name */
    group: string;
    /** Date in YYYYMMDD format */
    date: string;
    /** Original file size */
    fileSize: number;
    /** Data type (0=text, 1=character art) */
    dataType: number;
    /** File type (0=ASCII, 1=ANSI, 2=Ansimation, etc.) */
    fileType: number;
    /** Type-specific info 1 (width for ANSI files) */
    tInfo1: number;
    /** Type-specific info 2 (height for ANSI files) */
    tInfo2: number;
    /** Type-specific info 3 (font ID for ANSI files) */
    tInfo3: number;
    /** Type-specific info 4 (flags/aspect ratio for ANSI files) */
    tInfo4: number;
    /** Number of comment lines */
    comments: number;
    /** Type flags (ICE colors, letter spacing, etc.) */
    tFlags: number;
    /** Type-specific info string (22 bytes, zero-terminated) */
    tInfoS?: string;
    /** Comment lines (each up to 64 characters) */
    commentLines: string[];
} | null;

export { COMMENT_ID_SIZE, COMMENT_SIZE, SAUCE_EOF, SAUCE_TRAILER_SIZE, type SauceMetadata, getSauceInfo, isSauceTrailer, parseSauce };
