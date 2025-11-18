// RIP (RIPscrip) vector graphics format types

export interface Point {
	x: number
	y: number
}

export interface Size {
	width: number
	height: number
}

export interface Rectangle {
	x: number
	y: number
	width: number
	height: number
}

// RIP Drawing State
export interface RipState {
	color: number // Current drawing color (0-15 for EGA)
	fillColor: number // Current fill color (0-15 for EGA)
	fillStyle: FillStyle
	lineStyle: LineStyle
	fontStyle: FontStyle
	viewport: Rectangle | null
	cursor: Point // Current cursor position
	writeMode: WriteMode
	palette: number[] // Color palette (16 colors for EGA)
	textWindow: Rectangle | null
}

export enum FillStyle {
	Empty = 0,
	Solid = 1,
	Line = 2,
	LtSlash = 3,
	Slash = 4,
	BkSlash = 5,
	LtBkSlash = 6,
	Hatch = 7,
	XHatch = 8,
	Interleave = 9,
	WideDot = 10,
	CloseDot = 11,
	User = 12,
}

export enum LineStyle {
	Solid = 0,
	Dotted = 1,
	Center = 2,
	Dashed = 3,
	User = 4,
}

export enum FontStyle {
	Default = 0,
	Triplex = 1,
	Small = 2,
	SansSerif = 3,
	Gothic = 4,
	Script = 5,
	TriplexScript = 6,
	Complex = 7,
	European = 8,
	Bold = 9,
}

export enum WriteMode {
	CopyPut = 0,
	XorPut = 1,
	OrPut = 2,
	AndPut = 3,
	NotPut = 4,
}

export enum Direction {
	Horizontal = 0,
	Vertical = 1,
}

// Base RIP Command interface
export interface RipCommand {
	type: string
	opcode: string
}

// Drawing Commands
export interface RipLine extends RipCommand {
	type: 'Line'
	opcode: 'L'
	start: Point
	end: Point
}

export interface RipCircle extends RipCommand {
	type: 'Circle'
	opcode: 'C'
	center: Point
	radius: number
}

export interface RipOval extends RipCommand {
	type: 'Oval'
	opcode: 'O'
	center: Point
	radius: Size
	startAngle: number
	endAngle: number
}

export interface RipArc extends RipCommand {
	type: 'Arc'
	opcode: 'A'
	center: Point
	radius: number
	startAngle: number
	endAngle: number
}

export interface RipPolygon extends RipCommand {
	type: 'Polygon'
	opcode: 'P'
	points: Point[]
}

export interface RipPolyLine extends RipCommand {
	type: 'PolyLine'
	opcode: 'l'
	points: Point[]
}

export interface RipBar extends RipCommand {
	type: 'Bar'
	opcode: 'B'
	rect: Rectangle
}

export interface RipDrawRectangle extends RipCommand {
	type: 'DrawRectangle'
	opcode: 'R'
	rect: Rectangle
}

export interface RipBezier extends RipCommand {
	type: 'Bezier'
	opcode: 'Z'
	points: Point[]
	segments: number
}

export interface RipPixel extends RipCommand {
	type: 'Pixel'
	opcode: 'X'
	point: Point
}

export interface RipFill extends RipCommand {
	type: 'Fill'
	opcode: 'F'
	point: Point
	border: number
}

export interface RipFilledPolygon extends RipCommand {
	type: 'FilledPolygon'
	opcode: 'p'
	points: Point[]
}

export interface RipFilledOval extends RipCommand {
	type: 'FilledOval'
	opcode: 'o'
	center: Point
	radius: Size
}

export interface RipPieSlice extends RipCommand {
	type: 'PieSlice'
	opcode: 'I'
	center: Point
	radius: number
	startAngle: number
	endAngle: number
}

export interface RipOvalPieSlice extends RipCommand {
	type: 'OvalPieSlice'
	opcode: 'i'
	center: Point
	radius: Size
	startAngle: number
	endAngle: number
}

export interface RipOvalArc extends RipCommand {
	type: 'OvalArc'
	opcode: 'V'
	center: Point
	radius: Size
	startAngle: number
	endAngle: number
}

// State Commands
export interface RipColor extends RipCommand {
	type: 'Color'
	opcode: 'c'
	value: number
}

export interface RipFillStyle extends RipCommand {
	type: 'FillStyle'
	opcode: 'S'
	style: FillStyle
	color: number
}

export interface RipLineStyle extends RipCommand {
	type: 'LineStyle'
	opcode: '='
	style: LineStyle
	pattern: number
	thickness: number
}

export interface RipFontStyle extends RipCommand {
	type: 'FontStyle'
	opcode: 'Y'
	font: FontStyle
	direction: Direction
	characterSize: number
}

export interface RipViewPort extends RipCommand {
	type: 'ViewPort'
	opcode: 'v'
	rect: Rectangle
}

