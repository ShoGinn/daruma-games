export class CircularBuffer<T> {
	private buffer: Array<T | undefined>;
	private head: number;
	private tail: number;
	private size: number;
	private count: number;

	constructor(size: number) {
		this.buffer = Array.from({ length: size });
		this.head = 0;
		this.tail = 0;
		this.size = size;
		this.count = 0;
	}

	enqueue(item: T): void {
		if (this.count === this.size) {
			this.head = (this.head + 1) % this.size;
		} else {
			this.count++;
		}
		this.buffer[this.tail] = item;
		this.tail = (this.tail + 1) % this.size;
	}

	dequeue(): T | undefined {
		if (this.count === 0) {
			return undefined;
		}
		const item = this.buffer[this.head];
		this.buffer[this.head] = undefined;
		this.head = (this.head + 1) % this.size;
		this.count--;
		return item;
	}

	isEmpty(): boolean {
		return this.count === 0;
	}
	isFull(): boolean {
		return this.count === this.size;
	}

	peek(): T | undefined {
		if (this.count === 0) {
			return undefined;
		}
		return this.buffer[this.head];
	}

	clear(): void {
		this.head = 0;
		this.tail = 0;
		this.count = 0;
	}

	toArray(): T[] {
		const result: T[] = [];
		for (let index = 0; index < this.count; index++) {
			result.push(this.buffer[(this.head + index) % this.size] as T);
		}
		return result;
	}
	fromArray(array: T[]): void {
		for (const item of array) this.enqueue(item);
	}
}
