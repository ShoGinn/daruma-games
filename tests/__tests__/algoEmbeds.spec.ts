import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import {
    buildAddRemoveButtons,
    buildYesNoButtons,
    customButton,
} from '../../src/utils/functions/algoEmbeds.js';

describe('buildYesNoButtons', () => {
    it('returns a message action row with two buttons', () => {
        const btnId = 'test-id';
        const result = buildYesNoButtons(btnId);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components.length).toBe(2);
        expect(components[0]).toBeInstanceOf(ButtonBuilder);
        expect(components[0].toJSON()).toEqual({
            custom_id: 'simple-yes_test-id',
            emoji: { animated: false, id: undefined, name: '✅' },
            style: ButtonStyle.Primary,
            type: 2,
        });
        expect(components[1].toJSON()).toEqual({
            custom_id: 'simple-no_test-id',
            emoji: { animated: false, id: undefined, name: '❌' },
            style: ButtonStyle.Secondary,
            type: 2,
        });
    });
});
describe('buildAddRemoveButtons', () => {
    it('returns a message action row with two buttons', () => {
        const btnId = 'test-id';
        const btnName = 'test-name';
        const result = buildAddRemoveButtons(btnId, btnName, true);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components.length).toBe(2);
        expect(components[0]).toBeInstanceOf(ButtonBuilder);
        expect(components[0].toJSON()).toEqual({
            custom_id: 'simple-add-test-name_test-id',
            emoji: {
                animated: false,
                id: undefined,
                name: '➕',
            },
            style: ButtonStyle.Primary,
            type: 2,
        });
        expect(components[1].toJSON()).toEqual({
            custom_id: 'simple-remove-test-name_test-id',
            emoji: {
                animated: false,
                id: undefined,
                name: '➖',
            },
            style: ButtonStyle.Danger,
            type: 2,
        });
    });
    it('returns a message action row with one', () => {
        const btnId = 'test-id';
        const btnName = 'test-name';
        const result = buildAddRemoveButtons(btnId, btnName);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components.length).toBe(1);
        expect(components[0]).toBeInstanceOf(ButtonBuilder);
        expect(components[0].toJSON()).toEqual({
            custom_id: 'simple-add-test-name_test-id',
            emoji: {
                animated: false,
                id: undefined,
                name: '➕',
            },
            style: ButtonStyle.Primary,
            type: 2,
        });
        expect(components[1]).toBeUndefined();
    });
});
describe('buildCustomButton', () => {
    it('returns a button builder', () => {
        const btnId = 'test-id';
        const btnLabel = 'test-label';
        const result = customButton(btnId, btnLabel);

        expect(result).toBeInstanceOf(ButtonBuilder);
        expect(result.toJSON()).toEqual({
            custom_id: 'custom-button_test-id',
            emoji: undefined,
            label: 'test-label',
            style: ButtonStyle.Secondary,
            type: 2,
        });
    });
});