export interface RipGotoXY extends RipCommand {
	type: 'GotoXY'
	opcode: 'g'
	point: Point
}

export interface RipMove extends RipCommand {
	type: 'Move'
	opcode: 'm'
	point: Point
}

export interface RipHome extends RipCommand {
	type: 'Home'
	opcode: 'H'
}

export interface RipWriteMode extends RipCommand {
	type: 'WriteMode'
	opcode: 'W'
	mode: WriteMode
}

export interface RipSetPalette extends RipCommand {
	type: 'SetPalette'
	opcode: 'Q'
	palette: number[]
}

export interface RipOnePalette extends RipCommand {
	type: 'OnePalette'
	opcode: 'a'
	color: number
	palette: number
}

export interface RipFillPattern extends RipCommand {
	type: 'FillPattern'
	opcode: 's'
	pattern: number[]
	color: number
}

// Text Commands
export interface RipBeginText extends RipCommand {
	type: 'BeginText'
	opcode: '1T'
	rect: Rectangle
	flags: number
}

export interface RipEndText extends RipCommand {
	type: 'EndText'
	opcode: '1E'
}

export interface RipOutText extends RipCommand {
	type: 'OutText'
	opcode: 'T'
	text: string
}

export interface RipOutTextXY extends RipCommand {
	type: 'OutTextXY'
	opcode: '@'
	point: Point
	text: string
}

export interface RipRegionText extends RipCommand {
	type: 'RegionText'
	opcode: '1t'
	rect: Rectangle
	text: string
}

export interface RipTextWindow extends RipCommand {
	type: 'TextWindow'
	opcode: 'w'
	rect: Rectangle
	wrap: number // 0 = no wrap, 1 = wrap
	size: number // Font size: 0-4
}

// Interactive Commands
export interface RipButton extends RipCommand {
	type: 'Button'
	opcode: 'U'
	rect: Rectangle
	hotKey: number
	flags: number
	text: string
}

export interface RipButtonStyle extends RipCommand {
	type: 'ButtonStyle'
	opcode: '1B'
	// Complex structure with many fields
}

export interface RipMouse extends RipCommand {
	type: 'Mouse'
	opcode: 'M'
	enabled: boolean
}

export interface RipKillMouseFields extends RipCommand {
	type: 'KillMouseFields'
	opcode: '1K'
}

// Erase Commands
export interface RipEraseEOL extends RipCommand {
	type: 'EraseEOL'
	opcode: '>'
}

export interface RipEraseView extends RipCommand {
	type: 'EraseView'
	opcode: 'E'
}

export interface RipEraseWindow extends RipCommand {
	type: 'EraseWindow'
	opcode: 'e'
	// No parameters - clears text window to current background color
}

export interface RipResetWindows extends RipCommand {
	type: 'ResetWindows'
	opcode: '*'
}

// Image Commands
export interface RipGetImage extends RipCommand {
	type: 'GetImage'
	opcode: '1C'
	rect: Rectangle
	id: number
}

export interface RipPutImage extends RipCommand {
	type: 'PutImage'
	opcode: '1P'
	point: Point
	writeMode: WriteMode
	id: number
}

export interface RipLoadIcon extends RipCommand {
	type: 'LoadIcon'
	opcode: '1I'
	point: Point
	id: number
	flags: number
	filename: string
}

export interface RipWriteIcon extends RipCommand {
	type: 'WriteIcon'
	opcode: '1W'
	point: Point
	id: number
}

// Union type for all RIP commands
export type AnyRipCommand =
	| RipLine
	| RipCircle
	| RipOval
	| RipArc
	| RipPolygon
	| RipPolyLine
	| RipBar
	| RipDrawRectangle
	| RipBezier
	| RipPixel
	| RipFill
	| RipFilledPolygon
	| RipFilledOval
	| RipPieSlice
	| RipOvalPieSlice
	| RipOvalArc
	| RipColor
	| RipFillStyle
	| RipLineStyle
	| RipFontStyle
	| RipViewPort
	| RipGotoXY
	| RipMove
	| RipHome
	| RipWriteMode
	| RipSetPalette
	| RipOnePalette
	| RipFillPattern
	| RipBeginText
	| RipEndText
	| RipOutText
	| RipOutTextXY
	| RipRegionText
	| RipTextWindow
	| RipButton
	| RipButtonStyle
	| RipMouse
	| RipKillMouseFields
	| RipEraseEOL
	| RipEraseView
	| RipEraseWindow
	| RipResetWindows
	| RipGetImage
	| RipPutImage
	| RipLoadIcon
	| RipWriteIcon

// Parser result
export interface RipParseResult {
	commands: AnyRipCommand[]
	width: number
	height: number
	state: RipState // Backwards-compat alias for initialState
	initialState: RipState
	finalState: RipState
}

