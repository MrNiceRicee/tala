import { describe, expect, it } from "bun:test"
import { computeBordaScores, parseJudgeRanking, determineWinner, shuffleProposals } from "../../src/orchestrator/tournament"

describe("parseJudgeRanking", () => {
	it("parses valid ranking", () => {
		const result = parseJudgeRanking("Some analysis...\n\nRANK: 1st=2, 2nd=3, 3rd=1")
		expect(result).toEqual({ first: 2, second: 3, third: 1 })
	})
	it("returns null for missing ranking", () => {
		expect(parseJudgeRanking("No ranking here")).toBeNull()
	})
	it("handles ranking with extra whitespace", () => {
		const result = parseJudgeRanking("RANK: 1st = 1, 2nd = 2, 3rd = 3")
		expect(result).toEqual({ first: 1, second: 2, third: 3 })
	})
})

describe("computeBordaScores", () => {
	it("computes scores from rankings (2pts for 1st, 1pt for 2nd, 0 for 3rd)", () => {
		const rankings = [
			{ first: 1, second: 2, third: 3 },
			{ first: 1, second: 3, third: 2 },
			{ first: 2, second: 1, third: 3 },
		]
		const scores = computeBordaScores(rankings)
		expect(scores.get(1)).toBe(5)
		expect(scores.get(2)).toBe(3)
		expect(scores.get(3)).toBe(1)
	})
	it("handles unanimous rankings", () => {
		const rankings = [
			{ first: 2, second: 1, third: 3 },
			{ first: 2, second: 1, third: 3 },
			{ first: 2, second: 1, third: 3 },
		]
		const scores = computeBordaScores(rankings)
		expect(scores.get(2)).toBe(6)
		expect(scores.get(1)).toBe(3)
		expect(scores.get(3)).toBe(0)
	})
})

describe("determineWinner", () => {
	it("returns highest scoring proposal", () => {
		const scores = new Map([[1, 5], [2, 3], [3, 1]])
		expect(determineWinner(scores, 1)).toBe(1)
	})
	it("favors incumbent on tie", () => {
		const scores = new Map([[1, 3], [2, 3], [3, 3]])
		expect(determineWinner(scores, 1)).toBe(1)
	})
	it("returns non-incumbent when it scores higher", () => {
		const scores = new Map([[1, 2], [2, 5], [3, 1]])
		expect(determineWinner(scores, 1)).toBe(2)
	})
})

describe("shuffleProposals", () => {
	it("returns three proposals with original indices", () => {
		const result = shuffleProposals("A text", "B text", "AB text")
		expect(result.proposals).toHaveLength(3)
		expect(result.indexMap).toHaveLength(3)
		const texts = result.proposals
		expect(texts).toContain("A text")
		expect(texts).toContain("B text")
		expect(texts).toContain("AB text")
	})
	it("preserves index mapping", () => {
		const result = shuffleProposals("A", "B", "AB")
		for (let i = 0; i < 3; i++) {
			const originalIdx = result.indexMap[i]
			const expectedText = originalIdx === 1 ? "A" : originalIdx === 2 ? "B" : "AB"
			expect(result.proposals[i]).toBe(expectedText)
		}
	})
})
