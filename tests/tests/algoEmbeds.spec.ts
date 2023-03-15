import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import {
    buildAddRemoveButtons,
    buildYesNoButtons,
    customButton,
} from '../../src/utils/functions/algoEmbeds.js';

describe('buildYesNoButtons', () => {
    it('returns a message action row with two buttons', () => {
        const buttonId = 'test-id';
        const result = buildYesNoButtons(buttonId);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components).toHaveLength(2);
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
        const buttonId = 'test-id';
        const buttonName = 'test-name';
        const result = buildAddRemoveButtons(buttonId, buttonName, true);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components).toHaveLength(2);
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
        const buttonId = 'test-id';
        const buttonName = 'test-name';
        const result = buildAddRemoveButtons(buttonId, buttonName);

        expect(result).toBeInstanceOf(ActionRowBuilder);
        const components = result.components;
        expect(components).toHaveLength(1);
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
        const buttonId = 'test-id';
        const buttonLabel = 'test-label';
        const result = customButton(buttonId, buttonLabel);

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
