import { CircularBuffer } from '../../src/utils/classes/circular-buffer.js';
describe('CircularBuffer', () => {
    describe('enqueue', () => {
        it('should enqueue an item into the buffer', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            buffer.enqueue(1);

            // Assert
            expect(buffer.dequeue()).toBe(1);
        });

        it('should enqueue multiple items into the buffer', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Assert
            expect(buffer.dequeue()).toBe(1);
            expect(buffer.dequeue()).toBe(2);
            expect(buffer.dequeue()).toBe(3);
        });

        it('should overwrite oldest item when buffer is full', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);
            buffer.enqueue(4);

            // Assert
            expect(buffer.dequeue()).toBe(2);
            expect(buffer.dequeue()).toBe(3);
            expect(buffer.dequeue()).toBe(4);
        });
    });

    describe('dequeue', () => {
        it('should dequeue the oldest item from the buffer', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Act
            const item = buffer.dequeue();

            // Assert
            expect(item).toBe(1);
        });

        it('should return undefined when buffer is empty', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            const item = buffer.dequeue();

            // Assert
            expect(item).toBeUndefined();
        });
    });

    describe('isEmpty', () => {
        it('should return true when buffer is empty', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            const empty = buffer.isEmpty();

            // Assert
            expect(empty).toBe(true);
        });

        it('should return false when buffer is not empty', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);

            // Act
            const empty = buffer.isEmpty();

            // Assert
            expect(empty).toBe(false);
        });
    });
    describe('isFull', () => {
        it('should return true when buffer is full', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Act
            const full = buffer.isFull();

            // Assert
            expect(full).toBe(true);
        });

        it('should return false when buffer is not full', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);

            // Act
            const full = buffer.isFull();

            // Assert
            expect(full).toBe(false);
        });
    });

    describe('peek', () => {
        it('should return the next item in the buffer without dequeuing it', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Act
            const item = buffer.peek();

            // Assert
            expect(item).toBe(1);
            expect(buffer.peek()).toBe(1);
        });

        it('should return undefined when buffer is empty', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            const item = buffer.peek();

            // Assert
            expect(item).toBeUndefined();
        });
    });

    describe('clear', () => {
        it('should clear the buffer', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Act
            buffer.clear();

            // Assert
            expect(buffer.isEmpty()).toBe(true);
            expect(buffer.isFull()).toBe(false);
            expect(buffer.peek()).toBeUndefined();
            expect(buffer.dequeue()).toBeUndefined();
        });
    });

    describe('toArray', () => {
        it('should convert the buffer to an array', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            buffer.enqueue(1);
            buffer.enqueue(2);
            buffer.enqueue(3);

            // Act
            const array = buffer.toArray();

            // Assert
            expect(array).toEqual([1, 2, 3]);
        });

        it('should return an empty array when buffer is empty', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);

            // Act
            const array = buffer.toArray();

            // Assert
            expect(array).toEqual([]);
        });
    });
    describe('fromArray', () => {
        it('should enqueue items from an array into the buffer', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            const array = [1, 2, 3];

            // Act
            buffer.fromArray(array);

            // Assert
            expect(buffer.dequeue()).toBe(1);
            expect(buffer.dequeue()).toBe(2);
            expect(buffer.dequeue()).toBe(3);
        });

        it('should enqueue items from an empty array', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            const array: number[] = [];

            // Act
            buffer.fromArray(array);

            // Assert
            expect(buffer.isEmpty()).toBe(true);
        });

        it('should enqueue items from an array larger than the buffer size', () => {
            // Arrange
            const buffer = new CircularBuffer<number>(3);
            const array = [1, 2, 3, 4, 5];

            // Act
            buffer.fromArray(array);

            // Assert
            expect(buffer.dequeue()).toBe(3);
            expect(buffer.dequeue()).toBe(4);
            expect(buffer.dequeue()).toBe(5);
        });
    });
});