// Perlin noise implementation
// Based on Ken Perlin's original algorithm

// Standard permutation table (from Ken Perlin's reference implementation)
const p: number[] = [
	151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
	8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203,
	117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165,
	71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92,
	41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
	89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
	226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
	17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155,
	167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218,
	246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
	239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
	254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
]

// Double the permutation table for easy wrapping
const perm: number[] = []
for (let i = 0; i < 512; i++) {
	perm[i] = p[i & 255]
}

// Gradient vectors for 2D
const grad2: Array<[number, number]> = [
	[1, 1],
	[-1, 1],
	[1, -1],
	[-1, -1],
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
]

// Gradient vectors for 3D
const grad3: Array<[number, number, number]> = [
	[1, 1, 0],
	[-1, 1, 0],
	[1, -1, 0],
	[-1, -1, 0],
	[1, 0, 1],
	[-1, 0, 1],
	[1, 0, -1],
	[-1, 0, -1],
	[0, 1, 1],
	[0, -1, 1],
	[0, 1, -1],
	[0, -1, -1],
	[1, 1, 0],
	[-1, 1, 0],
	[0, -1, 1],
	[0, -1, -1],
]

function fade(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
	return a + t * (b - a)
}

function dot2d(gx: number, gy: number, x: number, y: number): number {
	return gx * x + gy * y
}

function dot3d(gx: number, gy: number, gz: number, x: number, y: number, z: number): number {
	return gx * x + gy * y + gz * z
}

/**
 * 2D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @returns Noise value between -1 and 1 (typically normalized to 0-1)
 */
export function perlinNoise2D(x: number, y: number): number {
	// Find unit grid cell containing point
	const X = Math.floor(x) & 255
	const Y = Math.floor(y) & 255

	// Get relative x,y coordinates of point within that cell
	x -= Math.floor(x)
	y -= Math.floor(y)

	// Compute fade curves for each of x,y
	const u = fade(x)
	const v = fade(y)

	// Hash coordinates of the 4 square corners
	const A = perm[X] + Y
	const AA = perm[A]
	const AB = perm[A + 1]
	const B = perm[X + 1] + Y
	const BA = perm[B]
	const BB = perm[B + 1]

	// And add blended results from 4 corners of the square
	const gradAA = grad2[AA % grad2.length]
	const gradAB = grad2[AB % grad2.length]
	const gradBA = grad2[BA % grad2.length]
	const gradBB = grad2[BB % grad2.length]

	const n00 = dot2d(gradAA[0], gradAA[1], x, y)
	const n10 = dot2d(gradBA[0], gradBA[1], x - 1, y)
	const n01 = dot2d(gradAB[0], gradAB[1], x, y - 1)
	const n11 = dot2d(gradBB[0], gradBB[1], x - 1, y - 1)

	const n0 = lerp(n00, n10, u)
	const n1 = lerp(n01, n11, u)

	return lerp(n0, n1, v)
}

/**
 * 3D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Z coordinate
 * @returns Noise value between -1 and 1 (typically normalized to 0-1)
 */
export function perlinNoise3D(x: number, y: number, z: number): number {
	// Find unit grid cell containing point
	const X = Math.floor(x) & 255
	const Y = Math.floor(y) & 255
	const Z = Math.floor(z) & 255

	// Get relative x,y,z coordinates of point within that cell
	x -= Math.floor(x)
	y -= Math.floor(y)
	z -= Math.floor(z)

	// Compute fade curves for each of x,y,z
	const u = fade(x)
	const v = fade(y)
	const w = fade(z)

	// Hash coordinates of the 8 cube corners
	const A = perm[X] + Y
	const AA = perm[A] + Z
	const AB = perm[A + 1] + Z
	const B = perm[X + 1] + Y
	const BA = perm[B] + Z
	const BB = perm[B + 1] + Z

	// And add blended results from 8 corners of the cube
	const grad000 = grad3[perm[AA] % grad3.length]
	const grad001 = grad3[perm[AA + 1] % grad3.length]
	const grad100 = grad3[perm[BA] % grad3.length]
	const grad101 = grad3[perm[BA + 1] % grad3.length]
	const grad010 = grad3[perm[AB] % grad3.length]
	const grad011 = grad3[perm[AB + 1] % grad3.length]
	const grad110 = grad3[perm[BB] % grad3.length]
	const grad111 = grad3[perm[BB + 1] % grad3.length]

	const n000 = dot3d(grad000[0], grad000[1], grad000[2], x, y, z)
	const n100 = dot3d(grad100[0], grad100[1], grad100[2], x - 1, y, z)
	const n010 = dot3d(grad010[0], grad010[1], grad010[2], x, y - 1, z)
	const n110 = dot3d(grad110[0], grad110[1], grad110[2], x - 1, y - 1, z)
	const n001 = dot3d(grad001[0], grad001[1], grad001[2], x, y, z - 1)
	const n101 = dot3d(grad101[0], grad101[1], grad101[2], x - 1, y, z - 1)
	const n011 = dot3d(grad011[0], grad011[1], grad011[2], x, y - 1, z - 1)
	const n111 = dot3d(grad111[0], grad111[1], grad111[2], x - 1, y - 1, z - 1)

	const n00 = lerp(n000, n100, u)
	const n10 = lerp(n010, n110, u)
	const n01 = lerp(n001, n101, u)
	const n11 = lerp(n011, n111, u)

	const n0 = lerp(n00, n10, v)
	const n1 = lerp(n01, n11, v)

	return lerp(n0, n1, w)
}

/**
 * 2D or 3D Perlin noise
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Optional Z coordinate for 3D noise
 * @returns Noise value between -1 and 1
 */
export function perlinNoise(x: number, y: number, z?: number): number {
	if (z !== undefined) {
		return perlinNoise3D(x, y, z)
	}
	return perlinNoise2D(x, y)
}
