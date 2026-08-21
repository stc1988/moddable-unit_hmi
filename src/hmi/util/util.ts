export function integerInRange(value: number, name: string, minimum: number, maximum: number): number {
	if (!Number.isInteger(value) || value < minimum || value > maximum)
		throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
	return value;
}
